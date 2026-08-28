// تست چرخه جنگ: اعلام جنگ، نبرد، اشغال، صلح
import { newGame } from '../src/state.js';
import * as SIM from '../src/sim.js';

const S = newGame(987654321, 0);
const P = S.nations[0];
// ملت همسایه بازیکن را پیدا کن
let foeId = -1;
for (const p of S.map.provs) {
  if (p.owner === 0) {
    for (const q of p.adj) { const o = S.map.provs[q].owner; if (o !== 0) { foeId = o; break; } }
  }
  if (foeId >= 0) break;
}
const F = S.nations[foeId];

// نیرو به هر دو طرف بده
P.battalions = 8; F.battalions = 8;
S.nations[0].treasury = 9000;

// ارتش دو طرف
const pc = P.capital, fc = F.capital;
S.armies.push({ id: S.nextArmyId++, n: 0, home: pc, prov: pc, size: 6, org: 100, mor: 100, path: [], status: 'idle' });
S.armies.push({ id: S.nextArmyId++, n: foeId, home: fc, prov: fc, size: 5, org: 100, mor: 100, path: [], status: 'idle' });

// استان مرزی هدف
let border = null;
for (const p of S.map.provs) if (p.owner === foeId && p.adj.some(q => S.map.provs[q].owner === 0)) { border = p; break; }
if (!border) { console.log('⚠️ مرز مشترک نداریم'); process.exit(1); }

console.log('اعلام جنگ به', F.name, 'برای', border.name);
S.phase = 'ruling'; S.prologue = { step: 10, traits: {}, nextWk: 1e9 }; SIM.declareWar(S, 0, foeId, border.id);
console.log('جنگ‌ها:', S.wars.map(w => ({ a: w.a, d: w.d, goal: w.goal })));

// فرمان حمله
const myArmy = S.armies.find(a => a.n === 0);
const ok = SIM.orderArmy(S, myArmy, border.id);
console.log('مسیر حمله:', ok, myArmy.path?.length ?? 0, 'استان');

let log = [];
for (let w = 0; w < 400 && S.wars.length; w++) {
  SIM.tick(S);
  if (S.pendingEvent) SIM.applyEventChoice(S, S.pendingEvent, 0);
  if (S.dipOffers && S.dipOffers.length) {
    for (const o of [...S.dipOffers]) { SIM.respondOffer(S, o.id, false); }
  }
  if (w % 26 === 0) log.push(`h${S.week} score=${S.wars[0]?.score ?? '-'} battles=${S.battles.length} armies=${S.armies.map(a => `${a.n}:${a.size.toFixed(1)}@${a.prov}${a.status[0]}`).join(' ')} borderCtl=${S.map.provs[border.id].controller}`);
  // اگر ارتشم مُرد ولی ذخیره دارم، دوباره بساز
  if (!S.armies.some(a => a.n === 0) && P.battalions >= 2) SIM.createArmy(S, 0, P.capital);
  // اگر ارتش بیکار است و جنگ ادامه دارد → حمله مجدد
  const a2 = S.armies.find(a => a.n === 0 && a.status === 'idle');
  if (a2 && S.wars.length) SIM.orderArmy(S, a2, border.id);
}
console.log(log.join('\n'));
console.log('جنگ مانده:', S.wars.length);
console.log('صاحب استان هدف:', S.map.provs[border.id].owner, 'کنترل:', S.map.provs[border.id].controller);
console.log('امتیاز نهایی:', S.wars[0]?.score, 'ورودی لاگ جنگ:', S.log.filter(l => l.text.includes('نبرد') || l.text.includes('اشغال') || l.text.includes('صلح') || l.text.includes('ضمیمه')).slice(-8).map(l => l.text));
console.log(S.wars.length === 0 && S.map.provs[border.id].owner === 0 ? '✅ جنگ کامل شد و استان ضمیمه شد' : S.wars.length === 0 ? '🕊️ جنگ با صلح تمام شد' : '❌ جنگ تمام نشد');
