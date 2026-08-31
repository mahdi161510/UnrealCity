// حسابرسی سقف فرزند برای همه‌ی رویال‌های غیرنجیب، همه‌ی ملت‌ها
import { newGame } from '../src/state.js';
import * as SIM from '../src/sim.js';
import { allChildrenOf } from '../src/dynasty.js';

for (const seed of [777, 2024, 99]) {
  const S = newGame(seed,{timelineId:'victoria',scenarioId:'balance',difficulty:'normal',nationIdx:0});
  let worstRuler=0, worstAny=0, worstSame=0, whenR=0, ex=null;
  for (let i=0;i<52*64;i++) {
    SIM.tick(S);
    const rid = S.nations[S.playerId].dyn?.rulerId;
    const k = rid!=null ? S.royals.find(r=>r.id===rid) : null;
    if (k) { const c=allChildrenOf(S,k).length; if(c>worstRuler){worstRuler=c;whenR=1836+Math.floor(i/52);} }
    if (i%52===0) for (const r of S.royals) {
      if (r.isNoble) continue;
      const kids=allChildrenOf(S,r);
      if (kids.length>worstAny){worstAny=kids.length; ex={name:r.name,nat:r.nation,kids:kids.map(c=>(c.male?'پسر':'دختر')+' '+c.name)};}
      const s=Math.max(kids.filter(c=>c.male).length, kids.filter(c=>!c.male).length);
      if(s>worstSame) worstSame=s;
    }
  }
  console.log(`بذر ${String(seed).padEnd(5)} | شاهِ بازیکن بیشینه: ${worstRuler} فرزند (سال ${whenR}) | هر رویال غیرنجیب بیشینه: ${worstAny} | بیشینه هم‌جنس: ${worstSame}`);
  if (ex && worstAny>2) console.log('   نمونه‌ی تخلف:', ex.name, '(ملت '+ex.nat+') →', ex.kids.join('، '));
}
