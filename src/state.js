// ---------- ساخت بازی جدید + ذخیره/بارگذاری ----------
import { genMap } from './mapgen.js';
import { genRealMap } from './worldmap.js';
import { NATION_DEFS, GOODS, BUILDINGS, FAMILY_PORTRAITS, DAUGHTER_NAMES, SON_NAMES } from './data.js';
import { timelineById, difficultyById, OTHER_NATION } from './timelines.js';
import { mulberry32, clamp, pick } from './utils.js';
import { initCharacters, charsOf, resetCharUid } from './characters.js';
import { initNavy } from './naval.js';
import { initEspionage } from './espionage.js';
import { initSociety } from './society.js';
import { initTrade } from './trade.js';
import { initDynasty, resetRoyalUid } from './dynasty.js';
import { initWorld } from './world.js';
import { refreshGreatPowers, initCrises } from './greatpower.js';
import { initProjects } from './projects.js';
import { initInfamy } from './infamy.js';
import { initCouncil } from './council.js';

export const SAVE_KEY = 'unrealcity1836_save_v5';

// قوانین آغازین هر خط زمانی (با توجه به روح دوره)
function defaultLaws(tlId, pers, rng) {
  if (tlId === 'modern') return { tax: 'prop', labor: 'unions', gov: pers === 'aggressive' ? 'absolut' : 'repub' };
  if (tlId === 'ww2') return { tax: rng() < 0.5 ? 'land' : 'prop', labor: 'poor', gov: pers === 'aggressive' ? 'absolut' : 'constit' };
  if (tlId === 'ww1') return { tax: rng() < 0.5 ? 'poll' : 'land', labor: 'poor', gov: pers === 'aggressive' ? 'absolut' : 'constit' };
  return { tax: pick(rng, ['poll', 'land']), labor: rng() < 0.55 ? 'serf' : 'poor', gov: rng() < 0.5 ? 'absolut' : 'constit' };
}

// opts: { timelineId, scenarioId, difficulty, nationIdx } — برای سازگاری، عدد هم می‌پذیرد
export function newGame(seed, opts) {
  if (typeof opts === 'number') opts = { nationIdx: opts };
  const tlId = opts.timelineId || 'victoria';
  const tl = timelineById(tlId);
  const diff = difficultyById(opts.difficulty);
  const diffMods = diff.mods;
  const scenario = tl.scenarios ? (tl.scenarios.find(s => s.id === opts.scenarioId) || tl.scenarios[0]) : null;
  const scMods = scenario ? scenario.mods || {} : {};
  const playerIdx = opts.nationIdx ?? 0;
  const real = tl.mapKind === 'real';

  // ---- ملت‌ها ----
  let defs;
  if (real) {
    defs = [...tl.nations, { ...OTHER_NATION, key: 'OTHER' }];
  } else {
    defs = NATION_DEFS.map((d, i) => ({ ...d, key: 'F' + i }));
    if (scMods.allAggressive) defs = defs.map(d => ({ ...d, pers: 'aggressive' }));
  }
  const nations = defs.map((d, i) => ({
    id: i, key: d.key, name: d.name, adj: d.adj, ruler: d.ruler, pers: d.pers, desc: d.desc,
    c1: d.c1, c2: d.c2, flag: d.flag, ideas: d.ideas || null,
    player: i === playerIdx, alive: true, playable: real ? i < tl.nations.length : true,
    capital: 0,
    treasury: Math.round((2500 + ((seed >> i) % 7) * 400) * (diffMods.startMoney || 1) * (scMods.treasuryMult || 1)),
    taxLvl: (d.pers === 'aggressive') ? 3 : 2,
    laws: d.laws || defaultLaws(tlId, d.pers, mulberry32(seed ^ (i * 7919 + 13))),
    enact: null,
    groups: {},
    tech: [], res: { key: null, pts: 0 },
    rel: {}, pacts: {}, wars: [],
    improvementCd: {}, dowCd: 0, revoltCd: 0, buildCd: 0,
    battalions: 0,
    prestige: 0, gdp: 300, solScore: 10,
    literacy: real ? 30 + Math.floor(Math.random() * 25) : 11 + Math.floor(Math.random() * 8) + (i % 4 === 1 ? 6 : 0),
    missionsDone: [], annexed: 0,
    electionCd: 208 + Math.floor(Math.random() * 60),
    warExh: 0,
    personality: null, persMods: {},
    ai: { nextThink: Math.floor(Math.random() * 8) },
    boom: 0, strike: 0,
  }));

  // ---- نقشه ----
  const map = real ? genRealMap(seed, tl) : genMap(seed);
  for (let i = 0; i < nations.length; i++) nations[i].capital = map.capitals[i] ?? 0;

  const rng = mulberry32(seed ^ 0x9e3779b9);
  for (const n of nations) for (const m of nations) {
    if (n.id === m.id) continue;
    n.rel[m.id] = Math.round((rng() - 0.42) * 55);
  }

  // ---- استان‌ها: جمعیت + ساختمان اولیه ----
  for (const p of map.provs) {
    const n = nations[p.owner];
    const richness = p.res.farm * 0.65 + p.res.wood * 0.15 + (p.res.iron + p.res.coal) * 0.25 + (p.coast ? 0.2 : 0);
    const base = 22000 + richness * 150000 + (map.real ? p.cells.length * 900 : 0) + rng() * 26000;
    const isCap = p.id === n.capital;
    const pop = Math.round(base * (isCap ? 1.9 : 1) * (n.pers === 'peaceful' ? 1.15 : 1) * (diffMods.popGrowth || 1) * 0.85);
    p.provPops = pop;
    p.pops = {
      farmer: pop * 0.52, worker: pop * 0.11, clerk: pop * 0.035,
      capitalist: pop * 0.014, aristocrat: pop * 0.02, soldier: pop * 0.012,
      unemp: pop * 0.289,
    };
    p.bld = {};
    for (const k in BUILDINGS) p.bld[k] = 0;
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
    // سناریوی «عصر ماشین»: صنعت پیش‌ساخته
    if (scMods.industry) {
      if (isCap) { p.bld.textile = Math.max(p.bld.textile, 2); p.bld.tool_work = Math.max(p.bld.tool_work, 1); p.bld.steel_mill = 1; p.bld.railway = 1; }
      if (p.res.coal > 0.4) p.bld.coal_mine = Math.max(p.bld.coal_mine, 1);
      if (p.res.iron > 0.4) p.bld.iron_mine = Math.max(p.bld.iron_mine, 1);
    }
    p.queue = [];
    p.unrest = 5 + rng() * 12 + (diffMods.unrestBias || 0);
    p.sol = 12 + richness * 8;
    p.employ = {};
    p.devast = 0;
  }

  // گردان‌های آغازین از روی پادگان‌ها
  for (const n of nations) {
    let caps = 0;
    for (const p of map.provs) if (p.owner === n.id) caps += p.bld.barracks || 0;
    n.battalions = Math.max(1, Math.round(caps * (n.pers === 'aggressive' ? 1 : 0.6)));
  }

  // ---- خانواده‌ی سلطنتی (فقط خط زمانی ویکتوریا) ----
  const fam = [];
  if (tlId === 'victoria') {
    fam.push(
      { id: 1, role: 'father', name: nations[playerIdx].ruler, avatar: FAMILY_PORTRAITS.father, rel: 72, age: 58, alive: true, traits: ['خویشتن‌دار', 'جهان‌دیده'], talkCd: 0, hist: [] },
      { id: 2, role: 'mother', name: 'ملکه ' + pick(rng, ['جهان‌بانو', 'ماه‌دخت', 'تاج‌الملوک', 'شیرین‌بانو']), avatar: FAMILY_PORTRAITS.mother, rel: 80, age: 52, alive: true, traits: ['مهربان', 'تدبیرگر'], talkCd: 0, hist: [] },
      { id: 3, role: 'brother', name: 'شاهزاده ' + pick(rng, SON_NAMES), avatar: FAMILY_PORTRAITS.brother, rel: 42, age: 24, alive: true, traits: ['جاه‌طلب', 'رقابت‌جو'], talkCd: 0, hist: [] },
      { id: 4, role: 'sister', name: 'شاهزاده ' + pick(rng, DAUGHTER_NAMES), avatar: FAMILY_PORTRAITS.sister, rel: 62, age: 20, alive: true, traits: ['زیرک', 'شاعر'], talkCd: 0, hist: [] },
      { id: 5, role: 'vizier', name: 'وزیر ' + pick(rng, ['میرزا کاظم', 'میرزا حسن', 'میرزا تقی', 'میرزا ابوالقاسم']), avatar: FAMILY_PORTRAITS.vizier, rel: 68, age: 55, alive: true, traits: ['با تجربه', 'وفادار'], talkCd: 0, hist: [] },
    );
  }

  const state = {
    v: 3, seed, week: 0, tickN: 0,
    speed: 2, paused: true,
    playerId: playerIdx,
    timelineId: tlId, scenarioId: scenario ? scenario.id : null,
    difficulty: diff.id, diffMods,
    tl, startYear: tl.year, endYear: tl.endYear,
    tlGenNames: tl.genNames,
    map, nations,
    goods: {},
    armies: [], nextArmyId: 1,
    wars: [], nextWarId: 1,
    battles: [], nextBattleId: 1,
    // --- سامانه‌های تازه ---
    chars: [], nextOpId: 1,
    royals: [], royalNews: [], nextRoyalEventId: 1,
    regions: [], wonders: [], crises: [], nextCrisisId: 1,
    fleets: [], nextFleetId: 1, seaZones: [],
    navalBattles: [],
    fx: [],
    log: [],
    pendingEvent: null,
    eventCd: 20,
    evCd: {}, evSeen: {}, evFlags: {}, evProv: null,
    scheduled: [],
    family: fam,
    nextFamId: 6,
    phase: real ? 'ruling' : 'prologue',
    prologue: { step: 0, traits: {}, nextWk: 0 },
    era: real ? 3 : 0,
    stats: { weeks: 0, gdp: {}, sol: {} },
    victory: false, defeat: false, gameOver: false,
    tutorialDone: false,
  };
  for (const g in GOODS) {
    state.goods[g] = { price: GOODS[g].base * (0.9 + rng() * 0.2), s: 0, d: 0, hist: [] };
  }
  for (const n of nations) { state.stats.gdp[n.id] = []; state.stats.sol[n.id] = []; }

  // ---- سامانه‌های تازه: شخصیت‌ها، جامعه، تجارت، جاسوسی، نیروی دریایی ----
  initCharacters(state);
  initSociety(state);
  initTrade(state);
  // --- سلسله، جهان داستان‌دار و قدرت‌های بزرگ (فقط خط ویکتوریا) ---
  resetRoyalUid();
  initWorld(state);
  initDynasty(state);
  initCouncil(state);
  initCrises(state);
  initProjects(state);
  initInfamy(state);
  refreshGreatPowers(state);
  initEspionage(state);
  initNavy(state);

  // سناریوی «عصر ماشین»: پژوهش آغازین
  if (scMods.researchStart) state.nations[playerIdx].res = { key: null, pts: scMods.researchStart };
  // خطوط زمانی واقعی: فناوری‌های پایه‌ی دوره از پیش کشف‌شده‌اند
  if (real) {
    const baseTech = tlId === 'ww1' ? ['mechani', 'steam', 'railway', 'steel', 'rifling', 'artillery', 'logistics', 'banking', 'literacy', 'medicine']
      : tlId === 'ww2' ? ['mechani', 'steam', 'railway', 'steel', 'assembly', 'rifling', 'artillery', 'conscript', 'logistics', 'trench', 'banking', 'literacy', 'medicine', 'romantik', 'chemical']
      : ['mechani', 'steam', 'railway', 'steel', 'assembly', 'electric', 'rifling', 'artillery', 'conscript', 'logistics', 'trench', 'steelnavy', 'banking', 'literacy', 'medicine', 'romantik', 'suffrage', 'welfare', 'chemical', 'drills', 'journalism', 'academy'];
    state.nations[playerIdx].tech = baseTech.slice();
    for (const n of state.nations) if (!n.player) n.tech = baseTech.slice(0, Math.max(4, Math.floor(baseTech.length * (0.6 + Math.random() * 0.4))));
  }

  // رویداد آغازین خطوط زمانی واقعی
  if (real && tl.intro) {
    state.pendingEvent = tl.intro;
    state.pausedBeforeEvent = true;
    state.paused = true;
  }

  addLog(state, '📜', `بازی آغاز شد. شما فرمانروای ${nations[playerIdx].name} هستید (خط زمانی: ${tl.name}).`);
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
    timelineId: state.timelineId, scenarioId: state.scenarioId, difficulty: state.difficulty,
    nations: state.nations.map(n => ({
      taxLvl: n.taxLvl, laws: n.laws, enact: n.enact, groups: n.groups, tech: n.tech,
      res: n.res, rel: n.rel, pacts: n.pacts, wars: n.wars, treasury: n.treasury,
      battalions: n.battalions, prestige: n.prestige, gdp: n.gdp, alive: n.alive,
      projDone: n.projDone, decreeCd: n.decreeCd, industBoost: n.industBoost,
      idleResWk: n.idleResWk, emergWk: n.emergWk,
      infamy: n.infamy,
      boom: n.boom, strike: n.strike, capital: n.capital, revoltCd: n.revoltCd, dowCd: n.dowCd,
      literacy: n.literacy, missionsDone: n.missionsDone, annexed: n.annexed, electionCd: n.electionCd,
      warExh: n.warExh, personality: n.personality, persMods: n.persMods,
      // سامانه‌های تازه
      cabinet: n.cabinet, candidates: n.candidates,
      spyNet: n.spyNet, ops: n.ops, intel: n.intel, grudge: n.grudge, counterBoost: n.counterBoost,
      culture: n.culture, religion: n.religion, stability: n.stability, legitimacy: n.legitimacy,
      movements: n.movements, civilWar: n.civilWar, civilWarCd: n.civilWarCd, lostProvs: n.lostProvs,
      tariff: n.tariff, routes: n.routes, companies: n.companies, colonies: n.colonies,
      dyn: n.dyn, sphere: n.sphere, sphereSince: n.sphereSince,
      greatPower: n.greatPower, gpRank: n.gpRank, powerScore: n.powerScore, ruler: n.ruler,
      council: n.council, corruption: n.corruption, plot: n.plot, heirRisk: n.heirRisk, eduCd: n.eduCd,
    })),
    provs: state.map.provs.map(p => ({
      owner: p.owner, controller: p.controller, pops: p.pops, bld: p.bld, queue: p.queue,
      unrest: p.unrest, sol: p.sol, devast: p.devast,
      culture: p.culture, religion: p.religion, assim: p.assim, sepPressure: p.sepPressure,
      navyQueue: p.navyQueue, blockaded: p.blockaded,
      landmark: p.landmark, rare: p.rare, region: p.region, tribe: p.tribe,
    })),
    chars: state.chars, nextOpId: state.nextOpId,
    fleets: state.fleets, nextFleetId: state.nextFleetId,
    goods: Object.fromEntries(Object.entries(state.goods).map(([k, g]) => [k, { price: g.price, hist: g.hist.slice(-80) }])),
    armies: state.armies.map(a => ({ id: a.id, n: a.n, prov: a.prov, home: a.home, size: a.size, org: a.org, mor: a.mor, path: a.path, status: a.status, rebel: a.rebel, prog: a.prog, gen: a.gen, dig: a.dig })),
    nextArmyId: state.nextArmyId,
    wars: state.wars, nextWarId: state.nextWarId,
    log: state.log.slice(-60), stats: state.stats, victory: state.victory,
    evCd: state.evCd, evSeen: state.evSeen, evFlags: state.evFlags, scheduled: state.scheduled,
    family: state.family, nextFamId: state.nextFamId,
    royals: state.royals, royalNews: state.royalNews,
    regions: state.regions, wonders: state.wonders, projects: state.projects, coalitions: state.coalitions,
    crises: state.crises, nextCrisisId: state.nextCrisisId,
    phase: state.phase, prologue: state.prologue, era: state.era,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(dyn));
}

export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

export function loadGame() {
  const dyn = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (!dyn) return null;
  const state = newGame(dyn.seed, {
    timelineId: dyn.timelineId || 'victoria',
    scenarioId: dyn.scenarioId || null,
    difficulty: dyn.difficulty || 'normal',
    nationIdx: dyn.playerId,
  });
  state.week = dyn.week;
  dyn.nations.forEach((d, i) => Object.assign(state.nations[i], d));
  dyn.provs.forEach((d, i) => Object.assign(state.map.provs[i], d));
  for (const k in dyn.goods) Object.assign(state.goods[k], dyn.goods[k]);
  state.armies = dyn.armies; state.nextArmyId = dyn.nextArmyId;
  state.wars = dyn.wars; state.nextWarId = dyn.nextWarId;
  state.log = dyn.log; state.stats = dyn.stats || state.stats; state.victory = dyn.victory;
  state.stats.gdp = state.stats.gdp || {};
  state.stats.sol = state.stats.sol || {};
  for (const n of state.nations) {
    if (!state.stats.gdp[n.id]) state.stats.gdp[n.id] = [];
    if (!state.stats.sol[n.id]) state.stats.sol[n.id] = [];
    if (!n.missionsDone) n.missionsDone = [];
    if (!n.persMods) n.persMods = {};
  }
  if (dyn.evCd) state.evCd = dyn.evCd;
  if (dyn.evSeen) state.evSeen = dyn.evSeen;
  if (dyn.evFlags) state.evFlags = dyn.evFlags;
  if (dyn.scheduled) state.scheduled = dyn.scheduled;
  if (dyn.family) { state.family = dyn.family; state.nextFamId = dyn.nextFamId || state.nextFamId; }
  if (dyn.phase) state.phase = dyn.phase;
  if (dyn.prologue) state.prologue = dyn.prologue;
  // ---- بازیابی سامانه‌های تازه ----
  if (dyn.chars?.length) {
    state.chars = dyn.chars;
    state.nextOpId = dyn.nextOpId || 1;
    let mx = 0; for (const c of state.chars) mx = Math.max(mx, c.id);
    resetCharUid(mx + 1);
  }
  if (dyn.fleets) { state.fleets = dyn.fleets; state.nextFleetId = dyn.nextFleetId || 1; }
  // ---- سلسله، جهان و بحران‌ها ----
  if (dyn.royals?.length) {
    state.royals = dyn.royals;
    let mr = 0; for (const r of state.royals) mr = Math.max(mr, r.id);
    resetRoyalUid(mr + 1);
  }
  if (dyn.royalNews) state.royalNews = dyn.royalNews;
  if (dyn.regions?.length) state.regions = dyn.regions;
  if (dyn.wonders) state.wonders = dyn.wonders;
  if (dyn.projects) state.projects = dyn.projects;
  if (dyn.coalitions) state.coalitions = dyn.coalitions;
  if (dyn.crises) { state.crises = dyn.crises; state.nextCrisisId = dyn.nextCrisisId || 1; }
  // مقادیر پیش‌فرض برای ذخیره‌های ناقص
  for (const n of state.nations) {
    n.cabinet = n.cabinet || {}; n.candidates = n.candidates || [];
    n.spyNet = n.spyNet || {}; n.ops = n.ops || []; n.intel = n.intel || {}; n.grudge = n.grudge || {};
    n.movements = n.movements || {}; n.routes = n.routes || []; n.companies = n.companies || [];
    n.colonies = n.colonies || [];
    if (n.tariff === undefined) n.tariff = 2;
    if (n.stability === undefined) n.stability = 50;
    if (n.legitimacy === undefined) n.legitimacy = 60;
  }
  state.battles = []; state.fx = []; state.pendingEvent = null; state.eventCd = 8;
  return state;
}

export function clearSave() { localStorage.removeItem(SAVE_KEY); }
