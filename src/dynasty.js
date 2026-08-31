// ---------- سلسله، جانشینی، خاندان‌های اشرافی و ازدواج سیاسی ----------
// این ماژول قلب خط زمانی «ویکتوریا فانتزی» است: پادشاهان پیر می‌شوند و می‌میرند،
// وارث با صفات نیمه‌ارثی به تخت می‌نشیند، خاندان‌های اشرافی وفادار یا یاغی‌اند،
// و ازدواج‌های میان‌سلسله‌ای شبکه‌ای از خویشاوندی می‌سازد که بر دیپلماسی اثر دارد.
//
// اصل طراحی: «رویدادهای بزرگ باید نادر باشند». همه‌ی نرخ‌ها در DYN_RARITY متمرکز شده‌اند
// تا با یک عدد بتوان کل بازی را تنظیم کرد.

import { clamp, pick, mulberry32 } from './utils.js';

// ================== تنظیم نُدرت ==================
// هر عدد ضریبِ شانس در هر «بررسی» است. بررسی‌ها هفتگی‌اند مگر خلافش گفته شود.
export const DYN_RARITY = {
  global: 1.0,             // ضریب کلی؛ ۰٫۵ = نصف، ۲ = دوبرابر
  succCrisis: 0.10,        // احتمال بحران در هر جانشینی
  pretenderRise: 0.00055,  // هفتگی، فقط وقتی همه‌ی شروط بد فراهم باشد
  factionRevolt: 0.00040,  // هفتگی، شورش تمام‌عیار خاندان
  royalMarriage: 0.010,    // هفتگی، پیشنهاد ازدواج از سوی AI
  personalUnion: 0.06,     // در مرگِ بی‌وارثِ یک هم‌پیمانِ خویشاوند
  assassination: 0.00022,  // هفتگی، ترور پادشاه به دست خاندان یاغی
  childBirth: 0.020,       // هفتگی، تولد فرزند در ازدواج بارور
};
const R = (k) => DYN_RARITY[k] * DYN_RARITY.global;

// ================== صفات پادشاهی ==================
// هر صفت روی کشور اثر عددی واقعی دارد. mods با cabinetMods جمع می‌شود.
export const ROYAL_TRAITS = {
  // --- مثبت ---
  brilliant:   { name: 'نابغه',        icon: '🧠', good: 1, mods: { research: 0.14, admin: 0.08 },      desc: 'ذهنی که چند گام جلوتر می‌بیند' },
  warrior:     { name: 'رزم‌آور',      icon: '⚔️', good: 1, mods: { armyAtk: 0.10, armyMor: 0.08 },     desc: 'در میدان نبرد زاده شده' },
  just:        { name: 'دادگر',        icon: '⚖️', good: 1, mods: { stability: 0.10, unrest: -0.08 },   desc: 'داد او زبانزد مردم است' },
  charismatic: { name: 'دلربا',        icon: '✨', good: 1, mods: { legitimacy: 0.10, relGain: 0.12 },  desc: 'دل‌ها را با یک نگاه می‌برد' },
  frugal:      { name: 'صرفه‌جو',      icon: '🪙', good: 1, mods: { upkeep: -0.10, corruption: -0.12 }, desc: 'یک سکه را دو بار می‌شمارد' },
  builder:     { name: 'آبادگر',       icon: '🏗️', good: 1, mods: { buildCost: -0.12, prod: 0.06 },     desc: 'سنگ روی سنگ می‌گذارد' },
  diplomat:    { name: 'سخن‌دان',      icon: '🕊️', good: 1, mods: { relGain: 0.18, tradeCap: 0.08 },    desc: 'با کلام، جنگ را می‌خواباند' },
  pious:       { name: 'پرهیزگار',     icon: '🕌', good: 1, mods: { legitimacy: 0.08, stability: 0.06 },desc: 'روحانیون پشت اویند' },
  shrewd:      { name: 'زیرک',         icon: '🦊', good: 1, mods: { spy: 0.16, counter: 0.10 },         desc: 'هیچ توطئه‌ای از چشمش پنهان نیست' },
  seafarer:    { name: 'دریانورد',     icon: '⚓', good: 1, mods: { navy: 0.14, tradeCap: 0.10 },       desc: 'تاج او بر موج‌ها استوار است' },
  // --- منفی ---
  cruel:       { name: 'سنگ‌دل',       icon: '🩸', good: -1, mods: { unrest: 0.12, armyAtk: 0.05, legitimacy: -0.06 }, desc: 'از او می‌ترسند، دوستش ندارند' },
  craven:      { name: 'بزدل',         icon: '🐁', good: -1, mods: { armyMor: -0.12, legitimacy: -0.08 }, desc: 'سایه‌ی خود را هم می‌ترساند' },
  wastrel:     { name: 'ولخرج',        icon: '💸', good: -1, mods: { upkeep: 0.14, corruption: 0.10 },    desc: 'خزانه در دستانش آب می‌شود' },
  sickly:      { name: 'بیمارگون',     icon: '🤒', good: -1, mods: { healthDecay: 1.9, legitimacy: -0.05 }, desc: 'پزشکان همواره بر بالینش‌اند' },
  paranoid:    { name: 'بدگمان',       icon: '👁️', good: -1, mods: { counter: 0.14, stability: -0.08, relGain: -0.10 }, desc: 'در هر سایه دشمنی می‌بیند' },
  indolent:    { name: 'تن‌آسان',      icon: '🛌', good: -1, mods: { admin: -0.12, research: -0.08 },     desc: 'کار امروز را به فردا می‌سپارد' },
  zealot:      { name: 'متعصب',        icon: '🔥', good: -1, mods: { relTension: 0.15, stability: -0.06, armyMor: 0.06 }, desc: 'با ناهم‌کیشان سر سازش ندارد' },
  arrogant:    { name: 'خودکامه',      icon: '👺', good: -1, mods: { relGain: -0.14, factionLoyal: -0.10 }, desc: 'اشراف را به هیچ می‌گیرد' },
};
export const ROYAL_TRAIT_KEYS = Object.keys(ROYAL_TRAITS);
const GOOD_TRAITS = ROYAL_TRAIT_KEYS.filter(k => ROYAL_TRAITS[k].good > 0);
const BAD_TRAITS = ROYAL_TRAIT_KEYS.filter(k => ROYAL_TRAITS[k].good < 0);

// ================== قوانین جانشینی ==================
export const SUCCESSION_LAWS = {
  primo_male: { name: 'ارشدیت پسری', icon: '👑', desc: 'بزرگ‌ترین پسر وارث است. ساده و پایدار، اما اگر پسری نباشد بحران می‌آید.',
    stability: 4, legitimacy: 6, factionLoyal: 3 },
  primo_abs:  { name: 'ارشدیت مطلق', icon: '⚜️', desc: 'بزرگ‌ترین فرزند، دختر یا پسر. بحران کمتر، اما اشراف سنت‌گرا ناخشنودند.',
    stability: 2, legitimacy: 3, factionLoyal: -4 },
  seniority:  { name: 'ارشدیت خاندان', icon: '🏛️', desc: 'مسن‌ترین مرد خاندان به تخت می‌نشیند. پادشاهان کارآزموده اما کوتاه‌عمر.',
    stability: 3, legitimacy: 2, factionLoyal: 6 },
  elective:   { name: 'انتخابی', icon: '🗳️', desc: 'خاندان‌های بزرگ پادشاه را برمی‌گزینند. اشراف راضی‌اند، اما تاج لرزان است.',
    stability: -3, legitimacy: -6, factionLoyal: 14 },
  appointed:  { name: 'انتصابی', icon: '📜', desc: 'پادشاه خود وارث را برمی‌گزیند. بهترین گزینه ممکن است، اما اشراف بدگمان می‌شوند.',
    stability: 1, legitimacy: -2, factionLoyal: -8 },
};
export const SUCCESSION_KEYS = Object.keys(SUCCESSION_LAWS);

// ================== خاندان‌های اشرافی ==================
export const FACTION_KINDS = {
  military: { name: 'خاندان سپاهی',  icon: '🗡️', desc: 'سرداران موروثی که سپاه را در مشت دارند', boon: { armyAtk: 0.06 }, threat: 1.3 },
  landed:   { name: 'خاندان زمین‌دار', icon: '🌾', desc: 'اربابان بزرگ که غله و رعیت از آنِ اوست', boon: { prod: 0.05 }, threat: 1.0 },
  merchant: { name: 'خاندان بازرگان', icon: '⚖️', desc: 'کاروان‌سالاران و صرافان که پول را می‌گردانند', boon: { tradeCap: 0.08 }, threat: 0.7 },
  clerical: { name: 'خاندان روحانی',  icon: '📿', desc: 'متولیان نیایشگاه‌ها و وجدان مردم', boon: { legitimacy: 0.05 }, threat: 0.9 },
  scholar:  { name: 'خاندان دیوانی',  icon: '🖋️', desc: 'دبیران و دیوان‌سالاران موروثی', boon: { research: 0.06 }, threat: 0.6 },
};
export const FACTION_KEYS = Object.keys(FACTION_KINDS);

const HOUSE_NAMES = ['اسپهبدان', 'کارن', 'سورن', 'مهران', 'زرمهر', 'ویسه', 'گودرز', 'نوذر', 'آبتین', 'فرهاد',
  'بهرامیان', 'شیرزاد', 'تهماسب', 'رستمیان', 'اردشیریان', 'پیروزان', 'خسروانی', 'برزین', 'دیلمان', 'ساسان'];
const DYNASTY_NAMES = ['هخامنش', 'کیانی', 'اشکانی', 'ساسان', 'سامانی', 'غزنوی', 'صفوی', 'زند', 'اوستایی', 'مزدَک',
  'فرّخ‌زاد', 'آذرگشسب', 'بهمنی', 'سیاوشان', 'گرشاسپ'];
const M_NAMES = ['بهرام', 'اردشیر', 'خسرو', 'کاووس', 'داریوش', 'کوروش', 'شاپور', 'هرمز', 'قباد', 'پیروز',
  'سیاوش', 'فریدون', 'منوچهر', 'کیخسرو', 'اسفندیار', 'رستم', 'گشتاسب', 'تهمورث', 'جمشید', 'بابک'];
const F_NAMES = ['آناهیتا', 'پوراندخت', 'آزرمی', 'شیرین', 'گردآفرید', 'مهرآفرین', 'دُرناز', 'روشنک', 'ماندانا', 'آتوسا',
  'فرانک', 'سودابه', 'همای', 'ترانه', 'گلنار', 'یاسمن', 'نازآفرین', 'دل‌آرام'];

// ================== ساخت شخصیت سلطنتی ==================
let RUID = 1;
export function resetRoyalUid(v) { RUID = v || 1; }

function rollTraits(rng, parentA, parentB, count) {
  const out = [];
  // ارث: هر صفت والد ۳۵٪ شانس انتقال دارد
  for (const p of [parentA, parentB]) {
    if (!p?.traits) continue;
    for (const t of p.traits) if (rng() < 0.35 && !out.includes(t)) out.push(t);
  }
  // صفات تازه
  while (out.length < count) {
    const pool = rng() < 0.62 ? GOOD_TRAITS : BAD_TRAITS;
    const t = pick(rng, pool);
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, Math.max(count, out.length > 4 ? 4 : count));
}

function inheritSkill(rng, a, b, base) {
  const pa = a ?? base, pb = b ?? base;
  const mid = (pa + pb) / 2;
  return clamp(Math.round(mid + (rng() - 0.5) * 8), 1, 20);
}

export function makeRoyal(S, opts = {}) {
  const rng = opts.rng || Math.random;
  const male = opts.male ?? (rng() < 0.5);
  const fa = opts.father, mo = opts.mother;
  const r = {
    id: RUID++,
    name: opts.name || pick(rng, male ? M_NAMES : F_NAMES),
    house: opts.house || fa?.house || 'ناشناس',
    male,
    age: opts.age ?? 0,
    alive: true,
    health: opts.health ?? clamp(72 + Math.round((rng() - 0.5) * 30), 30, 100),
    fatherId: fa?.id ?? null,
    motherId: mo?.id ?? null,
    spouseId: null,
    spouseForeign: null,     // {nation, name} برای ازدواج سیاسی
    nation: opts.nation ?? null,
    // مهارت‌ها ۱..۲۰
    stat: {
      admin: inheritSkill(rng, fa?.stat?.admin, mo?.stat?.admin, opts.base ?? 9),
      martial: inheritSkill(rng, fa?.stat?.martial, mo?.stat?.martial, opts.base ?? 9),
      diplo: inheritSkill(rng, fa?.stat?.diplo, mo?.stat?.diplo, opts.base ?? 9),
      guile: inheritSkill(rng, fa?.stat?.guile, mo?.stat?.guile, opts.base ?? 9),
    },
    traits: opts.traits || rollTraits(rng, fa, mo, rng() < 0.35 ? 3 : 2),
    education: null,          // گرایش تربیت وارث
    prestige: 0,
    reignStart: null,
    hist: [],
    childrenIds: [],
  };
  return r;
}

// ================== دسترسی ==================
export function royalById(S, id) { return (S.royals || []).find(r => r.id === id) || null; }
export function rulerOf(S, nid) { const n = S.nations[nid]; return n?.dyn ? royalById(S, n.dyn.rulerId) : null; }
export function heirOf(S, nid) { const n = S.nations[nid]; return n?.dyn?.heirId ? royalById(S, n.dyn.heirId) : null; }
export function childrenOf(S, r) { return (r?.childrenIds || []).map(id => royalById(S, id)).filter(c => c && c.alive); }
export function houseOf(S, nid) { return S.nations[nid]?.dyn?.house || '—'; }

/** ضرایب حکومتی پادشاه کنونی — با cabinetMods جمع می‌شود. */
export function royalMods(S, nid) {
  const out = {};
  const k = rulerOf(S, nid);
  if (!k) return out;
  const add = (o) => { for (const key in o) out[key] = (out[key] || 0) + o[key]; };
  for (const t of k.traits) if (ROYAL_TRAITS[t]) add(ROYAL_TRAITS[t].mods);
  // مهارت‌ها: هر امتیاز بالای ۱۰ اثر کوچکی دارد
  const s = k.stat;
  add({
    admin:      (s.admin - 10) * 0.010,
    armyAtk:    (s.martial - 10) * 0.008,
    relGain:    (s.diplo - 10) * 0.012,
    spy:        (s.guile - 10) * 0.010,
    research:   (s.admin - 10) * 0.006,
    legitimacy: (s.diplo - 10) * 0.004,
  });
  // نیابت سلطنت: کشور نیمه‌فلج است
  const n = S.nations[nid];
  if (n.dyn?.regency) add({ admin: -0.15, legitimacy: -0.20, stability: -0.10, factionLoyal: -0.12 });
  // قانون جانشینی
  const law = SUCCESSION_LAWS[n.dyn?.succession];
  if (law) add({ stabFlat: law.stability, legitFlat: law.legitimacy, factionLoyalFlat: law.factionLoyal });
  return out;
}

// ================== خاندان‌های اشرافی ==================
function makeFaction(S, n, rng, kind, usedNames) {
  let nm;
  do { nm = pick(rng, HOUSE_NAMES); } while (usedNames.has(nm) && usedNames.size < HOUSE_NAMES.length);
  usedNames.add(nm);
  const head = makeRoyal(S, { rng, male: rng() < 0.8, age: 30 + Math.floor(rng() * 28), house: nm, nation: n.id, base: 8 });
  head.isNoble = true;
  S.royals.push(head);
  // خاندان بزرگ یعنی چند چهره، نه یک نفر: فرزندان و خویشان که نامزد کرسی‌های دربار می‌شوند
  const kids = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < kids; i++) {
    const age = Math.max(2, head.age - 20 - Math.floor(rng() * 8) + Math.floor(rng() * 14));
    const kid = makeRoyal(S, { rng, father: head, age: clamp(age, 2, head.age - 16), house: nm, nation: n.id, base: 8 });
    kid.isNoble = true;
    head.childrenIds.push(kid.id);
    S.royals.push(kid);
  }
  return {
    key: kind,
    house: nm,
    headId: head.id,
    power: Math.round(14 + rng() * 22),      // ۰..۱۰۰ نفوذ در کشور
    loyalty: Math.round(52 + rng() * 30),    // ۰..۱۰۰
    provs: [],
    pretender: false,
    grudge: 0,
  };
}

export function factionsOf(S, nid) { return S.nations[nid]?.dyn?.factions || []; }

/** ضرایبی که خاندان‌های وفادار به کشور می‌دهند (یا وقتی خشمگین‌اند، می‌گیرند). */
export function factionMods(S, nid) {
  const out = {};
  for (const f of factionsOf(S, nid)) {
    const w = (f.power / 100) * ((f.loyalty - 50) / 50);  // −۱..+۱
    const boon = FACTION_KINDS[f.key]?.boon || {};
    for (const k in boon) out[k] = (out[k] || 0) + boon[k] * w;
  }
  return out;
}

// ================== راه‌اندازی ==================
export function initDynasty(S) {
  // فقط خط زمانی فانتزی سلسله دارد؛ خطوط واقعی دست‌نخورده می‌مانند.
  if (S.timelineId !== 'victoria') { S.royals = []; S.royalNews = []; return; }
  S.royals = [];
  S.royalNews = [];
  S.nextRoyalEventId = 1;
  resetRoyalUid();

  const usedDyn = new Set();
  for (const n of S.nations) {
    const rng = mulberry32((S.seed ^ 0x5bf03635) + n.id * 2654435761);
    let hn;
    do { hn = pick(rng, DYNASTY_NAMES); } while (usedDyn.has(hn) && usedDyn.size < DYNASTY_NAMES.length);
    usedDyn.add(hn);

    // --- پادشاه کنونی ---
    const male = !/^ملکه|^بانو/.test(n.ruler || '');
    const king = makeRoyal(S, { rng, male, age: 42 + Math.floor(rng() * 22), house: hn, nation: n.id, base: 10 });
    // نام پادشاه از تعریف ملت گرفته می‌شود تا با متن‌های موجود جور بماند
    const bare = (n.ruler || '').replace(/^(شاهنشاه|پادشاه|ملکه|امیر|خان بزرگ|خدیو|دوج|سلطان|رهبر|شاه)\s*/, '').trim();
    if (bare) king.name = bare;
    king.title = (n.ruler || '').slice(0, (n.ruler || '').length - bare.length).trim() || (male ? 'شاه' : 'ملکه');
    king.reignStart = 0;
    S.royals.push(king);

    // --- همسر ---
    const queen = makeRoyal(S, { rng, male: !king.male, age: king.age - 3 - Math.floor(rng() * 8), house: pick(rng, HOUSE_NAMES), nation: n.id, base: 9 });
    queen.spouseId = king.id; king.spouseId = queen.id;
    S.royals.push(queen);

    // --- فرزندان ---
    const nKids = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < nKids; k++) {
      const kid = makeRoyal(S, {
        rng, father: king.male ? king : queen, mother: king.male ? queen : king,
        age: Math.max(0, king.age - 24 - Math.floor(rng() * 6) + k * 3),
        house: hn, nation: n.id,
      });
      S.royals.push(kid);
      king.childrenIds.push(kid.id);
      queen.childrenIds.push(kid.id);
    }

    // --- خاندان‌های اشرافی ---
    const usedH = new Set([hn]);
    const nFac = 3 + Math.floor(rng() * 3);   // ۳ تا ۵
    const kinds = [...FACTION_KEYS].sort(() => rng() - 0.5);
    const factions = [];
    for (let f = 0; f < nFac; f++) factions.push(makeFaction(S, n, rng, kinds[f % kinds.length], usedH));

    // استان‌ها را میان خاندان‌ها پخش کن
    const mine = S.map.provs.filter(p => p.owner === n.id);
    mine.forEach((p, i) => { const f = factions[i % factions.length]; f.provs.push(p.id); });

    n.dyn = {
      house: hn,
      rulerId: king.id,
      heirId: null,
      succession: pick(rng, ['primo_male', 'primo_male', 'primo_abs', 'seniority', 'elective']),
      regency: false,
      regentName: null,
      factions,
      marriages: {},          // {nationId: {since, kin}}  خویشاوندی
      claims: {},             // {nationId: قدرت ادعا}
      reignYears: 0,
      succCrisis: false,
      pretenderWar: null,
      unionWith: null,
    };
    recalcHeir(S, n.id);
  }
}

// ================== انتخاب وارث ==================
export function recalcHeir(S, nid) {
  const n = S.nations[nid];
  if (!n?.dyn) return null;
  const k = rulerOf(S, nid);
  if (!k) return null;
  const law = n.dyn.succession;
  let cands = childrenOf(S, k).filter(c => c.alive);

  if (law === 'primo_male') cands = cands.filter(c => c.male);
  if (law === 'seniority') {
    // مسن‌ترین مرد هم‌خاندان (نه لزوماً فرزند)
    cands = (S.royals || []).filter(r => r.alive && r.house === n.dyn.house && r.male && r.id !== k.id && !r.isNoble);
  }
  if (law === 'elective') {
    // خاندان‌ها رأی می‌دهند: نامزدها فرزندان + سرکرده‌های قدرتمند
    const pool = [...childrenOf(S, k)];
    for (const f of n.dyn.factions) { const h = royalById(S, f.headId); if (h?.alive && f.power > 25) pool.push(h); }
    cands = pool;
  }

  let heir = null;
  if (law === 'appointed' && n.dyn.appointedHeir) {
    heir = royalById(S, n.dyn.appointedHeir);
    if (!heir?.alive) heir = null;
  }
  if (!heir && cands.length) {
    if (law === 'seniority') heir = cands.sort((a, b) => b.age - a.age)[0];
    else if (law === 'elective') {
      heir = cands.sort((a, b) => (b.stat.diplo + b.stat.admin + b.age * 0.2) - (a.stat.diplo + a.stat.admin + a.age * 0.2))[0];
    } else heir = cands.sort((a, b) => b.age - a.age)[0];
  }
  n.dyn.heirId = heir ? heir.id : null;
  return heir;
}

// ================== تاج‌گذاری ==================
export function crown(S, nid, newKing, reason) {
  const n = S.nations[nid];
  const old = rulerOf(S, nid);
  if (!newKing) return false;
  n.dyn.rulerId = newKing.id;
  newKing.reignStart = S.week;
  newKing.nation = nid;
  if (!newKing.title) newKing.title = newKing.male ? 'شاه' : 'ملکه';
  n.ruler = `${newKing.title} ${newKing.name}`;
  n.dyn.house = newKing.house || n.dyn.house;
  n.dyn.appointedHeir = null;
  // نیابت سلطنت اگر خردسال باشد
  n.dyn.regency = newKing.age < 16;
  if (n.dyn.regency) {
    const strongest = [...n.dyn.factions].sort((a, b) => b.power - a.power)[0];
    const rh = strongest ? royalById(S, strongest.headId) : null;
    n.dyn.regentName = rh ? `${rh.name} از خاندان ${rh.house}` : 'شورای اشراف';
    if (strongest) strongest.power = clamp(strongest.power + 12, 0, 100);
  } else n.dyn.regentName = null;

  // مشروعیت تازه: پادشاه نو همیشه کمی لرزان است
  n.legitimacy = clamp((n.legitimacy ?? 60) - (n.dyn.regency ? 18 : 8), 0, 100);
  recalcHeir(S, nid);
  royalNews(S, nid, '👑', `${n.ruler} بر تخت ${n.name} نشست${reason ? ' — ' + reason : ''}.`);
  // ---- مراسم تاج‌گذاری برای بازیکن ----
  if (nid === S.playerId && !S.pendingEvent) {
    const tr = newKing.traits.map(t => ROYAL_TRAITS[t]).filter(Boolean);
    const trTxt = tr.length ? tr.map(x => `${x.icon} ${x.name}`).join('، ') : 'هنوز ناشناخته';
    const st = newKing.stat;
    const best = [['کشورداری', st.admin], ['نظامی‌گری', st.martial], ['دیپلماسی', st.diplo], ['تدبیر', st.guile]]
      .sort((a, b) => b[1] - a[1])[0];
    S.pendingEvent = {
      id: 'coronation_' + newKing.id + '_' + S.week, icon: '👑', title: 'تاج‌گذاری',
      text: n.dyn.regency
        ? `${old ? old.name + ' درگذشت و ' : ''}${newKing.name} در ${newKing.age} سالگی بر تخت نشست — کودکی بر تختِ مردان. `
          + `${n.dyn.regentName} نیابت سلطنت را بر عهده گرفت و تا سن قانونی، قدرت واقعی در دست اوست. `
          + `اشراف بوی ضعف را شنیده‌اند.`
        : `زیر گنبد نیایشگاه بزرگ، تاج ${n.dyn.house} بر سر ${newKing.name} نهاده شد. `
          + `${newKing.age} سال دارد و برجسته‌ترین توانش ${best[0]} است. مردم فریاد شادی سر داده‌اند، `
          + `اما اشراف در سایه‌ها می‌سنجند که این فرمانروا چه‌قدر می‌ارزد.\n\nصفات: ${trTxt}`,
      t2: n.dyn.regency
        ? `پادشاه جدید بچه‌ست! ${n.dyn.regentName} به‌جاش حکومت می‌کنه تا بزرگ بشه. اوضاع شکننده‌ست.`
        : `پادشاه جدید تاج‌گذاری کرد: ${newKing.name}، ${newKing.age} ساله. صفاتش: ${trTxt}`,
      opts: [
        { label: 'جشن باشکوه بگیر', hint: 'خزانه −۲۰۰۰، مشروعیت +۸، وفاداری اشراف +۶', fx: { coronFeast: 1 } },
        { label: 'مراسم ساده و کم‌خرج', hint: 'رایگان، اما مشروعیت +۲', fx: { coronPlain: 1 } },
        { label: 'زر میان مردم بپاش', hint: 'خزانه −۳۵۰۰، ناآرامی −۱۰، مشروعیت +۵', fx: { coronAlms: 1 } },
      ],
    };
  }
  if (old) old.hist.push({ w: S.week, t: 'پایان سلطنت' });
  newKing.hist.push({ w: S.week, t: 'تاج‌گذاری' });
  return true;
}

function royalNews(S, nid, icon, text) {
  S.royalNews = S.royalNews || [];
  S.royalNews.unshift({ w: S.week, nid, icon, text });
  if (S.royalNews.length > 90) S.royalNews.length = 90;
}
export { royalNews };

// ================== شبیه‌سازی هفتگی ==================
// سرِ خاندان که می‌میرد باید جانشین بگیرد، وگرنه خاندان بی‌سر و بی‌اثر می‌شود
function succeedFactionHeads(S) {
  for (const n of S.nations) {
    if (!n.alive || !n.dyn?.factions) continue;
    for (const f of n.dyn.factions) {
      const h = royalById(S, f.headId);
      if (h?.alive) continue;
      // نخست فرزند بالغ، سپس خویشاوند هم‌خاندان، در نهایت وارثی تازه
      let succ = null;
      if (h) {
        const kids = childrenOf(S, h).filter(c => c.alive && c.age >= 16);
        if (kids.length) succ = kids.sort((a, b) => (b.male - a.male) || (b.age - a.age))[0];
      }
      if (!succ) {
        const kin = S.royals.filter(r => r.alive && r.nation === n.id && r.house === f.house && r.age >= 16 && r.id !== f.headId);
        if (kin.length) succ = kin.sort((a, b) => b.age - a.age)[0];
      }
      if (!succ) {
        succ = makeRoyal(S, { male: Math.random() < 0.8, age: 26 + Math.floor(Math.random() * 26), house: f.house, nation: n.id, base: 8 });
        succ.isNoble = true;
        S.royals.push(succ);
      }
      f.headId = succ.id;
      succ.isNoble = true;
      // نسل تازه‌ی خاندان: بدون این، دربار در چند دهه از چهره خالی می‌شود
      const kin = S.royals.filter(r => r.alive && r.nation === n.id && r.house === f.house);
      if (kin.length < 4) {
        const kids = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < kids; i++) {
          const kid = makeRoyal(S, { father: succ, age: 2 + Math.floor(Math.random() * 14), house: f.house, nation: n.id, base: 8 });
          kid.isNoble = true;
          succ.childrenIds.push(kid.id);
          S.royals.push(kid);
        }
      }
      // انتقال قدرت هموار نیست: خاندانِ در حال جابه‌جایی کمی متزلزل می‌شود
      f.power = clamp(f.power - 2 - Math.random() * 4, 4, 100);
      if (n.id === S.playerId) {
        S.royalNews.push({ wk: S.week, icon: '🏰', txt: `${succ.name} سرپرستی خاندان ${f.house} را به دست گرفت.` });
      }
    }
  }
}

export function simDynasty(S) {
  if (S.timelineId !== 'victoria' || !S.royals) return;
  const yearTick = S.week % 52 === 0;
  if (S.week % 13 === 0) succeedFactionHeads(S);

  // ---- پیری و سلامت (سالانه) ----
  if (yearTick && S.week > 0) {
    for (const r of S.royals) {
      if (!r.alive) continue;
      r.age++;
      const k = rulerOf(S, r.nation);
      const isKing = k && k.id === r.id;
      // فرسایش سلامت: پس از ۴۵ سالگی شتاب می‌گیرد
      let decay = r.age < 45 ? 0.5 : (r.age - 44) * 0.42;
      if (r.traits.includes('sickly')) decay *= 1.9;
      if (isKing) decay *= 1.15;                        // بار سلطنت
      if (S.nations[r.nation]?.wars?.length && isKing) decay *= 1.1;
      r.health = clamp(r.health - decay, 0, 100);
      // وارثِ در حال رشد: مهارت‌ها با تربیت بالا می‌روند
      if (r.age >= 6 && r.age <= 16 && r.education) {
        const map = { martial: 'martial', admin: 'admin', diplo: 'diplo', guile: 'guile' };
        const st = map[r.education];
        if (st && Math.random() < 0.55) r.stat[st] = clamp(r.stat[st] + 1, 1, 20);
      }
    }
  }

  // ---- مرگ ----
  for (const r of S.royals) {
    if (!r.alive) continue;
    // احتمال هفتگی مرگ بر پایه‌ی سلامت و سن
    const frail = (100 - r.health) / 100;
    let pDeath = 0.00012 + frail * frail * 0.0016 + Math.max(0, r.age - 60) * 0.00010;
    if (r.age > 78) pDeath *= 1.8;
    if (Math.random() < pDeath) killRoyal(S, r, 'مرگ طبیعی');
  }

  // ---- به‌روزرسانی هر ملت ----
  for (const n of S.nations) {
    if (!n.alive || !n.dyn) continue;
    const d = n.dyn;
    const k = rulerOf(S, n.id);

    // پادشاه مرده و جانشین تعیین نشده
    if (!k || !k.alive) { doSuccession(S, n); continue; }

    if (yearTick) d.reignYears = Math.floor((S.week - (k.reignStart || 0)) / 52);

    // خردسالی تمام شد؟
    if (d.regency && k.age >= 16) {
      d.regency = false; d.regentName = null;
      n.legitimacy = clamp((n.legitimacy ?? 60) + 12, 0, 100);
      royalNews(S, n.id, '🎓', `${n.ruler} به سن قانونی رسید و زمام امور را خود به دست گرفت.`);
    }

    // ---- تولد فرزند ----
    const sp = k.spouseId ? royalById(S, k.spouseId) : null;
    const fertile = (sp && sp.alive && sp.age < 45 && k.age < 60) || (k.spouseForeign && k.age < 60);
    if (fertile && Math.random() < R('childBirth') * (childrenOf(S, k).length > 4 ? 0.35 : 1)) {
      const rng = Math.random;
      const kid = makeRoyal(S, { rng, father: k.male ? k : sp, mother: k.male ? sp : k, age: 0, house: d.house, nation: n.id });
      S.royals.push(kid);
      k.childrenIds.push(kid.id);
      if (sp) sp.childrenIds.push(kid.id);
      recalcHeir(S, n.id);
      if (n.id === S.playerId) royalNews(S, n.id, '👶', `${kid.male ? 'شاهزاده' : 'شاهدخت'} ${kid.name} زاده شد.`);
    }

    // ---- خاندان‌ها ----
    stepFactions(S, n);

    // ---- ازدواج سیاسی از سوی AI ----
    if (n.id !== S.playerId && Math.random() < R('royalMarriage') * 0.5) aiSeekMarriage(S, n);
  }

  // ---- پیشنهاد ازدواج به بازیکن (با خنک‌کننده تا اسپم نشود) ----
  const pn = S.nations[S.playerId];
  if (pn?.alive && pn.dyn && !S.pendingEvent && S.week >= (pn.dyn.marOfferCd || 0)
      && Math.random() < R('royalMarriage')) {
    pn.dyn.marOfferCd = S.week + 150 + Math.floor(Math.random() * 120);   // ≈ ۳ تا ۵ سال
    offerMarriageToPlayer(S);
  }
}

// ================== مرگ ==================
export function killRoyal(S, r, cause) {
  if (!r.alive) return;
  r.alive = false;
  r.deathWeek = S.week;
  r.deathCause = cause;
  r.hist.push({ w: S.week, t: cause });
  const n = S.nations[r.nation];
  if (!n?.dyn) return;
  if (n.dyn.rulerId === r.id) {
    royalNews(S, n.id, '⚰️', `${n.ruler} در ${r.age} سالگی درگذشت (${cause}).`);
    doSuccession(S, n);
  } else if (n.dyn.heirId === r.id) {
    royalNews(S, n.id, '🥀', `${r.male ? 'شاهزاده' : 'شاهدخت'} ${r.name}، وارث تاج، درگذشت (${cause}).`);
    recalcHeir(S, n.id);
  }
}

// ================== جانشینی ==================
function doSuccession(S, n) {
  const d = n.dyn;
  let heir = d.heirId ? royalById(S, d.heirId) : null;
  if (!heir || !heir.alive) heir = recalcHeir(S, n.id);

  // --- بحران جانشینی ---
  const crisis = !heir || Math.random() < R('succCrisis');
  if (!heir) {
    // هیچ وارثی نیست: یا اتحاد تاجی، یا خاندان قدرتمند تاج را می‌گیرد
    const ally = findUnionPartner(S, n);
    if (ally && Math.random() < R('personalUnion')) { formPersonalUnion(S, n, ally); return; }
    const strongest = [...d.factions].sort((a, b) => b.power * (b.loyalty / 100) - a.power * (a.loyalty / 100))[0];
    const head = strongest ? royalById(S, strongest.headId) : null;
    if (head?.alive) {
      d.house = head.house;
      head.isNoble = false;
      crown(S, n.id, head, 'تاج به خاندان دیگری رسید');
      n.legitimacy = clamp((n.legitimacy ?? 60) - 22, 0, 100);
      n.stability = clamp((n.stability ?? 50) - 14, 0, 100);
      royalNews(S, n.id, '⚠️', `${n.name} بی‌وارث ماند؛ خاندان ${head.house} تاج را برداشت. مشروعیت به‌شدت شکست.`);
      for (const f of d.factions) if (f.house !== head.house) f.loyalty = clamp(f.loyalty - 18, 0, 100);
    } else {
      // آخرین راه: یک نجیب‌زاده‌ی تازه
      const nk = makeRoyal(S, { rng: Math.random, age: 20 + Math.floor(Math.random() * 25), house: d.house, nation: n.id, base: 9 });
      S.royals.push(nk);
      crown(S, n.id, nk, 'شورای بزرگان برگزید');
      n.legitimacy = clamp((n.legitimacy ?? 60) - 26, 0, 100);
    }
    d.succCrisis = true;
    return;
  }

  crown(S, n.id, heir, null);

  if (crisis) {
    d.succCrisis = true;
    n.stability = clamp((n.stability ?? 50) - 12, 0, 100);
    n.legitimacy = clamp((n.legitimacy ?? 60) - 10, 0, 100);
    // یک خاندان ناراضی مدعی می‌شود
    const angry = [...d.factions].filter(f => f.loyalty < 55).sort((a, b) => b.power - a.power)[0];
    if (angry) {
      angry.pretender = true;
      angry.loyalty = clamp(angry.loyalty - 20, 0, 100);
      royalNews(S, n.id, '⚔️', `خاندان ${angry.house} جانشینی را نامشروع خواند و مدعی تاج شد!`);
      if (n.id === S.playerId) {
        S.pendingEvent = {
          id: 'succ_crisis_' + S.week, icon: '⚔️', title: 'بحران جانشینی',
          text: `تاج‌گذاری ${n.ruler} با اعتراض روبه‌رو شد. خاندان ${angry.house}، که ${angry.power} درصد نفوذ دربار را در دست دارد، جانشینی را نامشروع می‌خواند و خود را وارث راستین می‌داند. اگر امروز کاری نکنید، فردا شمشیر می‌کشند.`,
          t2: `یه خاندان قدرتمند زیر بار پادشاه جدید نرفته و می‌گه تاج مال منه. باید یه کاریش بکنی وگرنه جنگ داخلی راه می‌افته.`,
          opts: [
            { label: 'با زر و زمین راضی‌شان کن', hint: 'خزانه −۳۵۰۰، وفاداری +۳۰', fx: { dynAppease: angry.house } },
            { label: 'سرکرده را دستگیر کن', hint: 'ریسک بالا: یا فرو می‌نشیند یا شورش', fx: { dynArrest: angry.house } },
            { label: 'بگذار غر بزنند', hint: 'رایگان، اما کینه می‌ماند', fx: { dynIgnore: angry.house } },
          ],
        };
      }
    }
  } else d.succCrisis = false;
}

// ================== خاندان‌ها: وفاداری و شورش ==================
// مدل: نفوذ خاندان به استان‌هایی که در دست دارد گره خورده است (نه رانش تصادفی)،
// و وفاداری از «شکایت‌های واقعی» تغذیه می‌شود: مالیات سنگین، جنگ بازنده،
// بی‌ثباتی، پادشاه خودکامه و قانون جانشینیِ ناخوشایند.
function stepFactions(S, n) {
  const d = n.dyn;
  const k = rulerOf(S, n.id);
  const legit = n.legitimacy ?? 60;
  const stab = n.stability ?? 50;
  const rm = royalMods(S, n.id);
  const nProv = Math.max(1, S.map.provs.filter(p => p.owner === n.id).length);

  for (const f of d.factions) {
    // ---- نفوذ: به استان‌های زیر دست خاندان گره خورده است ----
    const held = f.provs.filter(id => S.map.provs[id]?.owner === n.id).length;
    const basePower = clamp(12 + (held / nProv) * 100 * 0.65, 6, 70);
    // خاندان ناراضی نفوذش را گسترش می‌دهد، خاندان وفادار در سایه‌ی تاج می‌ماند
    const powerPull = f.loyalty < 35 ? 8 : f.loyalty > 70 ? -5 : 0;
    f.power = clamp(f.power + ((basePower + powerPull) - f.power) * 0.006 + (Math.random() - 0.5) * 0.12, 3, 100);

    // ---- شکایت‌ها: هر کدام وفاداریِ هدف را پایین می‌کشد ----
    let target = 58;
    target += (legit - 60) * 0.55;
    target += (stab - 50) * 0.30;
    target += (SUCCESSION_LAWS[d.succession]?.factionLoyal || 0) * 1.1;
    target += (rm.factionLoyal || 0) * 100 * 0.3;
    // مالیات سنگین، اشراف را می‌آزارد
    target -= Math.max(0, (n.taxLvl ?? 2) - 2) * 7;
    // جنگ طولانی و فرسودگی
    target -= clamp((n.warExh || 0) * 0.5, 0, 16);
    if (n.wars.length) target -= 5;
    // پادشاه
    if (k?.traits.includes('just')) target += 9;
    if (k?.traits.includes('charismatic')) target += 6;
    if (k?.traits.includes('arrogant')) target -= 12;
    if (k?.traits.includes('cruel')) target -= 8;
    if (k?.traits.includes('paranoid')) target -= 6;
    if (k?.traits.includes('brilliant')) target += 4;
    if (d.regency) target -= 14;
    // خاندانِ پرنفوذ، طلبکارتر است
    target -= Math.max(0, f.power - 30) * 0.30;
    // نوع خاندان: سپاهیان در صلح بی‌قرارند، بازرگانان در جنگ
    if (f.key === 'military' && !n.wars.length) target -= 4;
    if (f.key === 'merchant' && n.wars.length) target -= 6;
    if (f.key === 'clerical' && (n.legitimacy ?? 60) < 45) target -= 5;

    target = clamp(target, 0, 100);
    f.loyalty = clamp(f.loyalty + (target - f.loyalty) * 0.010, 0, 100);

    // ---- کینه: از وفاداریِ پایین تغذیه می‌شود و آرام فروکش می‌کند ----
    if (f.loyalty < 42) f.grudge = clamp(f.grudge + (42 - f.loyalty) * 0.014, 0, 100);
    else f.grudge = clamp(f.grudge - 0.05, 0, 100);

    // ---- نمره‌ی تهدید ----
    // به‌جای چند شرطِ سختِ AND (که باعث می‌شد شورش عملاً ناممکن شود)،
    // یک نمره‌ی پیوسته می‌سازیم: نارضایتیِ شدید می‌تواند حتی زیر تاجِ نسبتاً
    // مشروع هم مدعی بزاید — اما بسیار سخت‌تر.
    f.threat = clamp(
      (40 - f.loyalty) * 1.5 +                       // بی‌وفایی: مهم‌ترین عامل
      (f.grudge - 40) * 0.8 +                        // کینه‌ی انباشته
      (56 - legit) * 0.9 +                           // تاج نامشروع جسارت می‌دهد
      (f.power - 26) * 0.7 +                         // نفوذ برای ادعا لازم است
      ((FACTION_KINDS[f.key]?.threat || 1) - 1) * 12, // سپاهیان جسورترند
      0, 100);

    // ---- ظهور مدعی (نادر) ----
    if (!f.pretender && f.threat > 40 && f.loyalty < 38 && f.power > 22) {
      // شانس با توان دوم شدتِ تهدید بالا می‌رود، اما پایه بسیار پایین است
      if (Math.random() < R('pretenderRise') * ((f.threat / 40) ** 2)) {
        f.pretender = true;
        royalNews(S, n.id, '🩸', `خاندان ${f.house} پرچم شورش برافراشت و مدعی تاج ${n.name} شد.`);
        if (n.id === S.playerId) {
          S.pendingEvent = S.pendingEvent || {
            id: 'pretender_rise_' + S.week, icon: '🩸', title: 'مدعی تاج',
            text: `خاندان ${f.house} آشکارا بر تاج شما ادعا کرد. هنوز شمشیری کشیده نشده، اما در تالارهای دربار نجوا می‌کنند و سپاهیانشان را می‌شمارند. اگر امروز آرامشان نکنید، فردا دیر است.`,
            t2: `خاندان ${f.house} داره ادعای تاج می‌کنه. هنوز جنگ نشده ولی اگه کاری نکنی، می‌شه.`,
            opts: [
              { label: 'با زر و زمین راضی‌شان کن', hint: 'خزانه −۳۵۰۰، وفاداری +۳۰', fx: { dynAppease: f.house } },
              { label: 'سرکرده را دستگیر کن', hint: 'ریسک بالا: یا فرو می‌نشیند یا شورش', fx: { dynArrest: f.house } },
              { label: 'بگذار غر بزنند', hint: 'رایگان، اما کینه می‌ماند', fx: { dynIgnore: f.house } },
            ],
          };
        }
      }
    }
    // مدعیِ راضی‌شده، ادعایش را پس می‌گیرد
    if (f.pretender && f.loyalty > 55) { f.pretender = false; f.grudge = Math.max(0, f.grudge - 20); }

    // ---- شورش تمام‌عیار (نادرتر) ----
    if (f.pretender && !d.pretenderWar && (f.threat || 0) > 50 && f.loyalty < 34) {
      const chance = R('factionRevolt') * (((f.threat || 0) / 50) ** 2);
      if (Math.random() < chance) startPretenderWar(S, n, f);
    }

    // ---- ترور پادشاه (نادرترین) ----
    if (f.pretender && k && f.grudge > 72 && Math.random() < R('assassination')) {
      const guile = (k.stat.guile + (rm.counter || 0) * 40) / 20;
      if (Math.random() > guile * 0.55) {
        killRoyal(S, k, `ترور به دست خاندان ${f.house}`);
        royalNews(S, n.id, '🗡️', `پادشاه ${n.name} به دست آدم‌کشانِ خاندان ${f.house} کشته شد!`);
        f.grudge = 30;
        return;
      }
    }
  }
}

function startPretenderWar(S, n, f) {
  const head = royalById(S, f.headId);
  n.dyn.pretenderWar = { house: f.house, headId: f.headId, week: S.week, prog: 0 };
  n.stability = clamp((n.stability ?? 50) - 22, 0, 100);
  n.legitimacy = clamp((n.legitimacy ?? 60) - 12, 0, 100);
  // استان‌های تحت نفوذ خاندان به دست مدعی می‌افتد
  let flipped = 0;
  for (const pid of f.provs) {
    const p = S.map.provs[pid];
    if (!p || p.owner !== n.id) continue;
    if (Math.random() < 0.55) { p.controller = -2; p.unrest = Math.min(100, (p.unrest || 0) + 30); flipped++; }
  }
  royalNews(S, n.id, '⚔️', `جنگ جانشینی! خاندان ${f.house} با ادعای تاج، ${flipped} استان را به تصرف درآورد.`);
  if (n.id === S.playerId) {
    S.pendingEvent = {
      id: 'pretender_war_' + S.week, icon: '⚔️', title: 'جنگ جانشینی',
      text: `${head ? head.name : 'سرکرده‌ی'} خاندان ${f.house} خود را پادشاه راستین خواند و شمشیر کشید. ${flipped} استان به دست او افتاده و لشکرش هر روز بزرگ‌تر می‌شود. این دیگر غرغر درباری نیست — این جنگ بر سر تاج شماست.`,
      t2: `خاندان ${f.house} رسماً شورش کرد و ${flipped} تا استان رو گرفت. باید بجنگی وگرنه تاجت رو از دست می‌دی.`,
      opts: [
        { label: 'سرکوبش می‌کنم', hint: 'ارتش بسیج شود — ناآرامی +، ولی تاج محفوظ', fx: { unrestAll: 4, army: 2 } },
        { label: 'مذاکره و امتیازدهی', hint: 'خزانه −۶۰۰۰، شورش می‌خوابد', fx: { dynSettle: f.house } },
      ],
    };
  }
}

// ================== ازدواج سیاسی ==================
export function marriageKin(S, a, b) {
  const m = S.nations[a]?.dyn?.marriages?.[b];
  return m ? m.kin : 0;
}

export function arrangeMarriage(S, aId, bId) {
  const A = S.nations[aId], B = S.nations[bId];
  if (!A?.dyn || !B?.dyn) return { ok: false, why: 'سلسله ندارد' };
  if (A.dyn.marriages[bId]) return { ok: false, why: 'پیوند خویشاوندی از پیش برقرار است' };
  A.dyn.marriages[bId] = { since: S.week, kin: 1 };
  B.dyn.marriages[aId] = { since: S.week, kin: 1 };
  A.rel[bId] = clamp((A.rel[bId] || 0) + 22, -100, 100);
  B.rel[aId] = clamp((B.rel[aId] || 0) + 22, -100, 100);
  // ادعای متقابل شکل می‌گیرد
  A.dyn.claims[bId] = Math.min(100, (A.dyn.claims[bId] || 0) + 25);
  B.dyn.claims[aId] = Math.min(100, (B.dyn.claims[aId] || 0) + 25);
  royalNews(S, aId, '💍', `پیوند زناشویی میان خاندان ${A.dyn.house} (${A.name}) و ${B.dyn.house} (${B.name}) بسته شد.`);
  return { ok: true };
}

function findUnionPartner(S, n) {
  const cands = [];
  for (const oid in n.dyn.marriages) {
    const o = S.nations[+oid];
    if (o?.alive && o.dyn && (n.rel[o.id] || 0) > 40) cands.push(o);
  }
  return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
}

function formPersonalUnion(S, n, ally) {
  // تاج n به پادشاه ally می‌رسد — اتحاد تاجی
  const ak = rulerOf(S, ally.id);
  if (!ak) return;
  n.dyn.unionWith = ally.id;
  n.dyn.rulerId = ak.id;
  n.dyn.house = ally.dyn.house;
  n.ruler = ally.ruler;
  n.dyn.regency = false;
  n.legitimacy = clamp((n.legitimacy ?? 60) - 10, 0, 100);
  n.rel[ally.id] = 100; ally.rel[n.id] = 100;
  n.pacts[ally.id] = { ...(n.pacts[ally.id] || {}), alliance: true };
  ally.pacts[n.id] = { ...(ally.pacts[n.id] || {}), alliance: true };
  royalNews(S, n.id, '⚜️', `اتحاد تاجی! ${n.name} بی‌وارث ماند و تاجش به ${ally.ruler} از ${ally.name} رسید.`);
  royalNews(S, ally.id, '⚜️', `${ally.ruler} تاج ${n.name} را نیز بر سر نهاد.`);
}

function aiSeekMarriage(S, n) {
  const cands = S.nations.filter(o => o.alive && o.id !== n.id && o.dyn && !n.dyn.marriages[o.id] && (n.rel[o.id] || 0) > 15);
  if (!cands.length) return;
  const t = cands[Math.floor(Math.random() * cands.length)];
  if (t.id === S.playerId) return;  // پیشنهاد به بازیکن جداگانه است
  if (Object.keys(n.dyn.marriages).length >= 3) return;
  arrangeMarriage(S, n.id, t.id);
}

function offerMarriageToPlayer(S) {
  const pn = S.nations[S.playerId];
  const cands = S.nations.filter(o => o.alive && o.id !== pn.id && o.dyn && !pn.dyn.marriages[o.id] && (pn.rel[o.id] || 0) > 5);
  if (!cands.length) return;
  const t = cands[Math.floor(Math.random() * cands.length)];
  const tk = rulerOf(S, t.id);
  const heir = heirOf(S, pn.id);
  S.pendingEvent = {
    id: 'royal_marriage_' + t.id + '_' + S.week, icon: '💍', title: 'پیشنهاد وصلت',
    text: `سفیر ${t.name} با هدایایی گران به دربار آمده است. ${t.ruler} خواستار پیوند زناشویی میان دو خاندان است — وصلتی که خون ${pn.dyn.house} و ${t.dyn.house} را به هم می‌آمیزد. چنین پیوندی دوستی می‌آورد و ادعای خاندان شما بر تاج آنان را نیز استوار می‌کند.`,
    t2: `${t.name} پیشنهاد داده که با ازدواج فامیل بشید. رابطه‌تون خیلی بهتر می‌شه و اگه پادشاهشون بی‌وارث بمیره، ممکنه تاجشون به تو برسه.`,
    opts: [
      { label: 'می‌پذیرم — پیوند مبارک باد', hint: 'روابط +۲۲، ادعای متقابل، شانس اتحاد تاجی', fx: { dynMarry: t.id } },
      { label: 'رد می‌کنم', hint: 'روابط −۸', fx: { rel: { who: t.id, d: -8 } } },
    ],
  };
}
