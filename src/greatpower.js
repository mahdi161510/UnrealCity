// ---------- قدرت‌های بزرگ، حوزه‌ی نفوذ، دست‌نشاندگی و بحران‌های بین‌المللی ----------
// به‌جای «اعلان جنگ ناگهانی»، اکنون تنش بر سر یک استان انباشته می‌شود، به بحران می‌رسد،
// طرفین متحد جذب می‌کنند و در پایان یا کسی عقب می‌نشیند یا جنگ درمی‌گیرد.

import { clamp, pick } from './utils.js';
import { royalNews, marriageKin } from './dynasty.js';

export const GP_COUNT = 8;                 // شمار قدرت‌های بزرگ

// ================== رتبه‌ی قدرت ==================
export function powerScore(S, n) {
  if (!n.alive) return 0;
  const provs = S.map.provs.filter(p => p.owner === n.id).length;
  const gdp = n.gdp || 0;
  const army = n.battalions || 0;
  const navy = (S.fleets || []).filter(f => f.n === n.id).reduce((a, f) => {
    let t = 0; for (const k in f.ships) t += f.ships[k]; return a + t;
  }, 0);
  return gdp * 0.05 + provs * 6 + army * 2.2 + navy * 1.6 + (n.prestige || 0) * 1.4;
}

export function refreshGreatPowers(S) {
  const ranked = S.nations.filter(n => n.alive).map(n => ({ n, s: powerScore(S, n) })).sort((a, b) => b.s - a.s);
  ranked.forEach((r, i) => {
    const wasGP = r.n.greatPower;
    r.n.gpRank = i + 1;
    r.n.greatPower = i < GP_COUNT;
    r.n.powerScore = Math.round(r.s);
    if (!wasGP && r.n.greatPower && S.week > 26) {
      addNews(S, r.n.id, '🌟', `${r.n.name} به جرگه‌ی قدرت‌های بزرگ جهان پیوست.`);
      r.n.prestige = (r.n.prestige || 0) + 5;
    } else if (wasGP && !r.n.greatPower && S.week > 26) {
      addNews(S, r.n.id, '📉', `${r.n.name} جایگاه خود را در میان قدرت‌های بزرگ از دست داد.`);
    }
  });
  for (const n of S.nations) if (!n.alive) { n.greatPower = false; n.gpRank = 99; }
}

function addNews(S, nid, icon, text) { royalNews(S, nid, icon, text); }

// ================== حوزه‌ی نفوذ ==================
// یک قدرت بزرگ می‌تواند کشور کوچک را به حوزه‌ی خود بکشد: تجارت ارزان، اما استقلال کمتر.
export function sphereLord(S, nid) {
  const n = S.nations[nid];
  return n?.sphere != null ? S.nations[n.sphere] : null;
}
export function sphereOf(S, lordId) {
  return S.nations.filter(n => n.alive && n.sphere === lordId);
}

export function canSphere(S, lord, target) {
  if (!lord.greatPower) return { ok: false, why: 'تنها قدرت‌های بزرگ حوزه‌ی نفوذ دارند' };
  if (target.greatPower) return { ok: false, why: 'قدرت بزرگ را نمی‌توان به حوزه کشید' };
  if (target.sphere === lord.id) return { ok: false, why: 'از پیش در حوزه‌ی شماست' };
  if (target.id === lord.id) return { ok: false, why: '—' };
  if ((lord.rel[target.id] || 0) < 25) return { ok: false, why: 'روابط باید دست‌کم +۲۵ باشد' };
  if (S.wars.some(w => (w.a === lord.id && w.d === target.id) || (w.d === lord.id && w.a === target.id))) return { ok: false, why: 'در حال جنگ' };
  const cost = 2600;
  if (lord.treasury < cost) return { ok: false, why: `خزانه کافی نیست (${cost})` };
  return { ok: true, cost };
}

export function addToSphere(S, lord, target) {
  const chk = canSphere(S, lord, target);
  if (!chk.ok) return chk;
  lord.treasury -= chk.cost;
  const prev = target.sphere;
  target.sphere = lord.id;
  target.sphereSince = S.week;
  lord.rel[target.id] = clamp((lord.rel[target.id] || 0) + 8, -100, 100);
  if (prev != null && S.nations[prev]) {
    const old = S.nations[prev];
    old.rel[lord.id] = clamp((old.rel[lord.id] || 0) - 28, -100, 100);
    lord.rel[old.id] = clamp((lord.rel[old.id] || 0) - 12, -100, 100);
    addNews(S, lord.id, '🎭', `${target.name} از حوزه‌ی ${old.name} بیرون آمد و به حوزه‌ی ${lord.name} پیوست. ${old.name} خشمگین است.`);
  } else {
    addNews(S, lord.id, '🤝', `${target.name} به حوزه‌ی نفوذ ${lord.name} پیوست.`);
  }
  return { ok: true };
}

export function leaveSphere(S, target) {
  const lord = sphereLord(S, target.id);
  if (!lord) return { ok: false, why: 'در حوزه‌ی کسی نیستید' };
  target.sphere = null;
  lord.rel[target.id] = clamp((lord.rel[target.id] || 0) - 30, -100, 100);
  target.rel[lord.id] = clamp((target.rel[lord.id] || 0) - 15, -100, 100);
  addNews(S, target.id, '⛓️', `${target.name} از حوزه‌ی نفوذ ${lord.name} بیرون آمد.`);
  return { ok: true };
}

/** سود ارباب از حوزه: کمی درآمد و اعتبار. */
export function sphereMods(S, nid) {
  const subs = sphereOf(S, nid);
  if (!subs.length) return {};
  return { tradeCap: subs.length * 0.05, taxIncome: subs.length * 0.025, prestigeFlat: subs.length * 1.2 };
}

// ================== ادعای ارضی ==================
// ادعا به جنگ مشروعیت می‌دهد: هزینه‌ی اعتبار و ثبات کمتر، امتیاز جنگ بیشتر.
export function claimStrength(S, nid, targetId) {
  const n = S.nations[nid];
  let c = n.dyn?.claims?.[targetId] || 0;
  // ادعای فرهنگی: استان‌های هم‌فرهنگ در دست دیگری
  const mine = S.map.provs.filter(p => p.owner === targetId && p.culture === n.culture).length;
  c += mine * 8;
  return clamp(c, 0, 100);
}

export function fabricateClaim(S, n, targetId) {
  const cost = 1800;
  if (n.treasury < cost) return { ok: false, why: `خزانه کافی نیست (${cost})` };
  if (!n.dyn) return { ok: false, why: 'سلسله ندارید' };
  n.treasury -= cost;
  n.dyn.claims = n.dyn.claims || {};
  n.dyn.claims[targetId] = Math.min(100, (n.dyn.claims[targetId] || 0) + 30);
  const t = S.nations[targetId];
  t.rel[n.id] = clamp((t.rel[n.id] || 0) - 14, -100, 100);
  // احتمال لو رفتن
  if (Math.random() < 0.4) {
    addNews(S, n.id, '📜', `دیوان‌سالاران ${n.name} سندی کهن یافتند که ${t.name} را از آنِ تاج می‌داند. ${t.name} آن را جعل خواند.`);
    t.rel[n.id] = clamp((t.rel[n.id] || 0) - 10, -100, 100);
  }
  return { ok: true };
}

// ================== بحران‌های بین‌المللی ==================
// چرخه: تنش ⇒ بحران ⇒ جذب متحد ⇒ (عقب‌نشینی | جنگ)
export function initCrises(S) { S.crises = []; S.nextCrisisId = 1; }

const CRISIS_WEEKS = 16;   // مهلت پیش از انفجار

function findFlashpoint(S, a, d) {
  // استانی از d که a رویش ادعا دارد و هم‌مرز است
  const cands = S.map.provs.filter(p => p.owner === d.id &&
    p.adj.some(q => S.map.provs[q]?.owner === a.id));
  if (!cands.length) return null;
  const scored = cands.map(p => ({
    p, s: (p.culture === a.culture ? 30 : 0) + (p.rare ? 12 : 0) + (p.landmark ? 8 : 0) + Math.random() * 10,
  })).sort((x, y) => y.s - x.s);
  return scored[0].p;
}

export function startCrisis(S, aId, dId, provId) {
  const a = S.nations[aId], d = S.nations[dId];
  if (!a?.alive || !d?.alive) return null;
  if (S.crises.some(c => c.active && ((c.a === aId && c.d === dId) || (c.a === dId && c.d === aId)))) return null;
  const p = provId != null ? S.map.provs[provId] : findFlashpoint(S, a, d);
  if (!p) return null;
  const c = {
    id: S.nextCrisisId++, a: aId, d: dId, prov: p.id,
    week: S.week, deadline: S.week + CRISIS_WEEKS,
    backA: [aId], backD: [dId],          // پشتیبانان
    tension: 30, active: true, resolved: null,
  };
  S.crises.push(c);
  addNews(S, aId, '🔥', `بحران بین‌المللی! ${a.name} خواستار واگذاری ${p.name} از ${d.name} شد.`);
  if (aId === S.playerId || dId === S.playerId) queueCrisisEvent(S, c);
  return c;
}

function queueCrisisEvent(S, c) {
  if (S.pendingEvent) return;
  const a = S.nations[c.a], d = S.nations[c.d], p = S.map.provs[c.prov];
  const iAmA = c.a === S.playerId;
  const foe = iAmA ? d : a;
  S.pendingEvent = {
    id: 'crisis_' + c.id, icon: '🔥', title: 'بحران بین‌المللی',
    text: iAmA
      ? `دیوان شما بر ${p.name} ادعا کرده و ${d.name} آن را رد کرده است. سفیران قدرت‌های بزرگ در رفت‌وآمدند و هر دو سو در پی جذب متحدند. ${Math.round((c.deadline - S.week))} هفته تا لبه‌ی پرتگاه مانده است.`
      : `${a.name} خواستار واگذاری ${p.name} شده است — استانی از آنِ شما. اروپا نفس در سینه حبس کرده. تسلیم شوید و آبرو ببازید، یا بایستید و خطر جنگ را بپذیرید.`,
    t2: iAmA
      ? `سر ${p.name} با ${d.name} کارمون به بحران کشیده. چند هفته وقت داری متحد جمع کنی یا کوتاه بیای.`
      : `${a.name} داره ${p.name} رو ازت می‌خواد. یا بدیش یا آماده‌ی جنگ شو.`,
    opts: [
      { label: 'می‌ایستم — بگذار بترسند', hint: 'تنش +۲۵؛ اگر پشتیبان بیشتری داشته باشید، پیروز میدان دیپلماسی‌اید', fx: { crisisStand: c.id } },
      { label: 'پشتیبان جذب می‌کنم', hint: 'خزانه −۲۵۰۰، یک قدرت بزرگ به سویتان می‌آید', fx: { crisisBack: c.id } },
      { label: 'عقب می‌نشینم', hint: 'اعتبار −۶، اما جنگ نمی‌شود', fx: { crisisBackDown: c.id } },
    ],
  };
}

export function crisisAddBacker(S, c, nid) {
  const side = Math.random() < 0.5 ? 'backA' : 'backD';
  if (!c[side].includes(nid)) c[side].push(nid);
}

export function simCrises(S) {
  if (!S.crises) return;
  for (const c of S.crises) {
    if (!c.active) continue;
    const a = S.nations[c.a], d = S.nations[c.d];
    if (!a?.alive || !d?.alive) { c.active = false; c.resolved = 'منتفی'; continue; }

    // قدرت‌های بزرگ کم‌کم طرف می‌گیرند
    if (Math.random() < 0.09) {
      const free = S.nations.filter(n => n.alive && n.greatPower && !c.backA.includes(n.id) && !c.backD.includes(n.id));
      if (free.length) {
        const g = pick(Math.random, free);
        const towardA = (g.rel[c.a] || 0) + marriageKin(S, g.id, c.a) * 20;
        const towardD = (g.rel[c.d] || 0) + marriageKin(S, g.id, c.d) * 20;
        if (Math.abs(towardA - towardD) > 12) {
          (towardA > towardD ? c.backA : c.backD).push(g.id);
          addNews(S, g.id, '⚖️', `${g.name} در بحران ${S.map.provs[c.prov].name} از ${towardA > towardD ? a.name : d.name} پشتیبانی کرد.`);
        }
      }
    }
    c.tension = clamp(c.tension + 1.6, 0, 100);

    // ---- سررسید ----
    if (S.week >= c.deadline) {
      const sA = c.backA.reduce((s, id) => s + powerScore(S, S.nations[id]), 0);
      const sD = c.backD.reduce((s, id) => s + powerScore(S, S.nations[id]), 0);
      const ratio = sA / Math.max(1, sD);
      c.active = false;
      if (ratio > 1.55) {
        // مدعی برنده‌ی دیپلماسی: استان بدون جنگ واگذار می‌شود
        const p = S.map.provs[c.prov];
        p.owner = c.a; p.controller = c.a;
        a.prestige = (a.prestige || 0) + 8;
        d.prestige = Math.max(0, (d.prestige || 0) - 8);
        d.legitimacy = clamp((d.legitimacy ?? 60) - 8, 0, 100);
        c.resolved = 'واگذاری';
        addNews(S, c.a, '🕊️', `${d.name} زیر فشار جهانی، ${p.name} را بدون جنگ به ${a.name} واگذار کرد.`);
      } else if (ratio < 0.65) {
        // مدافع برنده: مدعی رسوا می‌شود
        a.prestige = Math.max(0, (a.prestige || 0) - 10);
        a.legitimacy = clamp((a.legitimacy ?? 60) - 6, 0, 100);
        c.resolved = 'عقب‌نشینی';
        addNews(S, c.d, '🛡️', `${a.name} در برابر ائتلافِ پشتیبانِ ${d.name} عقب نشست. آبرویش رفت.`);
      } else {
        // توازن: جنگ
        c.resolved = 'جنگ';
        c.warOut = true;
        addNews(S, c.a, '💥', `مذاکرات بر سر ${S.map.provs[c.prov].name} شکست خورد. جنگ آغاز شد!`);
      }
    }
  }
  S.crises = S.crises.filter(c => c.active || S.week - c.week < 60);
}

/** آیا AI باید به‌جای اعلان جنگ مستقیم، بحران راه بیندازد؟ */
export function maybeCrisis(S, a, d) {
  if (!a.greatPower && !d.greatPower) return false;
  if (S.crises.some(c => c.active && (c.a === a.id || c.d === a.id))) return false;
  if (Math.random() < 0.55) { return !!startCrisis(S, a.id, d.id, null); }
  return false;
}
