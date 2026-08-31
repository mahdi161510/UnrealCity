// تست سلسله: چند بازی کامل ۶۴ ساله را می‌دواند و می‌سنجد که
// «رویدادهای بزرگ نادر باشند» — دقیقاً همان چیزی که خواسته شده.
import { newGame } from '../src/state.js';
import { tick } from '../src/sim.js';
import { rulerOf, heirOf, DYN_RARITY } from '../src/dynasty.js';
import { mulberry32 } from '../src/utils.js';

// شبیه‌سازی هفتگی از Math.random خام استفاده می‌کند؛ برای آن‌که این آزمون
// تکرارپذیر باشد، Math.random را با یک RNG بذردار جایگزین می‌کنیم.
const _rnd = Math.random;
const seedRandom = (sd) => { const r = mulberry32(sd); Math.random = r; };
const restoreRandom = () => { Math.random = _rnd; };

const WEEKS = 64 * 52;        // کل خط زمانی ویکتوریا: ۱۸۳۶ تا ۱۹۰۰
const RUNS = 3;

let fail = 0;
const ok = (c, m) => { console.log(c ? `✅ ${m}` : `❌ ${m}`); if (!c) fail++; };

console.log(`— ${RUNS} بازی کامل ${WEEKS / 52} ساله —\n`);

const agg = {
  succ: [], crisis: [], pretender: [], revolt: [], union: [],
  marriages: [], assass: [], crises: [], wonders: [], gpChange: [],
};

for (let run = 0; run < RUNS; run++) {
  const seed = 1000 + run * 7717;
  const S = newGame(seed, { timelineId: 'victoria', scenarioId: 'balance', difficulty: 'normal', nationIdx: 0 });
  S.paused = false;

  const seenKings = new Set();
  let crisisCount = 0, pretenderCount = 0, revoltCount = 0, unionCount = 0, assassCount = 0;
  const pn = S.nations[S.playerId];
  seenKings.add(pn.dyn.rulerId);

  for (let w = 0; w < WEEKS; w++) {
    tick(S);
    const k = rulerOf(S, S.playerId);
    if (k) seenKings.add(k.id);
    if (pn.dyn?.succCrisis) { crisisCount++; pn.dyn.succCrisis = false; }
    for (const f of pn.dyn?.factions || []) {
      if (f.pretender && !f._counted) { f._counted = true; pretenderCount++; }
    }
    if (pn.dyn?.pretenderWar && !pn.dyn._warCounted) { pn.dyn._warCounted = true; revoltCount++; }
    if (pn.dyn?.unionWith != null && !pn.dyn._unionCounted) { pn.dyn._unionCounted = true; unionCount++; }
    // پاسخ خودکار به رویدادها تا بازی گیر نکند
    if (S.pendingEvent) S.pendingEvent = null;
  }

  for (const r of S.royals) if (r.deathCause?.includes('ترور')) assassCount++;

  agg.succ.push(seenKings.size - 1);
  agg.crisis.push(crisisCount);
  agg.pretender.push(pretenderCount);
  agg.revolt.push(revoltCount);
  agg.union.push(unionCount);
  agg.assass.push(assassCount);
  agg.marriages.push(Object.keys(pn.dyn?.marriages || {}).length);
  agg.crises.push((S.crises || []).length);
  agg.wonders.push((S.wonders || []).filter(w => w.done).length);
  agg.gpChange.push(S.nations.filter(n => n.greatPower).length);

  const k = rulerOf(S, S.playerId);
  console.log(`اجرا ${run + 1}: ${seenKings.size - 1} جانشینی | ${crisisCount} بحران جانشینی | ` +
    `${pretenderCount} مدعی | ${revoltCount} شورش | ${assassCount} ترور | ` +
    `${Object.keys(pn.dyn?.marriages || {}).length} وصلت | پادشاه پایانی: ${k ? k.name + ' (' + k.age + ')' : 'ندارد'}`);
}

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const mx = a => Math.max(...a);

console.log('\n— میانگین در یک بازی ۶۴ ساله —');
console.log(`جانشینی: ${avg(agg.succ).toFixed(1)}  (انتظار ۱ تا ۳)`);
console.log(`بحران جانشینی: ${avg(agg.crisis).toFixed(2)}  (باید کم باشد)`);
console.log(`ظهور مدعی: ${avg(agg.pretender).toFixed(2)}  (باید نادر باشد)`);
console.log(`شورش خاندان: ${avg(agg.revolt).toFixed(2)}  بیشینه ${mx(agg.revolt)}  (هدف: ۰ تا ۱)`);
console.log(`ترور پادشاه: ${avg(agg.assass).toFixed(2)}  (باید بسیار نادر باشد)`);
console.log(`اتحاد تاجی: ${avg(agg.union).toFixed(2)}  (باید بسیار نادر باشد)`);
console.log(`وصلت سلطنتی: ${avg(agg.marriages).toFixed(1)}`);
console.log(`بحران بین‌المللی: ${avg(agg.crises).toFixed(1)}`);
console.log(`بنای عظیم ساخته‌شده: ${avg(agg.wonders).toFixed(1)}`);

console.log('\n— ادعاها —');
ok(avg(agg.succ) >= 0.8 && avg(agg.succ) <= 4.5, `جانشینی در بازه‌ی منطقی است (${avg(agg.succ).toFixed(1)})`);
ok(mx(agg.succ) <= 7, `هیچ بازی‌ای پادشاه‌های پیاپی بی‌رویه ندارد (بیشینه ${mx(agg.succ)})`);
ok(avg(agg.revolt) <= 1.2, `شورش خاندان نادر است (میانگین ${avg(agg.revolt).toFixed(2)})`);
ok(mx(agg.revolt) <= 3, `حتی بدترین بازی هم غرق شورش نیست (بیشینه ${mx(agg.revolt)})`);
ok(avg(agg.assass) <= 0.8, `ترور بسیار نادر است (میانگین ${avg(agg.assass).toFixed(2)})`);
ok(avg(agg.pretender) <= 2.5, `مدعیان نادرند (میانگین ${avg(agg.pretender).toFixed(2)})`);
ok(agg.succ.every(v => v > 0), 'در هر بازی دست‌کم یک جانشینی رخ می‌دهد (پادشاه جاودانه نیست)');

// ---- آزمون تفاضلی: حکومت بد باید پیامد داشته باشد، حکومت خوب نباید ----
console.log('\n— آزمون تفاضلی: حکومت خوب در برابر حکومت بد —');
function govRun(bad, seed) {
  seedRandom(seed * 7 + 13);
  const S = newGame(seed, { timelineId: 'victoria', scenarioId: bad ? 'ironstorm' : 'balance', difficulty: 'normal', nationIdx: 0 });
  S.paused = false;
  const pn = S.nations[0];
  let pret = 0, rev = 0;
  for (let w = 0; w < WEEKS; w++) {
    tick(S);
    if (S.pendingEvent) S.pendingEvent = null;
    if (bad) pn.taxLvl = 4;                       // مالیات خفه‌کننده
    for (const f of pn.dyn?.factions || []) if (f.pretender && !f._c) { f._c = true; pret++; }
    if (pn.dyn?.pretenderWar && !pn.dyn._w) { pn.dyn._w = true; rev++; }
  }
  const out = { pret, rev, loy: (pn.dyn?.factions || []).map(f => Math.round(f.loyalty)) };
  restoreRandom();
  return out;
}
// چند بذر، چون یک بازیِ تکی نمایانگر رفتار سامانه نیست
const GOV_SEEDS = [4242, 777, 9001];
const G = { pret: 0, rev: 0, minLoy: 999 }, B = { pret: 0, rev: 0, minLoy: 999 };
for (const sd of GOV_SEEDS) {
  const g = govRun(false, sd), b = govRun(true, sd);
  G.pret += g.pret; G.rev += g.rev; G.minLoy = Math.min(G.minLoy, ...g.loy);
  B.pret += b.pret; B.rev += b.rev; B.minLoy = Math.min(B.minLoy, ...b.loy);
  console.log(`بذر ${sd} | دادگر: ${g.pret} مدعی/${g.rev} شورش، کمینه‌وفاداری ${Math.min(...g.loy)}`
    + ` | ستمگر: ${b.pret} مدعی/${b.rev} شورش، کمینه‌وفاداری ${Math.min(...b.loy)}`);
}
console.log(`جمع ${GOV_SEEDS.length} بازی → دادگر: ${G.pret} مدعی، ${G.rev} شورش`
  + ` | ستمگر: ${B.pret} مدعی، ${B.rev} شورش`);

ok(G.rev === 0, 'فرمانروای دادگر هرگز شورشِ تمام‌عیار خاندان نمی‌بیند');
ok(G.pret <= GOV_SEEDS.length, `زیر حکومت دادگر مدعی هم کمیاب است (${G.pret} در ${GOV_SEEDS.length} بازی)`);
ok(B.pret > G.pret, `ستمگری مدعی می‌سازد (${B.pret} در برابر ${G.pret})`);
ok(B.rev > G.rev, `ستمگری به شورش می‌انجامد (${B.rev} در برابر ${G.rev})`);
ok(B.minLoy < G.minLoy, `وفاداری اشراف زیر ستم پایین‌تر است (${B.minLoy} در برابر ${G.minLoy})`);

// ---- یکتایی بناهای عظیم + نبودِ اسپم وصلت ----
console.log('\n— جهان: بناهای عظیم و وصلت‌ها —');
{
  const S = newGame(777, { timelineId: 'victoria', scenarioId: 'balance', difficulty: 'normal', nationIdx: 0 });
  S.paused = false;
  let marOffers = 0;
  for (let w = 0; w < WEEKS; w++) {
    tick(S);
    if (S.pendingEvent) { if ((S.pendingEvent.id || '').startsWith('royal_marriage')) marOffers++; S.pendingEvent = null; }
  }
  const keys = (S.wonders || []).map(w => w.key);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  const done = (S.wonders || []).filter(w => w.done).length;
  const freeLeft = S.map.provs.filter(p => p.owner < 0).length;
  console.log(`بنای عظیم کامل: ${done} | تکراری: ${dup.length} | پیشنهاد وصلت: ${marOffers} | سرزمین بکر باقی‌مانده: ${freeLeft}`);
  ok(dup.length === 0, 'هر بنای عظیم تنها یک بار در جهان ساخته می‌شود');
  ok(done > 0, 'هوش مصنوعی بناهای عظیم می‌سازد (رقابت واقعی)');
  ok(marOffers <= 20, `پیشنهاد وصلت اسپم نیست (${marOffers} بار در ۶۴ سال)`);
}

console.log(fail ? `\n❌ ${fail} ادعا شکست خورد` : '\n✅ همه‌ی ادعاهای سلسله موفق');
process.exit(fail ? 1 : 0);
