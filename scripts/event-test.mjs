// آزمون سامانه‌ی رویداد: یکتایی، سلامت داده، بسته‌بودن زنجیره‌ها،
// و مهم‌تر از همه «هیچ رویدادی در یک بازی دو بار نمی‌آید».
import { readFileSync } from 'fs';
import { EVENTS } from '../src/data.js';
import { newGame } from '../src/state.js';
import { tick, applyEventChoice } from '../src/sim.js';
import { mulberry32 } from '../src/utils.js';

let fail = 0;
const ok = (c, m) => { console.log(c ? `✅ ${m}` : `❌ ${m}`); if (!c) fail++; };
const WEEKS = 64 * 52;

console.log(`— سامانه‌ی رویداد: ${EVENTS.length} رویداد —\n`);

// ---------- ۱) سلامت داده ----------
const ids = EVENTS.map(e => e.id);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
ok(dup.length === 0, `شناسه‌ی تکراری نیست ${dup.length ? '(' + [...new Set(dup)].join(', ') + ')' : ''}`);

const noOpts = EVENTS.filter(e => !e.opts?.length);
ok(noOpts.length === 0, `همه‌ی رویدادها گزینه دارند ${noOpts.length ? '(' + noOpts.map(e => e.id).join(', ') + ')' : ''}`);

const noText = EVENTS.filter(e => !e.text || !e.title);
ok(noText.length === 0, 'همه‌ی رویدادها متن و عنوان دارند');

// متن دوگانه فقط برای رویدادهای تازه‌ی ویکتوریا الزامی است
const vicNew = EVENTS.filter(e => e.tl === 'victoria');
const noT2 = vicNew.filter(e => !e.t2);
ok(noT2.length === 0, `رویدادهای ویکتوریا متن دوگانه دارند (${vicNew.length} رویداد)`);

const badLabel = EVENTS.filter(e => (e.opts || []).some(o => !o.label));
ok(badLabel.length === 0, 'همه‌ی گزینه‌ها برچسب دارند');

// ---------- ۲) اعتبار کلیدهای fx ----------
const simSrc = readFileSync(new URL('../src/sim.js', import.meta.url), 'utf8');
const implemented = new Set([...simSrc.matchAll(/fx\.([A-Za-z][A-Za-z0-9_]*)/g)].map(m => m[1]));
const usedFx = new Set();
for (const e of EVENTS) for (const o of e.opts || []) for (const k in (o.fx || {})) usedFx.add(k);
const missing = [...usedFx].filter(k => !implemented.has(k)).sort();
ok(missing.length === 0, `همه‌ی کلیدهای fx پیاده‌سازی شده‌اند ${missing.length ? '(گمشده: ' + missing.join(', ') + ')' : `(${usedFx.size} کلید)`}`);

// ---------- ۳) بسته‌بودن زنجیره‌ها ----------
const byId = new Map(EVENTS.map(e => [e.id, e]));
const chainRefs = [];
for (const e of EVENTS) {
  if (e.next) chainRefs.push([e.id, e.next.id]);
  for (const o of e.opts || []) if (o.next) chainRefs.push([e.id, o.next.id]);
}
const broken = chainRefs.filter(([, to]) => !byId.has(to));
ok(broken.length === 0, `همه‌ی زنجیره‌ها بسته‌اند ${broken.length ? '(' + broken.map(b => b.join('→')).join(', ') + ')' : `(${chainRefs.length} پیوند)`}`);

const notHidden = chainRefs.filter(([, to]) => byId.get(to) && !byId.get(to).hidden);
ok(notHidden.length === 0, `پرده‌های میانی زنجیره hidden هستند ${notHidden.length ? '(' + notHidden.map(b => b[1]).join(', ') + ')' : ''}`);

// هر رویداد پنهان باید از جایی قابل دسترسی باشد
const reachable = new Set(chainRefs.map(([, to]) => to));
const orphan = EVENTS.filter(e => e.hidden && !reachable.has(e.id));
ok(orphan.length === 0, `رویداد پنهانِ بی‌راه نیست ${orphan.length ? '(' + orphan.map(e => e.id).join(', ') + ')' : ''}`);

// ---------- ۴) سلامت cond ----------
const S0 = newGame(1, { timelineId: 'victoria', scenarioId: 'balance', difficulty: 'normal', nationIdx: 0 });
let condErr = [];
for (const e of EVENTS) {
  if (!e.cond) continue;
  try { e.cond(S0); } catch (err) { condErr.push(e.id + ': ' + err.message); }
}
ok(condErr.length === 0, `همه‌ی شرط‌ها بی‌خطا اجرا می‌شوند ${condErr.length ? '(' + condErr.slice(0, 3).join(' | ') + ')' : ''}`);

// ---------- ۵) قانون «یک بار در هر بازی» ----------
console.log('\n— اجرای بازی‌های کامل —');
const _r = Math.random;
let anyRepeat = 0, totFired = 0, totUniq = 0, minFired = 1e9, chainsSeen = 0;
const SEEDS = [777, 4242, 99, 2024, 55];
for (const seed of SEEDS) {
  Math.random = mulberry32(seed * 31 + 7);
  const S = newGame(seed, { timelineId: 'victoria', scenarioId: 'balance', difficulty: 'normal', nationIdx: 0 });
  S.paused = false;
  const count = {};
  let fired = 0;
  for (let w = 0; w < WEEKS; w++) {
    tick(S);
    if (S.pendingEvent) {
      const id = S.pendingEvent.id;
      count[id] = (count[id] || 0) + 1;
      fired++;
      // یک گزینه‌ی تصادفی را واقعاً اعمال کن تا زنجیره‌ها راه بیفتند
      const ev = S.pendingEvent;
      S.pendingEvent = null;
      try { applyEventChoice(S, ev, Math.floor(Math.random() * ev.opts.length)); } catch (err) { /* در آزمون نادیده */ }
    }
  }
  Math.random = _r;
  // معاف: زمینه‌ای‌ها، انتخابات دوره‌ای، و تولد (هر تولد رویداد تازه‌ای است)
  const EXEMPT = new Set(['election', 'birth']);
  const repeats = Object.entries(count).filter(([id, c]) => c > 1 && !byId.get(id)?.filler && !EXEMPT.has(id));
  const chains = Object.keys(count).filter(id => byId.get(id)?.hidden).length;
  chainsSeen += chains;
  anyRepeat += repeats.length;
  totFired += fired; totUniq += Object.keys(count).length;
  minFired = Math.min(minFired, fired);
  console.log(`  بذر ${String(seed).padStart(4)} → شلیک ${fired} | یکتا ${Object.keys(count).length} | تکرار غیرمجاز ${repeats.length} | پرده‌ی زنجیره ${chains}`);
  if (repeats.length) console.log('     تکراری‌ها:', repeats.map(([id, c]) => `${id}×${c}`).join(', '));
}
Math.random = _r;

ok(anyRepeat === 0, 'هیچ رویداد داستانی در یک بازی دو بار نمی‌آید');
ok(minFired >= 40, `استخر تا پایان بازی خشک نمی‌شود (کمینه‌ی شلیک ${minFired})`);
ok(chainsSeen > 0, `زنجیره‌ها واقعاً راه می‌افتند (${chainsSeen} پرده در ${SEEDS.length} بازی)`);
ok(totUniq / SEEDS.length > 45, `تنوع بالاست (میانگین ${(totUniq / SEEDS.length).toFixed(0)} رویداد یکتا در هر بازی)`);

console.log(`\nمیانگین: ${(totFired / SEEDS.length).toFixed(0)} شلیک، ${(totUniq / SEEDS.length).toFixed(0)} یکتا در هر بازی ۶۴ ساله`);
console.log(fail ? `\n❌ ${fail} ادعا شکست خورد` : '\n✅ همه‌ی ادعاهای سامانه‌ی رویداد موفق');
process.exit(fail ? 1 : 0);
