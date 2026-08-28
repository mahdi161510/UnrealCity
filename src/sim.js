// ---------- شبیه‌سازی هفتگی: اقتصاد، جمعیت، سیاست، جنگ، رویدادها، AI ----------
import { GOODS, BUILDINGS, NEEDS, POP_CLASSES, TECHS, LAWS, GROUPS, TAX_LEVELS, TERRAIN, EVENTS, NATION_DEFS, MISSIONS, ELECTION_EVENT } from './data.js';
import { clamp, lerp, mulberry32, pick } from './utils.js';
import { addLog } from './state.js';
import { findPath } from './mapgen.js';

const PS = 0.30;      // مقیاس قیمت↔پول
const WAGE = 9.0;     // دستمزد هفتگی به‌ازای هر ۱۰۰۰ نفر × ضریب طبقه
export const REBEL = -2;

const hashNoise = (seedA, w) => { const r = mulberry32((seedA * 2654435761 ^ w * 97) >>> 0); return r(); };

// ================= ابزارهای پرسشی برای UI =================
export function buildingCap(prov, key) { return Math.max(0, BUILDINGS[key].cap(prov)); }
export function canBuild(state, prov, key) {
  const bd = BUILDINGS[key];
  const n = state.nations[prov.owner];
  if (bd.unlock && !n.tech.includes(bd.unlock)) return { ok: false, why: 'نیازمند فناوری ' + TECHS[bd.unlock].name };
  const cap = buildingCap(prov, key);
  const inQueue = prov.queue.filter(q => q.key === key).length;
  if (prov.bld[key] + inQueue >= cap) return { ok: false, why: cap === 0 ? 'این زمین/منبع ظرفیت ندارد' : 'به حداکثر ظرفیت رسیده' };
  if (n.treasury < bd.cost * 0.08) return { ok: false, why: 'خزانه کافی نیست' };
  return { ok: true };
}
export function jobsOf(key, lvl) {
  const j = BUILDINGS[key].jobs, out = {};
  for (const c in j) out[c] = j[c] * lvl;
  return out;
}
export function nationJobs(state, prov) {
  const jobs = {};
  for (const k in BUILDINGS) {
    const lvl = prov.bld[k]; if (!lvl) continue;
    const j = jobsOf(k, lvl);
    for (const c in j) jobs[c] = (jobs[c] || 0) + j[c];
  }
  return jobs;
}
export function techMods(state, n) {
  const m = { urbanOut: 0, mineOut: 0, farmOut: 0, toolOut: 0, allOut: 0, taxMult: 0, atk: 0, def: 0, recruit: 0, speed: 0, innov: 0, growth: 0, calm: 0, prestige: 0, portInc: 0, approval: 0, apprWorkers: 0, lawSpeed: 0, solAll: 0 };
  for (const t of n.tech) { const tm = TECHS[t].mods; for (const k in tm) if (k in m) m[k] += tm[k]; }
  const lawMods = lawModsOf(n);
  for (const k in lawMods.mods || {}) { if (k in m) m[k] += lawMods.mods[k]; }
  return m;
}
export function lawModsOf(n) {
  const out = { mods: { farmOut: 0, urbanOut: 0, unrest: 0, solAll: 0, taxMult: 1, innov: 0, authority: 0 }, appr: {} };
  for (const cat in n.laws) {
    const L = LAWS[cat][n.laws[cat]];
    const md = L.mods;
    if (md.farmOut) out.mods.farmOut += md.farmOut;
    if (md.urbanOut) out.mods.urbanOut += md.urbanOut;
    if (md.unrest) out.mods.unrest += md.unrest;
    if (md.solAll) out.mods.solAll += md.solAll;
    if (md.taxMult) out.mods.taxMult *= md.taxMult;
    if (md.innov) out.mods.innov += md.innov;
    if (md.authority) out.mods.authority += md.authority;
    if (md.appr) for (const g in md.appr) out.appr[g] = (out.appr[g] || 0) + md.appr[g];
  }
  return out;
}
export function constructionPoints(n, tm) { return 1 + (tm.speed ? 0 : 0) + (n.tech.includes('railway') ? 0.5 : 0) + (n.tech.includes('assembly') ? 0.5 : 0); }
export function battalionCap(state, n) {
  let s = 0;
  for (const p of state.map.provs) if (p.owner === n.id && p.controller === n.id) s += p.bld.barracks || 0;
  return Math.round(s * (1 + techMods(state, n).recruit));
}
export function nationPop(state, nid) {
  let s = 0;
  for (const p of state.map.provs) if (p.owner === nid) for (const c in p.pops) s += p.pops[c];
  return s;
}
export function atWar(state, a, b) { return state.wars.some(w => (w.a === a && w.d === b) || (w.a === b && w.d === a)); }
export function armiesOf(state, nid) { return state.armies.filter(a => a.n === nid); }
export function warBetween(state, a, b) { return state.wars.find(w => (w.a === a && w.d === b) || (w.a === b && w.d === a)); }

// ================= تیک اصلی =================
export function tick(state) {
  state.week++;
  const w = state.week;
  const S = state;

  // صفرکردن عرضه/تقاضا
  for (const g in S.goods) { S.goods[g].s = 0; S.goods[g].d = 0; }

  const ledgers = {}; // برای UI
  for (const n of S.nations) ledgers[n.id] = { taxIncome: 0, tariffs: 0, wages: 0, armyUpkeep: 0, construction: 0, govWages: 0, balance: 0 };

  // ---------- ۱) تولید و درآمد ----------
  for (const n of S.nations) {
    if (!n.alive) continue;
    const tm = techMods(S, n);
    const lm = lawModsOf(n);
    let gdp = 0, wageBill = 0, profitPool = 0, grainShort = false;
    const happy = g => (n.groups[g]?.appr ?? 0) >= 10;
    const toolFill = S.goods.tools.fill ?? 1;

    for (const p of S.map.provs) {
      if (p.owner !== n.id || p.controller !== n.id) continue;
      const jobs = nationJobs(S, p);
      const emp = p.employ = {};
      // استخدام: هر طبقه تا سقف ظرفیت (مشاغل منشی به سواد وابسته است)
      for (const c in POP_CLASSES) {
        const pool = p.pops[c] || 0;
        let cap = jobs[c] || 0;
        if (c === 'clerk') cap *= clamp(0.4 + (n.literacy || 12) / 100 * 0.8, 0.4, 1.1);
        emp[c] = Math.min(pool, cap);
      }
      emp.unemp = 0;
      const devMult = Math.max(0.35, 1 - p.devast * 0.08);
      p.incomeClass = {};

      for (const k in BUILDINGS) {
        const lvl = p.bld[k]; if (!lvl) continue;
        const bd = BUILDINGS[k];
        // نسبت حضور: میانگین استخدام طبقات این ساختمان
        let need = 0, have = 0;
        for (const c in bd.jobs) { need += bd.jobs[c] * lvl; have += emp[c] || 0; }
        // سهم این ساختمان از نیروی کار موجود (تقریبی، بر اساس سهم مشاغل)
        const shareSum = Object.values(jobs).reduce((a, b) => a + b, 0) || 1;
        let staff = 0;
        for (const c in bd.jobs) staff += (bd.jobs[c] * lvl) * ((emp[c] || 0) / (jobs[c] || 1));
        const r = need > 0 ? clamp(staff / need, 0, 1) : 0;

        let outMult = 1 + tm.allOut;
        if (bd.urban) outMult *= 1 + tm.urbanOut + lm.mods.urbanOut;
        if (k === 'farm' || k === 'ranch') outMult *= 1 + tm.farmOut + lm.mods.farmOut;
        if (k === 'farm' || k === 'lumber') outMult *= 1 + 0.25 * toolFill; // ابزار موجب رونق می‌شود
        if (k === 'coal_mine' || k === 'iron_mine') outMult *= 1 + tm.mineOut;
        if (k === 'tool_work' || k === 'arms_ind') outMult *= 1 + tm.toolOut;
        if (happy('industrialists') && bd.urban) outMult *= 1.05;
        if (happy('landowners') && (k === 'farm' || k === 'ranch')) outMult *= 1.05;
        if (n.boom > 0) outMult *= 1.08;
        if (n.strike > 0 && bd.urban) outMult *= 0.65;
        if (p.bld.railway > 0 && bd.prod && Object.keys(bd.prod).length) outMult *= 1 + Math.min(0.05 * p.bld.railway, 0.25); // زیرساخت ریلی
        // کمبود نهاده
        let inFill = 1;
        for (const g in bd.cons) { const f = S.goods[g].fill ?? 1; if (f < inFill) inFill = f; }
        outMult *= (0.55 + 0.45 * inFill);

        const qty = lvl * r * devMult * outMult;
        let revenue = 0, material = 0;
        for (const g in bd.prod) { const q = bd.prod[g] * qty; S.goods[g].s += q; revenue += q * S.goods[g].price * PS; }
        for (const g in bd.cons) { const q = bd.cons[g] * lvl * r; S.goods[g].d += q; material += q * S.goods[g].price * PS; }
        if (bd.income) revenue += bd.income * lvl * r * (1 + tm.portInc);
        let wages = 0;
        for (const c in bd.jobs) wages += (bd.jobs[c] * lvl * r / 1000) * POP_CLASSES[c].wage * WAGE;
        p.incomeClass[k] = { wages, revenue };
        wageBill += wages;
        const profit = revenue - material - wages;
        profitPool += profit;
        gdp += revenue - material * 0.4;
      }

      // درآمد طبقات (برای سطح زندگی و تقاضا)
      const classInc = {};
      for (const c in POP_CLASSES) {
        const empN = emp[c] || 0, tot = p.pops[c] || 0;
        const w = POP_CLASSES[c].wage * WAGE / 1000;
        classInc[c] = empN * w + (tot - empN) * w * 0.3; // بیکاران کوشش معیشت
      }
      // سود به مالکان
      const owners = (p.pops.capitalist || 0) + (p.pops.aristocrat || 0) + 1;
      classInc.capitalist += profitPool * 0;
      p.classIncome = classInc;

      // تقاضای نیازهای مردم
      let needsCost = 0, grainLack = 0;
      for (const c in POP_CLASSES) {
        const cnt = (p.pops[c] || 0) / 10000;
        const nd = NEEDS[c];
        for (const g in nd) { const q = nd[g] * cnt; S.goods[g].d += q; if (g === 'grain') needsCost += q * S.goods.grain.price * PS; }
      }
      const grainNeed = Object.entries(p.pops).reduce((a, [c, n2]) => a + (NEEDS[c].grain || 0) * n2 / 10000, 0);
      const fillG = S.goods.grain.fill ?? 1;
      p.hunger = fillG < 0.85 ? (0.85 - fillG) : 0;

      // سطح زندگی
      let solSum = 0, popSum = 0;
      for (const c in POP_CLASSES) {
        const tot = p.pops[c] || 0; if (tot < 1) continue;
        const inc = p.classIncome[c] / (tot / 1000); // درآمد هر ۱۰۰۰ نفر
        let need = 0; const nd = NEEDS[c];
        for (const g in nd) need += nd[g] * Math.min(S.goods[g].price, GOODS[g].base * 2.2) * PS / 10; // هر ۱۰۰۰ نفر
        need = Math.max(need, 0.5);
        const solC = clamp(3 + (inc / (need * 2.15)) * 6, 2, 30);
        solSum += solC * tot; popSum += tot;
      }
      const baseSol = (solSum / Math.max(popSum, 1)) + lm.mods.solAll + tm.solAll;
      p.sol = lerp(p.sol || 12, baseSol, 0.25);

      // بی‌کاری و ناآرامی
      const jobTotal = Object.values(jobs).reduce((a, b) => a + b, 0);
      const workAge = (p.pops.farmer || 0) + (p.pops.worker || 0) + (p.pops.clerk || 0) + (p.pops.unemp || 0);
      const empTotal = workAge - (p.pops.unemp || 0) + Math.min(p.pops.unemp || 0, Math.max(0, jobTotal - (workAge - (p.pops.unemp || 0))));
      p.unempShare = clamp(((p.pops.unemp || 0)) / Math.max(workAge, 1), 0, 1);

      const taxU = TAX_LEVELS[n.taxLvl].unrest;
      let groupU = 0;
      for (const g in n.groups) if (n.groups[g].appr <= -10) groupU += 0.06;
      const targetU = clamp(
        8 + taxU * 90 + (lm.mods.unrest || 0) * 80 + p.unempShare * 55 + Math.max(0, 15 - p.sol) * 2.2
        + groupU * 100 + p.hunger * 160 - (tm.calm + (happy('clergy') ? 0.08 : 0) + (lm.mods.unrest < 0 ? -lm.mods.unrest : 0)) * 40
        + (atWarAny(S, n.id) ? 4 : 0), 2, 100);
      p.unrest = clamp(lerp(p.unrest, targetU, 0.07), 0, 100);
      p.devast = Math.max(0, p.devast - 0.01);
    }

    // تقاضای ساخت‌وساز و ارتش
    let activeCons = 0;
    for (const p of S.map.provs) if (p.owner === n.id) activeCons += p.queue.length;
    S.goods.wood.d += activeCons * 0.4; S.goods.tools.d += activeCons * 0.22; S.goods.iron.d += activeCons * 0.14;
    S.goods.arms.d += n.battalions * 0.06;

    n._gdpRaw = gdp;
    n._wageBill = wageBill;
    n._profitPool = profitPool;
  }

  // ---------- ۲) بازار: تناسب عرضه/تقاضا و قیمت ----------
  // صنایع دستی خانگی (عرضه پایه پوشاک، مبلمان و کمی لوکس از سوی روستائیان)
  let ruralAll = 0;
  for (const p of S.map.provs) ruralAll += (p.pops.farmer || 0) + (p.pops.unemp || 0);
  S.goods.clothes.s += ruralAll / 10000 * 0.10;
  S.goods.furniture.s += ruralAll / 10000 * 0.035;
  S.goods.luxury.s += ruralAll / 10000 * 0.008;
  for (const g in S.goods) {
    const G = S.goods[g];
    G.fill = G.d <= 0 ? 1 : clamp(G.s / G.d, 0, 1.25);
    const base = GOODS[g].base;
    const r = G.d > 0 ? clamp((G.d - G.s) / Math.max(G.s, G.d, 1), -1, 1) : -0.5;
    G.price = clamp(G.price * (1 + 0.07 * r), base * 0.45, base * 3.6);
    G.hist.push(G.price);
    if (G.hist.length > 130) G.hist.shift();
  }

  // ---------- ۳) خزانه‌داری ----------
  for (const n of S.nations) {
    if (!n.alive) continue;
    const tm = techMods(S, n), lm = lawModsOf(n);
    const L = ledgers[n.id];
    const taxMult = TAX_LEVELS[n.taxLvl].mult * lm.mods.taxMult * (1 + tm.taxMult);
    L.taxIncome = (n._wageBill * 0.24 + Math.max(0, n._profitPool) * 0.20) * taxMult;
    let tradeBonus = 0;
    for (const o in n.pacts) if (n.pacts[o] === 'trade') tradeBonus += (S.nations[o]?.alive ? 40 : 0);
    L.tariffs = tradeBonus;
    L.govWages = state_provincesCount(S, n.id) * 2.2 + nationPop(S, n.id) / 42000;
    L.armyUpkeep = n.battalions * 3.2 * (S.goods.arms.fill < 0.8 ? 1.4 : 1);
    let cons = 0;
    for (const p of S.map.provs) {
      if (p.owner !== n.id) continue;
      for (const q of p.queue.slice(0, 2)) cons += BUILDINGS[q.key].cost / BUILDINGS[q.key].weeks;
    }
    L.construction = cons;
    L.balance = L.taxIncome + L.tariffs - L.govWages - L.armyUpkeep - L.construction;
    n.treasury += L.balance;
    n.ledger = L;

    if (n.treasury < -4000) {
      n.treasury = -1200;
      n.prestige = Math.max(0, n.prestige - 8);
      addLog(S, '💸', `${n.name} ورشکست شد!`);
      for (const p of S.map.provs) if (p.owner === n.id) p.unrest = Math.min(100, p.unrest + 15);
    }
    n.gdp = lerp(n.gdp || n._gdpRaw, n._gdpRaw || n.gdp, 0.35);
  }

  // ---------- ۴) جمعیت: رشد، تبدیل طبقه، مهاجرت ----------
  for (const n of S.nations) {
    if (!n.alive) continue;
    const tm = techMods(S, n);
    const growth = (0.00042 + Math.max(0, (n.gdp > 0 ? 1 : 1)) * 0) * (1 + tm.growth);
    // جذابیت استان‌ها
    const attr = new Map();
    for (const p of S.map.provs) {
      if (p.owner !== n.id || p.controller !== n.id) continue;
      const jobs = nationJobs(S, p);
      const vacant = Object.entries(jobs).reduce((a, [c, j]) => a + Math.max(0, j - (p.pops[c] || 0)), 0);
      attr.set(p.id, vacant * 1.6 + p.sol * 900 - p.unrest * 250);
    }
    // مهاجرت داخلی بیکاران
    const provs = S.map.provs.filter(p => p.owner === n.id && p.controller === n.id);
    if (provs.length > 1) {
      const totalUnemp = provs.reduce((a, p) => a + (p.pops.unemp || 0), 0);
      const flow = totalUnemp * 0.012;
      let attrSum = 0; provs.forEach(p => attrSum += Math.max(0, attr.get(p.id)));
      for (const p of provs) {
        const share = attrSum > 0 ? Math.max(0, attr.get(p.id)) / attrSum : 1 / provs.length;
        p._mig = share * flow;
      }
      for (const p of provs) {
        const out = Math.min(p.pops.unemp || 0, flow * Math.max(0, (0 - 0)) * 0 + (p.pops.unemp || 0) * 0.02);
        p.pops.unemp -= out; p._out = out;
      }
      let outSum = provs.reduce((a, p) => a + (p._out || 0), 0);
      if (attrSum > 0 && outSum > 0) {
        for (const p of provs) {
          const add = outSum * Math.max(0, attr.get(p.id)) / attrSum;
          p.pops.unemp = (p.pops.unemp || 0) + add;
        }
      } else {
        // بازگرداندن اگر هیچ استان جذابی نیست
        for (const p of provs) p.pops.unemp = (p.pops.unemp || 0) + (p._out || 0);
      }
      provs.forEach(p => { delete p._mig; delete p._out; });
    }
    // تبدیل بیکاران به طبقه موردنیاز + رشد
    for (const p of provs) {
      const jobs = nationJobs(S, p);
      for (const c of ['worker', 'farmer', 'clerk', 'soldier']) {
        const vac = Math.max(0, (jobs[c] || 0) - (p.pops[c] || 0));
        if (vac > 0 && (p.pops.unemp || 0) > 50) {
          const move = Math.min(vac * 0.05, p.pops.unemp * 0.05);
          p.pops[c] += move; p.pops.unemp -= move;
        }
      }
      const g = growth * (1 + clamp(p.sol - 12, -6, 10) * 0.02);
      for (const c in p.pops) p.pops[c] = Math.max(0, p.pops[c] * (1 + g));
    }
  }

  // ---------- ۵) سیاست: گروه‌ها، قانون‌گذاری، شورش ----------
  for (const n of S.nations) {
    if (!n.alive) continue;
    // قدرت گروه‌ها از روی جمعیت
    let land = 0, ind = 0, work = 0, intel = 0, mil = 0, clergy = 0;
    for (const p of S.map.provs) {
      if (p.owner !== n.id) continue;
      land += (p.pops.aristocrat || 0) * 3 + (p.pops.farmer || 0) * 0.35;
      ind += (p.pops.capitalist || 0) * 3.2 + (p.pops.clerk || 0) * 0.12;
      work += (p.pops.worker || 0) * 1 + (p.pops.unemp || 0) * 0.28;
      intel += (p.pops.clerk || 0) * 2.1;
      mil += (p.pops.soldier || 0) * 3 + n.battalions * 120;
      clergy += 600 + (p.pops.farmer || 0) * 0.18;
    }
    const total = land + ind + work + intel + mil + clergy || 1;
    const lm = lawModsOf(n);
    const shares = { landowners: land / total, industrialists: ind / total, workers: work / total, intelligentsia: intel / total, military: mil / total, clergy: clergy / total };
    const tm = techMods(S, n);
    for (const g in GROUPS) {
      if (!n.groups[g]) n.groups[g] = { clout: 0, appr: 0 };
      n.groups[g].clout = lerp(n.groups[g].clout || 0, shares[g] * 100, 0.25);
      let target = (lm.appr[g] || 0) + (TAX_LEVELS[n.taxLvl].appr * (g === 'workers' || g === 'landowners' ? 1 : 0.3))
        + (atWarAny(S, n.id) ? GROUPS[g].onWar : 0) + (tm.approval || 0) + (g === 'workers' ? (tm.apprWorkers || 0) : 0)
        + (n.groups[g].apprBonus || 0);
      n.groups[g].appr = clamp(lerp(n.groups[g].appr, clamp(target, -20, 20), 0.10), -20, 20);
      if (n.groups[g].apprBonus) n.groups[g].apprBonus *= 0.995;
    }
    // پیشرفت قانون
    if (n.enact) {
      n.enact.prog += 1 * (1 + tm.lawSpeed);
      if (n.enact.prog >= n.enact.total) {
        const success = Math.random() < n.enact.chance();
        const [cat, key] = [n.enact.cat, n.enact.key];
        if (success) {
          n.laws[cat] = key;
          addLog(S, '⚖️', `${n.name}: قانون «${LAWS[cat][key].name}» تصویب شد.`);
          for (const g in GROUPS) { const L = LAWS[cat][key]; if (L.mods.appr && L.mods.appr[g]) n.groups[g].apprBonus = (n.groups[g].apprBonus || 0) + L.mods.appr[g] * 0.5; }
        } else {
          addLog(S, '🛑', `${n.name}: تصویب قانون «${LAWS[cat][key].name}» متوقف شد.`);
          for (const g in n.groups) n.groups[g].appr = clamp(n.groups[g].appr - 2, -20, 20);
        }
        n.enact = null;
      }
    }
    // شورش
    if (n.revoltCd > 0) n.revoltCd--;
    for (const p of S.map.provs) {
      if (p.owner !== n.id || p.controller !== n.id) continue;
      if (p.unrest >= 80 && n.revoltCd <= 0) {
        // شورش!
        p.controller = REBEL;
        p.occ = 0;
        p.unrest = 60;
        n.revoltCd = 60;
        const size = clamp(1 + (p.pops.unemp || 0) / 25000, 1, 6);
        S.armies.push({ id: S.nextArmyId++, n: REBEL, home: p.id, prov: p.id, size, org: 70, mor: 70, path: [], status: 'idle', rebel: true, prog: 0, sackCd: 8 });
        addLog(S, '🔥', `شورش در استان ${p.name} (${n.name})!`);
        if (n.player) pushAlert(S, '🔥', `مردم استان ${p.name} شورش کردند!`);
      }
    }
  }

  // ---------- ۶) پژوهش و سواد ----------
  for (const n of S.nations) {
    if (!n.alive) continue;
    // سواد: به‌سمت هدف حرکت آرام
    {
      let unis = 0, myProvs = 0;
      for (const p of S.map.provs) if (p.owner === n.id) { myProvs++; if (p.controller === n.id) unis += p.bld.university || 0; }
      const tmL = techMods(S, n);
      const targetLit = clamp(10 + (unis / Math.max(myProvs, 1)) * 7 + (n.tech.includes('literacy') ? 12 : 0) + (n.tech.includes('suffrage') ? 6 : 0) + tmL.innov * 0, 6, 92);
      n.literacy = clamp((n.literacy || 12) + clamp(targetLit - (n.literacy || 12), -1, 1) * 0.012, 4, 95);
    }
    if (!n.res.key) continue;
    const tm = techMods(S, n);
    let unis = 0;
    for (const p of S.map.provs) if (p.owner === n.id && p.controller === n.id) unis += p.bld.university || 0;
    const innov = 4 + unis * 1.5 + tm.innov + (n.literacy || 0) / 22 + ((n.groups.intelligentsia?.appr ?? 0) >= 10 ? 1.5 : 0);
    n.res.pts += innov;
    n.innov = innov;
    const t = TECHS[n.res.key];
    if (n.res.pts >= t.cost) {
      n.tech.push(n.res.key);
      addLog(S, '🎓', `${n.name}: فناوری «${t.name}» کشف شد.`);
      if (n.player) pushAlert(S, '🎓', `پژوهش «${t.name}» کامل شد!`);
      n.res.pts = 0; n.res.key = null;
    }
  }

  // ---------- ۷) ساخت‌وساز ----------
  for (const n of S.nations) {
    if (!n.alive) continue;
    const tm = techMods(S, n);
    let cp = constructionPoints(n, tm);
    const items = [];
    for (const p of S.map.provs) if (p.owner === n.id && p.queue.length) { if (p.controller === n.id) { items.push({ p, q: p.queue[0] }); if (items.length >= Math.round(cp + 1)) break; } }
    for (const { p, q } of items) {
      q.prog = (q.prog || 0) + 1;
      const bd = BUILDINGS[q.key];
      if (q.prog >= bd.weeks) {
        p.queue.shift();
        p.bld[q.key]++;
        if (q.key === 'barracks') n.battalions = Math.min(n.battalions + 1, battalionCap(S, n) + 1);
        addLog(S, bd.icon, `${n.name}: ساخت «${bd.name}» در ${p.name} تکمیل شد.`);
        if (n.player) pushAlert(S, '🏗️', `ساخت «${bd.name}» در استان ${p.name} پایان یافت.`);
      }
    }
  }
  // تولیدمثل گردان‌ها در صلح
  for (const n of S.nations) {
    if (!n.alive) continue;
    const cap = battalionCap(S, n);
    if (!atWarAny(S, n.id) && n.battalions < cap) n.battalions = Math.min(cap, n.battalions + cap * 0.02);
  }

  // ---------- ۸) جنگ ----------
  simArmies(state);
  simBattles(state);
  simOccupation(state);
  simWars(state);
  simRelations(state);

  // ---------- ۹) هوش مصنوعی ----------
  for (const n of S.nations) if (!n.player && n.alive) thinkAI(state, n);

  // ---------- ۱۰) اعتبار و آمار ----------
  const gdps = S.nations.map(n => n.gdp || 1);
  const maxG = Math.max(...gdps, 1);
  const maxBat = Math.max(...S.nations.map(n => n.battalions + armiesOf(S, n.id).reduce((a, x) => a + x.size, 0)), 1);
  for (const n of S.nations) {
    if (!n.alive) { n.prestige = 0; continue; }
    const tm = techMods(S, n);
    const arm = (n.battalions + armiesOf(S, n.id).reduce((a, x) => a + x.size, 0));
    n.prestige = 60 * (n.gdp / maxG) + 25 * (arm / maxBat) + n.tech.length * 2.2 + tm.prestige + avgSol(S, n.id) * 0.35;
    S.stats.gdp[n.id].push(n.gdp);
    if (!S.stats.sol[n.id]) S.stats.sol[n.id] = [];
    S.stats.sol[n.id].push(avgSol(S, n.id));
    if (S.stats.gdp[n.id].length > 150) { S.stats.gdp[n.id].shift(); S.stats.sol[n.id].shift(); }
  }
  S.stats.weeks++;
  if (n_boomTick(S)) { /* noop */ }

  // رویدادهای تصادفی
  S.eventCd--;
  for (const n of S.nations) { if (n.boom > 0) n.boom--; if (n.strike > 0) n.strike--; }
  if (S.eventCd <= 0 && !S.pendingEvent) {
    S.eventCd = 14 + Math.floor(Math.random() * 16);
    const n = S.nations[S.playerId];
    const eligible = EVENTS.filter(e => !e.cond || e.cond(S));
    if (eligible.length && n.alive) {
      const e = pick(Math.random, eligible);
      S.pendingEvent = e;
      S.pausedBeforeEvent = S.paused;
      S.paused = true;
    }
  }

  // پیشنهادهای دیپلماتیک برای بازیکن
  expireOffers(state);

  // ---------- ۱۰.۵) انتخابات دوره‌ای + مأموریت‌ها ----------
  const pnx = S.nations[S.playerId];
  if (pnx.alive && pnx.laws.gov !== 'absolut' && !S.pendingEvent && !S.gameOver) {
    if (pnx.electionCd === undefined) pnx.electionCd = 208;
    pnx.electionCd--;
    if (pnx.electionCd <= 0) {
      pnx.electionCd = 208;
      S.pendingEvent = ELECTION_EVENT;
      S.pausedBeforeEvent = S.paused;
      S.paused = true;
      addLog(S, '🗳️', 'انتخابات عمومی آغاز شد.');
    }
  }
  checkMissions(S);
  if (!S.gameOver && S.week >= 3380) {
    S.gameOver = true;
    S.paused = true;
    addLog(S, '👑', 'قرن نوزدهم به پایان رسید؛ سرشماری نهایی قدرت‌ها انجام شد.');
  }

  // ---------- ۱۱) پیروزی/شکست ----------
  const pn = S.nations[S.playerId];
  const myProvs = S.map.provs.filter(p => p.owner === pn.id).length;
  if (myProvs === 0 && !S.defeat) { S.defeat = true; addLog(S, '💀', 'سرزمین شما به‌کلی سقوط کرد.'); }
  const { y } = { y: 1836 + S.week / 52 };
  if (S.week > 0 && S.week % 52 === 0 && !S.victory) {
    const rank = ranking(S).findIndex(r => r.id === pn.id) + 1;
    if (rank === 1 && 1836 + S.week / 52 >= 1900) { S.victory = true; }
  }
}

function state_provincesCount(S, nid) { return S.map.provs.filter(p => p.owner === nid).length; }
export function atWarAny(S, nid) { return S.nations[nid].wars.length > 0; }
export function avgSol(S, nid) {
  let s = 0, c = 0;
  for (const p of S.map.provs) if (p.owner === nid) { s += (p.sol || 10) * nationPopProv(p); c += nationPopProv(p); }
  return c ? s / c : 10;
}
function nationPopProv(p) { return Object.values(p.pops).reduce((a, b) => a + b, 0); }
export function ranking(S) { return S.nations.slice().sort((a, b) => b.prestige - a.prestige); }
function pushAlert(S, icon, text) { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon, text, w: S.week }); }
function n_boomTick() { return false; }

// ================= ارتش‌ها =================
function terrainOf(S, pid) { return S.map.provs[pid].terrain; }
function moveWeeks(S, nid, provId) {
  const tm = (nid >= 0 && S.nations[nid]) ? techMods(S, S.nations[nid]) : { speed: 0 };
  const t = TERRAIN[terrainOf(S, provId)];
  return Math.max(0.5, 2 / t.speed / (1 + (tm.speed || 0)));
}
export function orderArmy(S, army, target) {
  const canPass = (pid) => {
    if (army.n === REBEL) return false;
    return true; // عبور سرزمینی آزاد است؛ سرزمین بی‌گانه کندتر است
  };
  const path = findPath(S.map.provs, army.prov, target, canPass);
  if (!path || path.length < 2) return false;
  army.path = path;
  army.status = 'move';
  army.prog = 0;
  return true;
}
function simArmies(S) {
  for (const a of S.armies) {
    if (a.status === 'battle') continue;
    if (a.n !== REBEL) {
      a.org = Math.min(100, a.org + 2.5);
      a.mor = Math.min(100, a.mor + 2.5);
    } else { a.size = Math.min(6, a.size + 0.08); } // شورشیان با سقف رشد می‌کنند
    if (a.status === 'move' && a.path && a.path.length > 1) {
      const n = a.n;
      const next = a.path[1];
      let mw = moveWeeks(S, n, next);
      const ownerN = S.map.provs[next].owner;
      if (n >= 0 && ownerN !== n && !atWar(S, n, ownerN)) mw *= 1.8; // گذر از خاک بی‌گانه خنثی
      if (S.map.provs[next].bld.railway > 0) mw /= 1.6; // حمل‌ونقل ریلی
      a.prog = (a.prog || 0) + 1 / mw;
      if (a.prog >= 1) {
        a.prog = 0;
        a.prov = next;
        a.path.shift();
        if (a.path.length < 2) { a.status = 'idle'; a.path = []; }
        // ورود به استان دشمن؟ نبرد در simBattles دیده می‌شود
      }
    }
  }
  // پاک‌سازی ارتش‌های نابودشده
  S.armies = S.armies.filter(a => a.size > 0.35);
}
function hostilePair(S, a, b) {
  if (a.n === b.n) return false;
  if (a.n === REBEL || b.n === REBEL) {
    const other = a.n === REBEL ? b : a;
    return other.n >= 0; // شورشی با هر ارتش ملی در شورش‌زده دشمن است
  }
  return atWar(S, a.n, b.n);
}
function simBattles(S) {
  // شروع نبردهای جدید
  for (const a of S.armies) {
    if (a.status === 'battle') continue;
    if (a.status === 'move') continue; // در حال عبور
    const enemy = S.armies.find(b => b !== a && b.status !== 'battle' && b.status !== 'move' && b.prov === a.prov && hostilePair(S, a, b));
    if (enemy) {
      const p = S.map.provs[a.prov];
      // مهاجم: کسی که صاحب استان نیست
      let atk = a, def = enemy;
      if (a.n === p.owner || (a.n !== REBEL && !atWar(S, a.n, p.owner) && a.n === p.owner)) { atk = enemy; def = a; }
      else if (enemy.n === REBEL) { atk = a; def = enemy; }
      atk.status = 'battle'; def.status = 'battle';
      S.battles.push({ id: S.nextBattleId++, prov: a.prov, atk: atk.id, def: def.id, t: 0 });
      if (atk.n === S.playerId || def.n === S.playerId) pushAlert(S, '⚔️', `نبرد در استان ${S.map.provs[a.prov].name} آغاز شد!`);
    }
  }
  // پیشروی نبردها
  for (const bt of S.battles) {
    const atk = S.armies.find(a => a.id === bt.atk), def = S.armies.find(a => a.id === bt.def);
    if (!atk || !def) { bt.done = true; continue; }
    bt.t++;
    const p = S.map.provs[bt.prov];
    const terr = TERRAIN[p.terrain];
    const modA = atk.n >= 0 ? techMods(S, S.nations[atk.n]) : { atk: -0.15, def: -0.15, calm: 0 };
    const modD = def.n >= 0 ? techMods(S, S.nations[def.n]) : { atk: -0.15, def: -0.15 };
    const hapA = atk.n >= 0 && (S.nations[atk.n].groups.military?.appr ?? 0) >= 10 ? 1.05 : 1;
    const hapD = def.n >= 0 && (S.nations[def.n].groups.military?.appr ?? 0) >= 10 ? 1.05 : 1;
    const fillA = atk.n >= 0 ? (S.goods.arms.fill ?? 1) : 1;
    const fillD = def.n >= 0 ? (S.goods.arms.fill ?? 1) : 1;
    const rnd1 = 0.75 + Math.random() * 0.5, rnd2 = 0.75 + Math.random() * 0.5;
    const pA = atk.size * (1 + (modA.atk || 0)) * (atk.org / 100) * (0.6 + 0.4 * fillA) * hapA * rnd1;
    const pD = def.size * (1 + (modD.def || 0)) * terr.def * (def.org / 100) * (0.6 + 0.4 * fillD) * hapD * rnd2;
    const k = 0.055;
    atk.size = Math.max(0, atk.size - pD * k * (0.8 + Math.random() * 0.4));
    def.size = Math.max(0, def.size - pA * k * (0.8 + Math.random() * 0.4));
    atk.org = Math.max(0, atk.org - (5 + pD / Math.max(pA, 1) * 8));
    def.org = Math.max(0, def.org - (5 + pA / Math.max(pD, 1) * 8));
    atk.mor = Math.max(0, atk.mor - 4); def.mor = Math.max(0, def.mor - 4);
    S.fx.push({ type: 'boom', x: p.cx, y: p.cy, t: 1, life: 1 });
    // کاهش جمعیت سرباز
    if (Math.random() < 0.2 && atk.n >= 0) drainSoldiers(S, atk.n, 220 * Math.random());
    if (Math.random() < 0.2 && def.n >= 0) drainSoldiers(S, def.n, 220 * Math.random());
    // پایان نبرد؟
    const atkOut = atk.org < 10 || atk.size < 0.5 || atk.mor < 8;
    const defOut = def.org < 10 || def.size < 0.5 || def.mor < 8;
    if (atkOut || defOut) {
      let loser = atkOut ? atk : def;
      let winner = atkOut ? def : atk;
      if (atkOut && defOut) { if (atk.size < def.size) { loser = atk; winner = def; } else { loser = def; winner = atk; } }
      loser.status = 'idle';
      winner.status = 'idle';
      winner.mor = Math.min(100, winner.mor + 10);
      // عقب‌نشینی
      if (loser.n >= 0) {
        const homeAdj = p.adj.find(q => S.map.provs[q].owner === loser.n) ?? p.adj[0];
        if (homeAdj !== undefined && S.map.provs[homeAdj].owner === loser.n) { loser.prov = homeAdj; loser.path = []; }
        else if (!S.armies.some(x => x !== loser && x.prov === p.id && hostilePair(S, x, loser))) { /* می‌ماند */ }
        else { loser.size = 0; } // محاصره و نابودی
      } else { loser.size = 0; }
      // امتیاز جنگ
      const war = warBetween(S, atk.n, def.n);
      if (war) {
        const atkWin = winner === atk;
        war.score += atkWin ? 9 : -9;
        war.score = clamp(war.score, -100, 100);
        const wn = S.nations[winner.n], ln = loser.n >= 0 ? S.nations[loser.n] : { name: 'شورشیان' };
        addLog(S, '⚔️', `نبرد ${p.name}: ${wn.name} پیروز شد.`);
        if (winner.n === S.playerId || (loser.n === S.playerId)) pushAlert(S, atkWin ? '⚔️' : '🛡️', `نبرد ${p.name} به پایان رسید.`);
      } else {
        addLog(S, '⚔️', `در ${p.name} نبردی درگرفت؛ شورش ${winner.n >= 0 ? 'سرکوب شد' : 'پیروز ماند'}.`);
      }
      bt.done = true;
    }
  }
  S.battles = S.battles.filter(b => !b.done);
}
function drainSoldiers(S, nid, cnt) {
  const provs = S.map.provs.filter(p => p.owner === nid);
  if (!provs.length) return;
  const p = pick(Math.random, provs);
  p.pops.soldier = Math.max(0, (p.pops.soldier || 0) - cnt);
}
function simOccupation(S) {
  for (const p of S.map.provs) {
    const hostiles = S.armies.filter(a => a.prov === p.id && a.status !== 'move' && a.status !== 'battle' &&
      (a.n === REBEL ? false : atWar(S, a.n, p.owner)));
    if (p.controller >= 0 && hostiles.length && p.controller === p.owner) {
      const force = hostiles.reduce((a, x) => a + x.size, 0);
      p.occ = (p.occ || 0) + clamp(force * 4, 1, 16);
      if (p.occ >= 100) {
        p.controller = hostiles[0].n;
        p.occ = 0; p.unrest = Math.min(100, p.unrest + 30);
        const w = warBetween(S, hostiles[0].n, p.owner);
        if (w) {
          const isAtt = w.a === hostiles[0].n;
          w.score = clamp(w.score + (S.nations[p.owner].capital === p.id ? 30 : 6) * (isAtt ? 1 : -1) * (isAtt ? 1 : 1), -100, 100);
        }
        addLog(S, '🏴', `استان ${p.name} به اشغال ${S.nations[hostiles[0].n].name} درآمد.`);
        if (p.owner === S.playerId) pushAlert(S, '🏴', `استان ${p.name} اشغال شد!`);
      }
    } else if (p.controller !== p.owner && p.controller >= 0) {
      // بازپس‌گیری
      const mine = S.armies.find(a => a.prov === p.id && a.n === p.owner && a.status !== 'move' && a.status !== 'battle');
      const anyEnemy = S.armies.some(a => a.prov === p.id && a.n === p.controller && a.status !== 'move');
      if (mine && !anyEnemy) {
        p.occ = (p.occ || 0) + 10;
        if (p.occ >= 100) { p.occ = 0; p.controller = p.owner; addLog(S, '🎌', `استان ${p.name} بازپس گرفته شد.`); }
      }
    }
    // شورشی: بازپس‌گیری خودکار وقتی شورشی نمانده + غارت دوره‌ای
    if (p.controller === REBEL) {
      const rebAny = S.armies.some(a => a.n === REBEL && a.prov === p.id);
      if (!rebAny) {
        p.controller = p.owner;
        p.unrest = 35;
        p.occ = 0;
        addLog(S, '🕊️', `شورش در استان ${p.name} پایان یافت.`);
      }
      const reb = S.armies.find(a => a.n === REBEL && a.prov === p.id);
      if (reb) {
        reb.sackCd = (reb.sackCd ?? 8) - 1;
        if (reb.sackCd <= 0) {
          reb.sackCd = 8;
          const keys = Object.keys(BUILDINGS).filter(k => p.bld[k] > 0);
          if (keys.length) { const k = pick(Math.random, keys); p.bld[k]--; }
          p.devast = Math.min(10, p.devast + 1);
          const owner = S.nations[p.owner];
          if (owner.alive) { owner.treasury = Math.max(-3000, owner.treasury - 300); }
          S.fx.push({ type: 'boom', x: p.cx, y: p.cy, t: 1, life: 1 });
        }
      }
    } else if (p.controller === p.owner && p.unrest <= 30) p.occ = Math.max(0, (p.occ || 0) - 4);
  }
}
function simWars(S) {
  for (const w of S.wars) {
    const A = S.nations[w.a], D = S.nations[w.d];
    w.weeks = (w.weeks || 0) + 1;
    // خستگی جنگ
    if (w.weeks > 52) w.score = clamp(w.score * 0.995, -100, 100);
    // پیوستن متحدان دفاعی
    if (w.weeks === 1) {
      for (const n of S.nations) {
        if (n.id === w.a || n.id === w.d || !n.alive) continue;
        if (n.pacts[w.d] === 'ally' && !atWar(S, n.id, w.a)) {
          joinWar(S, n.id, w, w.d);
        }
      }
    }
    // AI صلح می‌خواهد؟
    const scoreAD = w.score; // مثبت به نفع مهاجم
    // مهاجم اگر هدف جنگ را مدتی نگه دارد، خواسته‌اش تحمیل می‌شود
    if (w.goal !== null && w.goal !== undefined && S.map.provs[w.goal].controller === w.a) w.goalHold = (w.goalHold || 0) + 1;
    else w.goalHold = 0;
    if (w.goalHold >= 26 && canEnforce(S, w)) { endWar(S, w, 'enforce'); continue; }
    if (!A.player && scoreAD <= -45) { endWar(S, w, 'white'); continue; }
    if (!D.player && scoreAD >= 55 && canEnforce(S, w)) { endWar(S, w, 'enforce'); continue; }
    if (w.weeks > 104 && Math.abs(w.score) < 15 && !A.player && !D.player && Math.random() < 0.05) { endWar(S, w, 'white'); continue; }
    // پیشنهاد صلح AI به بازیکن
    if (!A.player && scoreAD <= -35 && !w._peaceAsked && D.player) { w._peaceAsked = true; pushDipOffer(S, A.id, 'peace', w.id); }
    if (!D.player && scoreAD >= 40 && !w._peaceAsked && A.player) { w._peaceAsked = true; pushDipOffer(S, D.id, 'peace', w.id); }
    if (!A.player && scoreAD >= 45 && !w._peaceAsked && D.player) { w._peaceAsked = true; w._demand = true; pushDipOffer(S, A.id, 'peace', w.id); }
    // سقوط کامل
    const dProvs = S.map.provs.filter(p => p.owner === w.d);
    const dOcc = dProvs.every(p => p.controller === w.a || p.controller === REBEL);
    if (dOcc && dProvs.length) { endWar(S, w, 'enforce'); continue; }
    const aProvs = S.map.provs.filter(p => p.owner === w.a);
    if (aProvs.every(p => p.controller === w.d || p.controller === REBEL) && aProvs.length) { w.score = -100; endWar(S, w, 'white'); continue; }
  }
  S.wars = S.wars.filter(w => !w.done);
  for (const n of S.nations) n.wars = n.wars.filter(id => S.wars.some(w => w.id === id));
}
// کشش روابط میان همسایگان بر اساس شخصیت و توازن قدرت
function simRelations(S) {
  for (let i = 0; i < S.nations.length; i++) {
    for (let j = i + 1; j < S.nations.length; j++) {
      const A = S.nations[i], B = S.nations[j];
      if (!A.alive || !B.alive) continue;
      const adj = S.map.provs.some(p => p.owner === i && p.adj.some(q => S.map.provs[q].owner === j));
      if (!adj) continue;
      const strA = (A.battalions + 1) / (B.battalions + 1);
      let d = 0;
      if (A.pers === 'aggressive' && strA > 1.3) d -= 0.14;
      if (B.pers === 'aggressive' && strA < 0.77) d -= 0.14;
      if (A.pers === 'peaceful' || B.pers === 'peaceful') d += 0.05;
      if (A.pacts[j]) d += 0.10;
      if (d !== 0) {
        A.rel[j] = clamp(A.rel[j] + d, -100, 100);
        B.rel[i] = clamp(B.rel[i] + d, -100, 100);
      }
    }
  }
}
function joinWar(S, nid, w, sideOf) {
  const other = sideOf === w.d ? w.a : w.d;
  if (sideOf === w.d) { w.allies = w.allies || []; w.allies.push({ side: 'd', id: nid }); }
  else { (w.allies = w.allies || []).push({ side: 'a', id: nid }); }
  S.nations[nid].wars.push(w.id);
  addLog(S, '🤝', `${S.nations[nid].name} به جنگ علیه ${S.nations[other].name} پیوست.`);
  if (nid === S.playerId) pushAlert(S, '🤝', 'شما به دلیل پیمان اتحاد وارد جنگ شدید!');
}
export function warHas(S, war, nid) {
  if (war.a === nid || war.d === nid) return true;
  return (war.allies || []).some(al => al.id === nid);
}
export function warSide(S, war, nid) {
  if (war.a === nid || (war.allies || []).some(al => al.id === nid && al.side === 'a')) return 'a';
  if (war.d === nid || (war.allies || []).some(al => al.id === nid && al.side === 'd')) return 'd';
  return null;
}
function canEnforce(S, w) {
  if (!w.goal && w.goal !== 0) return true;
  const p = S.map.provs[w.goal];
  return p.controller === w.a || w.score >= 70;
}
export function endWar(S, w, kind) {
  const A = S.nations[w.a], D = S.nations[w.d];
  let text = '';
  if (kind === 'enforce' && w.goal !== null && w.goal !== undefined) {
    const p = S.map.provs[w.goal];
    const from = p.owner;
    p.owner = w.a; p.controller = w.a; p.unrest = Math.min(100, p.unrest + 25); p.occ = 0;
    // پاک شدن صاحب قبلی در صورت نبود استان
    A.prestige += 6;
    A.annexed = (A.annexed || 0) + 1;
    text = `${A.name} استان ${p.name} را از ${D.name} ضمیمه کرد.`;
    addLog(S, '🏴‍☠️', text);
    const rep = Math.min(Math.max(0, D.treasury) * 0.5, Math.max(0, D.gdp) * 1.2);
    D.treasury -= rep; A.treasury += rep;
    checkCollapse(S, from);
  } else if (kind === 'enforce') {
    const rep = Math.min(Math.max(0, D.treasury) * 0.5, Math.max(0, D.gdp) * 1);
    D.treasury -= rep; A.treasury += rep;
    text = `${D.name} به ${A.name} غرامت پرداخت کرد.`;
    addLog(S, '🕊️', text);
  } else {
    text = `صلح سفید میان ${A.name} و ${D.name} برقرار شد.`;
    addLog(S, '🕊️', text);
  }
  // آزادسازی اشغال‌های جنگی که تغییر مالکیت نداشتند
  for (const p of S.map.provs) {
    if (warHas(S, w, p.controller) && (p.controller === w.a || p.controller === w.d || (w.allies || []).some(al => al.id === p.controller))) {
      if (p.controller !== p.owner) p.controller = p.owner;
      p.occ = 0;
    }
  }
  w.done = true;
  if (w.a === S.playerId || w.d === S.playerId) pushAlert(S, '🕊️', text);
}
function checkCollapse(S, loserId) {
  const n = S.nations[loserId];
  const left = S.map.provs.filter(p => p.owner === loserId);
  if (left.length === 0 && n.alive) {
    n.alive = false;
    for (const a of S.armies) if (a.n === loserId) a.size = 0;
    addLog(S, '💀', `${n.name} از صحنه سیاست محو شد!`);
  }
}

// ================= AI =================
function thinkAI(S, n) {
  n.ai.nextThink--;
  if (n.ai.nextThink > 0) return;
  n.ai.nextThink = 6 + Math.floor(Math.random() * 6);
  const rnd = Math.random;

  // پژوهش
  if (!n.res.key) {
    const pref = n.pers === 'industrial' ? 'ind' : n.pers === 'aggressive' ? 'mil' : n.pers === 'trader' ? 'ind' : n.pers === 'peaceful' ? 'soc' : (rnd() < 0.5 ? 'ind' : 'mil');
    const opts = Object.keys(TECHS).filter(k => !n.tech.includes(k) && TECHS[k].br === (rnd() < 0.7 ? pref : pick(rnd, ['ind', 'mil', 'soc'])) && (!TECHS[k].prereq || TECHS[k].prereq.every(t => n.tech.includes(t))));
    if (opts.length) n.res = { key: pick(rnd, opts), pts: 0 };
  }
  // مالیات
  if (n.treasury < 200 && n.taxLvl < 4 && rnd() < 0.5) n.taxLvl++;
  else if (n.treasury > 3500 && n.taxLvl > 1 && rnd() < 0.3) n.taxLvl--;

  // ساخت‌وساز
  if (n.treasury > 700 && rnd() < 0.85) {
    const myProvs = S.map.provs.filter(p => p.owner === n.id && p.controller === n.id);
    if (myProvs.length) {
      // کالای گران‌تر که بتوان تولید کرد
      const bids = [];
      for (const k in BUILDINGS) {
        const bd = BUILDINGS[k];
        if (bd.unlock && !n.tech.includes(bd.unlock)) continue;
        let score = 0.5;
        for (const g in bd.prod) score += (S.goods[g].price / GOODS[g].base) * (bd.prod[g] || 0);
        if (k === 'barracks' && n.pers === 'aggressive') score += 1.6;
        if (k === 'barracks' && n.battalions < battalionCap(S, n)) score += 0.8;
        if (k === 'arms_ind' && (S.goods.arms.fill ?? 1) < 0.9) score += 3;
        if (k === 'tool_work' && (S.goods.tools.fill ?? 1) < 0.9) score += 2;
        if (k === 'university' && n.tech.length < 6) score += 0.6;
        if (bd.income && n.pers === 'trader') score += 1;
        bids.push({ k, score: score + rnd() * 0.4 });
      }
      bids.sort((a, b) => b.score - a.score);
      let placed = 0;
      for (const b of bids.slice(0, 8)) {
        const prov = myProvs.find(p => canBuild(S, p, b.k).ok && p.queue.length < 2);
        if (prov) { prov.queue.push({ key: b.k, prog: 0 }); placed++; }
        if (placed >= (n.treasury > 3000 ? 2 : 1)) break;
      }
    }
  }

  // قانون
  if (!n.enact && rnd() < 0.12) {
    const want = n.laws.gov === 'absolut' && n.tech.includes('romantik') && rnd() < 0.4 ? { cat: 'gov', key: 'constit' }
      : n.laws.labor === 'serf' && rnd() < 0.5 ? { cat: 'labor', key: 'poor' }
      : n.laws.tax === 'poll' && rnd() < 0.5 ? { cat: 'tax', key: 'land' } : null;
    if (want) startEnact(S, n, want.cat, want.key);
  }

  // دیپلماسی با بازیکن
  const P = S.nations[S.playerId];
  if (P.alive) {
    const rel = n.rel[P.id];
    if (rel < 0 && rnd() < 0.3 && (n.improvementCd[P.id] || 0) <= S.week) { n.rel[P.id] += 12; P.rel[n.id] += 12; n.improvementCd[P.id] = S.week + 30; }
    if (rel > 40 && !n.pacts[P.id] && rnd() < 0.20 && n.pers === 'trader') pushDipOffer(S, n.id, 'trade');
    if (rel > 70 && !n.pacts[P.id] && rnd() < 0.12) pushDipOffer(S, n.id, 'ally');
    // اعلام جنگ
    if (n.pers === 'aggressive' && (n.dowCd || 0) <= S.week && !n.wars.length && rel < -8 && !n.pacts[P.id]) {
      const myArm = n.battalions + armiesOf(S, n.id).reduce((a, x) => a + x.size, 0);
      const pArm = P.battalions + armiesOf(S, P.id).reduce((a, x) => a + x.size, 0) || 1;
      if (myArm > pArm * 1.4 && rnd() < 0.32) {
        const borderProv = S.map.provs.find(p => p.owner === P.id && p.adj.some(q => S.map.provs[q].owner === n.id));
        if (borderProv) declareWar(S, n.id, P.id, borderProv.id);
      }
    }
  }
  // جنگ با AIِ دیگر همسایه (کمیاب)
  if (n.pers === 'aggressive' && !n.wars.length && rnd() < 0.16) {
    const foe = S.nations.find(m => m.alive && m.id !== n.id && m.id !== S.playerId && n.rel[m.id] < -18 && !atWar(S, n.id, m.id) &&
      S.map.provs.some(p => p.owner === m.id && p.adj.some(q => S.map.provs[q].owner === n.id)));
    if (foe) {
      const borderProv = S.map.provs.find(p => p.owner === foe.id && p.adj.some(q => S.map.provs[q].owner === n.id));
      if (borderProv) declareWar(S, n.id, foe.id, borderProv.id);
    }
  }

  // فرماندهی ارتش
  commandAIArmies(S, n);
}
function commandAIArmies(S, n) {
  const cap = battalionCap(S, n);
  const fielded = armiesOf(S, n.id).reduce((a, x) => a + x.size, 0);
  const reserve = Math.max(0, n.battalions - fielded);
  const myWars = S.wars.filter(w => warHas(S, w, n.id));
  let armies = armiesOf(S, n.id);

  if (myWars.length || S.armies.some(a => a.n === REBEL && S.map.provs[a.prov].owner === n.id)) {
    // ساخت/تقویت ارتش
    if (!armies.length && reserve >= 1) {
      const at = S.nations[n.id].capital;
      if (S.map.provs[at].controller === n.id) {
        S.armies.push({ id: S.nextArmyId++, n: n.id, home: at, prov: at, size: Math.max(1, Math.floor(reserve)), org: 100, mor: 90, path: [], status: 'idle' });
        armies = armiesOf(S, n.id);
      }
    }
    for (const a of armies) {
      if (a.status === 'battle') continue;
      // شورش داخلی اولویت دارد
      const reb = S.armies.find(r2 => r2.n === REBEL && S.map.provs[r2.prov].owner === n.id);
      const w = myWars[0];
      if (reb && a.status !== 'move') { if (a.prov !== reb.prov) orderArmy(S, a, reb.prov); continue; }
      if (!w) continue;
      const side = warSide(S, w, n.id);
      const foe = side === 'a' ? w.d : w.a;
      // اولویت نخست: آزادسازی استان اشغال‌شده‌ی خودمان
      const occProv = S.map.provs.find(p => p.owner === n.id && p.controller >= 0 && p.controller !== n.id && atWar(S, p.controller, n.id));
      let goal = occProv ? occProv.id : null;
      if (goal === null) {
        // هدف تهاجمی: استان هدف جنگ یا نزدیک‌ترین استان مرزی دشمن
        goal = (side === 'a' && w.goal !== undefined && w.goal !== null && S.map.provs[w.goal]?.owner === foe) ? w.goal : null;
        if (goal === null) {
          goal = S.map.provs.find(p => p.owner === foe && p.adj.some(q => S.map.provs[q].owner === n.id))?.id;
        }
      }
      // دفاع از پایتخت در صورت تهدید نزدیک
      const cap2 = n.capital;
      const threatened = S.armies.some(e => e.n >= 0 && atWar(S, e.n, n.id) && (S.map.provs[e.prov].owner === n.id || S.map.provs[e.prov].adj.includes(cap2)));
      if (threatened && !occProv) goal = cap2;
      if (goal !== null && goal !== undefined && a.prov !== goal && a.status !== 'move') orderArmy(S, a, goal);
    }
  } else {
    // بازگشت به خانه و ادغام
    for (const a of armies) {
      if (a.prov !== n.capital && a.status === 'idle') {
        if (S.map.provs[a.prov].owner === n.id || S.map.provs[a.prov].controller === n.id) orderArmy(S, a, n.capital);
      }
    }
    const home = armies.filter(a => a.prov === n.capital);
    if (home.length > 1) {
      let big = home[0];
      for (const a2 of home.slice(1)) { big.size += a2.size; a2.size = 0; }
      big.size = Math.min(big.size, Math.max(2, cap));
    }
  }
}

// ================= اقدام‌های بازیکن (API برای UI) =================
export function setTax(S, nid, lvl) {
  const n = S.nations[nid];
  n.taxLvl = clamp(lvl, 0, 4);
  const T = TAX_LEVELS[n.taxLvl];
  addLog(S, '💰', `${n.name}: مالیات «${T.name}» تعیین شد.`);
}
export function startBuild(S, prov, key) {
  const chk = canBuild(S, prov, key);
  if (!chk.ok) return chk;
  prov.queue.push({ key, prog: 0 });
  // پیش‌پرداخت جزئی
  S.nations[prov.owner].treasury -= BUILDINGS[key].cost * 0.05;
  return { ok: true };
}
export function cancelBuild(S, prov, idx) {
  if (prov.queue[idx]) prov.queue.splice(idx, 1);
}
export function startResearch(S, n, key) {
  if (n.tech.includes(key)) return false;
  const t = TECHS[key];
  if (t.prereq && !t.prereq.every(x => n.tech.includes(x))) return false;
  if (n.res.key === key) { n.res = { key: null, pts: 0 }; return true; }
  n.res = { key, pts: n.res.key === key ? n.res.pts : 0 };
  return true;
}
export function lawEnactInfo(S, n, cat, key) {
  const lm = lawModsOf(n);
  // طرفداران/مخالفان از روی تغییر تایید
  const cur = LAWS[cat][n.laws[cat]], next = LAWS[cat][key];
  let sup = 0, opp = 0;
  for (const g in GROUPS) {
    const d = ((next.mods.appr?.[g] || 0) - (cur.mods.appr?.[g] || 0));
    const clout = n.groups[g]?.clout || 0;
    if (d > 0) sup += clout * d; else opp += clout * -d;
  }
  const chance = clamp(0.25 + sup / Math.max(sup + opp, 1) * 0.65, 0.1, 0.9);
  const total = Math.round(26 + (opp / Math.max(sup + 1, 1)) * 40);
  return { chance, total, sup, opp };
}
export function startEnact(S, n, cat, key) {
  if (n.enact || n.laws[cat] === key) return false;
  const L = LAWS[cat][key];
  if (L.tech && !n.tech.includes(L.tech)) return false;
  const info = lawEnactInfo(S, n, cat, key);
  n.enact = { cat, key, prog: 0, total: info.total, chance: () => info.chance };
  addLog(S, '🏛️', `${n.name}: بررسی قانون «${L.name}» آغاز شد.`);
  return true;
}
export function improveRelations(S, a, b) {
  const A = S.nations[a];
  if ((A.improvementCd[b] || 0) > S.week) return { ok: false, why: 'سفیران مشغول‌اند (کمی صبر کنید)' };
  if (A.treasury < 100) return { ok: false, why: 'خزانه کافی نیست (100£)' };
  A.treasury -= 100;
  A.improvementCd[b] = S.week + 20;
  A.rel[b] = clamp(A.rel[b] + 15, -100, 100);
  S.nations[b].rel[a] = clamp(S.nations[b].rel[a] + 15, -100, 100);
  return { ok: true };
}
export function proposePact(S, a, b, kind) {
  const A = S.nations[a], B = S.nations[b];
  const rel = A.rel[b];
  if (kind === 'trade') {
    if (rel < 25) return { ok: false, why: 'روابط باید بیش از ۲۵ باشد' };
    A.pacts[b] = 'trade'; B.pacts[a] = 'trade';
    addLog(S, '🤝', `پیمان تجاری میان ${A.name} و ${B.name} بسته شد.`);
    return { ok: true };
  }
  if (kind === 'ally') {
    if (!A.pacts[b]) return { ok: false, why: 'ابتدا پیمان تجاری لازم است' };
    if (rel < 60) return { ok: false, why: 'روابط باید بیش از ۶۰ باشد' };
    A.pacts[b] = 'ally'; B.pacts[a] = 'ally';
    addLog(S, '🛡️', `اتحاد نظامی میان ${A.name} و ${B.name} منعقد شد.`);
    return { ok: true };
  }
  return { ok: false };
}
export function breakPact(S, a, b) {
  const A = S.nations[a], B = S.nations[b];
  delete A.pacts[b]; delete B.pacts[a];
  A.rel[b] = clamp(A.rel[b] - 20, -100, 100); B.rel[a] = clamp(B.rel[a] - 20, -100, 100);
  addLog(S, '✂️', `پیمان‌های ${A.name} و ${B.name} لغو شد.`);
}
export function declareWar(S, a, d, goal) {
  const A = S.nations[a], D = S.nations[d];
  if (atWar(S, a, d)) return false;
  const w = { id: S.nextWarId++, a, d, goal, score: 0, weeks: 0, allies: [] };
  S.wars.push(w);
  A.wars.push(w.id); D.wars.push(w.id);
  A.rel[d] = -80; D.rel[a] = -80;
  A.dowCd = S.week + 104;
  // اتحادهای متجاوز باطل
  if (A.pacts[d]) { delete A.pacts[d]; delete D.pacts[a]; }
  addLog(S, '🔥', `${A.name} به ${D.name} اعلام جنگ داد! هدف: استان ${S.map.provs[goal]?.name ?? '—'}`);
  if (d === S.playerId) {
    pushDipOffer(S, a, 'wardeclared', w.id);
    S.paused = true;
  }
  // همسایگان نگران
  for (const n of S.nations) {
    if (n.id !== a && n.id !== d) {
      n.rel[a] = clamp(n.rel[a] - 8, -100, 100);
      A.rel[n.id] = clamp(A.rel[n.id] - 2, -100, 100);
    }
  }
  return true;
}
export function pushDipOffer(S, from, kind, warId = null) {
  S.dipOffers = S.dipOffers || [];
  S.dipOffers.push({ id: (S._nextOfferId = (S._nextOfferId || 0) + 1), from, kind, warId, week: S.week, ttl: 26 });
}
function expireOffers(S) {
  if (!S.dipOffers) return;
  S.dipOffers = S.dipOffers.filter(o => {
    if (o.kind === 'peace' || o.kind === 'wardeclared') return o.warId === null || S.wars.some(w => w.id === o.warId);
    return S.week - o.week < o.ttl;
  });
}
export function respondOffer(S, offerId, accept) {
  const o = (S.dipOffers || []).find(x => x.id === offerId);
  if (!o) return;
  S.dipOffers = S.dipOffers.filter(x => x.id !== offerId);
  const A = S.nations[o.from], P = S.nations[S.playerId];
  if (o.kind === 'trade' || o.kind === 'ally') {
    if (accept) {
      A.pacts[P.id] = o.kind; P.pacts[A.id] = o.kind;
      addLog(S, '🤝', `${o.kind === 'trade' ? 'پیمان تجاری' : 'اتحاد'} با ${A.name} پذیرفته شد.`);
    } else {
      A.rel[P.id] = clamp(A.rel[P.id] - 5, -100, 100);
      addLog(S, '❌', `پیشنهاد ${A.name} رد شد.`);
    }
  } else if (o.kind === 'peace') {
    const w = S.wars.find(x => x.id === o.warId);
    if (w && accept) {
      const mine = currentWarScore(S, w, S.playerId);
      const side = warSide(S, w, S.playerId);
      // اگر دشمن منتفع است، پذیرش = تسلیم خواسته‌هاست
      if ((side === 'd' && mine <= -25) || (o.from === w.a && side === 'd' && currentWarScore(S, w, w.a) >= 40)) endWar(S, w, 'enforce');
      else endWar(S, w, 'white');
    }
  } else if (o.kind === 'wardeclared') {
    // فقط اطلاع‌رسانی بود
    S.paused = false;
  }
}
export function playerOfferPeace(S, warId) {
  const w = S.wars.find(x => x.id === warId);
  if (!w) return { ok: false };
  const side = warSide(S, w, S.playerId);
  const foe = S.nations[side === 'a' ? w.d : w.a];
  const myScore = side === 'a' ? w.score : -w.score;
  if (myScore >= 35 && canEnforce(S, w) && side === 'a') { endWar(S, w, 'enforce'); return { ok: true, kind: 'enforce' }; }
  if (myScore >= 35 && side === 'd') { endWar(S, w, 'white'); return { ok: true, kind: 'white' }; }
  // صلح سفید
  const accept = myScore > -25 || (foe.gdp < S.nations[S.playerId].gdp * 0.5);
  if (accept) { endWar(S, w, 'white'); return { ok: true, kind: 'white' }; }
  return { ok: false, why: 'دشمن حاضر به صلح نیست؛ وضعیت میدان را بهبود دهید' };
}
export function createArmy(S, nid, atProv) {
  const n = S.nations[nid];
  const fielded = armiesOf(S, nid).reduce((a, x) => a + x.size, 0);
  const reserve = Math.floor(n.battalions - fielded);
  if (reserve < 1) return { ok: false, why: 'نیروی ذخیره‌ای در دسترس نیست؛ پادگان بسازید' };
  const p = S.map.provs[atProv];
  if (p.owner !== nid || p.controller !== nid) return { ok: false, why: 'فقط در سرزمین خودی' };
  S.armies.push({ id: S.nextArmyId++, n: nid, home: atProv, prov: atProv, size: reserve, org: 85, mor: 85, path: [], status: 'idle' });
  return { ok: true };
}
export function disbandArmy(S, army) {
  const n = S.nations[army.n];
  n.battalions = Math.min(battalionCap(S, n), n.battalions); // نیروها به ذخیره برمی‌گردند (size همین‌جا حذف می‌شود)
  army.size = 0;
}
export function applyEventChoice(S, ev, optIdx) {
  const fx = ev.opts[optIdx].fx;
  const n = S.nations[S.playerId];
  if (fx.money) n.treasury += fx.money;
  if (fx.prestige) n.prestige += fx.prestige;
  if (fx.solAll) { for (const p of S.map.provs) if (p.owner === n.id) p.sol = clamp(p.sol + fx.solAll, 2, 30); }
  if (fx.unrestAll) { for (const p of S.map.provs) if (p.owner === n.id) p.unrest = clamp(p.unrest + fx.unrestAll, 0, 100); }
  if (fx.approval) for (const g in fx.approval) { if (n.groups[g]) n.groups[g].apprBonus = (n.groups[g].apprBonus || 0) + fx.approval[g]; }
  if (fx.approveAll) for (const g in n.groups) n.groups[g].apprBonus = (n.groups[g].apprBonus || 0) + fx.approveAll;
  if (fx.price) for (const g in fx.price) S.goods[g].price = clamp(S.goods[g].price * fx.price[g], GOODS[g].base * 0.28, GOODS[g].base * 5.5);
  if (fx.research) n.res.pts += fx.research;
  if (fx.relAll) for (const m of S.nations) if (m.id !== n.id && m.alive) { n.rel[m.id] = clamp(n.rel[m.id] + fx.relAll, -100, 100); m.rel[n.id] = clamp(m.rel[n.id] + fx.relAll, -100, 100); }
  if (fx.popLoss) { for (const p of S.map.provs) if (p.owner === n.id) for (const c in p.pops) p.pops[c] *= (1 - fx.popLoss); }
  if (fx.boom) n.boom = fx.boom;
  if (fx.strike) n.strike = fx.strike;
  addLog(S, ev.icon, `رویداد «${ev.title}»: ${ev.opts[optIdx].label}`);
  S.pendingEvent = null;
  S.paused = S.pausedBeforeEvent ?? false;
}

// برای AI: رویداد فوری سبک
function aiFlavorEvent(S, n) { /* سبک‌وزن؛ فعلاً غیرفعال */ }

export function aiWeeklyMaintenance(S) { /* رزرو */ }
export function currentWarScore(S, w, nid) {
  const side = warSide(S, w, nid);
  return side === 'a' ? w.score : side === 'd' ? -w.score : 0;
}

// ---------- مأموریت‌ها ----------
export const missionHelpers = {
  countBld(S, n, keys) {
    let c = 0;
    for (const p of S.map.provs) if (p.owner === n.id) for (const k of keys) c += p.bld[k] || 0;
    return c;
  },
  fielded(S, nid) { return armiesOf(S, nid).reduce((a, x) => a + x.size, 0); },
  avgSol(S2, nid) { return avgSol(S2, nid); },
  rankOf(S, nid) { return ranking(S).findIndex(r => r.id === nid) + 1; },
};
function checkMissions(S) {
  const n = S.nations[S.playerId];
  if (!n.alive) return;
  if (!n.missionsDone) n.missionsDone = [];
  for (const m of MISSIONS) {
    if (n.missionsDone.includes(m.id)) continue;
    let p;
    try { p = m.prog(S, missionHelpers, n); } catch (e) { continue; }
    if (p.cur >= p.max) {
      n.missionsDone.push(m.id);
      const R = m.reward;
      if (R.money) n.treasury += R.money;
      if (R.prestige) n.prestige += R.prestige;
      if (R.research) n.res.pts += R.research;
      if (R.solAll) { for (const pv of S.map.provs) if (pv.owner === n.id) pv.sol = clamp(pv.sol + R.solAll, 2, 30); }
      if (R.approval) for (const g in R.approval) { if (n.groups[g]) n.groups[g].apprBonus = (n.groups[g].apprBonus || 0) + R.approval[g]; }
      addLog(S, m.icon, `مأموریت «${m.title}» تکمیل شد!`);
      pushAlert(S, m.icon, `مأموریت «${m.title}» تکمیل شد — پاداش گرفتید`);
    }
  }
}
