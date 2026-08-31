// ---------- جاسوسی، توطئه و عملیات پنهان ----------
// سازمان اطلاعات هر ملت «شبکه» می‌سازد، عملیات اجرا می‌کند و در برابر
// جاسوسان بیگانه دفاع می‌کند. هر عملیات هزینه، خطر و پاداش دارد.

import { clamp, pick } from './utils.js';
import { cabinetMods, charById, charsOf, killChar } from './characters.js';

// ---------------- عملیات‌ها ----------------
// risk = شانس پایه‌ی لو رفتن | net = شبکه‌ی لازم | cost = هزینه‌ی خزانه
export const OPS = {
  build_net: {
    name: 'گسترش شبکه', icon: '🕸️', cost: 260, weeks: 6, net: 0, risk: 0.10,
    desc: 'مأموران تازه می‌فرستید تا شبکه‌ی نفوذتان در آن کشور ریشه بدواند.',
    hint: 'پایه‌ی همه‌ی عملیات‌هاست؛ بدون شبکه کاری از پیش نمی‌رود.',
  },
  gather: {
    name: 'گردآوری اطلاعات', icon: '🔎', cost: 180, weeks: 4, net: 10, risk: 0.08,
    desc: 'خزانه، ارتش، فناوری و نیت‌های دشمن را از پرده بیرون می‌کشید.',
    hint: 'اطلاعات کامل کشور هدف تا مدتی برایتان باز می‌شود.',
  },
  steal_tech: {
    name: 'سرقت فناوری', icon: '📐', cost: 700, weeks: 10, net: 30, risk: 0.30,
    desc: 'نقشه‌های صنعتی و نظامی را از کارگاه‌های دشمن می‌دزدید.',
    hint: 'یک فناوری که دشمن دارد و شما ندارید، امتیاز پژوهشی کلانی می‌دهد.',
  },
  sabotage: {
    name: 'خرابکاری صنعتی', icon: '💣', cost: 850, weeks: 8, net: 35, risk: 0.34,
    desc: 'انبار و ماشین‌آلات یک استان صنعتی را به آتش می‌کشید.',
    hint: 'یک سطح ساختمان نابود و استان ویران می‌شود.',
  },
  incite: {
    name: 'تحریک شورش', icon: '🔥', cost: 900, weeks: 12, net: 45, risk: 0.38,
    desc: 'به نارضایتی‌ها دامن می‌زنید تا استانی سر به شورش بردارد.',
    hint: 'ناآرامی استان هدف به‌شدت بالا می‌رود؛ شاید شورش شود.',
  },
  fund_opp: {
    name: 'تأمین مالی اپوزیسیون', icon: '🗳️', cost: 650, weeks: 10, net: 30, risk: 0.24,
    desc: 'به مخالفان دولت پول می‌رسانید تا مشروعیت تاجش بلرزد.',
    hint: 'مشروعیت و ثبات کشور هدف افت می‌کند.',
  },
  bribe: {
    name: 'خریدن یک وزیر', icon: '🪙', cost: 1200, weeks: 8, net: 40, risk: 0.28,
    desc: 'یکی از وزیران دشمن را با زر می‌خرید تا کارها را خراب کند.',
    hint: 'وفاداری یک وزیر دشمن فرو می‌ریزد و کارایی‌اش نابود می‌شود.',
  },
  assassinate: {
    name: 'ترور', icon: '🗡️', cost: 1800, weeks: 14, net: 60, risk: 0.52,
    desc: 'یکی از ژنرال‌ها یا وزیران دشمن را از میان برمی‌دارید. کاری خطرناک و ننگ‌آور.',
    hint: 'اگر لو بروید، آبروی جهانی‌تان می‌رود و شاید جنگ درگیرد.',
  },
  coup: {
    name: 'کودتا', icon: '👑', cost: 3500, weeks: 20, net: 85, risk: 0.60,
    desc: 'با ژنرال‌های ناراضی دست می‌دهید تا حکومت را واژگون کنند.',
    hint: 'کشور هدف در آشوب فرو می‌رود: شورش گسترده، سقوط مشروعیت و تغییر قانون.',
  },
  counter: {
    name: 'ضدجاسوسی', icon: '🛡️', cost: 400, weeks: 6, net: 0, risk: 0.02, self: 1,
    desc: 'مأموران خودی را به شکار جاسوسان بیگانه می‌فرستید.',
    hint: 'شبکه‌ی دشمنان در کشور شما پاک‌سازی می‌شود.',
  },
};
export const OP_KEYS = Object.keys(OPS);

// ---------------- توان جاسوسی ----------------
export function spyPower(S, n) {
  const cm = cabinetMods(S, n);
  const uni = S.map.provs.reduce((a, p) => a + (p.owner === n.id ? (p.bld.university || 0) : 0), 0);
  return 1 + (cm.spy || 0) + uni * 0.05 + (n.literacy || 12) / 140 + (n.tech.includes('journalism') ? 0.2 : 0);
}
export function counterPower(S, n) {
  const cm = cabinetMods(S, n);
  return 1 + (cm.counter || 0) + (n.laws.gov === 'absolut' ? 0.35 : 0) + (n.tech.includes('journalism') ? 0.15 : 0)
    + ((n.counterBoost || 0) > 0 ? 0.6 : 0);
}

export function networkIn(S, n, targetId) {
  n.spyNet = n.spyNet || {};
  return n.spyNet[targetId] || 0;
}

// ---------------- شروع عملیات ----------------
export function startOp(S, n, opKey, targetId, provId) {
  const op = OPS[opKey];
  if (!op) return { ok: false, why: 'عملیات نامعتبر' };
  n.ops = n.ops || [];
  if (n.ops.length >= 3) return { ok: false, why: 'بیش از ۳ عملیات هم‌زمان ممکن نیست' };
  if (n.ops.some(o => o.key === opKey && o.target === targetId)) return { ok: false, why: 'این عملیات همین حالا در جریان است' };
  const target = S.nations[targetId];
  if (!op.self) {
    if (!target || !target.alive) return { ok: false, why: 'هدف نامعتبر' };
    if (targetId === n.id) return { ok: false, why: 'نمی‌توانید علیه خود عملیات کنید' };
    const net = networkIn(S, n, targetId);
    if (net < op.net) return { ok: false, why: `شبکه‌ی کافی ندارید (${Math.round(net)}/${op.net}٪)` };
  }
  const cost = Math.round(op.cost * (S.diffMods?.upkeep || 1));
  if (n.treasury < cost) return { ok: false, why: `خزانه کافی نیست (£${cost})` };
  n.treasury -= cost;
  n.ops.push({
    id: (S.nextOpId = (S.nextOpId || 1) + 1),
    key: opKey, target: op.self ? n.id : targetId, prov: provId ?? null,
    prog: 0, weeks: op.weeks, started: S.week,
  });
  return { ok: true, cost };
}
export function abortOp(S, n, opId) {
  const i = (n.ops || []).findIndex(o => o.id === opId);
  if (i < 0) return { ok: false };
  const o = n.ops[i];
  n.treasury += Math.round(OPS[o.key].cost * 0.35);
  n.ops.splice(i, 1);
  return { ok: true };
}

// ---------------- گام هفتگی ----------------
export function simEspionage(S) {
  for (const n of S.nations) {
    if (!n.alive) continue;
    n.spyNet = n.spyNet || {};
    n.ops = n.ops || [];
    n.intel = n.intel || {};
    if (n.counterBoost > 0) n.counterBoost--;

    // فرسایش طبیعی شبکه‌ها (ضدجاسوسی دشمن)
    if (S.week % 4 === 0) {
      for (const tid in n.spyNet) {
        const t = S.nations[tid];
        if (!t || !t.alive) { delete n.spyNet[tid]; continue; }
        const decay = 0.4 + counterPower(S, t) * 0.35;
        n.spyNet[tid] = clamp(n.spyNet[tid] - decay, 0, 100);
        if (n.spyNet[tid] <= 0.2) delete n.spyNet[tid];
      }
    }
    // انقضای اطلاعات
    for (const tid in n.intel) if (S.week - n.intel[tid] > 52) delete n.intel[tid];

    // پیشرفت عملیات
    for (let i = n.ops.length - 1; i >= 0; i--) {
      const o = n.ops[i];
      const op = OPS[o.key];
      o.prog += spyPower(S, n) * 0.85;
      if (o.prog >= o.weeks) {
        n.ops.splice(i, 1);
        resolveOp(S, n, o);
      }
    }
  }
}

function resolveOp(S, n, o) {
  const op = OPS[o.key];
  const target = S.nations[o.target];
  const sp = spyPower(S, n);
  const cp = o.key === 'counter' ? 1 : counterPower(S, target);

  // شانس موفقیت و لو رفتن
  const success = Math.random() < clamp(0.42 + sp * 0.16 - cp * 0.13 + networkIn(S, n, o.target) / 260, 0.12, 0.94);
  const caught = Math.random() < clamp(op.risk * (1 + cp * 0.30) * (success ? 0.65 : 1.35) * (S.diffMods?.aiAggr || 1) * 0.7, 0.02, 0.85);

  const say = (icon, txt) => {
    S.log.push({ w: S.week, icon, text: txt });
    if (n.player) { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon, text: txt, w: S.week }); }
  };

  if (o.key === 'counter') {
    // پاک‌سازی شبکه‌های بیگانه در خاک خودی
    let cleaned = 0;
    for (const m of S.nations) {
      if (m.id === n.id || !m.spyNet) continue;
      if (m.spyNet[n.id] > 0) { cleaned += Math.min(m.spyNet[n.id], 30 + sp * 8); m.spyNet[n.id] = clamp(m.spyNet[n.id] - (30 + sp * 8), 0, 100); }
    }
    n.counterBoost = 20;
    say('🛡️', cleaned > 1
      ? `ضدجاسوسی: ${Math.round(cleaned)} واحد از شبکه‌های بیگانه در خاک ${n.name} برچیده شد.`
      : `ضدجاسوسی: خاک ${n.name} پاک است؛ مأموران هوشیارتر شدند.`);
    return;
  }

  if (!success) {
    say('🚫', `عملیات «${op.name}» علیه ${target.name} شکست خورد.`);
    n.spyNet[o.target] = clamp((n.spyNet[o.target] || 0) - 12, 0, 100);
  } else {
    applyOpEffect(S, n, target, o, say);
  }

  if (caught) {
    // رسوایی: رابطه خراب، اعتبار می‌رود، هدف خشمگین می‌شود
    const sev = op.risk > 0.4 ? 3 : op.risk > 0.25 ? 2 : 1;
    n.rel[target.id] = clamp((n.rel[target.id] || 0) - 14 * sev, -100, 100);
    target.rel[n.id] = clamp((target.rel[n.id] || 0) - 18 * sev, -100, 100);
    n.prestige = Math.max(0, n.prestige - 2 * sev);
    n.spyNet[o.target] = clamp((n.spyNet[o.target] || 0) - 22, 0, 100);
    target.grudge = target.grudge || {};
    target.grudge[n.id] = (target.grudge[n.id] || 0) + sev * 12;
    say('📰', `رسوایی! دست ${n.name} در «${op.name}» علیه ${target.name} رو شد؛ آبرو و روابط آسیب دید.`);
    if (target.player) {
      S.pendingAlerts = S.pendingAlerts || [];
      S.pendingAlerts.push({ icon: '🕵️', text: `جاسوسان ${n.name} در کشور شما دستگیر شدند! (${op.name})`, w: S.week });
    }
  }
}

function applyOpEffect(S, n, target, o, say) {
  const op = OPS[o.key];
  switch (o.key) {
    case 'build_net': {
      const gain = 18 + spyPower(S, n) * 7;
      n.spyNet[target.id] = clamp((n.spyNet[target.id] || 0) + gain, 0, 100);
      say('🕸️', `شبکه‌ی نفوذ در ${target.name} به ${Math.round(n.spyNet[target.id])}٪ رسید.`);
      break;
    }
    case 'gather': {
      n.intel[target.id] = S.week;
      n.spyNet[target.id] = clamp((n.spyNet[target.id] || 0) + 6, 0, 100);
      say('🔎', `گزارش کامل ${target.name} روی میز شماست: خزانه، ارتش، فناوری و نیت‌هایش.`);
      break;
    }
    case 'steal_tech': {
      const have = new Set(n.tech);
      const stealable = target.tech.filter(t => !have.has(t));
      if (!stealable.length) { say('📐', `${target.name} فناوری تازه‌ای برای دزدیدن ندارد؛ اما نقشه‌ها بی‌ارزش نبودند.`); n.res.pts += 90; break; }
      const t = pick(Math.random, stealable);
      n.res.pts += 260;
      if (n.res.key === t || !n.res.key) { n.res.key = t; }
      say('📐', `نقشه‌های «${t}» از ${target.name} به سرقت رفت — پژوهش شما جهش کرد.`);
      break;
    }
    case 'sabotage': {
      const cands = S.map.provs.filter(p => p.owner === target.id &&
        ['textile', 'tool_work', 'arms_ind', 'steel_mill', 'glasswork', 'furniture', 'railway', 'power'].some(k => (p.bld[k] || 0) > 0));
      if (!cands.length) { say('💣', `صنعتی برای خرابکاری در ${target.name} یافت نشد.`); break; }
      const p = pick(Math.random, cands);
      const keys = ['steel_mill', 'arms_ind', 'tool_work', 'textile', 'glasswork', 'furniture', 'railway', 'power'].filter(k => (p.bld[k] || 0) > 0);
      const k = keys[0];
      p.bld[k]--;
      p.devast = Math.min(10, (p.devast || 0) + 3);
      p.unrest = clamp(p.unrest + 8, 0, 100);
      S.fx.push({ type: 'boom', x: p.cx, y: p.cy, t: 1, life: 1 });
      say('💣', `انفجار در ${p.name} (${target.name}) — یک سطح صنعتی از میان رفت.`);
      break;
    }
    case 'incite': {
      const cands = S.map.provs.filter(p => p.owner === target.id && p.controller === target.id);
      if (!cands.length) break;
      cands.sort((a, b) => b.unrest - a.unrest);
      const p = cands[0];
      p.unrest = clamp(p.unrest + 34, 0, 100);
      say('🔥', `آتش نارضایتی در ${p.name} (${target.name}) شعله‌ور شد — ناآرامی به ${Math.round(p.unrest)}٪ رسید.`);
      break;
    }
    case 'fund_opp': {
      target.legitimacy = clamp((target.legitimacy ?? 60) - 16, 0, 100);
      target.stability = clamp((target.stability ?? 50) - 12, 0, 100);
      for (const g in target.groups) target.groups[g].apprBonus = (target.groups[g].apprBonus || 0) - 2;
      say('🗳️', `مخالفان ${target.name} با پول شما جان گرفتند؛ مشروعیت تاجش لرزید.`);
      break;
    }
    case 'bribe': {
      const mins = charsOf(S, target.id, 'minister').filter(c => c.post);
      if (!mins.length) { say('🪙', `${target.name} وزیر قابل خریدی ندارد.`); break; }
      const c = pick(Math.random, mins);
      c.loyalty = clamp(c.loyalty - 55, 0, 100);
      c.bribedBy = n.id;
      c.hist.push({ w: S.week, t: `از ${n.name} زر گرفت` });
      say('🪙', `${c.name}، ${roleWord(c)}ِ ${target.name}، خریداری شد و از این پس برای ما خبر می‌آورد.`);
      break;
    }
    case 'assassinate': {
      const pool = [...charsOf(S, target.id, 'general'), ...charsOf(S, target.id, 'minister').filter(c => c.post)];
      if (!pool.length) { say('🗡️', `هدف شایسته‌ای در ${target.name} نبود.`); break; }
      pool.sort((a, b) => (b.skill + b.lvl * 2) - (a.skill + a.lvl * 2));
      const c = pool[0];
      killChar(S, c, `ترور به دست عوامل ${n.name}`);
      target.stability = clamp((target.stability ?? 50) - 10, 0, 100);
      say('🗡️', `${c.name} از ${target.name} ترور شد.`);
      break;
    }
    case 'coup': {
      target.legitimacy = clamp((target.legitimacy ?? 60) - 35, 0, 100);
      target.stability = clamp((target.stability ?? 50) - 40, 0, 100);
      const own = S.map.provs.filter(p => p.owner === target.id && p.controller === target.id);
      let n2 = 0;
      for (const p of own) {
        p.unrest = clamp(p.unrest + 30, 0, 100);
        if (n2 < 2 && p.unrest > 70) {
          p.controller = -2; p.occ = 0; n2++;
          S.armies.push({ id: S.nextArmyId++, n: -2, home: p.id, prov: p.id, size: 4, org: 72, mor: 78, path: [], status: 'idle', rebel: true, prog: 0, sackCd: 8 });
        }
      }
      // دولت نظامی سر کار می‌آید
      target.laws.gov = 'absolut';
      for (const g in target.groups) target.groups[g].apprBonus = (target.groups[g].apprBonus || 0) - 5;
      say('👑', `کودتا در ${target.name}! حکومت واژگون شد و کشور در آشوب فرو رفت.`);
      break;
    }
  }
  // هر عملیات موفق کمی شبکه می‌سوزاند
  if (o.key !== 'build_net' && o.key !== 'gather') n.spyNet[target.id] = clamp((n.spyNet[target.id] || 0) - 8, 0, 100);
}
function roleWord(c) { return c.post ? 'وزیر' : c.kind === 'general' ? 'ژنرال' : c.kind === 'admiral' ? 'دریاسالار' : 'کارگزار'; }

// ---------------- AI جاسوسی ----------------
export function aiEspionage(S, n) {
  n.ops = n.ops || [];
  n.spyNet = n.spyNet || {};
  if (n.ops.length >= 2) return;
  if (n.treasury < 1400) return;
  const aggr = (S.diffMods?.aiAggr || 1);
  if (Math.random() > 0.13 * aggr) return;

  // هدف: رقیب قدرتمند یا کسی که رابطه‌اش بد است
  const rivals = S.nations.filter(m => m.alive && m.id !== n.id && m.playable !== false);
  if (!rivals.length) return;
  rivals.sort((a, b) => (b.prestige - (n.rel[b.id] || 0) * 0.5) - (a.prestige - (n.rel[a.id] || 0) * 0.5));
  const t = rivals[Math.floor(Math.random() * Math.min(3, rivals.length))];
  const net = networkIn(S, n, t.id);

  let key = 'build_net';
  if (net < 35) key = 'build_net';
  else if (net >= 60 && n.pers === 'aggressive' && Math.random() < 0.35 * aggr) key = pick(Math.random, ['incite', 'sabotage', 'assassinate']);
  else if (net >= 35) key = pick(Math.random, ['gather', 'steal_tech', 'sabotage', 'fund_opp']);
  // ملت‌های صلح‌طلب فقط اطلاعات جمع می‌کنند
  if (n.pers === 'peaceful' && ['assassinate', 'coup', 'incite', 'sabotage'].includes(key)) key = 'gather';
  startOp(S, n, key, t.id, null);

  // گاهی ضدجاسوسی
  if (Math.random() < 0.10 && n.ops.length < 3) startOp(S, n, 'counter', n.id, null);
}

export function initEspionage(S) {
  S.nextOpId = 1;
  for (const n of S.nations) {
    n.spyNet = {};
    n.ops = [];
    n.intel = {};
    n.grudge = {};
    n.counterBoost = 0;
  }
}
