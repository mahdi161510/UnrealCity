// ---------------------------------------------------------------
//  شورای درباری، فساد، دسیسه و رقابت وارثان
//  ویژه‌ی خط زمانی «ویکتوریا فانتزی»
// ---------------------------------------------------------------
import { clamp } from './utils.js';
import { rulerOf, heirOf, childrenOf, royalById } from './dynasty.js';

// ---------- کرسی‌های شورا ----------
export const SEATS = {
  vizier:  { name: 'وزیر اعظم',     icon: '🏛️', stat: 'admin',   desc: 'گرداننده‌ی دیوان و کار روزمره‌ی کشور',
             mods: s => ({ admin: 0.010 * s, corruptRes: 0.9 * s }) },
  treasury:{ name: 'خزانه‌دار',      icon: '💰', stat: 'admin',   desc: 'نگهبان خزانه و مالیات',
             mods: s => ({ taxIncome: 0.009 * s, corruptRes: 0.7 * s }) },
  marshal: { name: 'سپهسالار',       icon: '🗡️', stat: 'martial', desc: 'فرمانده‌ی کل سپاه',
             mods: s => ({ armyMor: 0.009 * s, armyAtk: 0.006 * s }) },
  justice: { name: 'قاضی‌القضات',    icon: '⚖️', stat: 'admin',   desc: 'داور دادگاه‌ها و مهارکننده‌ی ناآرامی',
             mods: s => ({ unrest: -0.010 * s, stability: 0.007 * s }) },
  herald:  { name: 'رئیس تشریفات',   icon: '📜', stat: 'diplo',   desc: 'زبان دربار در برابر جهان',
             mods: s => ({ relGain: 0.011 * s, legitimacy: 0.006 * s }) },
};
export const SEAT_KEYS = Object.keys(SEATS);

// آیا این خط زمانی شورا دارد؟
const active = S => S.timelineId === 'victoria';
const alertP = (S, icon, text) => { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon, text, w: S.week }); };
const news = (S, icon, txt) => { if (!S.royalNews) S.royalNews = []; S.royalNews.push({ wk: S.week, icon, txt }); };

// ---------- برپایی ----------
export function initCouncil(S) {
  if (!active(S)) return;
  for (const n of S.nations) {
    if (!n.alive || !n.dyn) continue;
    n.council = {};
    n.corruption = 4 + Math.random() * 8;
    autoFillCouncil(S, n);
  }
}

// نامزدهای ممکن: شاهزادگان بالغ + سران خاندان‌های بزرگ
export function candidatesFor(S, n, seatKey) {
  const out = [];
  const ruler = rulerOf(S, n.id);
  if (ruler) {
    for (const c of childrenOf(S, ruler)) {
      if (c.alive && c.age >= 16) out.push({ kind: 'prince', r: c });
    }
    const gp = ruler.fatherId != null ? royalById(S, ruler.fatherId) : null;
    if (gp) for (const sib of childrenOf(S, gp)) {
      if (sib.alive && sib.id !== ruler.id && sib.age >= 16) out.push({ kind: 'prince', r: sib });
    }
  }
  for (const f of n.dyn?.factions || []) {
    const head = royalById(S, f.headId);
    if (head?.alive) out.push({ kind: 'faction', r: head, fac: f });
  }
  // کسی که هم‌اکنون کرسی دیگری دارد، نامزد نیست
  const taken = new Set(Object.values(n.council || {}).map(c => c?.rid).filter(Boolean));
  return out.filter(c => !taken.has(c.r.id) || n.council?.[seatKey]?.rid === c.r.id);
}

export function seatScore(r, seatKey) {
  const st = SEATS[seatKey].stat;
  return r.stat?.[st] || 8;
}

// انتصاب
export function appoint(S, n, seatKey, royalId) {
  const r = royalById(S, royalId);
  if (!r?.alive) return { ok: false, why: 'این شخص در دسترس نیست' };
  if (!n.council) n.council = {};
  // کرسی قبلی همین فرد آزاد شود
  for (const k of SEAT_KEYS) if (n.council[k]?.rid === royalId) delete n.council[k];

  const prev = n.council[seatKey];
  n.council[seatKey] = { rid: royalId, since: S.week, honesty: clamp(50 + (r.stat?.admin || 9) * 2 - (r.stat?.guile || 9) * 3 + Math.random() * 20, 5, 95) };

  // واکنش خاندان‌ها: صاحب کرسی خشنود، محروم دلخور
  const fac = (n.dyn?.factions || []).find(f => f.headId === royalId);
  if (fac) { fac.loyalty = clamp(fac.loyalty + 10, 0, 100); fac.grudge = clamp((fac.grudge || 0) - 8, 0, 100); }
  if (prev) {
    const pf = (n.dyn?.factions || []).find(f => f.headId === prev.rid);
    if (pf) { pf.loyalty = clamp(pf.loyalty - 8, 0, 100); pf.grudge = clamp((pf.grudge || 0) + 12, 0, 100); }
    const pr = royalById(S, prev.rid);
    if (pr) pr.slighted = (pr.slighted || 0) + 1;   // شاهزاده‌ی عزل‌شده کینه می‌گیرد
  }
  return { ok: true };
}

export function dismiss(S, n, seatKey) {
  const c = n.council?.[seatKey];
  if (!c) return { ok: false };
  const pf = (n.dyn?.factions || []).find(f => f.headId === c.rid);
  if (pf) { pf.loyalty = clamp(pf.loyalty - 10, 0, 100); pf.grudge = clamp((pf.grudge || 0) + 14, 0, 100); }
  const pr = royalById(S, c.rid);
  if (pr) pr.slighted = (pr.slighted || 0) + 1;
  delete n.council[seatKey];
  return { ok: true };
}

// پرکردن خودکار کرسی‌های خالی (برای AI و آغاز بازی)
export function autoFillCouncil(S, n) {
  if (!n.dyn) return;
  for (const k of SEAT_KEYS) {
    if (n.council?.[k]) {
      const r = royalById(S, n.council[k].rid);
      if (r?.alive) continue;
      delete n.council[k];
    }
    const cands = candidatesFor(S, n, k);
    if (!cands.length) continue;
    cands.sort((a, b) => seatScore(b.r, k) - seatScore(a.r, k));
    appoint(S, n, k, cands[0].r.id);
  }
}

// ---------- مودیفایرهای شورا ----------
export function councilMods(S, n) {
  const out = {};
  if (!n.council) return out;
  let corruptRes = 0;
  for (const k of SEAT_KEYS) {
    const c = n.council[k];
    if (!c) continue;
    const r = royalById(S, c.rid);
    if (!r?.alive) continue;
    const m = SEATS[k].mods(seatScore(r, k));
    for (const key in m) {
      if (key === 'corruptRes') { corruptRes += m[key]; continue; }
      out[key] = (out[key] || 0) + m[key];
    }
  }
  out._corruptRes = corruptRes;
  // کرسی خالی = بی‌سامانی
  const empty = SEAT_KEYS.filter(k => !n.council[k]).length;
  if (empty) { out.stability = (out.stability || 0) - 0.02 * empty; out.admin = (out.admin || 0) - 0.03 * empty; }
  return out;
}

// اثر فساد بر کشور
export function corruptionMods(n) {
  const c = n.corruption || 0;
  if (c <= 0) return {};
  return { taxIncome: -0.006 * c, prod: -0.002 * c, unrest: 0.010 * c, stability: -0.004 * c };
}

// ---------- شبیه‌سازی هفتگی ----------
export function simCouncil(S) {
  if (!active(S)) return;
  if (S.week % 4 !== 0) return;

  for (const n of S.nations) {
    if (!n.alive || !n.dyn) continue;
    if (!n.council) n.council = {};
    if (n.corruption == null) n.corruption = 5;

    // کرسی‌های خالی‌شده (مرگ) دوباره پر می‌شوند؛ برای بازیکن خالی می‌ماند تا خودش تصمیم بگیرد
    let vacated = false;
    for (const k of SEAT_KEYS) {
      const c = n.council[k];
      if (c && !royalById(S, c.rid)?.alive) { delete n.council[k]; vacated = true; }
    }
    if (n.id !== S.playerId) autoFillCouncil(S, n);
    else if (vacated) {
      // دیوان بی‌سرپرست نمی‌ماند: کاردار موقت گمارده می‌شود، ولی بازیکن می‌تواند عوضش کند
      autoFillCouncil(S, n);
      news(S, '🏛️', 'کرسی‌ای در شورا خالی شد؛ کاردار موقت گمارده شد. می‌توانید خودتان کس دیگری بگمارید.');
      alertP(S, '🏛️', 'کرسی شورا خالی شد — کاردار موقت گمارده شد.');
    }

    // --- فساد ---
    const cm = councilMods(S, n);
    const size = S.map.provs.filter(p => p.owner === n.id).length;
    let drift = 0.05 + size * 0.004 + (n.taxLvl || 2) * 0.03;
    drift -= (cm._corruptRes || 0) * 0.010;                 // شورای درست‌کار جلوی فساد را می‌گیرد
    const honesty = SEAT_KEYS.map(k => n.council[k]?.honesty).filter(x => x != null);
    if (honesty.length) drift -= (honesty.reduce((a, b) => a + b, 0) / honesty.length - 50) * 0.004;
    n.corruption = clamp(n.corruption + drift, 0, 100);

    // فساد پول می‌بلعد
    if (n.corruption > 12 && S.week % 12 === 0) {
      const steal = Math.round(n.treasury * n.corruption * 0.00035);
      if (steal > 0) n.treasury -= steal;
    }

    // --- دسیسه ---
    stepIntrigue(S, n);
    // --- رقابت وارثان ---
    stepHeirRivalry(S, n);
  }
}

// دسیسه: بلندپایگان حیله‌گرِ دل‌آزرده توطئه می‌چینند
function stepIntrigue(S, n) {
  const ruler = rulerOf(S, n.id);
  if (!ruler) return;
  const heir = heirOf(S, n.id);
  const plotters = [];
  for (const f of n.dyn?.factions || []) {
    const head = royalById(S, f.headId);
    if (!head?.alive) continue;
    // انگیزه: کینه + حیله + بی‌کرسی‌بودن − وفاداری
    const seated = SEAT_KEYS.some(k => n.council?.[k]?.rid === head.id);
    let m = (f.grudge || 0) * 0.5 + (head.stat?.guile || 9) * 1.4 - f.loyalty * 0.5 + (head.slighted || 0) * 6;
    if (!seated) m += 8;
    if (m > 0) plotters.push({ head, f, m });
  }
  if (!plotters.length) { n.plot = n.plot || null; return; }

  if (!n.plot) {
    const best = plotters.sort((a, b) => b.m - a.m)[0];
    // توطئه‌ها کمیاب‌اند: فقط وقتی انگیزه واقعاً بالاست
    const chance = 0.0075 * Math.pow(best.m / 55, 2);  // مقیاس درجه‌دو: ستم واقعاً توطئه می‌سازد
    if (best.m > 55 && Math.random() < chance) {
      n.plot = {
        headId: best.head.id, facKey: best.f.key,
        target: (heir && Math.random() < 0.3) ? 'heir' : 'ruler',
        prog: 0, known: false, started: S.week,
      };
    }
    return;
  }

  // پیشرفت توطئه
  const pl = n.plot;
  const head = royalById(S, pl.headId);
  if (!head?.alive) { n.plot = null; return; }
  const f = (n.dyn?.factions || []).find(x => x.key === pl.facKey);
  pl.prog += 1.4 + (head.stat?.guile || 9) * 0.16 + ((f?.grudge || 0) * 0.035);

  // کشف توطئه: بستگی به حیله‌ی فرمانروا و ضدجاسوسی
  if (!pl.known) {
    const detect = 0.030 + (ruler.stat?.guile || 9) * 0.008 + (n.counterInt || 0) * 0.004;
    if (Math.random() < detect) {
      pl.known = true;
      news(S, '🕯️', `توطئه‌ای پنهان کشف شد: ${head.name} در سایه دسیسه می‌چیند.`);
      if (n.id === S.playerId) alertP(S, '🕯️', 'توطئه‌ای در دربار کشف شد!');
    }
  }

  // اجرا
  if (pl.prog >= 100) {
    const victim = pl.target === 'heir' ? heirOf(S, n.id) : ruler;
    n.plot = null;
    if (!victim) return;
    const guard = 0.55 + (ruler.stat?.guile || 9) * 0.022 + (pl.known ? 0.32 : 0);
    if (Math.random() < guard) {
      // ناکام
      if (f) { f.grudge = clamp((f.grudge || 0) + 10, 0, 100); f.loyalty = clamp(f.loyalty - 12, 0, 100); }
      news(S, '🛡️', `سوءقصد به ${victim.name} ناکام ماند؛ دست ${head.name} رو شد.`);
      if (n.id === S.playerId) alertP(S, '🛡️', 'سوءقصد ناکام ماند!');
    } else {
      victim.health = 0;
      news(S, '🗡️', `${victim.name} در دسیسه‌ای درباری از پای درآمد.`);
      if (n.id === S.playerId) alertP(S, '🗡️', `${victim.name} ترور شد!`);
      n.legitimacy = clamp((n.legitimacy ?? 60) - 8, 0, 100);
    }
  }
}

// رقابت وارثان: فرزندان پشتیبان جمع می‌کنند
function stepHeirRivalry(S, n) {
  const ruler = rulerOf(S, n.id);
  if (!ruler) return;
  const kids = childrenOf(S, ruler).filter(c => c.alive && c.age >= 14);
  if (kids.length < 2) return;
  const heir = heirOf(S, n.id);
  for (const c of kids) {
    if (c.support == null) c.support = 20 + Math.random() * 20;
    let d = ((c.stat?.diplo || 9) - 9) * 0.05 + ((c.stat?.martial || 9) - 9) * 0.02;
    if (heir && c.id === heir.id) d += 0.10;                  // وارث رسمی طبیعتاً پشتیبان دارد
    if (c.slighted) d += c.slighted * 0.03;                   // دل‌آزرده هوادار جمع می‌کند
    const seated = SEAT_KEYS.some(k => n.council?.[k]?.rid === c.id);
    if (seated) d += 0.08;
    c.support = clamp(c.support + d, 0, 100);
  }
  // اگر برادرِ رقیب خیلی قوی‌تر از وارث شد، خطر جنگ جانشینی
  if (heir) {
    const rival = kids.filter(c => c.id !== heir.id).sort((a, b) => b.support - a.support)[0];
    if (rival && rival.support > heir.support + 32) n.heirRisk = true;
    else n.heirRisk = false;
  }
}

// تربیت وارث (اکشن بازیکن)
export function educateHeir(S, n, track) {
  const h = heirOf(S, n.id);
  if (!h) return { ok: false, why: 'وارثی در کار نیست' };
  if (h.age > 22) return { ok: false, why: `${h.name} از سن آموزش گذشته است` };
  const cost = 2200;
  if (n.treasury < cost) return { ok: false, why: 'خزانه کافی نیست' };
  if ((n.eduCd || 0) > S.week) return { ok: false, why: 'به‌تازگی استادی گماشته‌اید' };
  n.treasury -= cost;
  n.eduCd = S.week + 60;
  h.stat[track] = clamp((h.stat[track] || 9) + 1 + (Math.random() < 0.3 ? 1 : 0), 1, 20);
  h.education = track;
  news(S, '📚', `${h.name} زیر دست استادان تازه، در «${track}» ورزیده‌تر شد.`);
  return { ok: true };
}

// مبارزه با فساد (اکشن بازیکن)
export function purgeCorruption(S, n, mode) {
  if (mode === 'audit') {
    const cost = 3000;
    if (n.treasury < cost) return { ok: false, why: 'خزانه کافی نیست' };
    n.treasury -= cost;
    n.corruption = clamp(n.corruption - 10 - Math.random() * 6, 0, 100);
    return { ok: true, msg: 'بازرسان به دیوان‌ها فرستاده شدند.' };
  }
  if (mode === 'purge') {
    n.corruption = clamp(n.corruption - 22 - Math.random() * 10, 0, 100);
    for (const f of n.dyn?.factions || []) { f.grudge = clamp((f.grudge || 0) + 12, 0, 100); f.loyalty = clamp(f.loyalty - 9, 0, 100); }
    for (const p of S.map.provs) if (p.owner === n.id) p.unrest = clamp((p.unrest || 0) + 5, 0, 100);
    return { ok: true, msg: 'پاکسازی بزرگ آغاز شد؛ اشراف خشمگین‌اند.' };
  }
  return { ok: false };
}
