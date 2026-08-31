// ================================================================
// پروژه‌های ملی و فرمان‌های سلطنتی
// ----------------------------------------------------------------
// در آزمون دیدیم بازیکن با £۳۳۴٬۰۰۰ خزانه‌ی راکد بازی را تمام می‌کند،
// چون پس از ساخت‌وساز چیزی برای خرج‌کردن نیست. پروژه‌های ملی سرمایه‌گذاری
// چندساله‌ی گران با پاداش دائمی‌اند، و فرمان‌های سلطنتی کنش‌های کم‌شمار
// و پرتأثیر با کول‌داون.
// ویکتوریا-محور: مثل بقیه‌ی سامانه‌های تازه با timelineId گارد می‌شود.
// ================================================================
import { clamp } from './utils.js';

// ---- پروژه‌های ملی ----
// cost: هزینه‌ی کل (اقساط هفتگی) · weeks: مدت · mods: بونوس دائمی پس از پایان
export const PROJECTS = {
  railway: {
    name: 'راه‌آهن سراسری', icon: '🚂', cost: 42000, weeks: 260,
    desc: 'ریل از پایتخت تا دورترین مرز؛ کالا و سرباز با شتاب جابه‌جا می‌شوند.',
    mods: { moveSpeed: 0.22, prod: 0.10, tradeCap: 0.12 },
    req: { tech: 'railway' },
  },
  university: {
    name: 'دانشگاه بزرگ', icon: '🎓', cost: 30000, weeks: 208,
    desc: 'کرسی‌های علم و کتابخانه‌ای که نامش از مرزها می‌گذرد.',
    mods: { research: 0.25, literacy: 0.15, prestigeFlat: 6 },
  },
  oceanfleet: {
    name: 'ناوگان اقیانوس‌پیما', icon: '⛵', cost: 48000, weeks: 234,
    desc: 'کشتی‌های بلندپروازی که آب‌های دور را به آب‌های خانگی بدل می‌کنند.',
    mods: { navalPower: 0.28, tradeCap: 0.18, prestigeFlat: 8 },
    req: { coastal: true },
  },
  landreform: {
    name: 'اصلاح ارضی', icon: '🌾', cost: 26000, weeks: 156,
    desc: 'زمین به دست کشاورز؛ اربابان خشمگین، روستا آرام.',
    mods: { farm: 0.18, unrest: -0.12, popGrowth: 0.08 },
    penalty: { faction: 'landed', grudge: 18 },
  },
  publichealth: {
    name: 'بهداشت همگانی', icon: '🏥', cost: 24000, weeks: 182,
    desc: 'آب پاک، بیمارستان شهری و پایان وباهای فصلی.',
    mods: { popGrowth: 0.14, unrest: -0.08, stability: 0.10 },
  },
  arsenal: {
    name: 'زرادخانه‌ی سلطنتی', icon: '⚒️', cost: 36000, weeks: 208,
    desc: 'کارگاه‌های توپ‌ریزی و انبارهای سلاح برای ارتشی مدرن.',
    mods: { armyAtk: 0.14, armyMor: 0.10, upkeep: -0.08 },
    req: { tech: 'artillery' },
  },
  grandbank: {
    name: 'بانک بزرگ دولتی', icon: '🏦', cost: 34000, weeks: 182,
    desc: 'اعتبار دولتی، اوراق قرضه و پایان وام‌های خفت‌بار.',
    mods: { taxIncome: 0.16, tradeCap: 0.14, buildCost: -0.10 },
  },
  telegraph: {
    name: 'شبکه‌ی تلگراف', icon: '📡', cost: 22000, weeks: 130,
    desc: 'فرمان پایتخت در یک روز به مرز می‌رسد، نه یک ماه.',
    mods: { stability: 0.12, moveSpeed: 0.10, research: 0.08 },
  },
};
export const PROJECT_KEYS = Object.keys(PROJECTS);

export function initProjects(S) {
  if (S.timelineId !== 'victoria') return;
  S.projects = [];
  for (const n of S.nations) { n.decreeCd = {}; n.projDone = []; }
}

// آیا این ملت می‌تواند این پروژه را آغاز کند؟
export function canStartProject(S, n, key) {
  if (S.timelineId !== 'victoria') return { ok: false, why: 'در این خط زمانی نیست' };
  const P = PROJECTS[key];
  if (!P) return { ok: false, why: 'ناشناخته' };
  if ((n.projDone || []).includes(key)) return { ok: false, why: 'پیش‌تر ساخته شده' };
  if ((S.projects || []).some(p => p.nid === n.id && p.key === key)) return { ok: false, why: 'در دست ساخت است' };
  if ((S.projects || []).filter(p => p.nid === n.id && !p.done).length >= 2) return { ok: false, why: 'هم‌زمان بیش از دو پروژه ممکن نیست' };
  if (P.req?.tech && !n.tech.includes(P.req.tech)) return { ok: false, why: 'نیازمند فناوری' };
  if (P.req?.coastal) {
    const hasPort = S.map.provs.some(p => p.owner === n.id && p.seaZone != null);
    if (!hasPort) return { ok: false, why: 'نیازمند استان ساحلی' };
  }
  const weekly = Math.ceil(P.cost / P.weeks);
  if (n.treasury < weekly * 8) return { ok: false, why: 'خزانه کفاف اقساط را نمی‌دهد' };
  return { ok: true, weekly };
}

export function startProject(S, n, key) {
  const c = canStartProject(S, n, key);
  if (!c.ok) return c;
  S.projects = S.projects || [];
  S.projects.push({ nid: n.id, key, prog: 0, paid: 0, weeks: 0, done: false, halted: 0 });
  return { ok: true };
}

export function cancelProject(S, n, key) {
  const i = (S.projects || []).findIndex(p => p.nid === n.id && p.key === key && !p.done);
  if (i < 0) return { ok: false, why: 'یافت نشد' };
  const p = S.projects[i];
  n.treasury += Math.round(p.paid * 0.35); // بخشی از هزینه بازمی‌گردد
  S.projects.splice(i, 1);
  return { ok: true, refund: Math.round(p.paid * 0.35) };
}

// بونوس‌های پروژه‌های کامل‌شده‌ی یک ملت
export function projectMods(S, n) {
  const m = {};
  if (S.timelineId !== 'victoria' || !n) return m;
  for (const key of (n.projDone || [])) {
    const P = PROJECTS[key];
    if (!P) continue;
    for (const k in P.mods) m[k] = (m[k] || 0) + P.mods[k];
  }
  return m;
}

export function simProjects(S) {
  if (S.timelineId !== 'victoria' || !S.projects?.length) return;
  for (const p of S.projects) {
    if (p.done) continue;
    const n = S.nations[p.nid];
    const P = PROJECTS[p.key];
    if (!n?.alive || !P) { p.dead = true; continue; }
    const weekly = Math.ceil(P.cost / P.weeks);
    // پرداخت قسط؛ اگر خزانه خالی باشد کار می‌خوابد ولی از بین نمی‌رود
    if (n.treasury < weekly) {
      p.halted = (p.halted || 0) + 1;
      if (n.player && p.halted === 4) S.pendingAlerts?.push({ icon: '⏸️', text: `${P.name}: اقساط پرداخت نشد، کار خوابید.`, w: S.week });
      continue;
    }
    n.treasury -= weekly;
    p.paid += weekly;
    p.halted = 0;
    p.weeks++;
    p.prog = clamp(p.paid / P.cost * 100, 0, 100);
    if (p.prog >= 100) {
      p.done = true;
      n.projDone = n.projDone || [];
      n.projDone.push(p.key);
      if (P.mods.prestigeFlat) n.prestige = (n.prestige || 0) + P.mods.prestigeFlat;
      if (P.penalty?.faction && n.dyn?.factions) {
        const f = n.dyn.factions.find(x => x.key === P.penalty.faction);
        if (f) f.grudge = clamp((f.grudge || 0) + P.penalty.grudge, 0, 100);
      }
      if (S.addLogFn) S.addLogFn(S, P.icon, `${P.name} به پایان رسید — ${n.name} دگرگون شد.`);
      if (n.player) S.pendingAlerts?.push({ icon: P.icon, text: `${P.name} کامل شد!`, w: S.week });
    }
  }
  S.projects = S.projects.filter(p => !p.dead);
}

// ---- فرمان‌های سلطنتی ----
// کنش‌های کم‌شمار و پرتأثیر با کول‌داون بلند.
export const DECREES = {
  mobilize: {
    name: 'بسیج عمومی', icon: '📯', cd: 312, cost: 6000,
    desc: 'فراخوان سراسری؛ گردان‌های تازه اما نارضایتی مردم.',
    run(S, n) {
      n.battalions = (n.battalions || 0) + 6;
      for (const p of S.map.provs) if (p.owner === n.id) p.unrest = clamp((p.unrest || 0) + 10, 0, 100);
      n.stability = clamp((n.stability ?? 50) - 6, 0, 100);
      return 'شش گردان تازه به پرچم پیوست؛ خانه‌ها خالی‌تر شد.';
    },
  },
  amnesty: {
    name: 'عفو عمومی', icon: '🕊️', cd: 260, cost: 3000,
    desc: 'زندان‌ها گشوده می‌شوند؛ آرامش می‌آید، اقتدار می‌رود.',
    run(S, n) {
      for (const p of S.map.provs) if (p.owner === n.id) p.unrest = clamp((p.unrest || 0) - 22, 0, 100);
      n.stability = clamp((n.stability ?? 50) + 8, 0, 100);
      n.legitimacy = clamp((n.legitimacy ?? 60) - 5, 0, 100);
      return 'دروازه‌ی زندان‌ها گشوده شد؛ شهرها نفس کشیدند.';
    },
  },
  industrial: {
    name: 'فرمان صنعتی', icon: '🏭', cd: 260, cost: 12000,
    desc: 'یارانه‌ی کلان به کارخانه‌ها؛ جهش تولید به بهای خزانه.',
    run(S, n) {
      n.industBoost = (n.industBoost || 0) + 52; // ۵۲ هفته جهش
      return 'چرخ کارخانه‌ها با یارانه‌ی سلطنتی تندتر چرخید.';
    },
  },
  grainDole: {
    name: 'توزیع غله', icon: '🌾', cd: 156, cost: 8000,
    desc: 'انبارهای سلطنتی گشوده می‌شوند تا شکم‌ها سیر بماند.',
    run(S, n) {
      for (const p of S.map.provs) if (p.owner === n.id) { p.unrest = clamp((p.unrest || 0) - 12, 0, 100); p.sol = clamp((p.sol || 10) + 2, 2, 30); }
      return 'غله میان مردم پخش شد؛ نان ارزان شد.';
    },
  },
  patronage: {
    name: 'حمایت از هنر', icon: '🎭', cd: 208, cost: 7000,
    desc: 'شاعران و معماران زیر سایه‌ی تاج؛ آوازه‌ی دربار بلند می‌شود.',
    run(S, n) {
      n.prestige = (n.prestige || 0) + 12;
      n.legitimacy = clamp((n.legitimacy ?? 60) + 6, 0, 100);
      return 'دربار به کعبه‌ی هنرمندان بدل شد.';
    },
  },
};
export const DECREE_KEYS = Object.keys(DECREES);

export function canDecree(S, n, key) {
  if (S.timelineId !== 'victoria') return { ok: false, why: 'در این خط زمانی نیست' };
  const D = DECREES[key];
  if (!D) return { ok: false, why: 'ناشناخته' };
  const cd = (n.decreeCd || {})[key] || 0;
  if (cd > 0) return { ok: false, why: `${Math.ceil(cd / 52)} سال تا فرمان بعدی` };
  if (n.treasury < D.cost) return { ok: false, why: 'خزانه کافی نیست' };
  return { ok: true };
}

export function issueDecree(S, n, key) {
  const c = canDecree(S, n, key);
  if (!c.ok) return c;
  const D = DECREES[key];
  n.treasury -= D.cost;
  n.decreeCd = n.decreeCd || {};
  n.decreeCd[key] = D.cd;
  const msg = D.run(S, n);
  if (S.addLogFn) S.addLogFn(S, D.icon, `فرمان سلطنتی — ${D.name}: ${msg}`);
  return { ok: true, msg };
}

export function simDecrees(S) {
  if (S.timelineId !== 'victoria') return;
  for (const n of S.nations) {
    if (!n.decreeCd) continue;
    for (const k in n.decreeCd) if (n.decreeCd[k] > 0) n.decreeCd[k]--;
    if (n.industBoost > 0) n.industBoost--;
  }
}

// هوش مصنوعی هم پروژه می‌سازد تا رقابت واقعی باشد (بدون تقلب: همان قواعد)
export function aiProjects(S, n) {
  if (S.timelineId !== 'victoria' || n.player) return;
  if ((S.projects || []).filter(p => p.nid === n.id && !p.done).length >= 1) return;
  if (n.treasury < 20000 || Math.random() > 0.02) return;
  const pref = n.pers === 'aggressive' ? ['arsenal', 'railway', 'telegraph']
    : n.pers === 'industrial' ? ['railway', 'grandbank', 'university']
      : n.pers === 'trader' ? ['oceanfleet', 'grandbank', 'telegraph']
        : n.pers === 'peaceful' ? ['publichealth', 'university', 'landreform']
          : ['university', 'railway', 'publichealth'];
  for (const key of pref) if (canStartProject(S, n, key).ok) { startProject(S, n, key); return; }
}

// ================================================================
// کارنامه‌ی پایان قرن و پایان‌های چندگانه
// ----------------------------------------------------------------
// پیش‌تر پایان بازی تنها «رتبه ۱ یا نه» بود. حالا بازیکن بر پایه‌ی
// آنچه واقعاً ساخته سنجیده می‌شود، و هر سبک بازی پایان شایسته‌ی
// خودش را می‌گیرد.
// ================================================================
export const ENDINGS = [
  {
    key: 'worldEmpire', icon: '🌍', title: 'امپراتوری جهانی',
    text: 'پرچم شما بر گسترده‌ترین خاک قرن برافراشته شد. نام شما را در مدرسه‌ها خواهند خواند — گاهی با شکوه، گاهی با ترس.',
    test: (s) => s.rank === 1 && s.provShare >= 0.24,
  },
  {
    key: 'industrial', icon: '🏭', title: 'قدرت صنعتی',
    text: 'دودکش‌های شما آسمان را رنگ زدند و چرخ اقتصاد جهان بر محور شما چرخید. ثروت، سلاحی بود که هرگز شلیک نشد.',
    test: (s) => s.gdpShare >= 0.20,
  },
  {
    key: 'enlightened', icon: '📚', title: 'مشعل‌دار تمدن',
    text: 'دانشگاه‌ها، کتاب‌ها و آزمایشگاه‌های شما میراثی ماندگارتر از هر فتحی ساختند. قرن بعد وامدار شماست.',
    test: (s) => s.techShare >= 0.9 && s.literacy >= 55,
  },
  {
    key: 'builder', icon: '🏗️', title: 'معمار ملت',
    text: 'راه‌آهن و دانشگاه و بیمارستان‌های شما کشور را از ریشه دگرگون کرد. مردم، نه مرزها، میراث شما شدند.',
    test: (s) => s.projects >= 4,
  },
  {
    key: 'respected', icon: '🕊️', title: 'وجدان جهان',
    text: 'بی‌آنکه خاکی بدزدید بزرگ شدید. در کنفرانس‌ها نخست به شما نگاه می‌کردند — این احترام، خریدنی نبود.',
    test: (s) => s.rank <= 3 && s.infamy < 15 && s.annexed === 0,
  },
  {
    key: 'survivor', icon: '🛡️', title: 'بازمانده‌ی سرافراز',
    text: 'قرن با شما مهربان نبود، اما تاج بر جای ماند. گاهی ماندن، خود پیروزی است.',
    test: (s) => s.alive && s.rank > 5,
  },
  {
    key: 'fallen', icon: '💀', title: 'فروپاشی',
    text: 'دولت از هم پاشید و کشور در هرج‌ومرج فرو رفت. تاریخ صفحه‌ای تازه خواهد گشود — بی نام شما.',
    test: (s) => !s.alive || s.defeat,
  },
];

// سنجه‌های پایان بازی
export function endgameStats(S) {
  const n = S.nations[S.playerId];
  const alive = S.nations.filter(x => x.alive);
  const rank = alive.slice().sort((a, b) => b.prestige - a.prestige).findIndex(x => x.id === n.id) + 1;
  const ownedAll = S.map.provs.filter(p => p.owner >= 0).length || 1;
  const mine = S.map.provs.filter(p => p.owner === n.id).length;
  const gdpAll = alive.reduce((a, x) => a + Math.max(0, x.gdp || 0), 0) || 1;
  const maxTech = Math.max(1, ...alive.map(x => (x.tech || []).length));
  return {
    rank: rank || alive.length,
    provShare: mine / ownedAll,
    gdpShare: Math.max(0, n.gdp || 0) / gdpAll,
    techShare: (n.tech || []).length / maxTech,
    literacy: n.literacy || 0,
    projects: (n.projDone || []).length,
    infamy: n.infamy || 0,
    annexed: n.annexed || 0,
    alive: !!n.alive,
    defeat: !!S.defeat,
    provs: mine,
    wonders: (S.wonders || []).filter(w => w.done && w.nid === n.id).length,
  };
}

// نخستین پایانی که شرطش برقرار است (ترتیب = اولویت)
export function pickEnding(S) {
  const s = endgameStats(S);
  const fallen = ENDINGS.find(e => e.key === 'fallen');
  if (fallen.test(s)) return { ...fallen, stats: s };
  for (const e of ENDINGS) if (e.key !== 'fallen' && e.test(s)) return { ...e, stats: s };
  return { ...ENDINGS.find(e => e.key === 'survivor'), stats: s };
}
