// تست طولانی ۸۰۰ هفته: ثبات اقتصاد، رَیت، مراسم، ماموریت‌ها
import { newGame } from '../src/state.js';
import * as SIM from '../src/sim.js';
import { ranking } from '../src/sim.js';

const SEEDS = [424242, 111];
for (const seed of SEEDS) {
  const S = newGame(seed, 0);
  S.nations[0].treasury = 50000;
  let events = 0, wars = 0, battles = 0, crowns = 0, prologueEvs = 0, famEvs = 0;
  const traces = [];
  for (let w = 0; w < 800; w++) {
    SIM.tick(S);
    if (S.pendingEvent) {
      events++;
      if (S.pendingEvent.id.startsWith('pr')) prologueEvs++;
      if (['bro_plot', 'sis_wed', 'birth', 'viz_scheme', 'mother_charity', 'spouse_idle' , 'bro_duel'].includes(S.pendingEvent.id)) famEvs++;
      SIM.applyEventChoice(S, S.pendingEvent, S.pendingEvent.opts.length - 1);
    }
    if (S.phase === 'ruling' && S.prologue.step < 10) { crowns++; S.prologue.step = 10; }
    if (w % 200 === 199) {
      const me = S.nations[S.playerId];
      const myProvs = S.map.provs.filter(p => p.owner === S.playerId);
      const solAvg = myProvs.length ? myProvs.reduce((a, p) => a + (p.sol || 0), 0) / myProvs.length : 0;
      traces.push({ week: S.week, year: 1836 + ~~(S.week / 48), era: S.era, money: Math.round(me.treasury), sol: +solAvg.toFixed(1), provs: myProvs.length, wars: S.wars.length, techs: (me.techs || []).length });
    }
  }
  const me = S.nations[S.playerId];
  const alive = S.nations.filter(n => n.provs ? n.provs.length : true).length;
  console.log(`seed=${seed} | هفته=${S.week} (${1836 + ~~(S.week / 48)}م) | رویداد=${events} (آغازنامه ${prologueEvs}, خانواده ${famEvs}) | فاز=${S.phase} | زنده‌های خانواده=${S.family.filter(m=>m.alive).length}`);
  console.log('  رده‌بندی:', ranking(S).map(n => `${n.name}:${n.prestige | 0}`).slice(0, 4).join(' | '));
  console.log(`  نبرد دریافت‌شده در لاگ: ${S.log.filter(l => (l.text || '').includes('نبرد')).length} | جنگ‌های فعال: ${S.wars.length} | ملت‌های زنده: ${alive}/${S.nations.length}`);
  console.log('  ردپا:', JSON.stringify(traces));
}
console.log('✅ longrun v3');
