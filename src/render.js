// ---------- رندر نقشه: زمین نقاشی‌شده، مُدها، ذرات، ارتش‌ها ----------
import { clamp, lerp, mulberry32, smoothstep } from './utils.js';
import { BUILDINGS, TERRAIN, POP_CLASSES } from './data.js';
import { REBEL, atWar, warHas } from './sim.js';
import { CULTURES, RELIGIONS } from './society.js';
import { SHIP_CLASSES, totalShips, fleetPower, zoneOf } from './naval.js';
import { factionsOf } from './dynasty.js';
import { LANDMARKS, RARE_RES } from './world.js';
import { powerScore } from './greatpower.js';

// ---------- فصل‌ها: رنگ‌آمیزی و حال‌وهوای جهان در طول سال ----------
export const SEASONS = [
  { id: 'spring', name: 'بهار',  icon: '🌸', tint: [  6,  14,  -6], warmth: 0.10, snow: 0.00, haze: 0.05 },
  { id: 'summer', name: 'تابستان', icon: '☀️', tint: [ 18,  10, -16], warmth: 0.20, snow: 0.00, haze: 0.12 },
  { id: 'autumn', name: 'پاییز', icon: '🍂', tint: [ 22,  -2, -18], warmth: 0.14, snow: 0.02, haze: 0.09 },
  { id: 'winter', name: 'زمستان', icon: '❄️', tint: [-10,  -6,  10], warmth: -0.18, snow: 0.55, haze: 0.16 },
];
export function seasonOfWeek(week) {
  // هفته ۰ = اوایل ژانویه ⇒ زمستان
  const w = ((week % 52) + 52) % 52;
  if (w < 9 || w >= 48) return 3;   // زمستان
  if (w < 22) return 0;             // بهار
  if (w < 35) return 1;             // تابستان
  return 2;                         // پاییز
}

const SEA_DEEP_A = [26, 45, 71], SEA_SHAL = [58, 98, 132];
const PAL = {
  beach: [214, 190, 140],
  desert: [206, 172, 108],
  plains: [148, 168, 96],
  forest: [92, 128, 74],
  hills: [140, 140, 96],
  mountain: [158, 156, 148],
  wetland: [110, 148, 108],
  snow: [232, 234, 230],
};

export class MapRenderer {
  constructor() {
    this.cam = { x: 0, y: 0, z: 0.55 };
    this.GW = 0; this.GH = 0; this.CELL = 10; this.W = 0; this.H = 0;
    this.dirtyTerrain = true; this.dirtyPol = true; this.dirtyBorders = true;
    this.clouds = []; this.smoke = [];
    this.mapMode = 'political';
    this._flagCache = new Map();
  }
  attach(cv, mini) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.mini = mini; this.mctx = mini.getContext('2d');
    this.terCv = document.createElement('canvas');
    this.polCv = document.createElement('canvas');
    this.borCv = document.createElement('canvas');
    this.decoCv = document.createElement('canvas');
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  // هماهنگ‌سازی لایه‌ها با ابعاد نقشه‌ی جاری (فانتزی یا واقعی)
  syncMap(map) {
    const g = map.grid;
    if (this.GW === g.gw && this.GH === g.gh) return;
    const first = this.GW === 0;
    this.GW = g.gw; this.GH = g.gh; this.CELL = g.cell;
    this.W = map.w; this.H = map.h;
    this.terCv.width = this.GW; this.terCv.height = this.GH;
    this.polCv.width = this.GW; this.polCv.height = this.GH;
    if (first) {
      this.cam.x = this.W / 2; this.cam.y = this.H / 2;
      this.clouds = [];
      for (let i = 0; i < 16; i++) this.clouds.push({ x: Math.random() * this.W, y: Math.random() * this.H, r: 140 + Math.random() * 320, s: 4 + Math.random() * 10, o: 0.05 + Math.random() * 0.07 });
    }
    this.dirtyTerrain = true; this.dirtyPol = true; this.dirtyBorders = true;
  }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.vw = r.width; this.vh = r.height;
    this.cv.width = r.width * devicePixelRatio; this.cv.height = r.height * devicePixelRatio;
  }

  // ---------- terrain ----------
  drawTerrain(state) {
    const { cells, elev, moist, seaLevel, gw: GW, gh: GH, cell: CELL } = state.map.grid;
    // فصل جاری، زمین را رنگ می‌زند: سبزِ بهار، طلایی پاییز، سفیدیِ زمستان
    const SEA = SEASONS[this._season ?? seasonOfWeek(state.week || 0)];
    this._drawnSeason = this._season ?? seasonOfWeek(state.week || 0);
    const W = this.W, H = this.H;
    const c = this.terCv.getContext('2d');
    const img = c.createImageData(GW, GH);
    const d = img.data;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      const e = elev[i], m = moist[i];
      let col, isSea2 = cells[i] < 0;
      if (isSea2) {
        const depth = clamp((seaLevel - e) / seaLevel, 0, 1);
        col = [lerp(SEA_SHAL[0], SEA_DEEP_A[0], depth), lerp(SEA_SHAL[1], SEA_DEEP_A[1], depth), lerp(SEA_SHAL[2], SEA_DEEP_A[2], depth)];
      } else {
        const p = state.map.provs[cells[i]];
        col = PAL[p.terrain] || PAL.plains;
        // تنوع رنگ با ارتفاع/رطوبت
        const v = (e - 0.5) * 60 + (m - 0.5) * 22;
        col = [clamp(col[0] + v * 0.8, 0, 255), clamp(col[1] + v, 0, 255), clamp(col[2] + v * 0.8, 0, 255)];
        if (e < seaLevel + 0.018) col = PAL.beach;
        if (e > 0.86) col = PAL.snow;
        // --- رنگ فصلی ---
        col = [clamp(col[0] + SEA.tint[0], 0, 255), clamp(col[1] + SEA.tint[1], 0, 255), clamp(col[2] + SEA.tint[2], 0, 255)];
        // برف زمستانی: عرض‌های بالا و ارتفاعات سفید می‌پوشند
        if (SEA.snow > 0) {
          const lat = Math.abs(y / GH - 0.5) * 2;                 // ۰ استوا … ۱ قطب
          const snowAmt = clamp((lat - 0.42) * 2.2 + (e - 0.62) * 2.4, 0, 1) * SEA.snow;
          if (snowAmt > 0.02) col = [lerp(col[0], 244, snowAmt), lerp(col[1], 246, snowAmt), lerp(col[2], 250, snowAmt)];
        }
      }
      // ---- سایه‌روشنِ برجسته‌نما (hillshade) با دو مقیاس + سایه‌ی فرورفتگی ----
      // مقیاس ریز: بافت سنگ و تپه
      const dx1 = elev[x < GW - 1 ? i + 1 : i] - elev[x > 0 ? i - 1 : i];
      const dy1 = elev[y < GH - 1 ? i + GW : i] - elev[y > 0 ? i - GW : i];
      // مقیاس درشت: توده‌ی کوهستان (۳ خانه آن‌سوتر)
      const x3a = clamp(x + 3, 0, GW - 1), x3b = clamp(x - 3, 0, GW - 1);
      const y3a = clamp(y + 3, 0, GH - 1), y3b = clamp(y - 3, 0, GH - 1);
      const dx2 = elev[y * GW + x3a] - elev[y * GW + x3b];
      const dy2 = elev[y3a * GW + x] - elev[y3b * GW + x];
      // نور از شمال‌غرب، با زاویه‌ی فصلی (زمستان نور کم‌جان‌تر و مایل‌تر)
      const lz = SEA.id === 'winter' ? 0.62 : SEA.id === 'summer' ? 0.92 : 0.78;
      const nx = -(dx1 * 2.4 + dx2 * 1.5), ny = -(dy1 * 2.4 + dy2 * 1.5);
      const len = Math.sqrt(nx * nx + ny * ny + lz * lz) || 1;
      // بردار نور نرمال‌شده (شمال‌غرب، کمی از بالا)
      let lambert = (nx * -0.55 + ny * -0.42 + lz * 0.72) / len;
      lambert = clamp((lambert - 0.35) * 1.9, -0.5, 0.55);
      // سایه‌ی فرورفتگی: درّه‌ها تیره‌تر، قله‌ها روشن‌تر
      const around = (elev[y * GW + x3a] + elev[y * GW + x3b] + elev[y3a * GW + x] + elev[y3b * GW + x]) * 0.25;
      const ao = clamp((e - around) * 3.2, -0.24, 0.20);
      const shade = (lambert * 0.86 + ao) * (isSea2 ? 0.28 : 1);
      // دانه‌بندی کاغذی
      const g = ((i * 7919) % 13 - 6);
      d[(i) * 4] = clamp((col[0] + g) * (1 + shade), 0, 255);
      d[(i) * 4 + 1] = clamp((col[1] + g) * (1 + shade), 0, 255);
      d[(i) * 4 + 2] = clamp((col[2] + g) * (1 + shade), 0, 255);
      d[(i) * 4 + 3] = 255;
    }
    // پاس نرم‌کننده: ترکیب ملایم هر پیکسل با میانگین همسایه‌ها تا حالت «پیکسلی» از بین برود
    {
      const src = new Uint8ClampedArray(d);
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x;
        for (let ch = 0; ch < 3; ch++) {
          const v = src[i * 4 + ch] * 0.72 + (src[(i - 1) * 4 + ch] + src[(i + 1) * 4 + ch] + src[(i - GW) * 4 + ch] + src[(i + GW) * 4 + ch]) * 0.07;
          d[i * 4 + ch] = v;
        }
      }
    }
    c.putImageData(img, 0, 0);
    // بزرگنمایی نرم روی بوم تزئینی (دو مرحله‌ای با کیفیت بالا)
    this.decoCv.width = W; this.decoCv.height = H;
    const dc = this.decoCv.getContext('2d');
    if (!this.terMid) { this.terMid = document.createElement('canvas'); }
    this.terMid.width = GW * 2; this.terMid.height = GH * 2;
    const mc = this.terMid.getContext('2d');
    mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
    mc.drawImage(this.terCv, 0, 0, GW * 2, GH * 2);
    dc.imageSmoothingEnabled = true; dc.imageSmoothingQuality = 'high';
    dc.drawImage(this.terMid, 0, 0, W, H);
    // برجسته‌سازی کوهستان با سایه‌روشن
    const rng = mulberry32(state.seed ^ 12345);
    for (const p of state.map.provs) {
      if (p.terrain === 'mountain') {
        const n = 2 + Math.floor(Math.min(5, p.cells.length / 30));
        for (let k = 0; k < n; k++) {
          const ci = p.cells[Math.floor(rng() * p.cells.length)];
          const x = (ci % GW + 0.5) * CELL, y = ((ci / GW | 0) + 0.5) * CELL;
          dc.strokeStyle = 'rgba(70,64,58,0.5)'; dc.lineWidth = 1.2;
          const s = CELL * (0.7 + rng() * 0.5);
          dc.beginPath(); dc.moveTo(x - s, y + s * 0.5); dc.lineTo(x, y - s * 0.6); dc.lineTo(x + s, y + s * 0.5); dc.stroke();
          dc.strokeStyle = 'rgba(255,255,250,0.55)';
          dc.beginPath(); dc.moveTo(x, y - s * 0.6); dc.lineTo(x + s * 0.3, y + s * 0.1); dc.stroke();
        }
      } else if (p.terrain === 'forest') {
        const n = Math.min(6, p.cells.length / 18);
        for (let k = 0; k < n; k++) {
          const ci = p.cells[Math.floor(rng() * p.cells.length)];
          const x = (ci % GW + 0.5) * CELL, y = ((ci / GW | 0) + 0.5) * CELL;
          dc.fillStyle = 'rgba(38,70,38,0.55)';
          const s = CELL * 0.32;
          dc.beginPath(); dc.moveTo(x, y - s); dc.lineTo(x - s * 0.7, y + s * 0.5); dc.lineTo(x + s * 0.7, y + s * 0.5); dc.closePath(); dc.fill();
        }
      }
    }
    // رودخانه‌ها
    if (state.map.rivers) {
      dc.lineCap = 'round'; dc.lineJoin = 'round';
      for (const path of state.map.rivers) {
        dc.strokeStyle = 'rgba(78,116,148,0.9)';
        dc.lineWidth = CELL * 0.52;
        dc.beginPath();
        for (let k = 0; k < path.length; k++) {
          const ci = path[k];
          const x = (ci % GW + 0.5) * CELL, y = ((ci / GW | 0) + 0.5) * CELL;
          k ? dc.lineTo(x, y) : dc.moveTo(x, y);
        }
        dc.stroke();
        dc.strokeStyle = 'rgba(165,205,228,0.5)';
        dc.lineWidth = CELL * 0.22;
        dc.stroke();
      }
    }
    // وینیت کاغذی
    const vg = dc.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(24,16,8,0.38)');
    dc.fillStyle = vg; dc.fillRect(0, 0, W, H);
    this.dirtyTerrain = false;
  }

  provPop(p) { return POP_CLASSES ? Object.values(p.pops).reduce((a, b) => a + b, 0) : 0; }

  drawPolitical(state) {
    const { cells, gw: GW, gh: GH } = state.map.grid;
    const c = this.polCv.getContext('2d');
    c.clearRect(0, 0, GW, GH);
    const img = c.createImageData(GW, GH); const d = img.data;
    const mode = this.mapMode;
    const cMap = new Map();
    const maxPop = Math.max(...state.map.provs.map(p => this.provPop(p)), 1);
    const maxProd = Math.max(...state.map.provs.map(p => prodValue(state, p)), 1);
    for (let i = 0; i < GW * GH; i++) {
      const pid = cells[i];
      if (pid < 0) continue;
      const p = state.map.provs[pid];
      let rgb, a = 235;
      if (mode === 'terrain') { rgb = [0, 0, 0]; a = 0; }
      else if (mode === 'political') {
        const n = state.nations[p.owner];
        // سرزمین بکر (بی‌صاحب): خاکستریِ کم‌رنگ با بافت قبیله‌ای
        if (!n) { rgb = [92, 86, 74]; a = 120; }
        else {
        rgb = hexToRgb(n.c1);
        if (p.controller === REBEL) { rgb = [150, 42, 32]; }
        else if (p.controller !== p.owner) { const on = state.nations[p.controller]; rgb = on ? mixRgb(hexToRgb(n.c1), hexToRgb(on.c1), 0.5) : rgb; }
        const v = 0.85 + 0.15 * Math.min(1, p.cells.length / 80);
        rgb = [rgb[0] * v, rgb[1] * v, rgb[2] * v];
        }
      } else if (mode === 'population') {
        const t = clamp(Math.sqrt(this.provPop(p) / maxPop), 0, 1);
        rgb = [lerp(40, 230, t), lerp(48, 210, (1 - t) * 0.5 + t * 0.2), lerp(60, 60, t)];
      } else if (mode === 'production') {
        const t = clamp(prodValue(state, p) / Math.max(maxProd, 1), 0, 1);
        rgb = [lerp(52, 232, t), lerp(46, 178, t), lerp(52, 66, t)];
      } else if (mode === 'unrest') {
        const t = clamp((p.unrest || 0) / 100, 0, 1);
        rgb = [lerp(52, 228, t), lerp(62, 40, t), lerp(66, 42, t)];
      } else if (mode === 'culture') {
        const C = CULTURES[p.culture];
        rgb = C ? hexToRgb(C.c) : [90, 90, 90];
        // استان‌های هم‌گون‌شده روشن‌تر دیده می‌شوند
        const as = (p.assim ?? 100) / 100;
        rgb = [lerp(rgb[0] * 0.55, rgb[0], as), lerp(rgb[1] * 0.55, rgb[1], as), lerp(rgb[2] * 0.55, rgb[2], as)];
      } else if (mode === 'religion') {
        const relKeys = Object.keys(RELIGIONS);
        const idx = Math.max(0, relKeys.indexOf(p.religion));
        const hue = (idx / Math.max(relKeys.length, 1)) * 360;
        rgb = hslToRgb(hue, 0.52, 0.52);
        const own = state.nations[p.owner];
        if (own && p.religion !== own.religion) { rgb = [rgb[0] * 0.72, rgb[1] * 0.72, rgb[2] * 0.72]; }
      } else if (mode === 'naval') {
        // بندرها و محاصره‌ها
        const port = p.bld?.port || 0;
        if (p.blockaded) rgb = [222, 60, 48];
        else if (port > 0) { const t = clamp(port / 5, 0, 1); rgb = [lerp(40, 90, t), lerp(90, 190, t), lerp(130, 240, t)]; }
        else { rgb = [46, 52, 58]; a = 150; }
      } else if (mode === 'separatism') {
        const t = clamp((p.sepPressure || 0) / 60, 0, 1);
        rgb = [lerp(48, 210, t), lerp(56, 46, t), lerp(52, 150, t)];
      } else if (mode === 'devast') {
        const t = clamp((p.devast || 0) / 8, 0, 1);
        rgb = [lerp(64, 40, t), lerp(70, 30, t), lerp(62, 26, t)];
      } else if (mode === 'houses') {
        // هر خاندان بزرگ رنگ خودش را دارد؛ وفاداری روشنایی را تعیین می‌کند
        const facs = factionsOf(state, p.owner);
        const fi = facs.findIndex(f => f.provs.includes(p.id));
        if (fi < 0) { rgb = [52, 48, 42]; a = 140; }
        else {
          const f = facs[fi];
          const hue = (fi * 67 + (p.owner * 23)) % 360;
          rgb = hslToRgb(hue, 0.48, 0.30 + (f.loyalty / 100) * 0.30);
          if (f.pretender) { rgb = [230, 70, 55]; }   // مدعی تاج: سرخِ هشدار
        }
      } else if (mode === 'regions') {
        const rg = (state.regions || [])[p.region];
        if (!rg) { rgb = [56, 52, 46]; a = 150; }
        else {
          const hue = (p.region * 47) % 360;
          rgb = hslToRgb(hue, 0.42, 0.48);
          if (p.owner < 0) { rgb = [rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.55]; }  // بکر: تیره‌تر
        }
      } else if (mode === 'infamy') {
        // بدنامی مالک استان: از سبز آرام تا سرخ منفور
        const own = state.nations[p.owner];
        if (!own || !own.alive) { rgb = [48, 46, 42]; a = 130; }
        else {
          const t = clamp((own.infamy || 0) / 100, 0, 1);
          rgb = [lerp(70, 200, t), lerp(120, 46, t), lerp(72, 38, t)];
        }
      } else if (mode === 'projects') {
        // پروژه‌های ملیِ تکمیل‌شده‌ی مالک استان
        const own = state.nations[p.owner];
        if (!own || !own.alive) { rgb = [48, 46, 42]; a = 130; }
        else {
          const done = (own.projDone || []).length;
          const t = clamp(done / 6, 0, 1);
          rgb = [lerp(58, 226, t), lerp(54, 182, t), lerp(48, 92, t)];
        }
      } else if (mode === 'power') {
        const own = state.nations[p.owner];
        if (!own || !own.alive) { rgb = [48, 46, 42]; a = 140; }
        else if (own.greatPower) {
          const t = clamp(1 - ((own.gpRank || 8) - 1) / 8, 0, 1);
          rgb = [lerp(120, 240, t), lerp(100, 200, t), lerp(40, 90, t)];   // طلاییِ قدرت
        } else if (own.sphere != null) {
          const lord = state.nations[own.sphere];
          rgb = (lord && lord.c1) ? hexToRgb(lord.c1) : [80, 80, 90];
          rgb = [rgb[0] * 0.5 + 40, rgb[1] * 0.5 + 40, rgb[2] * 0.5 + 50];  // زیر نفوذ: کم‌رنگ‌شده
        } else { rgb = [70, 74, 78]; }
      }
      d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = a;
    }
    c.putImageData(img, 0, 0);
    this.dirtyPol = false;
  }

  drawBorders(state) {
    const { cells, gw: GW, gh: GH, cell: CELL } = state.map.grid;
    const W = this.W, H = this.H;
    this.borCv.width = W; this.borCv.height = H;
    const c = this.borCv.getContext('2d');
    c.clearRect(0, 0, W, H);
    // مرز استانی ظریف + مرز ملی پررنگ
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, pid = cells[i];
      if (pid < 0) continue;
      const p = state.map.provs[pid];
      const checks = [[1, 0], [0, 1]];
      for (const [dx, dy] of checks) {
        const nx = x + dx, ny = y + dy;
        if (nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx, q2 = cells[j];
        if (q2 === pid) continue;
        const px = (x + 1) * CELL * dx + x * CELL * (1 - dx);
        const py = (y + 1) * CELL * dy + y * CELL * (1 - dy);
        if (q2 < 0) { // ساحل
          c.strokeStyle = 'rgba(240,235,215,0.75)'; c.lineWidth = 2.2;
          c.beginPath();
          if (dx) { c.moveTo(px, y * CELL); c.lineTo(px, (y + 1) * CELL); } else { c.moveTo(x * CELL, py); c.lineTo((x + 1) * CELL, py); }
          c.stroke();
          continue;
        }
        const q = state.map.provs[q2];
        const nation = p.owner !== q.owner;
        c.strokeStyle = nation ? 'rgba(26,20,16,0.85)' : 'rgba(26,20,16,0.30)';
        c.lineWidth = nation ? 2.4 : 1;
        c.beginPath();
        if (dx) { c.moveTo(px, y * CELL); c.lineTo(px, (y + 1) * CELL); } else { c.moveTo(x * CELL, py); c.lineTo((x + 1) * CELL, py); }
        c.stroke();
      }
    }
    this.dirtyBorders = false;
  }

  // ---------- پرچم‌ها ----------
  drawFlag(ctx, n, x, y, w, h) {
    const { style, emblem } = n.flag;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = n.c1; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = n.c2;
    if (style === 'h2') ctx.fillRect(x, y, w, h / 2);
    else if (style === 'h3') { ctx.fillRect(x, y, w, h / 3); ctx.fillRect(x, y + 2 * h / 3, w, h / 3); }
    else if (style === 'v2') ctx.fillRect(x, y, w / 2, h);
    else if (style === 'v3') { ctx.fillRect(x, y, w / 3, h); ctx.fillRect(x + 2 * w / 3, y, w / 3, h); }
    // نشان
    const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.42;
    ctx.fillStyle = contrast(n.c1, n.c2);
    drawEmblem(ctx, emblem, cx, cy, s);
    ctx.restore();
  }
  flagURL(n) {
    const key = n.id;
    if (this._flagCache.has(key)) return this._flagCache.get(key);
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 40;
    this.drawFlag(cv.getContext('2d'), n, 1, 1, 62, 38);
    const u = cv.toDataURL();
    this._flagCache.set(key, u);
    return u;
  }

  // ---------- تبدیل مختصات ----------
  toWorld(sx, sy) {
    return { x: this.cam.x + (sx - this.vw / 2) / this.cam.z, y: this.cam.y + (sy - this.vh / 2) / this.cam.z };
  }
  toScreen(wx, wy) {
    return { x: (wx - this.cam.x) * this.cam.z + this.vw / 2, y: (wy - this.cam.y) * this.cam.z + this.vh / 2 };
  }
  pickProv(state, sx, sy) {
    const w = this.toWorld(sx, sy);
    const { gw: GW, gh: GH, cell: CELL } = state.map.grid;
    const gx = Math.floor(w.x / CELL), gy = Math.floor(w.y / CELL);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return -1;
    return state.map.grid.cells[gy * GW + gx];
  }
  zoomAt(sx, sy, f) {
    const before = this.toWorld(sx, sy);
    this.cam.z = clamp(this.cam.z * f, 0.16, 3.2);
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.clampCam();
  }
  clampCam() {
    const m = 200 / this.cam.z;
    this.cam.x = clamp(this.cam.x, -m, this.W + m); this.cam.y = clamp(this.cam.y, -m, this.H + m);
  }
  focusOn(x, y, z) { this.cam.x = x; this.cam.y = y; if (z) this.cam.z = z; this.clampCam(); }

  // ---------- فریم اصلی ----------
  draw(state, ui, t, dt) {
    const { ctx } = this;
    this.syncMap(state.map);
    // تغییر فصل ⇒ بازنقاشی زمین
    const seas = seasonOfWeek(state.week || 0);
    if (seas !== this._season) { this._season = seas; this.dirtyTerrain = true; }
    if (this.dirtyTerrain) this.drawTerrain(state);
    if (this.dirtyPol) this.drawPolitical(state);
    if (this.dirtyBorders) this.drawBorders(state);

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.fillStyle = '#101c28';
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.save();
    ctx.scale(this.cam.z, this.cam.z);
    ctx.translate(this.vw / 2 / this.cam.z - this.cam.x, this.vh / 2 / this.cam.z - this.cam.y);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.decoCv, 0, 0);
    if (this.mapMode !== 'terrain') {
      ctx.globalAlpha = 0.86;
      ctx.drawImage(this.polCv, 0, 0, this.GW, this.GH, 0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(this.borCv, 0, 0);

    // درخشش ساحل (بس‌سویی ملایم)
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 0.7);
    ctx.drawImage(this.borCv, 0, 0);
    ctx.globalAlpha = 1;

    this.drawWaves(state, t);
    this.drawSeaZones(state, ui, t);
    this.drawTradeRoutes(state, t);
    this.drawNames(state, ui);
    this.updateShips(state, dt);
    this.drawShips(t);
    this.drawRailways(state, dt, t);
    this.drawNightVeil(state, t);
    this.drawCities(state, t);
    this.drawWorldFlavor(state, t);
    this.updateSmoke(state, dt);
    this.drawSmoke(ctx);
    this.updateBirds(dt);
    this.drawBirds(t);
    this.drawFleets(state, ui, t, dt);
    this.drawArmies(state, t);
    this.drawBattles(state, t);
    this.drawSieges(state, t);
    this.drawProjects(state, t);
    this.drawInfamy(state, t);
    this.drawFx(state, dt);
    this.drawSelection(state, ui, t);
    this.updateWeather(state, dt);
    this.drawWeather(state, t);
    this.drawClouds(dt);
    ctx.restore();
    this.drawVignette(state);
    this.drawMinimap(state);
  }

  // ---------- مناطق دریایی (فقط وقتی ناوگانی برگزیده یا مُد دریایی فعال است) ----------
  drawSeaZones(state, ui, t) {
    if (!state.seaZones?.length) return;
    const show = ui.selFleet != null || this.mapMode === 'naval';
    if (!show) return;
    const ctx = this.ctx;
    ctx.save();
    for (const z of state.seaZones) {
      const mine = (state.fleets || []).some(f => f.zone === z.id && f.n === state.playerId && totalShips(f) > 0);
      ctx.globalAlpha = 0.10 + 0.04 * Math.sin(t * 1.6 + z.id);
      ctx.fillStyle = mine ? '#6fd3ff' : '#7f9ab5';
      ctx.beginPath();
      ctx.ellipse(z.cx, z.cy, (z.x1 - z.x0) * 0.42, (z.y1 - z.y0) * 0.40, 0, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(190,225,245,0.55)';
      ctx.setLineDash([10, 8]); ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.cam.z > 0.3) {
        ctx.globalAlpha = 0.85;
        ctx.font = `600 ${clamp(15 / this.cam.z, 11, 34)}px Vazirmatn, Tahoma`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(14,24,34,0.65)';
        ctx.fillText(z.name, z.cx + 1.5, z.cy + 1.5);
        ctx.fillStyle = 'rgba(214,238,250,0.92)';
        ctx.fillText(z.name, z.cx, z.cy);
      }
    }
    ctx.restore();
  }

  // ---------- مسیرهای بازرگانی بازیکن ----------
  drawTradeRoutes(state, t) {
    const pn = state.nations[state.playerId];
    if (!pn?.routes?.length || this.cam.z < 0.22) return;
    const ctx = this.ctx;
    ctx.save();
    for (const r of pn.routes) {
      const other = state.nations[r.with];
      if (!other?.alive) continue;
      const a = state.map.provs[pn.capital], b = state.map.provs[other.capital];
      if (!a || !b) continue;
      const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2 - Math.hypot(b.cx - a.cx, b.cy - a.cy) * 0.14;
      ctx.strokeStyle = r.dir === 'export' ? 'rgba(143,188,106,0.42)' : 'rgba(217,177,102,0.42)';
      ctx.lineWidth = clamp(1 + (r.vol || 0) * 0.5, 1, 4);
      ctx.setLineDash([6, 7]);
      ctx.lineDashOffset = -t * (r.dir === 'export' ? 16 : -16);
      ctx.beginPath();
      ctx.moveTo(a.cx, a.cy);
      ctx.quadraticCurveTo(mx, my, b.cx, b.cy);
      ctx.stroke();
      ctx.setLineDash([]);
      // بسته‌ی کالا در حال حرکت
      const u = (t * 0.11 + r.with * 0.17) % 1;
      const uu = r.dir === 'export' ? u : 1 - u;
      const px = bez(a.cx, mx, b.cx, uu), py = bez(a.cy, my, b.cy, uu);
      ctx.globalAlpha = 0.9;
      ctx.font = `${clamp(11 / this.cam.z, 8, 20)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('📦', px, py);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---------- ناوگان‌ها روی دریا ----------
  drawFleets(state, ui, t, dt) {
    if (!state.fleets?.length) return;
    const ctx = this.ctx;
    for (const f of state.fleets) {
      const ships = totalShips(f);
      if (ships <= 0) continue;
      const z = zoneOf(state, f.zone);
      if (!z) continue;
      // موقعیت: مرکز منطقه + آفست پایدار بر پایه‌ی id (تا ناوگان‌ها روی هم نیفتند)
      const ang = (f.id * 2.399) % (Math.PI * 2);
      const rad = 26 + (f.id % 3) * 22;
      let x = z.cx + Math.cos(ang) * rad, y = z.cy + Math.sin(ang) * rad * 0.7;
      // حرکت بین مناطق
      if (f.status === 'move' && f.path?.length > 1) {
        const z2 = zoneOf(state, f.path[1]);
        if (z2) { const u = clamp(f.prog, 0, 1); x = lerp(x, z2.cx, u); y = lerp(y, z2.cy, u); }
      }
      // محاصره: ناوگان کنار بندر هدف می‌ایستد
      if (f.status === 'blockade' && f.blockade != null) {
        const bp = state.map.provs[f.blockade];
        if (bp) { const d = seaDir(state, bp); x = bp.cx + d.x * 26; y = bp.cy + d.y * 26; }
      }
      const n = state.nations[f.n];
      const bob = Math.sin(t * 1.8 + f.id) * 1.6;
      const isMine = f.n === state.playerId;
      const sel = ui.selFleet === f.id;
      ctx.save();
      ctx.translate(x, y + bob);
      // موج زیر ناوگان
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = '#dff0fa'; ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const rr = 11 + k * 6 + Math.sin(t * 2.2 + k + f.id) * 1.6;
        ctx.beginPath(); ctx.ellipse(0, 5, rr, rr * 0.32, 0, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (sel) {
        ctx.strokeStyle = '#ffd97a'; ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5);
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // بدنه‌ی ناو
      ctx.fillStyle = '#2b2418';
      ctx.beginPath();
      ctx.moveTo(-11, 2); ctx.quadraticCurveTo(-9, 7, 0, 7); ctx.quadraticCurveTo(11, 7, 13, 1);
      ctx.lineTo(-11, 1); ctx.closePath(); ctx.fill();
      // بادبان یا دودکش بسته به کلاس غالب
      const heavy = (f.ships.dread || 0) + (f.ships.cruiser || 0) + (f.ships.ironclad || 0);
      if (heavy > 0) {
        ctx.fillStyle = '#4a4238';
        ctx.fillRect(-4, -8, 3.4, 9); ctx.fillRect(1.5, -6, 3, 7);
        if (Math.random() < 0.05 && this.smoke.length < 380) {
          this.smoke.push({ x, y: y - 9, vx: 0.6 + Math.random(), vy: -5 - Math.random() * 2, life: 1.8, t: 0, r: 1.4 });
        }
      } else {
        ctx.fillStyle = 'rgba(246,241,226,0.95)';
        ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-1, -12); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
      }
      // پرچم ملی
      if (n) this.drawFlag(ctx, n, -12, -15, 11, 7);
      // شمار فروند
      ctx.fillStyle = isMine ? '#ffeec4' : '#f3dcd2';
      ctx.strokeStyle = 'rgba(12,18,24,0.85)'; ctx.lineWidth = 2.6;
      ctx.font = 'bold 9.5px Vazirmatn, Tahoma'; ctx.textAlign = 'center';
      ctx.strokeText('⚓' + fa(ships), 1, 17); ctx.fillText('⚓' + fa(ships), 1, 17);
      ctx.restore();
      // خط مسیر حرکت
      if (f.status === 'move' && f.path?.length > 1) {
        ctx.save();
        ctx.strokeStyle = n ? n.c2 : '#9cf';
        ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 20;
        ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 1; i < f.path.length; i++) { const zz = zoneOf(state, f.path[i]); if (zz) ctx.lineTo(zz.cx, zz.cy); }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ---------- محاصره‌ی بندرها + پیشرفت اشغال ----------
  drawSieges(state, t) {
    const ctx = this.ctx;
    for (const p of state.map.provs) {
      if (p.blockaded) {
        ctx.save();
        ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 3.4 + p.id);
        ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]); ctx.lineDashOffset = t * 10;
        ctx.beginPath(); ctx.arc(p.cx, p.cy, 17, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1; ctx.font = '12px serif'; ctx.textAlign = 'center';
        ctx.fillText('🚫', p.cx + 15, p.cy + 14);
        ctx.restore();
      }
      // نوار پیشرفت اشغال
      if ((p.occ || 0) > 2 && p.controller === p.owner) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.cx - 15, p.cy + 12, 30, 3.4);
        ctx.fillStyle = '#d9a441'; ctx.fillRect(p.cx - 15, p.cy + 12, 30 * clamp(p.occ / 100, 0, 1), 3.4);
        ctx.restore();
      }
      // مستعمره در حال ساخت
      const colonizer = state.nations.find(n => n.alive && (n.colonies || []).some(c => c.prov === p.id));
      if (colonizer) {
        const c = colonizer.colonies.find(c2 => c2.prov === p.id);
        ctx.save();
        ctx.globalAlpha = 0.9; ctx.font = '13px serif'; ctx.textAlign = 'center';
        ctx.fillText('🏴', p.cx, p.cy - 16 + Math.sin(t * 3 + p.id) * 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.cx - 13, p.cy + 12, 26, 3);
        ctx.fillStyle = colonizer.c2 || '#d9a441';
        ctx.fillRect(p.cx - 13, p.cy + 12, 26 * clamp(c.prog / 100, 0, 1), 3);
        ctx.restore();
      }
    }
  }

  // ---------- آب‌وهوا: باران و برف فصلی ----------
  updateWeather(state, dt) {
    const s = SEASONS[this._season ?? 0];
    this._wx = this._wx || [];
    const want = s.id === 'winter' ? 90 : s.id === 'autumn' ? 55 : s.id === 'spring' ? 35 : 0;
    // فقط وقتی زوم نزدیک است، ذره بسازیم (کارایی)
    const target = this.cam.z > 0.42 ? want : 0;
    while (this._wx.length < target) {
      const v = this.toWorld(Math.random() * this.vw, Math.random() * this.vh);
      this._wx.push({ x: v.x, y: v.y, sp: s.id === 'winter' ? 22 + Math.random() * 20 : 130 + Math.random() * 90, sw: Math.random() * 6.28, r: Math.random() });
    }
    if (this._wx.length > target) this._wx.length = target;
    const tl = this.toWorld(0, 0), br = this.toWorld(this.vw, this.vh);
    for (const w of this._wx) {
      w.y += w.sp * dt;
      w.x += (s.id === 'winter' ? Math.sin(w.sw + w.y * 0.02) * 9 : 26) * dt;
      if (w.y > br.y + 20 || w.x > br.x + 20) { w.y = tl.y - 20; w.x = tl.x + Math.random() * (br.x - tl.x); }
    }
  }
  drawWeather(state, t) {
    if (!this._wx?.length) return;
    const s = SEASONS[this._season ?? 0];
    const ctx = this.ctx;
    ctx.save();
    if (s.id === 'winter') {
      ctx.fillStyle = 'rgba(248,250,255,0.75)';
      for (const w of this._wx) { ctx.beginPath(); ctx.arc(w.x, w.y, 0.9 + w.r * 1.1, 0, 7); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(178,204,224,0.34)'; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const w of this._wx) { ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - 2.4, w.y - 8); }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- پرده‌ی شب: گرادیان آبیِ سرد که با نقشه می‌خزد ----------
  drawNightVeil(state, t) {
    const ctx = this.ctx;
    const tl = this.toWorld(0, 0), br = this.toWorld(this.vw, this.vh);
    // نمونه‌برداری از تاریکی در چند نقطه‌ی افقی و ساخت گرادیان
    const N = 6;
    const g = ctx.createLinearGradient(tl.x, 0, br.x, 0);
    let anyNight = false;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const wx = lerp(tl.x, br.x, u);
      const nv = this.nightAt(wx, t);
      if (nv > 0.05) anyNight = true;
      // شب: آبیِ عمیق و سرد. شفق: نارنجیِ کم‌رمق.
      const dusk = clamp(1 - Math.abs(nv - 0.45) * 3.4, 0, 1);
      const r = lerp(10, 62, dusk), gg = lerp(16, 34, dusk), b = lerp(38, 30, dusk);
      g.addColorStop(u, `rgba(${r | 0},${gg | 0},${b | 0},${(nv * 0.52).toFixed(3)})`);
    }
    if (!anyNight) return;
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.restore();
  }

  // ---------- وینیت سینمایی روی کل صفحه ----------
  drawVignette(state) {
    const ctx = this.ctx;
    const s = SEASONS[this._season ?? 0];
    ctx.save();
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    // مه فصلی ملایم
    if (s.haze > 0.02) {
      ctx.globalAlpha = s.haze * 0.5;
      ctx.fillStyle = s.id === 'winter' ? '#c9d8e8' : s.id === 'summer' ? '#e8d9a8' : '#d8cbb0';
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.globalAlpha = 1;
    }
    const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.42,
      this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(8,6,4,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.restore();
  }

  // ---------- امواج ساحلی ----------
  drawWaves(state, t) {
    const cs = state.map.coastSea;
    if (!cs || !cs.length) return;
    const { gw: GW, gh: GH, cell: CELL } = state.map.grid;
    const c = this.ctx;
    c.save();
    c.strokeStyle = 'rgba(228,240,248,1)';
    c.lineWidth = 1;
    for (let k = 0; k < cs.length; k += 5) {
      const i = cs[k];
      const x = (i % GW) * CELL + CELL / 2, y = ((i / GW | 0)) * CELL + CELL / 2;
      const ph = t * 1.7 + (i % 97) * 0.35;
      c.globalAlpha = 0.04 + 0.06 * (0.5 + 0.5 * Math.sin(ph));
      c.beginPath();
      c.arc(x + Math.sin(ph * 0.5) * 1.6, y, CELL * 0.55, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    }
    c.restore();
  }

  // ---------- کشتی‌های تجاری ----------
  updateShips(state, dt) {
    this._shipT = (this._shipT || 0) + dt;
    if (!this.ships) this.ships = [];
    if (this._shipT > 2.8 && this.ships.length < 10) {
      const ports = state.map.provs.filter(p => (p.bld.port || 0) > 0 && state.nations[p.owner]?.alive);
      if (ports.length >= 2) {
        const a = ports[(Math.random() * ports.length) | 0];
        let b = a, guard = 0;
        while (b === a && guard++ < 7) b = ports[(Math.random() * ports.length) | 0];
        if (b !== a) {
          const dirA = seaDir(state, a), dirB = seaDir(state, b);
          const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
          const off = 50 + Math.random() * 80;
          this.ships.push({
            ax: a.cx, ay: a.cy, bx: b.cx, by: b.cy,
            cx: mx + (dirA.x + dirB.x) * off / 2, cy: my + (dirA.y + dirB.y) * off / 2,
            t: 0, dur: 24 + Math.random() * 16,
          });
          this._shipT = 0;
        }
      }
    }
    for (const s of this.ships) s.t += dt;
    this.ships = this.ships.filter(s => s.t < s.dur);
  }
  drawShips(t) {
    const ctx = this.ctx;
    if (!this.ships) return;
    for (const s of this.ships) {
      const u = s.t / s.dur;
      const x = bez(s.ax, s.cx, s.bx, u), y = bez(s.ay, s.cy, s.by, u);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = 'rgba(242,240,232,0.8)';
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const uu = u + (k / 10) * (1 - u);
        const px = bez(s.ax, s.cx, s.bx, uu), py = bez(s.ay, s.cy, s.by, uu);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const u2 = Math.min(1, u + 0.012);
      const x2 = bez(s.ax, s.cx, s.bx, u2), y2 = bez(s.ay, s.cy, s.by, u2);
      const ang = Math.atan2(y2 - y, x2 - x);
      ctx.globalAlpha = 0.95;
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = '#3a2f22';
      ctx.beginPath();
      ctx.moveTo(5.5, 0); ctx.lineTo(-4.5, 2.8); ctx.lineTo(-4.5, -2.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(246,241,226,0.95)';
      ctx.beginPath(); ctx.moveTo(-0.5, -1); ctx.lineTo(-0.5, -8.5); ctx.lineTo(5, -1); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // ---------- راه‌آهن و قطار ----------
  drawRailways(state, dt, t) {
    const ctx = this.ctx;
    if (!this._trains) this._trains = new Map();
    for (const p of state.map.provs) {
      if (!(p.bld.railway > 0)) continue;
      if (p.controller !== p.owner) continue;
      for (const qid of p.adj) {
        if (qid <= p.id) continue;
        const q = state.map.provs[qid];
        if (!(q.bld.railway > 0) || q.controller !== q.owner || q.owner !== p.owner) continue;
        ctx.save();
        ctx.strokeStyle = 'rgba(52,40,28,0.85)';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(p.cx, p.cy); ctx.lineTo(q.cx, q.cy); ctx.stroke();
        const L = Math.hypot(q.cx - p.cx, q.cy - p.cy);
        const nx = (q.cx - p.cx) / L, ny = (q.cy - p.cy) / L;
        const px = -ny, py = nx;
        ctx.strokeStyle = 'rgba(96,76,54,0.9)'; ctx.lineWidth = 1;
        for (let dLen = 5; dLen < L - 4; dLen += 7) {
          const x = p.cx + nx * dLen, y = p.cy + ny * dLen;
          ctx.beginPath(); ctx.moveTo(x - px * 2.4, y - py * 2.4); ctx.lineTo(x + px * 2.4, y + py * 2.4); ctx.stroke();
        }
        const key = p.id + '-' + q.id;
        let tr = this._trains.get(key);
        if (!tr) { tr = { u: Math.random(), dir: 1 }; this._trains.set(key, tr); }
        tr.u += (dt * 30 / L) * tr.dir;
        if (tr.u > 1) { tr.u = 1; tr.dir = -1; }
        if (tr.u < 0) { tr.u = 0; tr.dir = 1; }
        const tx = p.cx + (q.cx - p.cx) * tr.u, ty = p.cy + (q.cy - p.cy) * tr.u;
        const ang = Math.atan2(q.cy - p.cy, q.cx - p.cx) * tr.dir;
        ctx.translate(tx, ty); ctx.rotate(ang);
        ctx.fillStyle = '#241c14'; ctx.fillRect(-3.4, -1.6, 6.8, 3.2);
        ctx.fillStyle = '#5a4632'; ctx.fillRect(-6.6, -1.4, 2.8, 2.8);
        ctx.restore();
        if (Math.random() < 0.08 && this.smoke.length < 380) {
          this.smoke.push({ x: tx, y: ty - 2.5, vx: 0.3 + Math.random() * 0.8, vy: -4.5 - Math.random() * 2, life: 1.4, t: 0, r: 1.1 });
        }
      }
    }
  }

  // ---------- پرنده‌ها ----------
  updateBirds(dt) {
    this._birdT = (this._birdT || 0) + dt;
    if (!this.birdsF) this.birdsF = [];
    if (this._birdT > 7 && this.birdsF.length < 3) {
      this._birdT = 0;
      this.birdsF.push({
        x: -50, y: Math.random() * this.H * 0.6 + this.H * 0.12,
        sp: 30 + Math.random() * 20, vy: (Math.random() - 0.5) * 12,
        n: 4 + (Math.random() * 3 | 0), ph: Math.random() * 9,
      });
    }
    for (const f of this.birdsF) { f.x += f.sp * dt; f.y += f.vy * dt; }
    this.birdsF = this.birdsF.filter(f => f.x < this.W + 90 && f.y > -70 && f.y < this.H + 70);
  }
  drawBirds(t) {
    const ctx = this.ctx;
    if (!this.birdsF) return;
    ctx.strokeStyle = 'rgba(42,36,28,0.55)';
    ctx.lineWidth = 1;
    for (const f of this.birdsF) {
      for (let i = 0; i < f.n; i++) {
        const bx = f.x - i * 9, by = f.y + Math.sin(t * 6 + f.ph + i) * 2 + (i % 2 ? 3.5 : -3.5);
        const flap = Math.sin(t * 14 + i * 1.7 + f.ph) * 1.7;
        ctx.beginPath();
        ctx.moveTo(bx - 3.2, by - flap);
        ctx.quadraticCurveTo(bx, by + 1.2, bx + 3.2, by - flap);
        ctx.stroke();
      }
    }
  }

  drawNames(state, ui) {
    const ctx = this.ctx;
    if (this.cam.z > 0.34) {
      // نام ملت‌ها
      for (const n of state.nations) {
        if (!n.alive) continue;
        let sx = 0, sy = 0, cnt = 0, maxX = -1e9, minX = 1e9;
        for (const p of state.map.provs) if (p.owner === n.id) { sx += p.cx; sy += p.cy; cnt++; minX = Math.min(minX, p.cx); maxX = Math.max(maxX, p.cx); }
        if (!cnt) continue;
        const size = clamp((maxX - minX) * 0.055, 20, 46);
        ctx.font = `700 ${size}px Vazirmatn, Tahoma`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(18,14,10,0.55)';
        ctx.fillText(n.name, sx / cnt + 1.5, sy / cnt + 1.5);
        ctx.fillStyle = 'rgba(250,246,235,0.88)';
        ctx.fillText(n.name, sx / cnt, sy / cnt);
      }
    }
    if (this.cam.z > 1.05) {
      ctx.font = `600 ${13 / this.cam.z * 1.6}px Vazirmatn, Tahoma`;
      ctx.textAlign = 'center';
      for (const p of state.map.provs) {
        ctx.fillStyle = 'rgba(20,16,12,0.5)';
        ctx.fillText(p.name, p.cx, p.cy + 26);
        ctx.fillStyle = 'rgba(255,252,240,0.85)';
        ctx.fillText(p.name, p.cx, p.cy + 25);
      }
    }
  }
  // ---------- پروژه‌های ملی در دست ساخت: داربست + نوار پیشرفت روی پایتخت ----------
  drawProjects(state, t) {
    if (state.timelineId !== 'victoria') return;
    const list = state.projects;
    if (!list || !list.length) return;
    const ctx = this.ctx;
    for (const pr of list) {
      if (pr.done) continue;
      const n = state.nations[pr.nid];
      if (!n || !n.alive || n.capital == null) continue;
      const p = state.map.provs[n.capital];
      if (!p) continue;
      const x = p.cx + 14, y = p.cy - 20;
      const frac = clamp((pr.prog || 0) / 100, 0, 1);
      ctx.save();
      // داربست چوبی
      ctx.strokeStyle = 'rgba(120,88,44,.95)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y + 12); ctx.lineTo(x, y - 2);
      ctx.moveTo(x + 9, y + 12); ctx.lineTo(x + 9, y - 2);
      ctx.moveTo(x - 1, y + 12); ctx.lineTo(x + 10, y + 12);
      ctx.moveTo(x, y + 4); ctx.lineTo(x + 9, y + 4);
      ctx.moveTo(x, y - 2); ctx.lineTo(x + 9, y - 2);
      ctx.stroke();
      // جرثقیل کوچک
      ctx.beginPath(); ctx.moveTo(x + 9, y - 2); ctx.lineTo(x + 14, y - 6); ctx.stroke();
      // نوار پیشرفت
      const bw = 18;
      ctx.fillStyle = 'rgba(20,16,10,.78)';
      ctx.fillRect(x - 2, y + 15, bw, 3.4);
      ctx.fillStyle = '#d9b166';
      ctx.fillRect(x - 2, y + 15, bw * frac, 3.4);
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 0.6;
      ctx.strokeRect(x - 2, y + 15, bw, 3.4);
      // تپش ملایم روی داربست
      const pulse = 0.35 + 0.25 * Math.sin(t * 2.2 + pr.nid);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.arc(x + 14, y - 6, 1.8, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // ---------- بدنامی: هاله‌ی قرمز روی پایتخت کشورهای بدنام + خطوط ائتلاف ----------
  drawInfamy(state, t) {
    if (state.timelineId !== 'victoria') return;
    const ctx = this.ctx;
    for (const n of state.nations) {
      if (!n || !n.alive || n.capital == null) continue;
      const inf = n.infamy || 0;
      if (inf < 30) continue;
      const p = state.map.provs[n.capital];
      if (!p) continue;
      const sev = clamp((inf - 30) / 70, 0, 1);
      const r = 12 + sev * 16;
      const puls = 0.5 + 0.5 * Math.sin(t * 1.6 + n.id * 0.9);
      ctx.save();
      const g = ctx.createRadialGradient(p.cx, p.cy, 2, p.cx, p.cy, r);
      g.addColorStop(0, `rgba(196,64,48,${(0.16 + sev * 0.26) * (0.7 + 0.3 * puls)})`);
      g.addColorStop(1, 'rgba(196,64,48,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.cx, p.cy, r, 0, 7); ctx.fill();
      ctx.restore();
    }
    // خطوط ائتلاف: از پایتخت هر عضو به پایتخت هدف
    const cos = state.coalitions;
    if (cos && cos.length) {
      for (const co of cos) {
        const tgt = state.nations[co.target];
        if (!tgt || !tgt.alive || tgt.capital == null) continue;
        const tp = state.map.provs[tgt.capital];
        if (!tp) continue;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -t * 18;
        ctx.strokeStyle = 'rgba(214,86,66,.62)';
        ctx.lineWidth = 1.4;
        for (const mid of (co.members || [])) {
          const m = state.nations[mid];
          if (!m || !m.alive || m.capital == null) continue;
          const mp = state.map.provs[m.capital];
          if (!mp) continue;
          ctx.beginPath(); ctx.moveTo(mp.cx, mp.cy); ctx.lineTo(tp.cx, tp.cy); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  drawCities(state, t) {
    const ctx = this.ctx;
    for (const p of state.map.provs) {
      const n = state.nations[p.owner];
      const pop = this.provPop(p);
      const rng = mulberry32(p.id * 331 + 7);
      const urbanLvl = ['textile', 'tool_work', 'furniture', 'glasswork', 'arms_ind', 'university', 'port', 'railway', 'steel_mill'].reduce((a, k) => a + (p.bld[k] || 0), 0);
      const size = clamp(Math.sqrt(pop / 20000), 1.4, 9) + urbanLvl * 0.35;
      const houses = clamp(Math.round(size), 2, 9);
      ctx.fillStyle = 'rgba(46,38,30,0.9)';
      for (let h = 0; h < houses; h++) {
        const a = rng() * Math.PI * 2, r = rng() * size * 1.5;
        const hx = p.cx + Math.cos(a) * r, hy = p.cy + Math.sin(a) * r * 0.6 + 6;
        ctx.fillRect(hx - 1.4, hy - 1.4, 2.8, 2.8);
      }
      // پایتخت
      const capital = state.nations.find(nn => nn.capital === p.id);
      if (capital && capital.alive) {
        ctx.font = '13px serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#2a2118';
        ctx.beginPath(); ctx.arc(p.cx, p.cy - 3, 7.5, 0, 7); ctx.fillStyle = '#f0e6c8'; ctx.fill(); ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = '#2a2118'; ctx.font = 'bold 10px Vazirmatn, Tahoma';
        ctx.fillText('★', p.cx, p.cy + 0.5);
        // پرچم کوچک
        this.drawFlag(ctx, capital, p.cx - 9, p.cy - 22, 18, 11);
        ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 1; ctx.strokeRect(p.cx - 9, p.cy - 22, 18, 11);
      }
      // اشغال: پرچم‌چه کوچک اشغالگر
      if (p.controller !== p.owner) {
        ctx.font = '11px serif'; ctx.textAlign = 'center';
        const occ = p.controller === REBEL ? '🔥' : '⚑';
        ctx.fillText(occ, p.cx + 12, p.cy - 8);
      }
      // ساخت‌وساز جاری
      if (p.queue.length) {
        ctx.font = '12px serif';
        const bounce = Math.sin(t * 4 + p.id) * 1.5;
        ctx.fillText('🏗️', p.cx - 14, p.cy - 12 + bounce);
      }
    }
    this.drawNightLights(state, t);
  }

  // ---------- آثار باستانی، منابع کمیاب، قبایل و نام مناطق ----------
  drawWorldFlavor(state, t) {
    const ctx = this.ctx;
    const z = this.cam.z;

    // --- نام مناطق: فقط در زوم دور، مثل اطلس کهن ---
    if (z < 0.42 && state.regions?.length) {
      ctx.save();
      ctx.textAlign = 'center';
      const fs = clamp(20 / z, 26, 76);
      ctx.font = `700 ${fs}px Vazirmatn, Tahoma`;
      for (const rg of state.regions) {
        if (!rg.provs?.length) continue;
        const alpha = clamp((0.42 - z) * 3.2, 0, 0.42);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#1a1408';
        ctx.fillText(rg.name, rg.cx + fs * 0.05, rg.cy + fs * 0.05);
        ctx.globalAlpha = alpha * 1.25;
        ctx.fillStyle = 'rgba(255,240,205,0.92)';
        ctx.fillText(rg.name, rg.cx, rg.cy);
      }
      ctx.restore();
    }

    // --- نشان آثار و منابع: فقط در زوم نزدیک ---
    if (z > 0.30) {
      ctx.save();
      ctx.textAlign = 'center';
      const fs = clamp(13 / z, 10, 22);
      for (const p of state.map.provs) {
        if (!p.landmark && !p.rare && !p.tribe) continue;
        let ox = 0;
        if (p.landmark) {
          const L = LANDMARKS[p.landmark];
          if (L) {
            ctx.font = `${fs}px serif`;
            const yy = p.cy - 18 + Math.sin(t * 1.4 + p.id) * 0.8;
            // هاله‌ی طلایی محو پشت اثر
            ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 1.8 + p.id);
            const g = ctx.createRadialGradient(p.cx - 11, yy - 3, 0.5, p.cx - 11, yy - 3, fs * 1.1);
            g.addColorStop(0, 'rgba(255,226,150,0.9)'); g.addColorStop(1, 'rgba(255,200,90,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(p.cx - 11, yy - 3, fs * 1.1, 0, 7); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillText(L.icon, p.cx - 11, yy);
            ox = 11;
          }
        }
        if (p.rare) {
          const Rr = RARE_RES[p.rare];
          if (Rr) {
            ctx.font = `${fs * 0.9}px serif`;
            ctx.globalAlpha = 0.95;
            ctx.fillText(Rr.icon, p.cx + ox, p.cy - 18);
            ctx.globalAlpha = 1;
          }
        }
        // قبایل مستقل: چادر و نام
        if (p.tribe && p.owner < 0) {
          ctx.font = `${fs}px serif`;
          ctx.globalAlpha = 0.9;
          ctx.fillText('⛺', p.cx, p.cy + 2);
          if (z > 0.5) {
            ctx.font = `600 ${clamp(9 / z, 8, 13)}px Vazirmatn, Tahoma`;
            ctx.fillStyle = 'rgba(18,14,8,0.75)';
            ctx.fillText(p.tribe, p.cx + 1, p.cy + 15);
            ctx.fillStyle = 'rgba(238,226,196,0.9)';
            ctx.fillText(p.tribe, p.cx, p.cy + 14);
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    // --- بناهای عظیم در حال ساخت یا کامل ---
    for (const w of state.wonders || []) {
      const p = state.map.provs[w.prov];
      if (!p) continue;
      ctx.save();
      ctx.textAlign = 'center';
      const fs = clamp(20 / z, 14, 34);
      ctx.font = `${fs}px serif`;
      if (w.done) {
        // درخشش شکوه
        ctx.globalAlpha = 0.30 + 0.12 * Math.sin(t * 1.5 + p.id);
        const g = ctx.createRadialGradient(p.cx, p.cy - 24, 1, p.cx, p.cy - 24, fs * 1.7);
        g.addColorStop(0, 'rgba(255,232,160,0.95)'); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.cx, p.cy - 24, fs * 1.7, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillText(WONDER_ICON(w.key), p.cx, p.cy - 18);
      } else {
        ctx.globalAlpha = 0.85;
        ctx.fillText('🏗️', p.cx, p.cy - 20 + Math.sin(t * 3 + p.id) * 1.6);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.cx - 16, p.cy - 8, 32, 3.6);
        ctx.fillStyle = '#e8c766'; ctx.fillRect(p.cx - 16, p.cy - 8, 32 * clamp(w.prog / 100, 0, 1), 3.6);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  // ---------- چرخه‌ی شب‌وروز + چراغ‌های شهر ----------
  // خط جدایی شب و روز از راست به چپ روی نقشه می‌خزد؛ هر دور ≈ ۹۰ ثانیه.
  nightAt(worldX, t) {
    const W = this.W;
    const per = 90;                                   // ثانیه برای یک شبانه‌روز کامل
    const sun = ((t / per) % 1) * (W * 2) - W * 0.5;  // مرکز روز
    let d = Math.abs(worldX - sun);
    if (d > W) d = W * 2 - d;                          // پیچش دورانی
    // ۰ = نیم‌روز کامل، ۱ = نیمه‌شب کامل
    return clamp((d / W - 0.26) * 2.5, 0, 1);
  }
  drawNightLights(state, t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.map.provs) {
      const night = this.nightAt(p.cx, t);
      if (night < 0.18) continue;
      const pop = this.provPop(p);
      const urban = ['textile','tool_work','furniture','glasswork','arms_ind','university','port','railway','steel_mill','bank']
        .reduce((a, k) => a + (p.bld[k] || 0), 0);
      const lit = clamp(Math.sqrt(pop / 30000) * 0.5 + urban * 0.16, 0, 2.4);
      if (lit < 0.12) continue;
      const isCap = state.nations.some(nn => nn.alive && nn.capital === p.id);
      const power = lit * night * (isCap ? 1.5 : 1);
      // هاله‌ی گرمِ شهر
      const R0 = (5 + lit * 6) * (isCap ? 1.35 : 1);
      const g = ctx.createRadialGradient(p.cx, p.cy + 3, 0.5, p.cx, p.cy + 3, R0);
      const flick = 0.86 + 0.14 * Math.sin(t * 2.3 + p.id * 1.7);
      g.addColorStop(0, `rgba(255,214,132,${0.42 * power * flick})`);
      g.addColorStop(0.45, `rgba(255,178,88,${0.18 * power * flick})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.cx, p.cy + 3, R0, 0, 7); ctx.fill();
      // پنجره‌های تک‌تک (فقط در زوم نزدیک)
      if (this.cam.z > 0.55) {
        const rng = mulberry32(p.id * 977 + 3);
        const cnt = Math.min(14, Math.round(2 + lit * 5));
        for (let k = 0; k < cnt; k++) {
          const a = rng() * Math.PI * 2, r = rng() * (3 + lit * 4);
          const wx = p.cx + Math.cos(a) * r, wy = p.cy + 6 + Math.sin(a) * r * 0.6;
          const tw = 0.55 + 0.45 * Math.sin(t * (1.4 + rng() * 2.4) + k * 2.1);
          ctx.fillStyle = `rgba(255,225,150,${0.75 * night * tw})`;
          ctx.fillRect(wx - 0.55, wy - 0.55, 1.1, 1.1);
        }
      }
    }
    ctx.restore();
  }
  updateSmoke(state, dt) {
    // تولید ذرات دود برای استان‌های صنعتی
    this._smokeT = (this._smokeT || 0) + dt;
    if (this._smokeT > 0.14) {
      this._smokeT = 0;
      for (const p of state.map.provs) {
        const ind = (p.bld.textile || 0) + (p.bld.tool_work || 0) + (p.bld.arms_ind || 0) + (p.bld.glasswork || 0) + (p.bld.furniture || 0) + ((p.bld.steel_mill || 0) * 1.3);
        if (ind > 0 && Math.random() < Math.min(0.9, ind * 0.22) && this.smoke.length < 380) {
          this.smoke.push({ x: p.cx + (Math.random() - 0.5) * 14, y: p.cy - 6, vx: 1.5 + Math.random() * 2, vy: -7 - Math.random() * 5, life: 2.8 + Math.random() * 2, t: 0, r: 2.3 + Math.random() * 2 });
        }
      }
    }
    for (const s of this.smoke) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.smoke = this.smoke.filter(s => s.t < s.life);
  }
  drawSmoke(ctx) {
    for (const s of this.smoke) {
      const a = 0.26 * (1 - s.t / s.life);
      ctx.fillStyle = `rgba(72,68,64,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (1 + s.t * 1.1), 0, 7); ctx.fill();
    }
  }
  drawArmies(state, t) {
    const ctx = this.ctx;
    for (const a of state.armies) {
      const p = state.map.provs[a.prov];
      let x = p.cx, y = p.cy - 16;
      // جابه‌جایی بین دو استان
      if (a.status === 'move' && a.path && a.path.length > 1) {
        const q = state.map.provs[a.path[1]];
        const tt = clamp(a.prog, 0, 1);
        x = lerp(p.cx, q.cx, tt); y = lerp(p.cy - 16, q.cy - 16, tt);
        // خط مسیر
        ctx.save();
        ctx.strokeStyle = a.n >= 0 ? state.nations[a.n].c2 : '#c33';
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -t * 22;
        ctx.globalAlpha = 0.6; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        for (let i = 1; i < a.path.length; i++) { const r2 = state.map.provs[a.path[i]]; ctx.lineTo(r2.cx, r2.cy - 10); }
        ctx.stroke();
        ctx.restore();
      }
      const wob = Math.sin(t * 3 + a.id) * 1.2;
      const w2 = 26, h2 = 15;
      ctx.save();
      // سایه
      ctx.fillStyle = 'rgba(10,8,6,0.4)';
      ctx.beginPath(); ctx.ellipse(x, y + 9, 12, 3.4, 0, 0, 7); ctx.fill();
      // بدنه توکن با پرچم
      ctx.translate(x, y + wob * 0.4);
      ctx.fillStyle = '#efe6cc';
      ctx.strokeStyle = '#241c14'; ctx.lineWidth = 1.3;
      roundRect(ctx, -w2 / 2, -h2 / 2, w2, h2, 3); ctx.fill(); ctx.stroke();
      if (a.n >= 0) this.drawFlag(ctx, state.nations[a.n], -w2 / 2 + 1.5, -h2 / 2 + 1.5, 13, h2 - 3);
      else { ctx.fillStyle = '#8c2f39'; ctx.fillRect(-w2 / 2 + 1.5, -h2 / 2 + 1.5, 13, h2 - 3); ctx.font = '8px serif'; ctx.fillStyle = '#fff'; ctx.fillText('🔥', -w2 / 2 + 4, h2 / 2 - 3); }
      ctx.fillStyle = '#241c14';
      ctx.font = 'bold 9.5px Vazirmatn, Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText('🪖' + fa(Math.round(a.size)), 7.5, 3.5);
      ctx.restore();
      // نوار سازمان
      if (a.org < 99) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 12, y + 10, 24, 2.6);
        ctx.fillStyle = a.org > 50 ? '#7fb069' : '#d2691e';
        ctx.fillRect(x - 12, y + 10, 24 * a.org / 100, 2.6);
      }
    }
  }
  drawBattles(state, t) {
    const ctx = this.ctx;
    for (const b of state.battles) {
      const p = state.map.provs[b.prov];
      const pulse = 1 + Math.sin(t * 6) * 0.18;
      const flash = Math.max(0, Math.sin(t * 9.3 + b.id) - 0.86) * 6;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6);
      const g = ctx.createRadialGradient(p.cx, p.cy, 2, p.cx, p.cy, 30 * pulse);
      g.addColorStop(0, 'rgba(255,120,50,0.75)');
      g.addColorStop(0.5, 'rgba(200,40,20,0.35)');
      g.addColorStop(1, 'rgba(150,20,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.cx, p.cy, 30 * pulse, 0, 7); ctx.fill();
      if (flash > 0) {
        ctx.globalAlpha = flash;
        ctx.fillStyle = 'rgba(255,240,180,0.9)';
        ctx.beginPath(); ctx.arc(p.cx + Math.sin(t * 43) * 12, p.cy - Math.cos(t * 37) * 8, 4, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = '15px serif'; ctx.textAlign = 'center';
      ctx.fillText('⚔️', p.cx, p.cy - 20 + Math.sin(t * 6) * 2);
      ctx.restore();
    }
  }
  drawFx(state, dt) {
    const ctx = this.ctx;
    for (const f of state.fx) {
      f.t -= dt * 1.4;
      if (f.type === 'boom') {
        const k = 1 - Math.max(0, f.t);
        ctx.globalAlpha = Math.max(0, f.t) * 0.5;
        ctx.strokeStyle = '#ffdf9e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, 4 + k * 26, 0, 7); ctx.stroke();
        ctx.globalAlpha = Math.max(0, f.t) * 0.4;
        ctx.fillStyle = '#585049';
        ctx.beginPath(); ctx.arc(f.x + 6, f.y - 8 - k * 14, 5 + k * 6, 0, 7); ctx.fill();
      }
    }
    state.fx = state.fx.filter(f => f.t > 0);
    ctx.globalAlpha = 1;
  }
  drawSelection(state, ui, t) {
    const ctx = this.ctx;
    if (ui.hoverProv >= 0) {
      const p = state.map.provs[ui.hoverProv];
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 5);
      ctx.fillStyle = '#fff';
      fillProv(ctx, state, p);
      ctx.restore();
    }
    if (ui.selProv >= 0) {
      const p = state.map.provs[ui.selProv];
      ctx.save();
      ctx.strokeStyle = '#ffd97a';
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 4);
      strokeProv(ctx, state, p);
      ctx.restore();
    }
  }
  drawClouds(dt) {
    const ctx = this.ctx;
    for (const c of this.clouds) {
      c.x += c.s * dt;
      if (c.x - c.r > this.W + 100) { c.x = -c.r - 50; c.y = Math.random() * this.H; }
      const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(250,248,242,${c.o})`);
      g.addColorStop(1, 'rgba(250,248,242,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
    }
  }
  drawMinimap(state) {
    if (!this.mini) return;
    const { gw: GW, gh: GH } = state.map.grid;
    const W = this.W, H = this.H;
    const mw = this.mini.width, mh = this.mini.height;
    const c = this.mctx;
    c.clearRect(0, 0, mw, mh);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.decoCv, 0, 0, mw, mh);
    if (this.mapMode !== 'terrain') { c.globalAlpha = 0.8; c.drawImage(this.polCv, 0, 0, GW, GH, 0, 0, mw, mh); c.globalAlpha = 1; }
    // کادر دید
    const tl = this.toWorld(0, 0), br = this.toWorld(this.vw, this.vh);
    const x = (tl.x / W) * mw, y = (tl.y / H) * mh;
    const w = ((br.x - tl.x) / W) * mw, h = ((br.y - tl.y) / H) * mh;
    c.strokeStyle = 'rgba(255,220,140,0.9)'; c.lineWidth = 1.2;
    c.strokeRect(x, y, Math.max(6, w), Math.max(6, h));
  }
}

// ---------- کمکی ----------
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function bez(a, c, b, u) { const v = 1 - u; return v * v * a + 2 * v * u * c + u * u * b; }
function seaDir(state, p) {
  const { cells, gw: GW, gh: GH, cell: CELL } = state.map.grid;
  for (let a8 = 0; a8 < 8; a8++) {
    const ang = (a8 / 8) * Math.PI * 2;
    const gx = clamp(Math.round(p.cx / CELL + Math.cos(ang) * 3), 0, GW - 1);
    const gy = clamp(Math.round(p.cy / CELL + Math.sin(ang) * 3), 0, GH - 1);
    if (cells[gy * GW + gx] < 0) return { x: Math.cos(ang), y: Math.sin(ang) };
  }
  return { x: 0, y: -1 };
}
function WONDER_ICON(key) {
  return ({ grand_palace: '🏯', great_academy: '🎓', grand_canal: '🚢', citadel: '🛡️', great_temple: '🕌', world_bourse: '🏦' })[key] || '🏛️';
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1/6 ? pp + (q - pp) * 6 * t : t < 1/2 ? q : t < 2/3 ? pp + (q - pp) * (2/3 - t) * 6 : pp; };
  return [f(h + 1/3) * 255, f(h) * 255, f(h - 1/3) * 255];
}
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function contrast(c1, c2) {
  const a = hexToRgb(c1), lum = (a[0] * 0.3 + a[1] * 0.5 + a[2] * 0.2);
  return lum > 120 ? '#2b2418' : '#f5efdd';
}
function drawEmblem(ctx, em, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy);
  switch (em) {
    case 'sun':
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.12, -s * 0.2); ctx.lineTo(-s * 0.12, -s * 0.2); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, 7); ctx.fill();
      break;
    case 'crescent':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, Math.PI * 0.28, Math.PI * 1.72); ctx.arc(s * 0.22, 0, s * 0.4, Math.PI * 1.62, Math.PI * 0.38, true); ctx.closePath(); ctx.fill(); break;
    case 'star': { star(ctx, 0, 0, s * 0.55, s * 0.24, 5); ctx.fill(); break; }
    case 'tree':
      ctx.fillRect(-s * 0.07, 0, s * 0.14, s * 0.5);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.lineTo(-s * 0.4, s * 0.18); ctx.lineTo(s * 0.4, s * 0.18); ctx.closePath(); ctx.fill(); break;
    case 'mountain':
      ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.4); ctx.lineTo(-s * 0.1, -s * 0.45); ctx.lineTo(s * 0.1, -s * 0.05); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 0.55, s * 0.4); ctx.closePath(); ctx.fill(); break;
    case 'horse':
      ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.4); ctx.quadraticCurveTo(-s * 0.5, -s * 0.2, -s * 0.1, -s * 0.3); ctx.quadraticCurveTo(s * 0.15, -s * 0.55, s * 0.3, -s * 0.35); ctx.quadraticCurveTo(s * 0.5, -s * 0.1, s * 0.2, s * 0.05); ctx.lineTo(s * 0.35, s * 0.4); ctx.closePath(); ctx.fill(); break;
    case 'scimitar':
      ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.5, Math.PI * 0.15, Math.PI * 0.85); ctx.arc(0, -s * 0.2, s * 0.34, Math.PI * 0.85, Math.PI * 0.15, true); ctx.closePath(); ctx.fill();
      ctx.fillRect(-s * 0.05, s * 0.2, s * 0.1, s * 0.35); break;
    case 'coin':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'rose': {
      for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.ellipse(0, -s * 0.3, s * 0.16, s * 0.3, 0, 0, 7); ctx.fill(); }
      break;
    }
  }
  ctx.restore();
}
function star(ctx, x, y, r1, r2, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = (i * Math.PI) / n - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function fa(n) { return Number(n).toLocaleString('fa-IR'); }

function fillProv(ctx, state, p) {
  const { gw: GW, cell: CELL } = state.map.grid;
  ctx.beginPath();
  for (const i of p.cells) {
    const x = (i % GW) * CELL, y = ((i / GW) | 0) * CELL;
    ctx.rect(x, y, CELL, CELL);
  }
  ctx.fill();
}
function strokeProv(ctx, state, p) {
  const { gw: GW, gh: GH, cell: CELL } = state.map.grid;
  ctx.beginPath();
  const set = new Set(p.cells);
  for (const i of p.cells) {
    const x = i % GW, y = (i / GW) | 0;
    if (!set.has(i + 1) && x < GW - 1) { ctx.moveTo((x + 1) * CELL, y * CELL); ctx.lineTo((x + 1) * CELL, (y + 1) * CELL); }
    if (!set.has(i - 1) && x > 0) { ctx.moveTo(x * CELL, y * CELL); ctx.lineTo(x * CELL, (y + 1) * CELL); }
    if (!set.has(i + GW) && y < GH - 1) { ctx.moveTo(x * CELL, (y + 1) * CELL); ctx.lineTo((x + 1) * CELL, (y + 1) * CELL); }
    if (!set.has(i - GW) && y > 0) { ctx.moveTo(x * CELL, y * CELL); ctx.lineTo(x * CELL, y * CELL); }
  }
  ctx.stroke();
}
function prodValue(state, p) {
  let v = 0;
  for (const k in BUILDINGS) {
    const lvl = p.bld[k] || 0; if (!lvl) continue;
    const bd = BUILDINGS[k];
    for (const g in bd.prod) v += bd.prod[g] * lvl * state.goods[g].price;
    if (bd.income) v += bd.income * lvl;
  }
  return v;
}
export { prodValue };

