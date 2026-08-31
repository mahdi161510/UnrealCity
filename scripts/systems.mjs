// تست سامانه‌های تازه: شخصیت‌ها، نیروی دریایی، جاسوسی، جامعه و تجارت
import { newGame } from '../src/state.js';
import { tick, applyEventChoice } from '../src/sim.js';
import { charsOf, charById, appointMinister, dismissMinister, cabinetMods, CABINET_KEYS } from '../src/characters.js';
import { startShip, fleetsOf, totalShips, navalStrength, orderFleet, SHIP_CLASSES } from '../src/naval.js';
import { startOp, OPS, networkIn, spyPower } from '../src/espionage.js';
import { MOVE_KEYS, suppressMovement, appeaseMovement } from '../src/society.js';
import { foundCompany, openRoute, setTariff, startColony, colonizable, COMPANY_KEYS, tradeCapacity } from '../src/trade.js';

let fails = 0;
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) fails++; };

const S = newGame(987654321, { timelineId: 'victoria', scenarioId: 'balance', difficulty: 'normal', nationIdx: 0 });
const pn = S.nations[0];

// ---------- شخصیت‌ها ----------
ok(S.chars.length > 50, `شخصیت‌ها ساخته شدند (${S.chars.length})`);
ok(charsOf(S, 0, 'general').length >= 3, `ژنرال‌های بازیکن: ${charsOf(S, 0, 'general').length}`);
ok(charsOf(S, 0, 'admiral').length >= 2, `دریاسالاران: ${charsOf(S, 0, 'admiral').length}`);
ok(charsOf(S, 0, 'minister').length >= 3, `وزیران: ${charsOf(S, 0, 'minister').length}`);
const cm0 = cabinetMods(S, pn);
ok(isFinite(cm0.tax) && isFinite(cm0.stability), 'اثر کابینه عددی معتبر است');

// انتصاب وزیر روی پست خالی
const emptyRole = CABINET_KEYS.find(r => !pn.cabinet[r]);
pn.treasury += 5000;
const cand = charById(S, pn.candidates[0]);
const ap = appointMinister(S, pn, emptyRole, cand.id);
ok(ap.ok && pn.cabinet[emptyRole] === cand.id, `انتصاب «${cand.name}» به ${emptyRole}`);
const before = cabinetMods(S, pn);
dismissMinister(S, pn, emptyRole);
ok(!pn.cabinet[emptyRole], 'برکناری وزیر کار می‌کند');
appointMinister(S, pn, emptyRole, cand.id);

// ---------- جامعه ----------
ok(pn.culture && pn.religion, `فرهنگ ${pn.culture} / مذهب ${pn.religion}`);
ok(typeof pn.stability === 'number' && typeof pn.legitimacy === 'number', 'ثبات و مشروعیت تعریف شده‌اند');
ok(MOVE_KEYS.every(k => pn.movements[k]), `${MOVE_KEYS.length} جنبش سیاسی فعال`);
const provCults = new Set(S.map.provs.map(p => p.culture));
ok(provCults.size >= 2, `تنوع فرهنگی روی نقشه (${provCults.size} فرهنگ)`);

// ---------- تجارت ----------
pn.treasury += 12000;
const fc = foundCompany(S, pn, 'grain_co');
ok(fc.ok && pn.companies.includes('grain_co'), 'تأسیس شرکت بازرگانی');
setTariff(S, pn, 3);
ok(pn.tariff === 3, 'تنظیم تعرفه');
const rt = openRoute(S, pn, 1, 'grain');
ok(rt.ok && pn.routes.length === 1, `گشایش مسیر بازرگانی (${rt.dir})`);
ok(tradeCapacity(S, pn) > 0, `ظرفیت بازرگانی: ${tradeCapacity(S, pn).toFixed(1)}`);

// ---------- نیروی دریایی ----------
ok(S.seaZones.length >= 4, `مناطق دریایی: ${S.seaZones.length}`);
ok(S.fleets.length > 0, `ناوگان‌های آغازین: ${S.fleets.length}`);
const myPort = S.map.provs.find(p => p.owner === 0 && p.coast && (p.bld.port || 0) > 0);
if (myPort) {
  pn.treasury += 5000;
  const sh = startShip(S, myPort, 'frigate');
  ok(sh.ok, `سفارش ناو در بندر ${myPort.name}`);
} else ok(true, 'بازیکن بندر ندارد — رد شد');
ok(navalStrength(S, 0) >= 0, `توان دریایی: ${navalStrength(S, 0).toFixed(1)}`);

// ---------- جاسوسی ----------
pn.treasury += 6000;
const op = startOp(S, pn, 'build_net', 1, null);
ok(op.ok && pn.ops.length === 1, 'شروع عملیات گسترش شبکه');
ok(spyPower(S, pn) > 0, `توان جاسوسی: ${spyPower(S, pn).toFixed(2)}`);

// ---------- اجرای بلندمدت ----------
console.log('\n— اجرای ۴۰۰ هفته —');
let err = null;
for (let w = 0; w < 400; w++) {
  try { tick(S); } catch (e) { err = `هفته ${w}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`; break; }
  if (S.pendingEvent) applyEventChoice(S, S.pendingEvent, 0);
  // NaN checks
  for (const n of S.nations) {
    if (!isFinite(n.treasury) || !isFinite(n.gdp) || !isFinite(n.prestige)) { err = `NaN در ملت ${n.name} هفته ${w}`; w = 1e9; break; }
    if (!isFinite(n.stability) || !isFinite(n.legitimacy)) { err = `NaN در ثبات/مشروعیت ${n.name} هفته ${w}`; w = 1e9; break; }
  }
  for (const g in S.goods) if (!isFinite(S.goods[g].price)) { err = `NaN قیمت ${g} هفته ${w}`; w = 1e9; break; }
}
ok(!err, err || 'شبیه‌سازی ۴۰۰ هفته بدون خطا');

// ---------- نتایج پس از اجرا ----------
console.log('\n— وضعیت پس از ۴۰۰ هفته —');
const alive = S.chars.filter(c => c.alive).length;
const leveled = S.chars.filter(c => c.lvl > 1);
console.log(`شخصیت‌ها: ${S.chars.length} کل / ${alive} زنده / ${leveled.length} ارتقایافته`);
ok(leveled.length > 0, `ژنرال‌ها تجربه گرفتند (بالاترین سطح: ${Math.max(...S.chars.map(c => c.lvl))})`);
const topGen = S.chars.filter(c => c.kind === 'general' && c.battles > 0).sort((a, b) => b.wins - a.wins)[0];
if (topGen) console.log(`  🎖️ برترین ژنرال: ${topGen.name} — سطح ${topGen.lvl}، ${topGen.wins}/${topGen.battles} پیروزی، صفات: ${topGen.traits.join(', ')}`);

const totFleets = S.fleets.length, totShips = S.fleets.reduce((a, f) => a + totalShips(f), 0);
console.log(`ناوگان‌ها: ${totFleets} / کشتی‌ها: ${totShips}`);
ok(totShips > 0, 'کشتی‌ها ساخته و نگهداری شدند');

const opsRun = S.nations.reduce((a, n) => a + (n.ops?.length || 0), 0);
const nets = S.nations.reduce((a, n) => a + Object.keys(n.spyNet || {}).length, 0);
console.log(`عملیات جاری: ${opsRun} / شبکه‌های جاسوسی فعال: ${nets}`);
ok(nets > 0, 'شبکه‌های جاسوسی شکل گرفتند');

console.log('ثبات/مشروعیت ملت‌ها:', S.nations.filter(n => n.alive).slice(0, 5)
  .map(n => `${n.name}: ${Math.round(n.stability)}/${Math.round(n.legitimacy)}`).join(' | '));
const civils = S.nations.filter(n => n.civilWar).length;
console.log(`جنگ‌های داخلی جاری: ${civils}`);
const totalRoutes = S.nations.reduce((a, n) => a + (n.routes?.length || 0), 0);
const totalCos = S.nations.reduce((a, n) => a + (n.companies?.length || 0), 0);
const totalCols = S.map.provs.filter(p => S.nations[p.owner]?.playable !== false).length;
console.log(`مسیرهای بازرگانی: ${totalRoutes} / شرکت‌ها: ${totalCos}`);
ok(totalCos > 0, 'شرکت‌های بازرگانی تأسیس شدند');

console.log('\nخزانه‌ی بازیکن:', Math.round(pn.treasury), '| اعتبار:', Math.round(pn.prestige));
console.log('تراز:', JSON.stringify(Object.fromEntries(Object.entries(pn.ledger || {}).map(([k, v]) => [k, +(+v).toFixed(1)]))));

console.log(fails ? `\n❌ ${fails} تست شکست خورد` : '\n✅ همه‌ی تست‌های سامانه‌ها موفق');
process.exit(fails ? 1 : 0);
