// آزمون چیدمان: هیچ دکمه‌ای نباید بیرون از صفحه یا زیر عنصر دیگر بیفتد.
// jsdom چیدمان واقعی محاسبه نمی‌کند، پس هندسه‌ی flex را از روی CSS
// بازسازی می‌کنیم و همان قواعدی را می‌سنجیم که در مرورگر اعمال می‌شوند.
import fs from 'fs';

const css = fs.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

const N_DOCK = (html.match(/class="dock-btn"/g) || []).length;
const BTN = 42, GAP = 6, TOP = 54, BOT = 10;

// --- ۱) CSS داک باید اجازه‌ی شکستن به ستون بدهد ---
console.log('\n— قواعد CSS داک —');
const dockCss = (css.match(/#dock\s*\{[^}]*\}/) || [''])[0];
ok(/flex-wrap:\s*wrap/.test(dockCss), 'داک flex-wrap: wrap دارد');
ok(!/top:\s*50%/.test(dockCss), 'داک دیگر با top:50% وسط‌چین ثابت نیست');
ok(/top:\s*54px/.test(dockCss) && /bottom:/.test(dockCss), 'داک به بالا و پایین مقید است (ارتفاع واقعی می‌گیرد)');
ok(/overflow:\s*auto/.test(dockCss), 'در بدترین حالت داک اسکرول می‌شود');

// --- ۲) شبیه‌سازی هندسه‌ی ستون‌بندی روی نمایشگرهای واقعی ---
console.log('\n— جاگیری ' + N_DOCK + ' دکمه‌ی داک —');
const screens = [[1280, 720, 'لپ‌تاپ ۱۳'], [1366, 768, 'لپ‌تاپ رایج'], [1440, 900, 'لپ‌تاپ بزرگ'], [1920, 1080, 'فول‌اچ‌دی'], [1600, 600, 'پنجره‌ی کوتاه']];
for (const [vw, vh, name] of screens) {
  const avail = vh - TOP - BOT;
  const perCol = Math.max(1, Math.floor((avail + GAP) / (BTN + GAP)));
  const cols = Math.ceil(N_DOCK / perCol);
  const usedH = Math.min(perCol, N_DOCK) * BTN + (Math.min(perCol, N_DOCK) - 1) * GAP;
  const fits = usedH <= avail && cols * BTN + (cols - 1) * GAP < vw * 0.5;
  ok(fits, `${name} (${vw}×${vh}): ${cols} ستون × حداکثر ${perCol} دکمه — همه‌ی ${N_DOCK} دکمه در صفحه`);
}

// --- ۳) رگرسیون: چیدمان قدیمی باید روی صفحه‌ی کوتاه رد شود ---
console.log('\n— بازآزمون باگ اصلی —');
const oldH = N_DOCK * BTN + (N_DOCK - 1) * GAP;
ok(oldH > 720 - TOP - BOT, `چیدمان تک‌ستونی قدیمی ${oldH}px بود و روی ۷۲۰p سرریز می‌کرد (باگ بازتولید شد)`);

// --- ۴) نوار مُدهای نقشه ---
console.log('\n— نوار مُدهای نقشه —');
const mmCss = (css.match(/#mapmodes\s*\{[^}]*\}/) || [''])[0];
ok(/flex-wrap:\s*wrap/.test(mmCss), 'نوار مُدها می‌شکند');
ok(!/right:\s*50%/.test(mmCss), 'دیگر با ترفند right:50% از عرض صفحه بیرون نمی‌زند');
ok(/left:\s*208px/.test(mmCss), 'حاشیه‌ی مینی‌مپ (چپ) رعایت شده');
ok(/var\(--dock-w/.test(mmCss), 'حاشیه‌ی داک (راست) رعایت شده');

// --- ۵) پنل نباید زیر داکِ چندستونی برود ---
console.log('\n— پنل —');
const pw = (css.match(/#panel-wrap\s*\{[^}]*\}/) || [''])[0];
ok(/right:\s*var\(--dock-w/.test(pw), 'پنل از عرض واقعی داک پیروی می‌کند');
const ui = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
ok(/--dock-w/.test(ui) && /syncDockWidth/.test(ui), 'ui.js متغیر --dock-w را ست می‌کند');
ok(/addEventListener\('resize'/.test(ui), 'با تغییر اندازه‌ی پنجره دوباره محاسبه می‌شود');

// --- ۶) هر دکمه باید آیکون یکتا داشته باشد وگرنه قابل تشخیص نیست ---
console.log('\n— یکتایی آیکون دکمه‌ها —');
const rows = [...html.matchAll(/data-panel="([a-z]+)" title="([^"]*)">([^<]+)<\/button>/g)];
ok(rows.length === N_DOCK, `هر ${N_DOCK} دکمه data-panel و title دارند`);
const seen = new Map(), dups = [];
for (const [, panel, , icon] of rows) {
  if (seen.has(icon)) dups.push(`${icon} (${seen.get(icon)} و ${panel})`);
  seen.set(icon, panel);
}
ok(dups.length === 0, dups.length ? 'آیکون تکراری: ' + dups.join('، ') : 'همه‌ی آیکون‌ها یکتا هستند');
ok(rows.every(r => r[2].trim().length > 0), 'همه‌ی دکمه‌ها تولتیپ دارند');

console.log(`\nنتیجه: ${pass} ✅ / ${fail} ❌`);
process.exit(fail ? 1 : 0);
