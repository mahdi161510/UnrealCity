// ---------- جهان داستان‌دار: مناطق نام‌دار، آثار باستانی، منابع کمیاب، مرزهای بکر ----------
// نقشه همچنان procedural است (تکرارپذیری بالا) اما دیگر بی‌روح نیست:
// هر بخش از جهان نام دارد، ویرانه‌ها و شگفتی‌های باستانی روی زمین پخش‌اند،
// منابع کمیاب خوراک تجارت‌اند، و بخشی از قاره دست‌نخورده مانده تا گسترش معنا پیدا کند.

import { clamp, pick, mulberry32 } from './utils.js';

// ================== مناطق جغرافیایی ==================
// نام‌ها بر پایه‌ی زیست‌بوم غالب انتخاب می‌شوند تا با نقشه جور دربیایند.
const REGION_NAMES = {
  cold:   ['کرانه‌ی یخ‌بسته', 'سرزمین شمالگان', 'دشت‌های برفی', 'مرز سپید', 'کوهسار سرد'],
  temper: ['کرانه‌ی زرین', 'دشت‌های بی‌پایان', 'میان‌رودان', 'سرزمین سبز', 'جلگه‌ی مهرگان', 'کرانه‌ی آرام'],
  forest: ['بیشه‌زار کهن', 'جنگل‌های تاریک', 'سرزمین درختان', 'بیشه‌ی زمرد'],
  hills:  ['کوهسار بلند', 'سرزمین سنگ', 'بلندی‌های شکسته', 'دژکوه'],
  dry:    ['ریگزار بزرگ', 'بیابان تشنه', 'دشت سوزان', 'کرانه‌ی شن'],
  coast:  ['کرانه‌ی مرواریدنشان', 'بندرگاه‌های زرین', 'ساحل بادخیز', 'خلیج تجار'],
};

// ================== آثار باستانی و شگفتی‌ها ==================
// همه واقع‌گرا: دست‌ساز بشر یا پدیده‌ی طبیعی — بدون جادو.
export const LANDMARKS = {
  royal_road:  { name: 'جاده‌ی شاهی',        icon: '🛤️', rare: 0.9, desc: 'سنگ‌فرش امپراتوری کهن؛ کاروان‌ها هنوز از آن می‌گذرند.',
    mods: { tradeCap: 0.16, moveSpeed: 0.12 }, terrain: ['plains', 'dry', 'hills'] },
  old_aqueduct:{ name: 'آب‌راه کهن',         icon: '🏛️', rare: 0.8, desc: 'قنات‌ها و طاق‌های سنگی که هنوز آب می‌رسانند.',
    mods: { farm: 0.20, popGrowth: 0.08 }, terrain: ['plains', 'dry'] },
  ruined_lib:  { name: 'ویرانه‌ی کتابخانه',  icon: '📜', rare: 0.55, desc: 'لوح‌های نیم‌سوخته‌ی دانشی که فراموش شد.',
    mods: { research: 0.18, literacy: 0.10 }, terrain: ['plains', 'hills', 'forest'] },
  dead_fort:   { name: 'دژ متروک',           icon: '🏰', rare: 0.9, desc: 'باروی سنگی نسل‌های پیشین؛ هنوز استوار است.',
    mods: { defense: 0.25, digCap: 0.15 }, terrain: ['hills', 'forest', 'plains'] },
  great_bazaar:{ name: 'بازار بزرگ',         icon: '🕌', rare: 0.7, desc: 'راسته‌های سرپوشیده‌ای که از شرق تا غرب آوازه دارند.',
    mods: { tradeCap: 0.22, taxIncome: 0.10 }, terrain: ['plains', 'dry', 'coast'] },
  salt_flats:  { name: 'کویر نمک',           icon: '🧂', rare: 0.6, desc: 'دریاچه‌ی خشکیده‌ای که نمکش سرمایه است.',
    mods: { prod: 0.10, tradeCap: 0.08 }, terrain: ['dry'] },
  hot_springs: { name: 'چشمه‌های گرم',       icon: '♨️', rare: 0.5, desc: 'آب‌های شفابخش که بیماران از دوردست می‌آیند.',
    mods: { popGrowth: 0.14, unrest: -0.10 }, terrain: ['hills', 'forest'] },
  great_falls: { name: 'آبشار بزرگ',         icon: '🌊', rare: 0.5, desc: 'غرشی که از فرسنگ‌ها شنیده می‌شود؛ نیروی آسیاب‌ها.',
    mods: { prod: 0.16 }, terrain: ['hills', 'forest'] },
  obelisk:     { name: 'ستون یادبود',        icon: '🗿', rare: 0.45, desc: 'سنگ‌نوشته‌ای از پادشاهی که نامش رفته است.',
    mods: { prestigeFlat: 3, legitimacy: 0.08 }, terrain: ['dry', 'plains', 'hills'] },
  deep_harbor: { name: 'لنگرگاه ژرف',        icon: '⚓', rare: 0.7, desc: 'خلیجی طبیعی که بزرگ‌ترین ناوها را در خود جای می‌دهد.',
    mods: { navy: 0.20, tradeCap: 0.12 }, terrain: ['coast'] },
  iron_veins:  { name: 'رگه‌های آشکار آهن',  icon: '⛏️', rare: 0.6, desc: 'کوهی که آهنش از سطح زمین پیداست.',
    mods: { ironBonus: 0.30 }, terrain: ['hills'] },
  sacred_grove:{ name: 'بیشه‌ی مقدس',        icon: '🌳', rare: 0.5, desc: 'درختان کهنی که نیایشگاه مردمان‌اند.',
    mods: { stability: 0.10, legitimacy: 0.06 }, terrain: ['forest'] },
};
export const LANDMARK_KEYS = Object.keys(LANDMARKS);

// ================== منابع کمیاب ==================
// خوراک سامانه‌ی تجارت: کم‌یاب، گران، و انگیزه‌ی فتح.
export const RARE_RES = {
  gems:    { name: 'سنگ گران‌بها', icon: '💎', desc: 'یاقوت و فیروزه؛ زینت تاج‌ها', mods: { taxIncome: 0.14, prestigeFlat: 2 }, weight: 1.0 },
  niter:   { name: 'شوره',         icon: '⚗️', desc: 'ماده‌ی جان باروت', mods: { armyAtk: 0.08, armsProd: 0.20 }, weight: 1.1 },
  horses:  { name: 'اسب اصیل',     icon: '🐎', desc: 'نژادی که باد را جا می‌گذارد', mods: { moveSpeed: 0.18, armyMor: 0.06 }, weight: 1.2 },
  purple:  { name: 'رنگ ارغوان',   icon: '🟣', desc: 'رنگی که تنها شاهان می‌پوشند', mods: { taxIncome: 0.10, relGain: 0.08 }, weight: 0.8 },
  incense: { name: 'کندر',         icon: '🪔', desc: 'دود خوش‌بوی نیایشگاه‌ها', mods: { legitimacy: 0.10, stability: 0.06 }, weight: 0.9 },
  amber:   { name: 'کهربا',        icon: '🟠', desc: 'اشک سنگ‌شده‌ی درختان کهن', mods: { tradeCap: 0.14 }, weight: 0.7 },
  silver:  { name: 'نقره',         icon: '🪙', desc: 'رگه‌های سپید در دل کوه', mods: { taxIncome: 0.18 }, weight: 1.0 },
  tea:     { name: 'برگ چای',      icon: '🍵', desc: 'کشتزارهای مه‌گرفته‌ی بلندی‌ها', mods: { tradeCap: 0.10, unrest: -0.06 }, weight: 0.9 },
};
export const RARE_KEYS = Object.keys(RARE_RES);

// ================== بناهای عظیم ==================
// پروژه‌های چندساله و پرهزینه؛ نماد اوج یک امپراتوری.
export const WONDERS = {
  grand_palace: { name: 'کاخ بزرگ',        icon: '🏯', cost: 24000, weeks: 130, desc: 'تختگاهی که سفیران را به زانو درمی‌آورد.',
    mods: { legitimacy: 0.18, prestigeFlat: 14, relGain: 0.10 } },
  great_academy:{ name: 'فرهنگستان بزرگ',  icon: '🎓', cost: 21000, weeks: 120, desc: 'گردهم‌آیی دانشمندان سراسر جهان.',
    mods: { research: 0.28, literacy: 0.18, prestigeFlat: 10 } },
  grand_canal:  { name: 'آب‌راه بزرگ',     icon: '🚢', cost: 27000, weeks: 150, desc: 'دو دریا را به هم می‌دوزد.',
    mods: { tradeCap: 0.35, navy: 0.14, prestigeFlat: 12 }, needCoast: true },
  citadel:      { name: 'ارگ استوار',      icon: '🛡️', cost: 19000, weeks: 110, desc: 'بارویی که هیچ سپاهی نگشوده است.',
    mods: { defense: 0.32, stability: 0.10, prestigeFlat: 9 } },
  great_temple: { name: 'نیایشگاه بزرگ',   icon: '🕌', cost: 18000, weeks: 115, desc: 'گنبدی که از فرسنگ‌ها پیداست.',
    mods: { legitimacy: 0.22, stability: 0.14, prestigeFlat: 11 } },
  world_bourse: { name: 'تالار بورس جهان', icon: '🏦', cost: 23000, weeks: 125, desc: 'جایی که بهای کالاهای جهان تعیین می‌شود.',
    mods: { taxIncome: 0.22, tradeCap: 0.24, prestigeFlat: 10 } },
};
export const WONDER_KEYS = Object.keys(WONDERS);

// ================== قبایل مستقل مرزی ==================
export const TRIBE_NAMES = ['کوچ‌نشینان باد', 'مردمان سنگ', 'آزادگان دشت', 'قبیله‌ی شاهین', 'کوه‌نشینان',
  'ساکنان مه', 'رهروان نمک', 'تیره‌ی گرگ', 'دریانوردان آزاد', 'نگهبانان بیشه'];

// ================== راه‌اندازی ==================
export function initWorld(S) {
  if (S.timelineId !== 'victoria') {
    S.regions = []; S.wonders = [];
    for (const p of S.map.provs) { p.landmark = null; p.rare = null; p.region = null; p.tribe = null; }
    return;
  }
  const rng = mulberry32((S.seed ^ 0x1f2e3d4c) >>> 0);
  S.wonders = [];        // {key, nid, prov, prog, done}
  S.regions = [];

  // ---------- ۱) مناطق نام‌دار: خوشه‌بندی استان‌ها بر پایه‌ی موقعیت ----------
  buildRegions(S, rng);

  // ---------- ۲) مرزهای بکر: بخشی از استان‌های پیرامونی بی‌صاحب می‌شوند ----------
  openFrontier(S, rng);

  // ---------- ۳) آثار باستانی ----------
  placeLandmarks(S, rng);

  // ---------- ۴) منابع کمیاب ----------
  placeRares(S, rng);
}

function biomeKey(p) {
  if (p.coast && Math.random() < 0.5) return 'coast';
  const t = p.terrain;
  if (t === 'forest') return 'forest';
  if (t === 'hills' || t === 'mountain') return 'hills';
  if (t === 'desert' || t === 'dry') return 'dry';
  if (t === 'tundra' || t === 'snow') return 'cold';
  return 'temper';
}

function buildRegions(S, rng) {
  const provs = S.map.provs;
  const nReg = clamp(Math.round(provs.length / 9), 6, 16);
  // بذرها را پخش کن
  const seeds = [];
  const shuffled = [...provs].sort(() => rng() - 0.5);
  for (const p of shuffled) {
    if (seeds.length >= nReg) break;
    if (seeds.every(s => Math.hypot(s.cx - p.cx, s.cy - p.cy) > 260)) seeds.push(p);
  }
  while (seeds.length < nReg && shuffled.length) seeds.push(shuffled[seeds.length]);

  const used = new Set();
  seeds.forEach((sp, i) => {
    const bio = biomeKey(sp);
    let pool = REGION_NAMES[bio] || REGION_NAMES.temper;
    let nm = pick(rng, pool);
    let guard = 0;
    while (used.has(nm) && guard++ < 30) {
      pool = REGION_NAMES[pick(rng, Object.keys(REGION_NAMES))];
      nm = pick(rng, pool);
    }
    used.add(nm);
    S.regions.push({ id: i, name: nm, cx: sp.cx, cy: sp.cy, biome: bio, provs: [] });
  });

  // هر استان به نزدیک‌ترین منطقه
  for (const p of provs) {
    let best = 0, bd = Infinity;
    S.regions.forEach((r, i) => { const d = Math.hypot(r.cx - p.cx, r.cy - p.cy); if (d < bd) { bd = d; best = i; } });
    p.region = best;
    S.regions[best].provs.push(p.id);
  }
  // مرکز مناطق را اصلاح کن
  for (const r of S.regions) {
    if (!r.provs.length) continue;
    r.cx = r.provs.reduce((a, id) => a + provs[id].cx, 0) / r.provs.length;
    r.cy = r.provs.reduce((a, id) => a + provs[id].cy, 0) / r.provs.length;
  }
}

/** بخشی از استان‌های دورافتاده را بی‌صاحب می‌کند تا گسترش و استعمار معنا پیدا کند. */
function openFrontier(S, rng) {
  const provs = S.map.provs;
  const caps = S.nations.filter(n => n.alive).map(n => provs[n.capital]).filter(Boolean);
  // فاصله‌ی هر استان تا نزدیک‌ترین پایتخت
  const scored = provs.map(p => {
    const d = Math.min(...caps.map(c => Math.hypot(c.cx - p.cx, c.cy - p.cy)));
    return { p, d };
  }).sort((a, b) => b.d - a.d);

  const target = Math.floor(provs.length * 0.17);   // ~۱۷٪ جهان بکر می‌ماند
  let freed = 0;
  for (const { p } of scored) {
    if (freed >= target) break;
    if (p.owner < 0) continue;
    // پایتخت‌ها هرگز آزاد نمی‌شوند
    if (S.nations.some(n => n.capital === p.id)) continue;
    // ملت نباید زیر ۶ استان بیفتد
    const ownerCount = provs.filter(q => q.owner === p.owner).length;
    if (ownerCount <= 6) continue;
    p.owner = -1;
    p.controller = -1;
    p.tribe = pick(rng, TRIBE_NAMES);
    p.unrest = 0;
    // جمعیت قبیله‌ای کمتر است
    if (p.pops) for (const k in p.pops) p.pops[k] = Math.round(p.pops[k] * 0.42);
    freed++;
  }
  S.frontierCount = freed;
}

function placeLandmarks(S, rng) {
  const provs = S.map.provs;
  for (const p of provs) p.landmark = null;
  const target = Math.max(8, Math.round(provs.length * 0.16));
  let placed = 0, guard = 0;
  while (placed < target && guard++ < 3000) {
    const p = provs[Math.floor(rng() * provs.length)];
    if (p.landmark || p.owner === -2) continue;
    const bio = p.coast ? 'coast' : (p.terrain === 'forest' ? 'forest'
      : (p.terrain === 'hills' || p.terrain === 'mountain') ? 'hills'
      : (p.terrain === 'desert' || p.terrain === 'dry') ? 'dry' : 'plains');
    const fits = LANDMARK_KEYS.filter(k => LANDMARKS[k].terrain.includes(bio));
    if (!fits.length) continue;
    const k = fits[Math.floor(rng() * fits.length)];
    if (rng() > LANDMARKS[k].rare) continue;
    p.landmark = k;
    placed++;
  }
  S.landmarkCount = placed;
}

function placeRares(S, rng) {
  const provs = S.map.provs;
  for (const p of provs) p.rare = null;
  const target = Math.max(6, Math.round(provs.length * 0.13));
  let placed = 0, guard = 0;
  const bag = [];
  for (const k of RARE_KEYS) for (let i = 0; i < Math.round(RARE_RES[k].weight * 10); i++) bag.push(k);
  while (placed < target && guard++ < 3000) {
    const p = provs[Math.floor(rng() * provs.length)];
    if (p.rare) continue;
    const k = bag[Math.floor(rng() * bag.length)];
    // تناسب با زمین
    if (k === 'tea' && !(p.terrain === 'hills' || p.terrain === 'forest')) continue;
    if (k === 'horses' && !(p.terrain === 'plains' || p.terrain === 'dry')) continue;
    if (k === 'amber' && !p.coast) continue;
    if ((k === 'silver' || k === 'gems') && !(p.terrain === 'hills' || p.terrain === 'mountain')) continue;
    p.rare = k;
    placed++;
  }
  S.rareCount = placed;
}

// ================== ضرایب ==================
/** مجموع اثر آثار باستانی و منابع کمیابِ در اختیار یک ملت. */
export function worldMods(S, nid) {
  const out = {};
  const add = (o) => { for (const k in o) out[k] = (out[k] || 0) + o[k]; };
  for (const p of S.map.provs) {
    if (p.owner !== nid || p.controller !== nid) continue;
    if (p.landmark && LANDMARKS[p.landmark]) add(LANDMARKS[p.landmark].mods);
    if (p.rare && RARE_RES[p.rare]) add(RARE_RES[p.rare].mods);
  }
  for (const w of S.wonders || []) {
    if (w.nid === nid && w.done && WONDERS[w.key]) add(WONDERS[w.key].mods);
  }
  return out;
}

/** ضرایب یک استان تنها (برای نمایش در پنل استان). */
export function provMods(p) {
  const out = {};
  const add = (o) => { for (const k in o) out[k] = (out[k] || 0) + o[k]; };
  if (p.landmark && LANDMARKS[p.landmark]) add(LANDMARKS[p.landmark].mods);
  if (p.rare && RARE_RES[p.rare]) add(RARE_RES[p.rare].mods);
  return out;
}

export function regionOf(S, p) { return (S.regions || [])[p?.region] || null; }

// ================== بناهای عظیم: ساخت ==================
export function canBuildWonder(S, n, key, provId) {
  const W = WONDERS[key];
  if (!W) return { ok: false, why: 'ناشناخته' };
  const ex = (S.wonders || []).find(w => w.key === key);
  if (ex) return { ok: false, why: ex.done ? 'این بنا پیش‌تر در جهان ساخته شده است' : 'کشور دیگری هم‌اکنون در حال ساخت آن است' };
  if ((S.wonders || []).some(w => w.nid === n.id && !w.done)) return { ok: false, why: 'هم‌زمان تنها یک بنای عظیم' };
  const p = S.map.provs[provId];
  if (!p || p.owner !== n.id) return { ok: false, why: 'استان از آنِ شما نیست' };
  if (W.needCoast && !p.coast) return { ok: false, why: 'باید در استان ساحلی ساخته شود' };
  if (n.treasury < W.cost) return { ok: false, why: `خزانه کافی نیست (${Math.round(W.cost)})` };
  return { ok: true };
}

export function startWonder(S, n, key, provId) {
  const chk = canBuildWonder(S, n, key, provId);
  if (!chk.ok) return chk;
  const W = WONDERS[key];
  n.treasury -= W.cost;
  S.wonders = S.wonders || [];
  S.wonders.push({ key, nid: n.id, prov: provId, prog: 0, done: false, started: S.week });
  return { ok: true };
}

export function simWonders(S) {
  if (!S.wonders?.length) return;
  for (const w of S.wonders) {
    if (w.done) continue;
    const W = WONDERS[w.key];
    const n = S.nations[w.nid];
    if (!n?.alive) { w.dead = true; continue; }   // کشور نابود شد ⇒ بنا رها و کلیدش آزاد می‌شود
    const p = S.map.provs[w.prov];
    if (!p || p.owner !== w.nid) continue;       // ساخت متوقف می‌شود اگر استان از دست برود
    w.prog += 100 / W.weeks;
    if (w.prog >= 100) {
      w.prog = 100; w.done = true;
      n.prestige = (n.prestige || 0) + (W.mods.prestigeFlat || 8);
      if (S.addLogFn) S.addLogFn(S, W.icon, `${W.name} در ${p.name} به پایان رسید! شکوه ${n.name} زبانزد جهان شد.`);
    }
  }
  S.wonders = S.wonders.filter(w => !w.dead);
}
