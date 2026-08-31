// آزمون سامانه‌های نسخه‌ی ۳: پروژه‌های ملی، فرمان‌ها، بدنامی، وضعیت بحرانی.
import { newGame } from '../src/state.js';
import { tick, applyEventChoice, emergencyReport } from '../src/sim.js';
import { PROJECTS, PROJECT_KEYS, DECREES, DECREE_KEYS, canStartProject, startProject, issueDecree, projectMods } from '../src/projects.js';
import { INF_COALITION, infamyLabel } from '../src/infamy.js';
import { ENDINGS, pickEnding } from '../src/projects.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const mk = (seed) => newGame(seed, { timelineId: 'victoria', scenario: 'balance', diff: 'normal', nationIdx: 0 });
const run = (S, wk) => { for (let w = 0; w < wk; w++) { tick(S); if (S.pendingEvent) applyEventChoice(S, S.pendingEvent, 0); } };

// ---------- سلامت داده ----------
console.log('\n— سلامت داده‌ی پروژه‌ها و فرمان‌ها —');
{
  let bad = 0;
  for (const k of PROJECT_KEYS) {
    const P = PROJECTS[k];
    if (!P.name || !P.icon || !P.desc || !P.cost || !P.weeks || !P.mods) bad++;
    if (Object.keys(P.mods).length === 0) bad++;
  }
  ok(bad === 0, `هر ${PROJECT_KEYS.length} پروژه نام، آیکون، شرح، هزینه، مدت و بونوس دارد`);
  let bd = 0;
  for (const k of DECREE_KEYS) { const D = DECREES[k]; if (!D.name || !D.cd || typeof D.run !== 'function') bd++; }
  ok(bd === 0, `هر ${DECREE_KEYS.length} فرمان سلطنتی کامل است`);
  // هزینه‌ها باید در مقیاس بازی معنادار باشند
  const weeklies = PROJECT_KEYS.map(k => Math.ceil(PROJECTS[k].cost / PROJECTS[k].weeks));
  ok(Math.min(...weeklies) >= 80 && Math.max(...weeklies) <= 400,
    `اقساط هفتگی در بازه‌ی منطقی است (${Math.min(...weeklies)}–${Math.max(...weeklies)})`);
}

// ---------- پروژه واقعاً کامل می‌شود و بونوس می‌دهد ----------
console.log('\n— چرخه‌ی کامل یک پروژه —');
{
  const S = mk(777);
  const n = S.nations[S.playerId];
  n.treasury = 80000;
  const r = startProject(S, n, 'university');
  ok(r.ok, 'پروژه آغاز می‌شود');
  run(S, 60);
  // خزانه از مالیات هم پر می‌شود، پس مبلغ پرداختیِ خودِ پروژه را می‌سنجیم
  const pr = S.projects.find(p => p.nid === n.id && p.key === 'university');
  ok(pr && pr.paid > 0, `اقساط پرداخت می‌شود (${Math.round(pr?.paid || 0)} تا اینجا)`);
  run(S, 200);
  ok((n.projDone || []).includes('university'), 'پروژه پس از مدت مقرر کامل می‌شود');
  const m = projectMods(S, n);
  ok((m.research || 0) > 0 && (m.literacy || 0) > 0, 'بونوس دائمی پس از پایان اعمال می‌شود');
  // دوباره‌سازی ممنوع
  ok(!canStartProject(S, n, 'university').ok, 'پروژه‌ی کامل‌شده دوباره ساخته نمی‌شود');
}

// ---------- سقف دو پروژه‌ی هم‌زمان ----------
console.log('\n— سقف هم‌زمانی —');
{
  const S = mk(99);
  const n = S.nations[S.playerId];
  n.treasury = 200000;
  const started = [];
  for (const k of PROJECT_KEYS) if (startProject(S, n, k).ok) started.push(k);
  ok(started.length === 2, `بیش از دو پروژه‌ی هم‌زمان ممکن نیست (${started.length})`);
}

// ---------- فرمان سلطنتی و کول‌داون ----------
console.log('\n— فرمان‌های سلطنتی —');
{
  const S = mk(4242);
  const n = S.nations[S.playerId];
  n.treasury = 90000;
  const bat = n.battalions;
  const r1 = issueDecree(S, n, 'mobilize');
  ok(r1.ok && n.battalions > bat, `بسیج عمومی گردان می‌افزاید (${bat} → ${n.battalions})`);
  const r2 = issueDecree(S, n, 'mobilize');
  ok(!r2.ok, 'همان فرمان بلافاصله دوباره صادر نمی‌شود (کول‌داون)');
  run(S, 40);
  ok((n.decreeCd.mobilize || 0) < DECREES.mobilize.cd, 'کول‌داون با گذر زمان کم می‌شود');
}

// ---------- بدنامی: کمیاب ولی واقعی ----------
console.log('\n— بدنامی و ائتلاف مهار (۴ بازی کامل) —');
{
  let coalTotal = 0, maxInf = 0, peaceful = 0, games = 0;
  for (const seed of [777, 2024, 99, 4242, 55, 31337]) {
    const S = mk(seed);
    // بدنامی با زمان ترمیم می‌شود، پس اوج را حین بازی می‌سنجیم نه در پایان
    for (let w = 0; w < 3328; w++) {
      tick(S);
      if (S.pendingEvent) applyEventChoice(S, S.pendingEvent, 0);
      for (const n of S.nations) maxInf = Math.max(maxInf, n.infamy || 0);
    }
    games++;
    const c = (S.coalitions || []).length;
    coalTotal += c;
    // کشور آرام نباید بدنام شود
    const calm = S.nations.filter(n => n.alive && (n.annexed || 0) === 0);
    if (calm.every(n => (n.infamy || 0) < 30)) peaceful++;
  }
  const avg = coalTotal / games;
  console.log(`  میانگین ائتلاف: ${avg.toFixed(2)} در هر بازی | بیشینه بدنامی: ${Math.round(maxInf)}`);
  // ائتلاف عمداً کمیاب است؛ روی ۶ بذر ممکن است صفر تا چند بار رخ دهد.
  // چیزی که باید تضمین شود: هرگز سیل‌آسا نشود.
  ok(avg <= 3.5, `ائتلاف مهار سیل‌آسا نیست (${avg.toFixed(2)} در هر بازی)`);
  ok(maxInf >= INF_COALITION * 0.7, `توسعه‌طلبی واقعاً بدنامی می‌آورد (بیشینه ${Math.round(maxInf)})`);
  ok(peaceful === games, 'کشوری که خاکی ضمیمه نکرده بدنام نمی‌شود');
}

// ---------- وضعیت بحرانی ----------
console.log('\n— وضعیت بحرانی —');
{
  const S = mk(777);
  const n = S.nations[S.playerId];
  const r0 = emergencyReport(S);
  ok(r0 && r0.score === 0, 'کشور سالم در آغاز بحرانی نیست');
  // کشور را عمداً به فروپاشی ببر
  for (const p of S.map.provs) if (p.owner === n.id) { p.unrest = 100; p.devast = 10; }
  n.stability = 2; n.legitimacy = 8; n.treasury = -20000;
  const r1 = emergencyReport(S);
  ok(r1.score >= 6, `کشور فروپاشیده شدت بالا می‌گیرد (${r1.score})`);
  ok(r1.woes.length >= 3, `نشانه‌های بحران فهرست می‌شوند (${r1.woes.length})`);
}

// ---------- بازیکن رهاشده باید ببازد ----------
console.log('\n— بازخورد فروپاشی —');
{
  // بازیکنی که هیچ نمی‌کند باید بازخورد بگیرد و اگر واقعاً فرو پاشید، ببازد.
  // همه‌ی بذرها به فروپاشی نمی‌رسند (بعضی کشورها موقعیت امن‌تری دارند)،
  // پس شرط را به «هرجا شدت بالا رفت، باخت هم رخ داد» گره می‌زنیم.
  let techAlert = false, collapsed = 0, defeated = 0, emergSeen = 0;
  for (const seed of [777, 2024, 99]) {
    const S = mk(seed);
    let peak = 0, defeatWk = null, firstDeep = null;
    for (let w = 0; w < 3328 && !defeatWk; w++) {
      tick(S);
      if (S.pendingEvent) applyEventChoice(S, S.pendingEvent, 0);
      for (const a of (S.pendingAlerts || [])) if (a.icon === '🔬') techAlert = true;
      S.pendingAlerts = [];
      const r = emergencyReport(S);
      if (r) { peak = Math.max(peak, r.score); if (r.score >= 6 && firstDeep === null) firstDeep = w; }
      if (S.emergency) emergSeen++;
      if (S.defeat) defeatWk = w;
    }
    // شمارش فقط وقتی معنا دارد که دست‌کم ۴ سال (۲۰۸ هفته) برای شمارش مانده باشد
    if (peak >= 6 && firstDeep !== null && firstDeep < 3328 - 208) {
      collapsed++;
      if (defeatWk !== null) defeated++;
    }
  }
  ok(techAlert, 'آزمایشگاه بیکار هشدار می‌دهد');
  ok(emergSeen > 0, `وضعیت بحرانی تشخیص داده می‌شود (${emergSeen} هفته)`);
  // فروپاشی به مسیر بازی بستگی دارد و همیشه رخ نمی‌دهد؛ چیزی که باید
  // تضمین شود این است که هیچ فروپاشیِ واقعی بدون اعلام باخت نماند.
  ok(defeated === collapsed,
    `هیچ فروپاشیِ واقعی بی‌پاسخ نماند (${defeated}/${collapsed})`);
}

// ---------- AI هم رقابت می‌کند ----------
console.log('\n— رقابت هوش مصنوعی (بدون تقلب) —');
{
  const S = mk(2024);
  run(S, 3328);
  const aiDone = S.nations.filter(n => !n.player).reduce((a, n) => a + (n.projDone || []).length, 0);
  console.log(`  پروژه‌های کامل‌شده‌ی AI: ${aiDone}`);
  ok(aiDone >= 5, `هوش مصنوعی هم پروژه‌ی ملی می‌سازد (${aiDone})`);
}

// ---------- پایان‌های چندگانه ----------
console.log('\n— پایان‌های چندگانه —');
{
  const cases = [
    ['امپراتوری جهانی', { rank: 1, provShare: 0.30, gdpShare: 0.2, techShare: 1, literacy: 60, projects: 3, infamy: 60, annexed: 9, alive: true, defeat: false }],
    ['قدرت صنعتی', { rank: 2, provShare: 0.10, gdpShare: 0.25, techShare: 0.8, literacy: 50, projects: 2, infamy: 5, annexed: 0, alive: true, defeat: false }],
    ['مشعل‌دار تمدن', { rank: 2, provShare: 0.08, gdpShare: 0.12, techShare: 1, literacy: 70, projects: 2, infamy: 0, annexed: 0, alive: true, defeat: false }],
    ['معمار ملت', { rank: 4, provShare: 0.09, gdpShare: 0.1, techShare: 0.7, literacy: 40, projects: 5, infamy: 0, annexed: 0, alive: true, defeat: false }],
    ['وجدان جهان', { rank: 3, provShare: 0.08, gdpShare: 0.1, techShare: 0.6, literacy: 40, projects: 1, infamy: 2, annexed: 0, alive: true, defeat: false }],
    ['بازمانده‌ی سرافراز', { rank: 8, provShare: 0.04, gdpShare: 0.02, techShare: 0.4, literacy: 20, projects: 0, infamy: 0, annexed: 0, alive: true, defeat: false }],
    ['فروپاشی', { rank: 10, provShare: 0, gdpShare: 0, techShare: 0.1, literacy: 10, projects: 0, infamy: 0, annexed: 0, alive: false, defeat: true }],
  ];
  const fallen = ENDINGS.find(e => e.key === 'fallen');
  let hit = 0;
  for (const [want, st] of cases) {
    const got = fallen.test(st) ? fallen : ENDINGS.find(e => e.key !== 'fallen' && e.test(st));
    if (got && got.title === want) hit++;
    else console.log(`     ${want} → ${got ? got.title : 'هیچ'}`);
  }
  ok(hit === cases.length, `هر ${cases.length} پایان درست تفکیک می‌شود`);
  ok(ENDINGS.every(e => e.icon && e.title && e.text && typeof e.test === 'function'), 'همه‌ی پایان‌ها متن و آیکون دارند');
  // پایان واقعی از یک بازی کامل
  const S = mk(777);
  run(S, 3328);
  const e = pickEnding(S);
  ok(e && e.title, `بازی کامل پایان می‌گیرد: ${e.icon} ${e.title}`);
  ok(e.stats && typeof e.stats.rank === 'number', 'کارنامه‌ی عددی تولید می‌شود');
}

console.log(`\nنتیجه: ${pass} ✅ / ${fail} ❌`);
process.exit(fail ? 1 : 0);
