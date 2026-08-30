// ---------- ساخت نقشه‌ی واقعی جهان از روی داده‌ی worlddata ----------
// خروجی با همان ساختار map در حالت فانتزی: grid/provs/capitals/rivers/coastSea
import { WORLD_GW, WORLD_GH, WORLD_RLE, WORLD_REGIONS, WORLD_CITIES } from './worlddata.js';
import { mulberry32, makeNoise2D, fbm, pick, clamp } from './utils.js';
import { OTHER_NATION } from './timelines.js';

export const CELL = 10;

// نام فارسی منطقه‌ها برای تولید نام استان‌های بی‌شهر
const REGION_FA = {
  RUS: 'روسیه', CAN: 'کانادا', USA: 'آمریکا', MEX: 'مکزیک', BRA: 'برزیل', ARG: 'آرژانتین', CHL: 'شیلی', PER: 'پرو', COL: 'کلمبیا',
  CHN: 'چین', IND: 'هند', KAZ: 'قزاقستان', MON: 'مغولستان', JPN: 'ژاپن', KOR: 'کره', MAN: 'منچوری', TWN: 'تایوان', INO: 'هندوچین',
  THA: 'تایلند', MYS: 'مالایا', INS: 'اندونزی', PHI: 'فیلیپین', BUR: 'بنگال', PAK: 'پاکستان', AFG: 'افغانستان', IRN: 'ایران',
  TUR: 'آناتولی', IRQ: 'عراق', ARB: 'عربستان', LEV: 'شام', EGY: 'مصر', NAF: 'مغرب', WAF: 'غرب آفریقا', CAF: 'مرکز آفریقا',
  EAF: 'شرق آفریقا', SAF: 'جنوب آفریقا', MAD: 'ماداگاسکار', GBR: 'بریتانیا', IRL: 'ایرلند', FRA: 'فرانسه', GER: 'آلمان',
  AUT: 'اتریش', HUN: 'مجارستان', CZE: 'بوهم', YUG: 'بالکان', ITA: 'ایتالیا', IBE: 'ایبری', BEN: 'بنلوکس', CHE: 'سوئیس',
  SCA: 'اسکاندیناوی', FIN: 'فنلاند', BAL: 'بالتیک', POL: 'لهستان', ROM: 'رومانی', BUL: 'بلغارستان', GRE: 'یونان', ISL: 'ایسلند',
  GRL: 'گرینلند', AUS: 'استرالیا', NZL: 'نیوزیلند',
};
const DIRS = ['شمالی', 'جنوبی', 'شرقی', 'غربی', 'مرکزی', 'ساحلی'];
// بانک نام برای منطقه‌های پهناور
const NAME_BANK = {
  RUS: ['مسکووی', 'اورال', 'سیبری', 'کازان', 'تاتارستان', 'قفقاز', 'کولیما'],
  CAN: ['کبک', 'انتاریو', 'مانیتوبا', 'ساسکاچوان', 'نورث‌وست', 'یوکان'],
  USA: ['نیوانگلند', 'آپالاش', 'غرب میانه', 'تگزاس', 'کالیفرنیا', 'فلوریدا'],
  CHN: ['هواپه', 'شاندونگ', 'سیچوان', 'یوننان', 'سین‌کیانگ', 'منطقه‌ی خودمختار تبت'],
  BRA: ['آمازون', 'میناس', 'سائوپائولو', 'سرادو'],
  AUS: ['کوئینزلند', 'نیو ساوت ولز', 'ویکتوریا', 'استرالیای غربی', 'نورترن'],
  IND: ['پنجاب', 'راجستان', 'گجرات', 'دهلی', 'مهاراشترا', 'بنگال'],
  KAZ: ['قزاقستان شمالی', 'قزاقستان مرکزی', 'ترکستان'],
  MON: ['گوی', 'دارخان', 'جنوب گبی'],
  SAF: ['کیپ', 'ترانسفال', 'ناتال', 'کارو'],
  ARG: ['پامپا', 'پاتاگونیا', 'کویو'],
  NAF: ['مغرب', 'الجزیره', 'تونس', 'طرابلس', 'فزان'],
  WAF: ['ساحل طلا', 'ساحل عاج', 'نیجریه', 'ساحل دانه'],
  CAF: ['کامرون', 'چاد', 'دارفور', 'کنگو شمالی'],
  EAF: ['حبشه', 'سومالی', 'کنیا', 'تانگانیکا'],
  INS: ['سوماترا', 'جاوه', 'بورنئو', 'گینه‌ی نو'],
  INO: ['تونکین', 'آنام', 'کامبوج', 'میانمار'],
  SCA: ['نروژ', 'سوئد', 'دانمارک'],
};

// منطقه‌های خشک (بیابان‌خیز)
const DESERT_REGS = new Set(['NAF', 'ARB', 'IRQ', 'EGY', 'MEX', 'LEV', 'SAF', 'AUS', 'MON', 'WAF', 'CAF', 'KAZ', 'IRN', 'EAF', 'PER', 'CHL', 'ARG', 'CEN']);
// منطقه‌های زغال‌خیز
const COAL_REGS = new Set(['GER', 'GBR', 'FRA', 'USA', 'CHN', 'RUS', 'POL', 'IND', 'AUS', 'SAF', 'CZE', 'BEN', 'CAN', 'UKR', 'KAZ']);
// منطقه‌های آهن‌خیز
const IRON_REGS = new Set(['GER', 'GBR', 'FRA', 'USA', 'CHN', 'RUS', 'POL', 'IND', 'AUS', 'SAF', 'BRA', 'SCA', 'TUR', 'IRN', 'CAN', 'UKR', 'MYS', 'PER', 'CHL']);

// کوهستان‌های شناخته‌شده: [lon0, lon1, lat1(شمال), lat0(جنوب)]
const MOUNTAIN_RECTS = [
  [-79, -66, 7, -56],   // آند
  [-125, -104, 60, 32], // راکی
  [65, 100, 36, 27],    // هیمالیا و تبت
  [6, 16, 48, 44],      // آلپ
  [40, 48, 44, 40],     // قفقاز
  [55, 66, 68, 55],     // اورال
  [5, 14, 70, 60],      // اسکاندیناوی
  [-10, 10, 36, 30],    // اطلس
  [34, 40, -6, -9],     // ارتفاعات شرق آفریقا
  [70, 95, 50, 42],     // تیان‌شان و آلتای
  [104, 119, 36, 30],   // چین مرکزی (چینلینگ)
  [70, 78, 38, 34],     // پامیر
  [-100, -95, 32, 25],  // سیرا مادره شرقی
];

export function genRealMap(seed, tl) {
  const GW = WORLD_GW, GH = WORLD_GH;
  const rng = mulberry32(seed ^ 0x51ab7e);
  const noise = makeNoise2D(rng), noiseM = makeNoise2D(rng);

  // --- ۱) رمزگشایی RLE → منطقه ---
  const regionCells = new Int16Array(GW * GH).fill(-1);
  let i = 0;
  for (const run of WORLD_RLE.split(';')) {
    if (!run) continue;
    const [len, code] = run.split(':');
    const l = parseInt(len, 36), c = parseInt(code, 36) - 1;
    for (let k = 0; k < l; k++) regionCells[i++] = c;
  }

  // --- ۲) نقشه‌ی منطقه → ملت ---
  const defs = [...tl.nations, { ...OTHER_NATION, key: 'OTHER' }];
  const codeToNation = new Map();
  for (const n of defs) for (const rc of n.regions || []) codeToNation.set(rc, n.key);
  const nationIdx = new Map(defs.map((n, idx) => [n.key, idx]));
  const cellNation = new Int16Array(GW * GH).fill(-1);
  const landCells = [];
  for (let k = 0; k < GW * GH; k++) {
    if (regionCells[k] < 0) continue;
    const code = WORLD_REGIONS[regionCells[k]];
    const key = codeToNation.get(code) || 'OTHER';
    cellNation[k] = nationIdx.get(key);
    landCells.push(k);
  }

  // --- ۳) استان‌ها: سیل‌گرفتگی هر ملت با حداکثر اندازه ---
  const MAXP = 110;
  const assigned = new Uint8Array(GW * GH);
  const provOf = new Int32Array(GW * GH).fill(-1);
  const provs = [];
  for (let ni = 0; ni < defs.length; ni++) {
    while (true) {
      // بذر: شمالی‌ترین سلول تخصیص‌نیافته (پایدار و قطعی)
      let seed = -1;
      for (let y = 0; y < GH && seed < 0; y++) for (let x = 0; x < GW; x++) {
        const k = y * GW + x;
        if (!assigned[k] && cellNation[k] === ni) { seed = k; break; }
      }
      if (seed < 0) break;
      const stack = [seed];
      assigned[seed] = 1;
      const cells = [];
      while (stack.length && cells.length < MAXP) {
        const cur = stack.pop();
        cells.push(cur);
        provOf[cur] = provs.length;
        const x = cur % GW, y = (cur / GW) | 0;
        const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of nbs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const j = ny * GW + nx;
          if (assigned[j] || cellNation[j] !== ni) continue;
          assigned[j] = 1;
          stack.push(j);
        }
      }
      // اتصال مجدد سلول‌های سرریز (اگر بیش از MAXP بود، بقیه به بذر بعدی می‌رسند)
      provs.push({ id: provs.length, cells, owner: ni, controller: ni, adj: [], coast: false, terrain: 'plains', river: 0, res: { farm: 0.5, wood: 0.1, iron: 0, coal: 0 } });
    }
  }
  // بازنویسی cells با شناسه‌ی استان (بدون مالک = دریا)
  const cells = new Int32Array(GW * GH).fill(-1);
  for (const p of provs) for (const k of p.cells) cells[k] = p.id;

  // --- ۴) مرکز، همسایگی، ساحل، ارتفاع/رطوبت ---
  const elev = new Float32Array(GW * GH), moist = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x;
    const nx = x / GW, ny = y / GH;
    const m = fbm(noiseM, nx * 7 + 3, ny * 7 + 1, 3);
    moist[k] = clamp(0.42 + (m - 0.5) * 0.75 - (y < GH * 0.22 ? 0.18 : 0) - (y > GH * 0.72 ? 0.08 : 0), 0, 1);
    elev[k] = cells[k] < 0 ? 0.34 + m * 0.16 : 0.60 + m * 0.18;
  }
  const provSet = new Set();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x, a = cells[k];
    if (a < 0) continue;
    const p = provs[a];
    p.cx = (p.cx || 0) + x; p.cy = (p.cy || 0) + y;
    const dirs = [[1, 0], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx, b = cells[j];
      if (b < 0) { p.coast = true; continue; }
      if (b !== a) { if (!p.adj.includes(b)) p.adj.push(b); if (!provs[b].adj.includes(a)) provs[b].adj.push(a); }
    }
    if (x > 0 && cells[k - 1] < 0) p.coast = true;
    if (y > 0 && cells[k - GW] < 0) p.coast = true;
    provSet.add(a);
  }
  for (const p of provs) {
    const n = p.cells.length;
    p.cx = (p.cx / n + 0.5) * CELL;
    p.cy = (p.cy / n + 0.5) * CELL;
    const lat = 90 - (p.cy / CELL + 0.5) / GH * 180;
    const lon = (p.cx / CELL + 0.5) / GW * 360 - 180;
    // زمین بر اساس عرض جغرافیایی + کوهستان‌ها + رطوبت
    const m = clamp(p.cells.reduce((a, k) => a + moist[k], 0) / n, 0, 1);
    const inMount = MOUNTAIN_RECTS.some(([x0, x1, y1, y0]) => lon >= x0 && lon <= x1 && lat <= y1 && lat >= y0);
    const code = p.owner < defs.length ? defs[p.owner].key : 'OTHER';
    let terr;
    if (inMount) terr = 'mountain';
    else if (lat > 66) terr = 'mountain'; // توندرا
    else if (DESERT_REGS.has(code) && lat > 8 && lat < 42 && m < 0.55) terr = 'desert';
    else if (lat < 12 && m > 0.3) terr = 'forest';
    else if (m > 0.66) terr = 'forest';
    else if (m < 0.30) terr = 'desert';
    else if (m > 0.58 && lat > 30) terr = 'hills';
    else terr = 'plains';
    p.terrain = terr;
    p.res.farm = terr === 'plains' ? 0.9 : terr === 'wetland' ? 0.75 : terr === 'forest' ? 0.4 : terr === 'hills' ? 0.35 : terr === 'desert' ? 0.12 : 0.05;
    p.res.wood = terr === 'forest' ? 1 : terr === 'hills' ? 0.45 : terr === 'mountain' ? 0.1 : 0.08;
    const r = rng();
    if (COAL_REGS.has(code) && terr !== 'desert') p.res.coal = 0.35 + r * 0.65;
    if (IRON_REGS.has(code)) p.res.iron = (terr === 'mountain' || terr === 'hills' ? 0.4 : 0.2) + rng() * 0.5;
  }

  // --- ۵) نام استان‌ها از روی شهرها ---
  const cityByProv = new Map();
  for (const [name, ci] of WORLD_CITIES) {
    const pid = cells[ci];
    if (pid >= 0 && !cityByProv.has(pid)) cityByProv.set(pid, name);
  }
  const bankIdx = {};
  for (const p of provs) {
    const code = defs[p.owner].key;
    const cname = cityByProv.get(p.id);
    if (cname) { p.name = cname; p.hasCity = true; }
    else {
      const bank = NAME_BANK[code] || [REGION_FA[code] || code];
      const bi = bankIdx[code] = (bankIdx[code] || 0) + 1;
      p.name = bank[(bi - 1) % bank.length] + ' ' + DIRS[(bi + p.id) % DIRS.length];
      p.hasCity = false;
    }
  }

  // --- ۶) پایتخت‌ها ---
  const capitals = new Array(defs.length).fill(0);
  for (let ni = 0; ni < defs.length; ni++) {
    const def = defs[ni];
    const mine = provs.filter(p => p.owner === ni);
    if (!mine.length) { capitals[ni] = 0; continue; }
    let cap = -1;
    if (def.capital) {
      const cityIdx = WORLD_CITIES.findIndex(([nm]) => nm === def.capital);
      if (cityIdx >= 0) {
        const ci = WORLD_CITIES[cityIdx][1];
        const pid = cells[ci];
        if (pid >= 0 && provs[pid].owner === ni) cap = pid;
      }
    }
    if (cap < 0) cap = mine.reduce((a, b) => (b.cells.length > a.cells.length ? b : a), mine[0]).id;
    capitals[ni] = cap;
  }

  // --- ۷) ساحل دریایی (امواج) + رودخانه‌های نمادین ---
  const coastSea = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x;
    if (cells[k] >= 0) continue;
    if ((x > 0 && cells[k - 1] >= 0) || (x < GW - 1 && cells[k + 1] >= 0) || (y > 0 && cells[k - GW] >= 0) || (y < GH - 1 && cells[k + GW] >= 0)) coastSea.push(k);
  }
  const rivers = [];

  return {
    seed,
    grid: { gw: GW, gh: GH, cell: CELL, cells, elev, moist, seaLevel: 0.535 },
    provs,
    nNations: defs.length,
    capitals,
    rivers,
    coastSea,
    cityProv: cityByProv,
    w: GW * CELL, h: GH * CELL,
    real: true,
  };
}
