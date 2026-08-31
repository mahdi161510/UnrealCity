// ---------- شخصیت‌ها: ژنرال‌ها، دریاسالاران و کابینه‌ی دولت ----------
// هر شخصیت یک انسان است: نام، سن، مهارت، صفات، وفاداری و تاریخچه.
// ژنرال‌ها با نبرد تجربه می‌گیرند و صفت تازه می‌آموزند؛ وزیران با مهارتشان
// کل کشور را بالا یا پایین می‌کشند و اگر وفاداری‌شان بشکند، توطئه می‌کنند.

import { clamp, pick, mulberry32 } from './utils.js';

// ---------------- نام‌ها ----------------
const MALE_FIRST = ['اردشیر', 'بهرام', 'کاوه', 'رستم', 'سهراب', 'فرهاد', 'شاپور', 'مهرداد', 'داریوش', 'کوروش',
  'اردوان', 'تیرداد', 'گشتاسب', 'هرمز', 'نریمان', 'زال', 'گودرز', 'طهماسب', 'بابک', 'سورنا',
  'آرش', 'پیروز', 'خسرو', 'قباد', 'یزدگرد', 'فریدون', 'منوچهر', 'اسفندیار', 'گیو', 'بیژن'];
const FEMALE_FIRST = ['آناهیتا', 'پوراندخت', 'آذرمیدخت', 'شیرین', 'گردآفرید', 'مهرانگیز', 'رودابه', 'فرانک',
  'سیندخت', 'ماه‌بانو', 'دلارام', 'گلنار', 'نازآفرین', 'شهرناز', 'ارنواز'];
const SURNAMES = ['اردلانی', 'کاویانی', 'نادری', 'تیموری', 'فرهمند', 'زرین‌کوه', 'آریامنش', 'سپهری', 'رستمی',
  'بهادر', 'شیردل', 'پولادوند', 'خرم‌دل', 'دلاور', 'رزم‌آرا', 'سرافراز', 'نیک‌پی', 'جهانبانی',
  'مهرآیین', 'یزدان‌پناه', 'فرزانه', 'دادگر', 'روشن‌روان', 'تاج‌بخش', 'گرشاسبی'];

const RANK_G = ['سرهنگ', 'سرتیپ', 'سرلشکر', 'سپهبد', 'ارتشبد'];
const RANK_A = ['ناخدا', 'دریادار', 'دریابان', 'دریاسالار', 'دریابد'];
const TITLE_M = ['میرزا', 'خواجه', 'حکیم', 'دکتر', 'استاد'];

// ---------------- صفات ژنرال ----------------
// mods روی نبرد اثر می‌گذارد؛ برخی صفات هزینه یا خطر دارند.
export const GEN_TRAITS = {
  bold:      { name: 'بی‌باک',        icon: '🔥', good: 1, desc: '+۱۸٪ تهاجم، −۸٪ دفاع', mods: { atk: 0.18, def: -0.08 } },
  cautious:  { name: 'محتاط',         icon: '🛡️', good: 1, desc: '+۱۸٪ دفاع، −۸٪ تهاجم', mods: { def: 0.18, atk: -0.08 } },
  engineer:  { name: 'مهندس سنگر',    icon: '🕳️', good: 1, desc: 'سنگرگیری دوبرابر سریع‌تر و عمیق‌تر', mods: { dig: 1.0, digCap: 8 } },
  logistic:  { name: 'کاردان تدارکات', icon: '🐎', good: 1, desc: '+۳۵٪ سرعت حرکت، فرسایش نصف', mods: { speed: 0.35, attrition: -0.5 } },
  inspiring: { name: 'الهام‌بخش',     icon: '🎺', good: 1, desc: 'روحیه و انسجام سریع‌تر بازمی‌گردد', mods: { org: 0.5, mor: 0.6 } },
  butcher:   { name: 'قصاب',          icon: '🩸', good: 0, desc: '+۲۲٪ تلفات دشمن، +۱۵٪ تلفات خودی', mods: { dmg: 0.22, selfDmg: 0.15 } },
  siege:     { name: 'استاد محاصره',   icon: '🏰', good: 1, desc: 'اشغال استان‌ها ۶۰٪ سریع‌تر', mods: { siege: 0.6 } },
  mountain:  { name: 'کوه‌نورد',       icon: '🏔️', good: 1, desc: 'در کوه و تپه ۲۵٪ قوی‌تر', mods: { terrHills: 0.25 } },
  desertfox: { name: 'روباه بیابان',   icon: '🏜️', good: 1, desc: 'در بیابان و دشت ۲۵٪ قوی‌تر', mods: { terrDry: 0.25 } },
  forester:  { name: 'جنگل‌آشنا',      icon: '🌲', good: 1, desc: 'در جنگل و مرداب ۲۵٪ قوی‌تر', mods: { terrWet: 0.25 } },
  drillmast: { name: 'مشّاق',          icon: '🎖️', good: 1, desc: 'انسجام پایه‌ی ارتش ۱۰ واحد بالاتر', mods: { orgCap: 10 } },
  scholar:   { name: 'اهل کتاب',       icon: '📖', good: 1, desc: 'هر پیروزی کمی پژوهش به ارمغان می‌آورد', mods: { research: 12 } },
  cruel:     { name: 'سنگدل',          icon: '💀', good: 0, desc: 'اشغال سریع‌تر ولی ناآرامی شدید', mods: { siege: 0.35, unrest: 6 } },
  drunkard:  { name: 'میگسار',         icon: '🍷', good: -1, desc: '−۱۲٪ همه‌ی توان رزمی', mods: { atk: -0.12, def: -0.12 } },
  coward:    { name: 'بزدل',           icon: '🐇', good: -1, desc: 'زودتر عقب می‌نشیند؛ روحیه شکننده', mods: { mor: -0.6, def: -0.1 } },
  corruptG:  { name: 'رشوه‌خوار',      icon: '🪙', good: -1, desc: 'نگهداری ارتش ۳۰٪ گران‌تر', mods: { upkeep: 0.3 } },
  ambitious: { name: 'جاه‌طلب',        icon: '👑', good: 0, desc: 'توانمند ولی وفاداری‌اش می‌لغزد', mods: { atk: 0.1, def: 0.1, loyalDrift: -0.35 } },
  loyalist:  { name: 'وفادار تاج',     icon: '💛', good: 1, desc: 'هرگز خیانت نمی‌کند؛ ثبات کشور +', mods: { loyalDrift: 0.4, stability: 1 } },
  naval:     { name: 'دریادلاور',      icon: '🌊', good: 1, desc: '+۲۰٪ توان دریایی', mods: { sea: 0.20 } },
  raider:    { name: 'تاراجگر',        icon: '🏴‍☠️', good: 0, desc: 'محاصره‌ی دریایی خفه‌کننده‌تر', mods: { blockade: 0.45 } },
};

// ---------------- صفات وزیران ----------------
export const MIN_TRAITS = {
  brilliant: { name: 'نابغه',       icon: '💡', good: 1, desc: 'مهارتش عملاً یک پله بالاتر است', mods: { skill: 1.5 } },
  honest:    { name: 'درستکار',     icon: '🕊️', good: 1, desc: 'فساد صفر؛ مردم دوستش دارند', mods: { corrupt: -0.5, unrest: -1.5 } },
  corrupt:   { name: 'مفسد',        icon: '🪙', good: -1, desc: 'بخشی از خزانه در جیب او گم می‌شود', mods: { corrupt: 0.6 } },
  reformer:  { name: 'اصلاح‌طلب',   icon: '📜', good: 1, desc: 'قانون‌گذاری ۳۰٪ سریع‌تر', mods: { lawSpeed: 0.3 } },
  reaction:  { name: 'واپس‌گرا',    icon: '⛓️', good: 0, desc: 'اشراف خشنود، روشنفکران خشمگین', mods: { apprLand: 5, apprIntel: -6 } },
  populist:  { name: 'مردم‌دار',    icon: '✊', good: 1, desc: 'ناآرامی کمتر، کارگران خشنود', mods: { unrest: -3, apprWork: 6 } },
  hawk:      { name: 'جنگ‌طلب',     icon: '🦅', good: 0, desc: 'ارتش خشنود ولی همسایگان بدبین', mods: { apprMil: 6, relDrift: -0.06 } },
  dove:      { name: 'آشتی‌جو',     icon: '🕯️', good: 1, desc: 'روابط دیپلماتیک به‌آرامی بهبود می‌یابد', mods: { relDrift: 0.10 } },
  workaholic:{ name: 'پرکار',       icon: '🕰️', good: 1, desc: 'همه‌ی اثرهای مثبت پست ۲۰٪ بیشتر', mods: { boost: 0.2 } },
  lazy:      { name: 'تن‌آسان',     icon: '🛋️', good: -1, desc: 'همه‌ی اثرهای پست ۳۰٪ کمتر', mods: { boost: -0.3 } },
  intriguer: { name: 'دسیسه‌گر',    icon: '🎭', good: 0, desc: 'جاسوسی قوی‌تر، ولی خودش هم توطئه می‌کند', mods: { spy: 0.25, loyalDrift: -0.3 } },
  pious:     { name: 'پرهیزگار',    icon: '🕌', good: 1, desc: 'روحانیون خشنود؛ مشروعیت بالاتر', mods: { apprClergy: 7, legit: 1.5 } },
  banker:    { name: 'زرگرِ دولت',  icon: '🏦', good: 1, desc: '+۱۰٪ درآمد مالیاتی', mods: { tax: 0.10 } },
  scholarM:  { name: 'دانش‌پرور',   icon: '🎓', good: 1, desc: '+۳ نوآوری در هفته', mods: { innov: 3 } },
};

// ---------------- پست‌های کابینه ----------------
export const CABINET = {
  chancellor: { name: 'صدراعظم',        icon: '🎩', desc: 'سرعت قانون‌گذاری، ثبات و مشروعیت تاج',
    effect: s => ({ lawSpeed: s * 0.05, stability: s * 0.35, legit: s * 0.20 }) },
  finance:    { name: 'وزیر دارایی',    icon: '💰', desc: 'کارایی مالیات و کاهش هزینه‌ی نگهداری',
    effect: s => ({ tax: s * 0.028, upkeep: -s * 0.022 }) },
  war:        { name: 'وزیر جنگ',       icon: '⚔️', desc: 'توان رزمی ارتش و ظرفیت سربازگیری',
    effect: s => ({ atk: s * 0.014, def: s * 0.014, recruit: s * 0.03 }) },
  foreign:    { name: 'وزیر خارجه',     icon: '🕊️', desc: 'بهبود پیوسته‌ی روابط و اعتبار جهانی',
    effect: s => ({ relDrift: s * 0.022, prestige: s * 0.35 }) },
  interior:   { name: 'وزیر کشور',      icon: '🏛️', desc: 'آرام‌کردن استان‌ها و رشد جمعیت',
    effect: s => ({ unrest: -s * 0.55, growth: s * 0.022 }) },
  spymaster:  { name: 'رئیس اطلاعات',   icon: '🕵️', desc: 'توان جاسوسی و ضدجاسوسی',
    effect: s => ({ spy: s * 0.05, counter: s * 0.06 }) },
  industry:   { name: 'وزیر صنایع',     icon: '🏭', desc: 'بازدهی کارخانه‌ها و سرعت ساخت‌وساز',
    effect: s => ({ urbanOut: s * 0.012, build: s * 0.035 }) },
  education:  { name: 'وزیر فرهنگ',     icon: '📚', desc: 'نوآوری و گسترش سواد',
    effect: s => ({ innov: s * 0.55, litTarget: s * 0.7 }) },
};
export const CABINET_KEYS = Object.keys(CABINET);

// ---------------- ساخت شخصیت ----------------
let _uid = 1;
export function resetCharUid(v) { _uid = v || 1; }

function randName(rng, kind) {
  const female = kind === 'minister' ? rng() < 0.18 : rng() < 0.10;
  const first = female ? pick(rng, FEMALE_FIRST) : pick(rng, MALE_FIRST);
  const sur = pick(rng, SURNAMES);
  let rank = '';
  if (kind === 'general') rank = pick(rng, RANK_G) + ' ';
  else if (kind === 'admiral') rank = pick(rng, RANK_A) + ' ';
  else if (kind === 'minister' && !female) rank = rng() < 0.4 ? pick(rng, TITLE_M) + ' ' : '';
  return { name: rank + first + ' ' + sur, female };
}

function rollTraits(rng, kind, count) {
  const pool = kind === 'minister' ? MIN_TRAITS : GEN_TRAITS;
  let keys = Object.keys(pool);
  if (kind === 'admiral') keys = keys.filter(k => !['mountain', 'desertfox', 'forester', 'siege', 'engineer'].includes(k));
  if (kind === 'general') keys = keys.filter(k => !['naval', 'raider'].includes(k));
  const out = [];
  for (let i = 0; i < count; i++) {
    const k = pick(rng, keys);
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

export function makeChar(S, kind, opts = {}) {
  const rng = opts.rng || Math.random;
  const { name, female } = opts.name ? { name: opts.name, female: false } : randName(rng, kind);
  const skill = opts.skill ?? clamp(Math.round(2 + rng() * 6 + (rng() < 0.12 ? 3 : 0)), 1, 10);
  const c = {
    id: _uid++,
    kind,                       // general | admiral | minister
    name, female,
    owner: opts.owner ?? S.playerId,
    age: opts.age ?? Math.round(34 + rng() * 26),
    skill,
    xp: 0, lvl: 1,
    loyalty: clamp(Math.round(45 + rng() * 45), 5, 100),
    traits: opts.traits || rollTraits(rng, kind, rng() < 0.35 ? 2 : 1),
    alive: true,
    assigned: null,             // armyId / fleetId
    post: null,                 // کلید کابینه
    battles: 0, wins: 0, kills: 0,
    hired: S.week || 0,
    salary: Math.round((kind === 'minister' ? 6 : 4) + skill * 1.6),
    hist: [],
  };
  return c;
}

export function charById(S, id) { return (S.chars || []).find(c => c.id === id) || null; }
export function charsOf(S, nid, kind) {
  return (S.chars || []).filter(c => c.alive && c.owner === nid && (!kind || c.kind === kind));
}
export function freeCommanders(S, nid, kind) {
  return charsOf(S, nid, kind).filter(c => c.assigned === null && c.post === null);
}

// ترکیب صفات یک شخصیت → یک شیء تعدیل‌دهنده
export function traitMods(c) {
  const m = {};
  if (!c) return m;
  const pool = c.kind === 'minister' ? MIN_TRAITS : GEN_TRAITS;
  for (const t of c.traits || []) {
    const T = pool[t]; if (!T) continue;
    for (const k in T.mods) m[k] = (m[k] || 0) + T.mods[k];
  }
  return m;
}

// توان مؤثر یک فرمانده: مهارت + سطح + صفات
export function commanderPower(c) {
  if (!c) return 1;
  return 0.72 + (c.skill / 10) * 0.42 + (c.lvl - 1) * 0.06;
}

// ---------------- اثر کابینه بر کل کشور ----------------
export function cabinetMods(S, n) {
  const out = {
    lawSpeed: 0, stability: 0, legit: 0, tax: 0, upkeep: 0, atk: 0, def: 0, recruit: 0,
    relDrift: 0, prestige: 0, unrest: 0, growth: 0, spy: 0, counter: 0,
    urbanOut: 0, build: 0, innov: 0, litTarget: 0, corrupt: 0,
    apprLand: 0, apprIntel: 0, apprWork: 0, apprMil: 0, apprClergy: 0, sea: 0,
  };
  if (!n.cabinet) return out;
  for (const role of CABINET_KEYS) {
    const id = n.cabinet[role];
    if (!id) continue;
    const c = charById(S, id);
    if (!c || !c.alive) continue;
    const tm = traitMods(c);
    const boost = 1 + (tm.boost || 0);
    // مهارت مؤثر (نابغه‌ها بالاتر عمل می‌کنند؛ وفاداری پایین کارایی را می‌خورد)
    const eff = clamp(c.skill + (tm.skill || 0), 0, 12) * (0.55 + 0.45 * (c.loyalty / 100));
    const fx = CABINET[role].effect(eff);
    for (const k in fx) out[k] = (out[k] || 0) + fx[k] * boost;
    // اثرهای مستقیم صفات
    for (const k of ['corrupt', 'unrest', 'lawSpeed', 'relDrift', 'spy', 'legit', 'tax', 'innov',
      'apprLand', 'apprIntel', 'apprWork', 'apprMil', 'apprClergy', 'stability']) {
      if (tm[k]) out[k] = (out[k] || 0) + tm[k];
    }
  }
  return out;
}

export function cabinetSalary(S, n) {
  let s = 0;
  for (const role of CABINET_KEYS) {
    const c = charById(S, n.cabinet?.[role]);
    if (c && c.alive) s += c.salary;
  }
  return s;
}

// ---------------- استخدام / برکناری ----------------
export function refreshCandidates(S, n, force) {
  n.candidates = n.candidates || [];
  if (!force && n.candidates.length >= 4) return;
  const rng = mulberry32((S.week + 1) * 7919 + n.id * 131);
  // نامزدهای استخدام‌نشده‌ی دوره‌ی پیش، دربار را ترک می‌کنند (جلوگیری از انباشت)
  const old = new Set(n.candidates);
  n.candidates = [];
  if (old.size) S.chars = S.chars.filter(c => !(old.has(c.id) && !c.post && c.assigned === null));
  for (let i = 0; i < 4; i++) {
    const c = makeChar(S, 'minister', { rng, owner: n.id });
    S.chars.push(c);
    n.candidates.push(c.id);
  }
}

export function appointMinister(S, n, role, charId) {
  const c = charById(S, charId);
  if (!c || !c.alive) return { ok: false, why: 'این شخص در دسترس نیست' };
  if (c.owner !== n.id) return { ok: false, why: 'او در خدمت شما نیست' };
  const cost = c.salary * 8;
  if (n.treasury < cost) return { ok: false, why: `هزینه‌ی انتصاب £${cost} است` };
  n.treasury -= cost;
  // اگر قبلاً پست دیگری داشت، آزاد شود
  for (const r of CABINET_KEYS) if (n.cabinet[r] === charId) n.cabinet[r] = null;
  // متصدی قبلی برکنار می‌شود
  const old = charById(S, n.cabinet[role]);
  if (old) { old.post = null; old.loyalty = clamp(old.loyalty - 18, 0, 100); }
  n.cabinet[role] = charId;
  c.post = role;
  c.hired = S.week;
  n.candidates = (n.candidates || []).filter(x => x !== charId);
  return { ok: true, cost };
}

export function dismissMinister(S, n, role) {
  const c = charById(S, n.cabinet?.[role]);
  if (!c) return { ok: false, why: 'این پست خالی است' };
  n.cabinet[role] = null;
  c.post = null;
  c.loyalty = clamp(c.loyalty - 25, 0, 100);
  c.hist.push({ w: S.week, t: 'برکنار شد' });
  return { ok: true, name: c.name };
}

// ---------------- ارتقای ژنرال‌ها ----------------
const XP_LVL = [0, 70, 180, 350, 600, 950, 1450];
export function addXP(S, c, amount) {
  if (!c || !c.alive) return;
  c.xp += amount;
  while (c.lvl < XP_LVL.length && c.xp >= XP_LVL[c.lvl]) {
    c.lvl++;
    // در سطح‌های زوج، صفت تازه‌ای می‌آموزد
    if (c.lvl % 2 === 0 && (c.traits || []).length < 4) {
      const pool = c.kind === 'admiral'
        ? ['naval', 'raider', 'bold', 'cautious', 'inspiring', 'logistic', 'drillmast']
        : ['bold', 'cautious', 'engineer', 'logistic', 'inspiring', 'siege', 'mountain', 'desertfox', 'forester', 'drillmast', 'scholar'];
      const cands = pool.filter(k => !c.traits.includes(k));
      if (cands.length) {
        const t = cands[(c.id * 31 + c.lvl * 17) % cands.length];
        c.traits.push(t);
        c.hist.push({ w: S.week, t: `صفت «${GEN_TRAITS[t].name}» را آموخت` });
      }
    }
    c.skill = clamp(c.skill + 1, 1, 12);
    c.hist.push({ w: S.week, t: `به سطح ${c.lvl} رسید` });
    if (c.owner === S.playerId) {
      S.pendingAlerts = S.pendingAlerts || [];
      S.pendingAlerts.push({ icon: '🎖️', text: `${c.name} به سطح ${c.lvl} ارتقا یافت`, w: S.week });
    }
  }
}
export function xpToNext(c) {
  if (!c || c.lvl >= XP_LVL.length) return null;
  return { cur: c.xp - (XP_LVL[c.lvl - 1] || 0), max: XP_LVL[c.lvl] - (XP_LVL[c.lvl - 1] || 0) };
}

// ---------------- گام هفتگی ----------------
export function stepCharacters(S) {
  if (!S.chars) return;
  const every4 = S.week % 4 === 0;
  for (const c of S.chars) {
    if (!c.alive) continue;
    const n = S.nations[c.owner];
    if (!n || !n.alive) { continue; }
    if (!every4) continue;

    c.age += 4 / 52;
    const tm = traitMods(c);

    // وفاداری: سمت‌داشتن و پول خوب نگهش می‌دارد؛ جاه‌طلبی و بی‌کاری می‌فرسایدش
    let drift = (tm.loyalDrift || 0);
    if (c.post || c.assigned !== null) drift += 0.35; else drift -= 0.22;
    if (n.treasury < 0) drift -= 0.5;
    if ((n.stability ?? 50) < 30) drift -= 0.4;
    if ((n.legitimacy ?? 60) > 70) drift += 0.3;
    c.loyalty = clamp(c.loyalty + drift, 0, 100);

    // مرگ طبیعی
    const deathP = c.age > 62 ? (c.age - 62) * 0.0016 : 0.00012;
    if (Math.random() < deathP) {
      killChar(S, c, 'کهولت سن');
      continue;
    }
  }
  // نامزدهای تازه هر ۲۶ هفته
  if (S.week % 26 === 0) {
    for (const n of S.nations) if (n.alive) refreshCandidates(S, n, true);
  }
  // پاک‌سازی شخصیت‌های بی‌صاحب و مرده‌ی قدیمی (سبک نگه‌داشتن حافظه)
  if (S.week % 52 === 0 && S.chars.length > 260) {
    S.chars = S.chars.filter(c => c.alive || (S.week - (c.diedW || 0)) < 260);
  }
}

export function killChar(S, c, cause) {
  if (!c || !c.alive) return;
  c.alive = false;
  c.diedW = S.week;
  c.cause = cause;
  const n = S.nations[c.owner];
  if (n) {
    if (c.post && n.cabinet) n.cabinet[c.post] = null;
    n.candidates = (n.candidates || []).filter(x => x !== c.id);
  }
  // ارتش/ناوگانش بی‌فرمانده می‌شود
  for (const a of S.armies || []) if (a.genId === c.id) { a.genId = null; a.gen = null; }
  for (const f of S.fleets || []) if (f.admId === c.id) { f.admId = null; }
  S.log && S.log.push({ w: S.week, icon: '🕯️', text: `${c.name} درگذشت (${cause}).` });
  if (n && n.player) {
    S.pendingAlerts = S.pendingAlerts || [];
    S.pendingAlerts.push({ icon: '🕯️', text: `${c.name} را از دست دادید — ${cause}`, w: S.week });
  }
}

// ---------------- راه‌اندازی آغازین ----------------
export function initCharacters(S) {
  S.chars = [];
  resetCharUid(1);
  for (const n of S.nations) {
    const rng = mulberry32((S.seed ^ 0x5eed) + n.id * 4093);
    n.cabinet = {};
    for (const r of CABINET_KEYS) n.cabinet[r] = null;
    n.candidates = [];
    // ۳ ژنرال، ۱ دریاسالار و کابینه‌ی نیمه‌پر آغازین
    const gCount = n.pers === 'aggressive' ? 4 : 3;
    for (let i = 0; i < gCount; i++) {
      const c = makeChar(S, 'general', { rng, owner: n.id });
      S.chars.push(c);
    }
    for (let i = 0; i < 2; i++) {
      const c = makeChar(S, 'admiral', { rng, owner: n.id });
      S.chars.push(c);
    }
    // کابینه‌ی آغازین: بازیکن ۳ پست پر، AI ۴ تا ۶ پست
    const fill = n.player ? 3 : 4 + Math.floor(rng() * 3);
    const roles = CABINET_KEYS.slice();
    for (let i = 0; i < fill && i < roles.length; i++) {
      const role = roles[i];
      const c = makeChar(S, 'minister', { rng, owner: n.id });
      S.chars.push(c);
      n.cabinet[role] = c.id;
      c.post = role;
    }
    refreshCandidates(S, n, true);
  }
}
