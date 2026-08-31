// ---------- جامعه: فرهنگ، مذهب، مشروعیت، جنبش‌ها و جنگ داخلی ----------
// هر استان فرهنگ و مذهبی دارد. اگر با فرهنگِ حاکم نخواند، جدایی‌طلبی می‌جوشد.
// جنبش‌های سیاسی (مشروطه‌خواه، سوسیالیست، ناسیونالیست…) رشد می‌کنند و اگر
// نادیده گرفته شوند، انقلاب یا جنگ داخلی می‌شود.

import { clamp, lerp, pick, mulberry32 } from './utils.js';
import { cabinetMods } from './characters.js';
import { projectMods } from './projects.js';

export const REBEL = -2;

// ---------------- فرهنگ‌ها ----------------
export const CULTURES = {
  aryan:    { name: 'آریایی',      icon: '🏛️', c: '#c9a227' },
  seruvi:   { name: 'سِروشهری',    icon: '🌿', c: '#4e8b3f' },
  turani:   { name: 'تورانی',      icon: '🐎', c: '#a4632c' },
  lajvard:  { name: 'لاجوردی',     icon: '💠', c: '#3c6ea5' },
  gulnari:  { name: 'گل‌ناری',     icon: '🌺', c: '#b7405e' },
  abani:    { name: 'آبانی',       icon: '⚖️', c: '#3f8f86' },
  nilpari:  { name: 'نیل‌پری',     icon: '🪷', c: '#6b4f9c' },
  biyabani: { name: 'بیابانی',     icon: '🏜️', c: '#c0913f' },
  marzbani: { name: 'مرزبانی',     icon: '🛡️', c: '#7a6a52' },
  kumi:     { name: 'کومی',        icon: '⛰️', c: '#5c6b74' },
  // برای نقشه‌ی واقعی
  latin:    { name: 'لاتین',       icon: '🕊️', c: '#a8443a' },
  germanic: { name: 'ژرمنی',       icon: '🦅', c: '#4a4a55' },
  slavic:   { name: 'اسلاوی',      icon: '❄️', c: '#3c6ea5' },
  anglo:    { name: 'آنگلوساکسون', icon: '⚓', c: '#8b3a3a' },
  sinic:    { name: 'چینی',        icon: '🐉', c: '#c23b22' },
  indic:    { name: 'هندی',        icon: '🪔', c: '#d08c2a' },
  semitic:  { name: 'سامی',        icon: '🕌', c: '#3f8f86' },
  turkic:   { name: 'تُرکی',       icon: '🌙', c: '#a4632c' },
  african:  { name: 'آفریقایی',    icon: '🦁', c: '#8a6b2f' },
  nippon:   { name: 'ژاپنی',       icon: '🌸', c: '#c85a7a' },
};

// ---------------- مذاهب ----------------
export const RELIGIONS = {
  mehri:    { name: 'مهرآیین',     icon: '☀️', tol: ['zarvani'] },
  zarvani:  { name: 'زروانی',      icon: '🌀', tol: ['mehri'] },
  ashavan:  { name: 'اشاوَن',      icon: '🔥', tol: [] },
  mahtabi:  { name: 'ماه‌تابی',    icon: '🌙', tol: ['zarvani'] },
  kohani:   { name: 'کهن‌آیین',    icon: '🪨', tol: [] },
  // واقعی
  christian:{ name: 'مسیحی',       icon: '✝️', tol: [] },
  muslim:   { name: 'مسلمان',      icon: '☪️', tol: [] },
  hindu:    { name: 'هندو',        icon: '🕉️', tol: ['buddhist'] },
  buddhist: { name: 'بودایی',      icon: '☸️', tol: ['hindu', 'shinto'] },
  shinto:   { name: 'شینتو',       icon: '⛩️', tol: ['buddhist'] },
  secular:  { name: 'سکولار',      icon: '🔬', tol: ['christian', 'muslim', 'hindu', 'buddhist', 'shinto'] },
};

// ---------------- جنبش‌های سیاسی ----------------
export const MOVEMENTS = {
  constit: {
    name: 'مشروطه‌خواهان', icon: '📜', want: 'gov:constit',
    desc: 'مجلس می‌خواهند و قانون بالای سر پادشاه.',
    grows: (S, n) => (n.laws.gov === 'absolut' ? 1.3 : -1.6) + (n.literacy || 12) / 34 + ((n.groups.intelligentsia?.clout || 0) / 22),
  },
  republic: {
    name: 'جمهوری‌خواهان', icon: '🗳️', want: 'gov:repub',
    desc: 'تاج را برمی‌دارند و رأی مردم را می‌نشانند.',
    grows: (S, n) => (n.laws.gov === 'repub' ? -2.2 : (n.laws.gov === 'constit' ? 0.5 : 0.15))
      + (n.literacy || 12) / 46 - ((n.legitimacy ?? 60) - 50) / 26,
  },
  socialist: {
    name: 'سوسیالیست‌ها', icon: '✊', want: 'labor:unions',
    desc: 'کار هشت‌ساعته، اتحادیه و نان بر سر سفره‌ی کارگر.',
    grows: (S, n) => (n.laws.labor === 'unions' ? -1.9 : 0.6) + ((n.groups.workers?.clout || 0) / 17)
      - Math.max(0, (avgSolS(S, n.id) - 14)) * 0.36,
  },
  nationalist: {
    name: 'ناسیونالیست‌ها', icon: '🦅', want: 'war',
    desc: 'شکوهِ ازدست‌رفته را می‌خواهند — با سرنیزه اگر لازم شد.',
    grows: (S, n) => (n.lostProvs > 0 ? n.lostProvs * 0.85 : -0.35) + ((n.warExh || 0) < 15 ? 0.35 : -0.85)
      + (n.tech.includes('romantik') ? 0.45 : 0),
  },
  clerical: {
    name: 'سنت‌گرایان', icon: '🕌', want: 'gov:absolut',
    desc: 'نظم کهن، تاج و منبر — همان‌طور که همیشه بوده.',
    grows: (S, n) => (n.laws.gov === 'absolut' ? -1.5 : 0.75) + ((n.groups.clergy?.clout || 0) / 24)
      - (n.literacy || 12) / 62,
  },
  separatist: {
    name: 'جدایی‌طلبان', icon: '🏴', want: 'independence',
    desc: 'می‌خواهند بروند و پرچم خودشان را بالا ببرند.',
    grows: (S, n) => (n.foreignCultureShare || 0) * 5.2 - 0.45,
  },
};
export const MOVE_KEYS = Object.keys(MOVEMENTS);

function avgSolS(S, nid) {
  let s = 0, c = 0;
  for (const p of S.map.provs) if (p.owner === nid) { const pp = Object.values(p.pops).reduce((a, b) => a + b, 0); s += (p.sol || 10) * pp; c += pp; }
  return c ? s / c : 10;
}

// ---------------- راه‌اندازی ----------------
const FANTASY_CULT = ['aryan', 'seruvi', 'turani', 'lajvard', 'gulnari', 'abani', 'nilpari', 'biyabani', 'marzbani', 'kumi'];
const FANTASY_REL = ['mehri', 'zarvani', 'ashavan', 'mahtabi', 'kohani'];

// نقشه‌ی واقعی: فرهنگ/مذهب از روی مختصات جغرافیایی
function realCultureFor(lon, lat) {
  if (lat > 34 && lon > -12 && lon < 32) return lat > 54 ? 'germanic' : (lon < 3 ? 'latin' : 'germanic');
  if (lon >= 30 && lon < 70 && lat > 36) return 'slavic';
  if (lat > 48 && lon > -12 && lon < 3) return 'anglo';
  if (lon >= 25 && lon < 65 && lat <= 42 && lat > 12) return lon > 43 ? 'turkic' : 'semitic';
  if (lon >= 65 && lon < 92 && lat < 38) return 'indic';
  if (lon >= 96 && lon < 128 && lat > 20) return 'sinic';
  if (lon >= 128 && lat > 30 && lat < 47) return 'nippon';
  if (lat < 18 && lon > -20 && lon < 52) return 'african';
  if (lon < -30) return lat > 25 ? 'anglo' : 'latin';
  if (lon > 92 && lat < 22) return 'indic';
  if (lat < -10 && lon > 100) return 'anglo';
  return 'latin';
}
function realReligionFor(cult, lon, lat) {
  if (cult === 'semitic' || cult === 'turkic') return 'muslim';
  if (cult === 'indic') return lon > 88 ? 'buddhist' : 'hindu';
  if (cult === 'sinic') return 'buddhist';
  if (cult === 'nippon') return 'shinto';
  if (cult === 'african') return lat > 8 ? 'muslim' : 'christian';
  return 'christian';
}

export function initSociety(S) {
  const rng = mulberry32((S.seed ^ 0xc0ffee) >>> 0);
  const real = !!S.map.real;
  const { gw, cell } = S.map.grid;

  // فرهنگ/مذهب هر ملت
  for (const n of S.nations) {
    if (real) {
      const cap = S.map.provs[n.capital];
      const lon = (cap.cx / cell + 0.5) / gw * 360 - 180;
      const lat = 90 - (cap.cy / cell + 0.5) / S.map.grid.gh * 180;
      n.culture = realCultureFor(lon, lat);
      n.religion = realReligionFor(n.culture, lon, lat);
    } else {
      n.culture = FANTASY_CULT[n.id % FANTASY_CULT.length];
      n.religion = FANTASY_REL[(n.id * 3 + 1) % FANTASY_REL.length];
    }
    n.stability = 50 + (n.pers === 'peaceful' ? 8 : n.pers === 'aggressive' ? -5 : 0);
    n.legitimacy = n.laws.gov === 'absolut' ? 68 : n.laws.gov === 'constit' ? 60 : 52;
    n.movements = {};
    for (const k of MOVE_KEYS) n.movements[k] = { power: 2 + rng() * 8, radical: 0 };
    n.lostProvs = 0;
    n.foreignCultureShare = 0;
    n.civilWar = null;
  }

  // فرهنگ/مذهب استان‌ها
  for (const p of S.map.provs) {
    const owner = S.nations[p.owner];
    if (real) {
      const lon = (p.cx / cell + 0.5) / gw * 360 - 180;
      const lat = 90 - (p.cy / cell + 0.5) / S.map.grid.gh * 180;
      p.culture = realCultureFor(lon, lat);
      p.religion = realReligionFor(p.culture, lon, lat);
    } else {
      // بیشتر استان‌ها فرهنگ حاکم؛ حاشیه‌ها اقلیت
      p.culture = rng() < 0.78 ? owner.culture : pick(rng, FANTASY_CULT);
      p.religion = rng() < 0.82 ? owner.religion : pick(rng, FANTASY_REL);
    }
    p.assim = p.culture === owner.culture ? 100 : 0;   // درصد هم‌گونی
    p.sepPressure = 0;
  }
}

// ---------------- تحمل و رضایت فرهنگی ----------------
export function isAccepted(S, n, p) {
  if (p.culture === n.culture) return true;
  if ((p.assim || 0) >= 70) return true;
  // قوانین مترقی، فرهنگ‌های بیشتری را می‌پذیرند
  if (n.laws.gov === 'repub') return true;
  if (n.laws.gov === 'constit' && (p.assim || 0) >= 35) return true;
  return false;
}
export function religiousTension(S, n, p) {
  if (p.religion === n.religion) return 0;
  const R = RELIGIONS[n.religion];
  if (R && R.tol.includes(p.religion)) return 0.35;
  return 1;
}

// ---------------- گام هفتگی ----------------
export function simSociety(S) {
  for (const n of S.nations) {
    if (!n.alive) continue;
    const cm = cabinetMods(S, n);
    const own = S.map.provs.filter(p => p.owner === n.id);
    if (!own.length) continue;

    // سهم جمعیت با فرهنگ بیگانه
    let foreign = 0, tot = 0;
    for (const p of own) {
      const pp = Object.values(p.pops).reduce((a, b) => a + b, 0);
      tot += pp;
      if (!isAccepted(S, n, p)) foreign += pp;
    }
    n.foreignCultureShare = tot > 0 ? foreign / tot : 0;

    // ---- مشروعیت ----
    let legitT = 55
      + (n.laws.gov === 'absolut' ? 10 : n.laws.gov === 'constit' ? 4 : -2)
      + (cm.legit || 0) * 2
      + Math.min(20, (n.prestige || 0) * 0.14)
      - (n.warExh || 0) * 0.22
      - n.foreignCultureShare * 22
      - (n.treasury < 0 ? 10 : 0);
    if (n.recentCoronation) legitT += 8;
    n.legitimacy = clamp(lerp(n.legitimacy ?? 60, clamp(legitT, 0, 100), 0.06), 0, 100);

    // ---- ثبات ----
    const avgUnrest = own.reduce((a, p) => a + p.unrest, 0) / own.length;
    const pmS = projectMods(S, n);
    let stabT = 62 + (cm.stability || 0) * 2.2 + (pmS.stability || 0) * 30 - avgUnrest * 0.62
      + ((n.legitimacy - 55) * 0.26) - (n.warExh || 0) * 0.16
      - (n.civilWar ? 30 : 0);
    // جنبش‌های رادیکال ثبات را می‌خورند
    let radSum = 0;
    for (const k of MOVE_KEYS) radSum += (n.movements?.[k]?.radical || 0);
    stabT -= radSum * 0.30;
    n.stability = clamp(lerp(n.stability ?? 50, clamp(stabT, 0, 100), 0.07), 0, 100);

    // ---- جنبش‌ها (هر ۴ هفته) ----
    if (S.week % 4 === 0) {
      n.movements = n.movements || {};
      for (const k of MOVE_KEYS) {
        const M = MOVEMENTS[k];
        if (!n.movements[k]) n.movements[k] = { power: 3, radical: 0 };
        const mv = n.movements[k];
        let g = 0;
        try { g = M.grows(S, n); } catch (e) { g = 0; }
        // سرکوب و رفاه، جنبش را می‌خواباند
        g -= (n.laws.gov === 'absolut' ? 0.45 : 0) + (cm.unrest ? -cm.unrest * 0.12 : 0);
        mv.power = clamp(mv.power + g * 0.55, 0, 100);
        // رادیکال‌شدن: جنبش قوی که خواسته‌اش برآورده نشود
        const satisfied = movementSatisfied(S, n, k);
        if (mv.power > 40 && !satisfied) mv.radical = clamp(mv.radical + (mv.power - 40) * 0.035, 0, 100);
        else mv.radical = clamp(mv.radical - 1.6, 0, 100);
      }
      // جنبش رادیکال ⇒ ناآرامی سراسری
      const worst = MOVE_KEYS.map(k => n.movements[k]).sort((a, b) => b.radical - a.radical)[0];
      if (worst && worst.radical > 45) {
        for (const p of own) p.unrest = clamp(p.unrest + worst.radical * 0.035, 0, 100);
      }
    }

    // ---- هم‌گونی فرهنگی (آرام و طولانی) ----
    if (S.week % 8 === 0) {
      const rate = 0.5 + (n.laws.gov === 'absolut' ? 0.35 : 0) + (n.tech.includes('literacy') ? 0.4 : 0)
        + (n.tech.includes('academy') ? 0.35 : 0);
      for (const p of own) {
        if (p.culture === n.culture) { p.assim = 100; continue; }
        if (p.controller !== n.id) continue;
        const uni = (p.bld.university || 0) * 0.55;
        const rail = (p.bld.railway || 0) * 0.35;
        p.assim = clamp((p.assim || 0) + (rate + uni + rail) * (p.unrest > 55 ? 0.3 : 1), 0, 100);
      }
    }

    // ---- فشار جدایی‌طلبی روی استان‌ها ----
    for (const p of own) {
      const notAcc = !isAccepted(S, n, p);
      const relT = religiousTension(S, n, p);
      const sepMov = (n.movements?.separatist?.power || 0) / 100;
      const target = (notAcc ? 26 : 0) + relT * 12 + sepMov * 26 - (p.assim || 0) * 0.18
        - (cm.unrest ? -cm.unrest * 1.5 : 0);
      p.sepPressure = clamp(lerp(p.sepPressure || 0, Math.max(0, target), 0.05), 0, 100);
      // فشار جدایی مستقیماً به ناآرامی می‌افزاید
      if (p.sepPressure > 12) p.unrest = clamp(p.unrest + p.sepPressure * 0.012, 0, 100);
    }

    // ---- جنگ داخلی ----
    if (!n.civilWar && n.stability < 14 && (n.legitimacy ?? 60) < 30 && own.length >= 3 && (n.civilWarCd || 0) <= 0) {
      startCivilWar(S, n);
    }
    if (n.civilWarCd > 0) n.civilWarCd--;
    if (n.civilWar) stepCivilWar(S, n);
    if (n.recentCoronation > 0) n.recentCoronation--;
  }
}

function movementSatisfied(S, n, key) {
  const M = MOVEMENTS[key];
  if (!M.want) return false;
  if (M.want === 'war') return (n.wars?.length || 0) > 0;
  if (M.want === 'independence') return false;
  const [cat, val] = M.want.split(':');
  return n.laws[cat] === val;
}

// ---------------- جنگ داخلی ----------------
function startCivilWar(S, n) {
  const own = S.map.provs.filter(p => p.owner === n.id && p.controller === n.id);
  if (own.length < 3) return;
  // نیمه‌ی ناآرام‌تر کشور می‌شکند
  own.sort((a, b) => (b.unrest + b.sepPressure) - (a.unrest + a.sepPressure));
  const rebelProvs = own.slice(0, Math.max(1, Math.floor(own.length * 0.38)));
  // پرچمدار: قوی‌ترین جنبش رادیکال
  const strongest = MOVE_KEYS.map(k => ({ k, r: n.movements[k]?.radical || 0 })).sort((a, b) => b.r - a.r)[0];
  const cause = MOVEMENTS[strongest.k];
  n.civilWar = {
    started: S.week, cause: strongest.k, causeName: cause.name,
    provs: rebelProvs.map(p => p.id), score: 0,
  };
  n.civilWarCd = 200;
  for (const p of rebelProvs) {
    p.controller = REBEL;
    p.occ = 0;
    p.unrest = Math.max(45, p.unrest - 20);
    if (Math.random() < 0.6) {
      S.armies.push({
        id: S.nextArmyId++, n: REBEL, home: p.id, prov: p.id,
        size: 3 + Math.random() * 4, org: 78, mor: 85, path: [], status: 'idle', rebel: true, prog: 0, sackCd: 12,
      });
    }
  }
  n.stability = clamp(n.stability - 25, 0, 100);
  S.log.push({ w: S.week, icon: '⚔️', text: `جنگ داخلی در ${n.name}! ${cause.name} در ${rebelProvs.length} استان پرچم برافراشتند.` });
  if (n.player) {
    S.pendingAlerts = S.pendingAlerts || [];
    S.pendingAlerts.push({ icon: '⚔️', text: `جنگ داخلی آغاز شد! ${cause.name} علیه شما قیام کردند`, w: S.week });
  }
}

function stepCivilWar(S, n) {
  const cw = n.civilWar;
  const still = cw.provs.filter(id => S.map.provs[id].controller === REBEL);
  if (!still.length) {
    // دولت پیروز شد
    n.civilWar = null;
    n.stability = clamp(n.stability + 22, 0, 100);
    n.legitimacy = clamp(n.legitimacy + 14, 0, 100);
    for (const k of MOVE_KEYS) if (n.movements[k]) n.movements[k].radical = clamp(n.movements[k].radical - 40, 0, 100);
    S.log.push({ w: S.week, icon: '🏛️', text: `جنگ داخلی ${n.name} پایان یافت — دولت پیروز شد.` });
    if (n.player) { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon: '🏛️', text: 'جنگ داخلی را سرکوب کردید!', w: S.week }); }
    return;
  }
  // اگر شورشیان بیش از ۷۰٪ کشور را گرفتند، خواسته‌شان تحمیل می‌شود
  const own = S.map.provs.filter(p => p.owner === n.id);
  const rebHeld = own.filter(p => p.controller === REBEL).length;
  if (rebHeld / own.length > 0.62) {
    const M = MOVEMENTS[cw.cause];
    if (M.want && M.want.includes(':')) {
      const [cat, val] = M.want.split(':');
      n.laws[cat] = val;
      S.log.push({ w: S.week, icon: '🏴', text: `${n.name} تسلیم شد: «${M.name}» پیروز شدند و قانون تغییر کرد.` });
    } else {
      S.log.push({ w: S.week, icon: '🏴', text: `${n.name} در برابر ${M.name} فرو ریخت.` });
    }
    // آشتی: استان‌ها بازمی‌گردند ولی کشور زخمی است
    for (const p of own) if (p.controller === REBEL) { p.controller = n.id; p.unrest = 55; p.devast = Math.min(10, (p.devast || 0) + 3); }
    S.armies = S.armies.filter(a => !(a.n === REBEL && cw.provs.includes(a.prov)));
    n.civilWar = null;
    n.legitimacy = clamp(n.legitimacy - 18, 0, 100);
    n.stability = clamp(n.stability + 10, 0, 100);
    n.prestige = Math.max(0, n.prestige - 12);
    for (const k of MOVE_KEYS) if (n.movements[k]) { n.movements[k].radical = 0; n.movements[k].power = clamp(n.movements[k].power - 30, 0, 100); }
    if (n.player) { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon: '🏴', text: 'جنگ داخلی را باختید — خواسته‌ی شورشیان تحمیل شد', w: S.week }); }
  }
}

// ---------------- سرکوب و اصلاح (اکشن‌های بازیکن) ----------------
export function suppressMovement(S, n, key) {
  const mv = n.movements?.[key];
  if (!mv) return { ok: false, why: 'چنین جنبشی نیست' };
  const cost = Math.round(400 + mv.power * 22);
  if (n.treasury < cost) return { ok: false, why: `هزینه £${cost} است` };
  n.treasury -= cost;
  mv.power = clamp(mv.power - 22, 0, 100);
  mv.radical = clamp(mv.radical + 8, 0, 100);      // سرکوب، رادیکال‌ترشان می‌کند
  n.legitimacy = clamp(n.legitimacy - 3, 0, 100);
  for (const p of S.map.provs) if (p.owner === n.id) p.unrest = clamp(p.unrest + 3, 0, 100);
  return { ok: true, cost };
}
export function appeaseMovement(S, n, key) {
  const mv = n.movements?.[key];
  if (!mv) return { ok: false, why: 'چنین جنبشی نیست' };
  const cost = Math.round(700 + mv.power * 32);
  if (n.treasury < cost) return { ok: false, why: `هزینه £${cost} است` };
  n.treasury -= cost;
  mv.radical = clamp(mv.radical - 26, 0, 100);
  mv.power = clamp(mv.power - 8, 0, 100);
  n.stability = clamp(n.stability + 4, 0, 100);
  return { ok: true, cost };
}
export function culturalProgram(S, n, provId) {
  const p = S.map.provs[provId];
  if (!p || p.owner !== n.id) return { ok: false, why: 'استان از آنِ شما نیست' };
  if (p.culture === n.culture) return { ok: false, why: 'این استان هم‌فرهنگ است' };
  const cost = 900;
  if (n.treasury < cost) return { ok: false, why: `هزینه £${cost} است` };
  n.treasury -= cost;
  p.assim = clamp((p.assim || 0) + 22, 0, 100);
  p.unrest = clamp(p.unrest + 6, 0, 100);
  return { ok: true, cost };
}
