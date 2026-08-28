// اجرای طولانی v2: ۸۰۰ هفته با فعالیت بازیکن (راه‌آهن، مأموریت، انتخابات)
import { newGame, saveGame } from '../src/state.js';
import * as SIM from '../src/sim.js';

const seed = Number(process.argv[2] || Date.now() % 1000000);
const S = newGame(seed, 0);
const P = S.nations[0];
let events = 0, offers = 0, elections = 0, wars = 0, missions = 0;
const WEEKS = 800;
for (let w = 0; w < WEEKS && !S.gameOver; w++) {
  if (S.pendingEvent) { if (S.pendingEvent.id === 'election') elections++; events++; SIM.applyEventChoice(S, S.pendingEvent, 0); }
  while ((S.dipOffers || []).length) { offers++; SIM.respondOffer(S, S.dipOffers[0].id, Math.random() > 0.5); }
  if (S.bankrupt) SIM.rescueNation(S, S.nations[S.playerId]);
  const before = P.missionsDone.length;
  SIM.tick(S);
  missions += P.missionsDone.length - before;
  if (P.treasury > 300) {
    const own = S.map.provs.filter(p => p.owner === 0);
    const p = own[Math.floor(Math.random() * own.length)];
    const opts = ['railway', 'tools', 'steel_mill', 'woodworks', 'port', 'university'];
    const k = opts[Math.floor(Math.random() * opts.length)];
    if (p.bld[k] !== undefined && SIM.canBuild(S, p, k, 0).ok) SIM.startBuild(S, p, k, 0);
    if (P.battalions >= 2 && !S.armies.some(a => a.n === 0) && Math.random() > 0.5) SIM.createArmy(S, 0, P.capital);
  }
  if (w === 400) { P.laws.gov = 'constit'; P.electionCd = 3; }
  if (S.wars.length) wars = Math.max(wars, S.wars.length);
}
const res = Object.fromEntries(Object.entries(S.goods).map(([k, g]) => [k, g.price.toFixed(1)]));
console.log('seed=' + seed, 'هفته:', S.week, '| قیمت‌ها:', res);
console.log('خزانه', (P.treasury||0).toFixed(0), '| GDP', (P.gdp||0).toFixed(0), '| SoL', SIM.avgSol(S, 0).toFixed(1), '| سواد', (P.literacy || 0).toFixed(0) + '٪', '| رویداد', events, '| انتخابات', elections, '| پیشنهادها', offers, '| مأموریت', missions, '| حداکثر جنگ همزمان', wars);
console.log('مأموریت‌های انجام‌شده:', P.missionsDone.join(',') || '—', '| الحاق:', P.annexed);
const rk = SIM.ranking(S).slice(0, 10);
console.log('صدر جدول:', rk.map(r => (r.player ? '⚑' : '') + r.name + ':' + Math.round(r.prestige)).join(' | '));
console.log('بازیکن زنده؟', P.alive, '|', 'زنده‌ها:', S.nations.filter(n => n.alive).length, '/', S.nations.length);
