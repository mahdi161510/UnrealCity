// ---------- ساخت بازی جدید + ذخیره/بارگذاری ----------
import { genMap } from './mapgen.js';
import { NATION_DEFS, GOODS, BUILDINGS } from './data.js';
import { mulberry32, clamp, pick } from './utils.js';

export const SAVE_KEY = 'unrealcity1836_save_v1';

export function newGame(seed, playerIdx) {
  const map = genMap(seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);

  const nations = NATION_DEFS.map((d, i) => ({
    id: i, name: d.name, adj: d.adj, ruler: d.ruler, pers: d.pers, desc: d.desc,
    c1: d.c1, c2: d.c2, flag: d.flag,
    player: i === playerIdx, alive: true,
    capital: map.capitals[i],
    treasury: 2500 + ((seed >> i) % 7) * 400,
    taxLvl: (d.pers === 'aggressive') ? 3 : 2,
    laws: {
      tax: pick(rng, ['poll', 'land']),
      labor: rng() < 0.55 ? 'serf' : 'poor',
      gov: i % 4 === 1 ? 'constit' : 'absolut',
    },
    enact: null,
    groups: {},
    tech: [], res: { key: null, pts: 0 },
    rel: {}, pacts: {}, wars: [],
    improvementCd: {}, dowCd: 0, revoltCd: 0, buildCd: 0,
    battalions: 0,
    prestige: 0, gdp: 300, solScore: 10,
    ai: { nextThink: Math.floor(rng() * 8) },
    boom: 0, strike: 0,
  }));
  for (const n of nations) for (const m of nations) {
    if (n.id === m.id) continue;
    n.rel[m.id] = Math.round((rng() - 0.42) * 55);
  }

  // استان‌ها: جمعیت + ساختمان‌ اولیه بر اساس زمین و شخصیت ملت
  for (const p of map.provs) {
    const n = nations[p.owner];
    const richness = p.res.farm * 0.65 + p.res.wood * 0.15 + (p.res.iron + p.res.coal) * 0.25 + (p.coast ? 0.2 : 0);
    const base = 22000 + richness * 150000 + rng() * 26000;
    const isCap = p.id === n.capital;
    const pop = Math.round(base * (isCap ? 1.9 : 1) * (n.pers === 'peaceful' ? 1.15 : 1));
    p.provPops = pop;
    p.pops = {
      farmer: pop * 0.52, worker: pop * 0.11, clerk: pop * 0.035,
      capitalist: pop * 0.014, aristocrat: pop * 0.02, soldier: pop * 0.012,
      unemp: pop * 0.289,
    };
    p.bld = {};
    for (const k in BUILDINGS) p.bld[k] = 0;
    // ساختمان‌های آغازین
    p.bld.farm = clamp(Math.round(p.res.farm * 3 + rng() * 2), 0, 5);
    if (p.res.wood > 0.4) p.bld.lumber = rng() < 0.8 ? 1 : 2;
    if (p.res.iron > 0.4) p.bld.iron_mine = rng() < 0.5 ? 1 : 2;
    if (p.res.coal > 0.4 && rng() < 0.6) p.bld.coal_mine = 1;
    if (p.res.farm > 0.5 && rng() < 0.6) p.bld.ranch = 1;
    if (p.coast && rng() < 0.5) p.bld.port = 1;
    if (n.pers === 'industrial') { p.bld.textile = p.res.farm > 0.4 ? 1 : 0; if (isCap) { p.bld.textile = 2; p.bld.tool_work = 1; } }
    if (isCap) {
      p.bld.barracks = Math.max(p.bld.barracks, n.pers === 'aggressive' ? 3 : 2);
      p.bld.university = 1;
      p.bld.textile = Math.max(p.bld.textile, n.pers === 'industrial' ? 2 : 1);
      if (rng() < 0.6) p.bld.tool_work = Math.max(p.bld.tool_work, 1);
      if (rng() < 0.55) p.bld.arms_ind = 1;
      if (rng() < 0.5) p.bld.furniture = 1;
      if (p.coast) p.bld.port = Math.max(p.bld.port, 2);
    } else if (rng() < 0.25) p.bld.barracks = 1;
    else if (rng() < 0.2) p.bld.textile = 1;
    p.queue = [];
    p.unrest = 5 + rng() * 12;
    p.sol = 12 + richness * 8;
    p.employ = {}; // پر می‌شود در sim
    p.devast = 0;
  }

  // گردان‌های آغازین از روی پادگان‌های موجود
  for (const n of nations) {
    let caps = 0;
    for (const p of map.provs) if (p.owner === n.id) caps += p.bld.barracks || 0;
    n.battalions = Math.max(1, Math.round(caps * (n.pers === 'aggressive' ? 1 : 0.6)));
  }

  const state = {
    v: 1, seed, week: 0, tickN: 0,
    speed: 2, paused: true,
    playerId: playerIdx,
    map, nations,
    goods: {},
    armies: [], nextArmyId: 1,
    wars: [], nextWarId: 1,
    battles: [], nextBattleId: 1,
    fx: [],            // افکت‌های موقت رندر (runtime)
    log: [],
    pendingEvent: null,
    eventCd: 20,
    stats: { weeks: 0, gdp: {}, sol: {} },
    victory: false, defeat: false,
  };
  for (const g in GOODS) {
    state.goods[g] = { price: GOODS[g].base * (0.9 + rng() * 0.2), s: 0, d: 0, hist: [] };
    state.stats.gdp[nations[0].id] = [];
  }
  for (const n of nations) { state.stats.gdp[n.id] = []; state.stats.sol[n.id] = []; }

  addLog(state, '📜', `بازی آغاز شد. شما فرمانروای ${nations[playerIdx].name} هستید.`);
  return state;
}

export function addLog(state, icon, text) {
  state.log.push({ w: state.week, icon, text });
  if (state.log.length > 120) state.log.shift();
}

// ---------- ذخیره/بارگذاری (بخش داینامیک) ----------
export function saveGame(state) {
  const dyn = {
    v: state.v, seed: state.seed, week: state.week, playerId: state.playerId,
    nations: state.nations.map(n => ({
      taxLvl: n.taxLvl, laws: n.laws, enact: n.enact, groups: n.groups, tech: n.tech,
      res: n.res, rel: n.rel, pacts: n.pacts, wars: n.wars, treasury: n.treasury,
      battalions: n.battalions, prestige: n.prestige, gdp: n.gdp, alive: n.alive,
      boom: n.boom, strike: n.strike, capital: n.capital, revoltCd: n.revoltCd, dowCd: n.dowCd,
    })),
    provs: state.map.provs.map(p => ({
      owner: p.owner, controller: p.controller, pops: p.pops, bld: p.bld, queue: p.queue,
      unrest: p.unrest, sol: p.sol, devast: p.devast,
    })),
    goods: Object.fromEntries(Object.entries(state.goods).map(([k, g]) => [k, { price: g.price, hist: g.hist.slice(-80) }])),
    armies: state.armies.map(a => ({ id: a.id, n: a.n, prov: a.prov, home: a.home, size: a.size, org: a.org, mor: a.mor, path: a.path, status: a.status, rebel: a.rebel, prog: a.prog })),
    nextArmyId: state.nextArmyId,
    wars: state.wars, nextWarId: state.nextWarId,
    log: state.log.slice(-60), stats: state.stats, victory: state.victory,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(dyn));
}

export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

export function loadGame() {
  const dyn = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (!dyn) return null;
  const state = newGame(dyn.seed, dyn.playerId);
  state.week = dyn.week;
  dyn.nations.forEach((d, i) => Object.assign(state.nations[i], d));
  dyn.provs.forEach((d, i) => Object.assign(state.map.provs[i], d));
  for (const k in dyn.goods) Object.assign(state.goods[k], dyn.goods[k]);
  state.armies = dyn.armies; state.nextArmyId = dyn.nextArmyId;
  state.wars = dyn.wars; state.nextWarId = dyn.nextWarId;
  state.log = dyn.log; state.stats = dyn.stats; state.victory = dyn.victory;
  state.battles = []; state.fx = []; state.pendingEvent = null; state.eventCd = 8;
  return state;
}

export function clearSave() { localStorage.removeItem(SAVE_KEY); }
