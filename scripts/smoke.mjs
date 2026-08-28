// تست دود: تولید بازی و اجرای ۱۵۰ هفته شبیه‌سازی
import { newGame } from '../src/state.js';
import { tick, ranking, nationPop, battalionCap } from '../src/sim.js';
import { GOODS } from '../src/data.js';

const S = newGame(123456789, 0);
console.log('🗺️ تعداد استان‌ها:', S.map.provs.length);
const owners = {};
for (const p of S.map.provs) owners[p.owner] = (owners[p.owner] || 0) + 1;
console.log('مالکیت:', owners);
const b4 = S.map.provs.filter(p => p.owner === 4);
console.log('نمونه استان:', JSON.stringify({ name: b4[0].name, terrain: b4[0].terrain, pops: b4[0].pops.farmer | 0, bld: b4[0].bld.farm }));

let bad = 0;
for (let w = 0; w < 156; w++) {
  try {
    S.week += 0; tick(S);
  } catch (e) {
    console.error('❌ خطا در هفته', w, e);
    bad++; break;
  }
  if (S.pendingEvent) {
    const { applyEventChoice } = await import('../src/sim.js');
    applyEventChoice(S, S.pendingEvent, 0);
  }
  // هر از گاهی اقدام‌های بازیکن
  if (w === 4) {
    const { startResearch, startEnact, createArmy } = await import('../src/sim.js');
    const pn = S.nations[0];
    startResearch(S, pn, 'literacy');
    startEnact(S, pn, 'tax', pn.laws.tax === 'poll' ? 'land' : 'poll');
    createArmy(S, 0, pn.capital);
  }
  if (w === 30) {
    const p = S.map.provs.find(p => p.owner === 0);
    const { startBuild } = await import('../src/sim.js');
    startBuild(S, p, 'farm');
    startBuild(S, p, 'textile');
  }
  // چک NaN
  const pn = S.nations[0];
  if (!isFinite(pn.treasury) || !isFinite(pn.gdp)) { console.error('❌ NaN در خزانه/GDP هفته', w, pn.treasury, pn.gdp); bad++; break; }
  for (const g in S.goods) if (!isFinite(S.goods[g].price)) { console.error('❌ NaN قیمت', g, 'هفته', w); bad++; w = 1e9; break; }
}

console.log('\n— پس از ۱۵۶ هفته —');
console.log('هفته:', S.week);
const pn = S.nations[0];
console.log('بازیکن:', { خزانه: pn.treasury | 0, gdp: pn.gdp | 0, اعتبار: pn.prestige | 0, جمعیت: nationPop(S, 0) | 0, tech: pn.tech.length, laws: pn.laws });
console.log('قیمت‌ها:', Object.fromEntries(Object.entries(S.goods).map(([k, v]) => [k, +v.price.toFixed(1)])));
console.log('تراز خزانه:', pn.ledger);
console.log('جنگ‌ها:', S.wars.length, 'ارتش‌ها:', S.armies.length, 'نبردها:', S.battles.length);
console.log('رتبه‌بندی:', ranking(S).map(n => `${n.name}:${n.prestige | 0}`).join(' | '));
console.log('رویدادهای لاگ:', S.log.length);
console.log('سول نمونه:', S.map.provs.filter(p => p.owner === 0).slice(0, 3).map(p => (+p.sol.toFixed(1)) + '/' + (+p.unrest.toFixed(0))));
console.log(bad ? '❌ تست با خطا' : '✅ تست موفق');
