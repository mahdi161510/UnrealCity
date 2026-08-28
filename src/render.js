// ---------- رندر نقشه: زمین نقاشی‌شده، مُدها، ذرات، ارتش‌ها ----------
import { GW, GH, CELL, W, H } from './mapgen.js';
import { clamp, lerp, mulberry32, smoothstep } from './utils.js';
import { BUILDINGS, TERRAIN, POP_CLASSES } from './data.js';
import { REBEL, atWar, warHas } from './sim.js';

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
    this.cam = { x: W / 2, y: H / 2, z: 0.55 };
    this.dirtyTerrain = true; this.dirtyPol = true; this.dirtyBorders = true;
    this.clouds = []; this.smoke = [];
    this.mapMode = 'political';
    this._flagCache = new Map();
  }
  attach(cv, mini) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.mini = mini; this.mctx = mini.getContext('2d');
    this.terCv = document.createElement('canvas'); this.terCv.width = GW; this.terCv.height = GH;
    this.polCv = document.createElement('canvas'); this.polCv.width = GW; this.polCv.height = GH;
    this.borCv = document.createElement('canvas');
    this.decoCv = document.createElement('canvas');
    this.resize();
    addEventListener('resize', () => this.resize());
    for (let i = 0; i < 16; i++) this.clouds.push({ x: Math.random() * W, y: Math.random() * H, r: 140 + Math.random() * 320, s: 4 + Math.random() * 10, o: 0.05 + Math.random() * 0.07 });
  }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.vw = r.width; this.vh = r.height;
    this.cv.width = r.width * devicePixelRatio; this.cv.height = r.height * devicePixelRatio;
  }

  // ---------- terrain ----------
  drawTerrain(state) {
    const { cells, elev, moist, seaLevel } = state.map.grid;
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
      }
      // سایه‌روشن شیب (نور از شمال‌غرب) → حس سه‌بعدی
      const dx = elev[x < GW - 1 ? i + 1 : i] - elev[x > 0 ? i - 1 : i];
      const dy = elev[y < GH - 1 ? i + GW : i] - elev[y > 0 ? i - GW : i];
      const shade = clamp((dx * -1.6 + dy * -1.1) * 2.2, -0.42, 0.42) * (isSea2 ? 0.35 : 1);
      // دانه‌بندی کاغذی
      const g = ((i * 7919) % 13 - 6);
      d[(i) * 4] = clamp((col[0] + g) * (1 + shade), 0, 255);
      d[(i) * 4 + 1] = clamp((col[1] + g) * (1 + shade), 0, 255);
      d[(i) * 4 + 2] = clamp((col[2] + g) * (1 + shade), 0, 255);
      d[(i) * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // بزرگنمایی نرم روی بوم تزئینی
    this.decoCv.width = W; this.decoCv.height = H;
    const dc = this.decoCv.getContext('2d');
    dc.imageSmoothingEnabled = true;
    dc.drawImage(this.terCv, 0, 0, W, H);
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
    const { cells } = state.map.grid;
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
        rgb = hexToRgb(n.c1);
        if (p.controller === REBEL) { rgb = [150, 42, 32]; }
        else if (p.controller !== p.owner) { const on = state.nations[p.controller]; rgb = mixRgb(hexToRgb(n.c1), hexToRgb(on.c1), 0.5); }
        const v = 0.85 + 0.15 * Math.min(1, p.cells.length / 80);
        rgb = [rgb[0] * v, rgb[1] * v, rgb[2] * v];
      } else if (mode === 'population') {
        const t = clamp(Math.sqrt(this.provPop(p) / maxPop), 0, 1);
        rgb = [lerp(40, 230, t), lerp(48, 210, (1 - t) * 0.5 + t * 0.2), lerp(60, 60, t)];
      } else if (mode === 'production') {
        const t = clamp(prodValue(state, p) / Math.max(maxProd, 1), 0, 1);
        rgb = [lerp(52, 232, t), lerp(46, 178, t), lerp(52, 66, t)];
      } else if (mode === 'unrest') {
        const t = clamp((p.unrest || 0) / 100, 0, 1);
        rgb = [lerp(52, 228, t), lerp(62, 40, t), lerp(66, 42, t)];
      }
      d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = a;
    }
    c.putImageData(img, 0, 0);
    this.dirtyPol = false;
  }

  drawBorders(state) {
    const { cells } = state.map.grid;
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
    this.cam.x = clamp(this.cam.x, -m, W + m); this.cam.y = clamp(this.cam.y, -m, H + m);
  }
  focusOn(x, y, z) { this.cam.x = x; this.cam.y = y; if (z) this.cam.z = z; this.clampCam(); }

  // ---------- فریم اصلی ----------
  draw(state, ui, t, dt) {
    const { ctx } = this;
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
    ctx.drawImage(this.decoCv, 0, 0);
    if (this.mapMode !== 'terrain') {
      ctx.globalAlpha = 0.86;
      ctx.drawImage(this.polCv, 0, 0, GW, GH, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(this.borCv, 0, 0);

    // درخشش ساحل (بس‌سویی ملایم)
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 0.7);
    ctx.drawImage(this.borCv, 0, 0);
    ctx.globalAlpha = 1;

    this.drawWaves(state, t);
    this.drawNames(state, ui);
    this.updateShips(state, dt);
    this.drawShips(t);
    this.drawRailways(state, dt, t);
    this.drawCities(state, t);
    this.updateSmoke(state, dt);
    this.drawSmoke(ctx);
    this.updateBirds(dt);
    this.drawBirds(t);
    this.drawArmies(state, t);
    this.drawBattles(state, t);
    this.drawFx(state, dt);
    this.drawSelection(state, ui, t);
    this.drawClouds(dt);
    ctx.restore();
    this.drawMinimap(state);
  }

  // ---------- امواج ساحلی ----------
  drawWaves(state, t) {
    const cs = state.map.coastSea;
    if (!cs || !cs.length) return;
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
      const ports = state.map.provs.filter(p => (p.bld.port || 0) > 0 && state.nations[p.owner].alive);
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
        x: -50, y: Math.random() * H * 0.6 + H * 0.12,
        sp: 30 + Math.random() * 20, vy: (Math.random() - 0.5) * 12,
        n: 4 + (Math.random() * 3 | 0), ph: Math.random() * 9,
      });
    }
    for (const f of this.birdsF) { f.x += f.sp * dt; f.y += f.vy * dt; }
    this.birdsF = this.birdsF.filter(f => f.x < W + 90 && f.y > -70 && f.y < H + 70);
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
      if (c.x - c.r > W + 100) { c.x = -c.r - 50; c.y = Math.random() * H; }
      const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(250,248,242,${c.o})`);
      g.addColorStop(1, 'rgba(250,248,242,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
    }
  }
  drawMinimap(state) {
    if (!this.mini) return;
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
  const { cells } = state.map.grid;
  for (let a8 = 0; a8 < 8; a8++) {
    const ang = (a8 / 8) * Math.PI * 2;
    const gx = clamp(Math.round(p.cx / CELL + Math.cos(ang) * 3), 0, GW - 1);
    const gy = clamp(Math.round(p.cy / CELL + Math.sin(ang) * 3), 0, GH - 1);
    if (cells[gy * GW + gx] < 0) return { x: Math.cos(ang), y: Math.sin(ang) };
  }
  return { x: 0, y: -1 };
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
  const { cells } = state.map.grid;
  ctx.beginPath();
  for (const i of p.cells) {
    const x = (i % GW) * CELL, y = ((i / GW) | 0) * CELL;
    ctx.rect(x, y, CELL, CELL);
  }
  ctx.fill();
}
function strokeProv(ctx, state, p) {
  const { cells } = state.map.grid;
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
