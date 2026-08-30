// تست یکپارچه UI با jsdom: اجرای واقعی پنل‌ها، اکشن‌ها و رندر
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// ---- استاب‌های کانوس و مرورگر ----
function makeCtx() {
  const grad = { addColorStop() { } };
  const base = {
    canvas: null,
    measureText: () => ({ width: 24 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    getLineDash: () => [],
  };
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this._ctx) { this._ctx = makeCtx(); this._ctx.canvas = this; }
  return this._ctx;
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
window.Element.prototype.getBoundingClientRect = function () { return { width: 1280, height: 720, left: 0, top: 0, right: 1280, bottom: 720, x: 0, y: 0 }; };

globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = window.localStorage;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 4);
globalThis.location = window.location;

const errors = [];
window.addEventListener('error', e => errors.push('window error: ' + e.message));

// ---- ایمپورت ماژول‌ها ----
const UIx = await import('../src/ui.js');
const { MapRenderer } = await import('../src/render.js');
const st = await import('../src/state.js');
const SIM = await import('../src/sim.js');
const { BUILDINGS, EVENTS } = await import('../src/data.js');

function step(name, fn) {
  try { fn(); console.log('✅', name); }
  catch (e) { errors.push(name + ': ' + e.stack.split('\n').slice(0, 3).join(' | ')); console.log('❌', name, '—', e.message); }
}

let S, R;
step('ساخت رندرر و اتصال کانوس', () => {
  R = new MapRenderer();
  R.attach(document.getElementById('map'), document.getElementById('minimap'));
});
let startedWith = null;
const menuHooksStub = { startGame(o) { startedWith = o; }, continueGame() { } };
step('نمایش منو + راه‌اندازی (خط زمانی/سختی/ملت)', () => {
  UIx.showMenu(menuHooksStub);
  document.getElementById('btn-new').click();
  if (document.getElementById('menu-setup').style.display === 'none') throw new Error('راه‌اندازی باز نشد');
  if (document.querySelectorAll('#tl-cards .tl-card').length !== 4) throw new Error('۴ کارت خط زمانی نیست');
  if (!document.querySelectorAll('#diff-chips .chip').length) throw new Error('درجه‌های سختی نیست');
});
step('انتخاب خط زمانی واقعی (ww1) → ملت‌های آن خط', () => {
  document.querySelector('#tl-cards .tl-card[data-tl="ww1"]').click();
  const cards = document.querySelectorAll('#nation-grid .nation-card');
  if (cards.length !== 10) throw new Error('۱۰ ملت ww1 در شبکه نیست (فعلاً ' + cards.length + ')');
  cards[0].click();
  if (!startedWith || startedWith.timelineId !== 'ww1') throw new Error('startGame با ww1 صدا زده نشد');
  if (startedWith.difficulty !== 'normal' || startedWith.nationIdx !== 0) throw new Error('پارامترهای startGame نادرست');
});
step('انتخاب سناریوی قفل‌دار ویکتوریا (رستاخیز آریان)', () => {
  UIx.showMenu(menuHooksStub);
  document.getElementById('btn-new').click();
  document.querySelector('#tl-cards .tl-card[data-tl="victoria"]').click();
  if (document.getElementById('scenario-section').style.display === 'none') throw new Error('بخش سناریو نمایش داده نشد');
  document.querySelector('#scenario-chips .chip[data-sc="persia"]').click();
  const cards = document.querySelectorAll('#nation-grid .nation-card');
  if (cards.length !== 1) throw new Error('سناریوی قفل‌دار باید فقط یک ملت داشته باشد');
  if (!document.querySelector('.setup-note')) throw new Error('نکته‌ی قفل نمایش داده نشد');
  cards[0].click();
  if (startedWith.scenarioId !== 'persia') throw new Error('scenarioId ارسال نشد');
  UIx.showMenu(menuHooksStub); // بازگشت
});
step('توتوریال کامل: قدم‌به‌قدم تا انتها', () => {
  UIx.showTutorial();
  const title = () => document.querySelector('#tut-body .tut-title').textContent;
  const first = title();
  let n = 0;
  while (n < 30) {
    const btn = document.getElementById('tut-next');
    const t = title();
    btn.click();
    n++;
    if (btn.textContent.includes('شروع کن')) break;
    if (title() === t && !document.getElementById('tutorial-modal').style.display) break;
  }
  if (!document.getElementById('tutorial-modal').style.display) throw new Error('توتوریال بسته نشد');
  if (!first.includes('خوش آمدید')) throw new Error('توتوریال از صفحه‌ی درست شروع نشد');
});

step('ساخت بازی جدید + initUI', () => {
  S = st.newGame(424242, 0);
  S._cellProv = S.map.grid.cells;
  UIx.hideMenu();
  UIx.initUI(S, R, { startGame() { }, continueGame() { } });
});
step('رندر فریم‌های نقشه (همه مُدها)', () => {
  R.draw(S, UIx.UI, 0.5, 0.016);
  for (const m of ['terrain', 'population', 'production', 'unrest', 'political']) {
    R.mapMode = m; R.dirtyPol = true;
    R.draw(S, UIx.UI, 1.0, 0.016);
  }
});
step('انتخاب استان و پنل استان', () => {
  const prov = S.map.provs.find(p => p.owner === 0);
  UIx.selectProv(prov.id);
});
step('ساخت مزرعه از دکمه', () => {
  const btn = document.querySelector('#panel-body [data-act="build"][data-k="farm"]');
  if (!btn) throw new Error('دکمه ساخت مزرعه یافت نشد');
  btn.click();
  const prov = S.map.provs[UIx.UI.selProv];
  if (!prov.queue.length) throw new Error('صف ساخت خالی است');
});
step('باگ پول: خرید ساختمان واقعاً خزانه را کم می‌کند', () => {
  const pn = S.nations[0];
  pn.treasury = 100000; // مطمئن شویم دکمه قفل نیست
  const prov = S.map.provs.find(p => p.owner === 0);
  UIx.selectProv(prov.id);
  const before = pn.treasury;
  const btn = document.querySelector('#panel-body [data-act="build"][data-k="farm"]');
  if (!btn) throw new Error('دکمه ساخت مزرعه یافت نشد');
  btn.click();
  const q = prov.queue[prov.queue.length - 1];
  if (!q || q.key !== 'farm') throw new Error('ساخت مزرعه آغاز نشد');
  const cost = BUILDINGS.farm.cost;
  if (pn.treasury !== before - cost) throw new Error(`خزانه کم نشد: قبل=${before} بعد=${pn.treasury} هزینه=${cost}`);
  // لغو ساخت → بازپرداخت کامل
  const before2 = pn.treasury;
  document.querySelector(`#panel-body [data-act="cancel"][data-i="${prov.queue.length - 1}"]`).click();
  if (pn.treasury !== before2 + cost) throw new Error(`بازپرداخت لغو نادرست: قبل=${before2} بعد=${pn.treasury}`);
  // خرید با پول ناکافی باید رد شود
  pn.treasury = BUILDINGS.farm.cost - 1;
  UIx.selectProv(prov.id);
  const chk = SIM.canBuild(S, prov, 'farm');
  if (chk.ok) throw new Error('خرید با پول ناکافی نباید مجاز باشد');
});
step('پنل بازار + اسپارک‌لاین', () => { UIx.openPanel('market'); });
step('پنل فناوری + شروع پژوهش', () => {
  UIx.openPanel('tech');
  document.querySelector('#panel-body .tech[data-k="literacy"]').click();
  if (!S.nations[0].res.key) throw new Error('پژوهش شروع نشد');
});
step('پنل سیاست + تغییر مالیات', () => {
  UIx.openPanel('politics');
  document.querySelector('[data-act="tax"][data-i="3"]').click();
  if (S.nations[0].taxLvl !== 3) throw new Error('مالیات تغییر نکرد');
});
step('طرح قانون با مودال تایید', () => {
  const btn = document.querySelector('[data-act="law"]');
  if (!btn) throw new Error('دکمه طرح قانون نیست');
  btn.click();
  document.getElementById('confirm-yes').click();
  if (!S.nations[0].enact) throw new Error('قانون‌گذاری آغاز نشد');
});
step('پنل دیپلماسی + بهبود روابط', () => {
  UIx.openPanel('diplomacy');
  const btn = document.querySelector('[data-act="improve"]');
  btn.click();
});
step('اعلام جنگ از دیپلماسی', () => {
  const btn = document.querySelector('[data-act="war"]');
  if (!btn) throw new Error('دکمه جنگ نیست (شاید جنگ از قبل؟)');
  btn.click();
  document.getElementById('confirm-yes').click();
  if (!S.wars.length) console.log('⚠️ جنگی آغاز نشد (شاید هدف مرزی نبود)');
});
step('پنل نظام + ساخت ارتش و فرمان', () => {
  UIx.openPanel('military');
  S.nations[0].battalions = 10;
  document.querySelector('[data-act="newarmy"]').click();
  if (!SIM.armiesOf(S, 0).length) throw new Error('ارتش ساخته نشد');
  const sel = document.querySelector('[data-act="selarmy"]');
  sel.click();
  if (!UIx.UI.selArmy) throw new Error('ارتش برگزیده نشد');
  // فرمان: کلیک روی نقشه
  UIx.mapClick(640, 360);
});
step('پنل رتبه‌بندی + نمودار GDP', () => { UIx.openPanel('ranking'); });
step('پنل کشور + نمودارها', () => { UIx.openPanel('country'); });
step('پنل مأموریت‌ها', () => { UIx.openPanel('missions'); });
step('مکانیز انتخابات (رویداد دوره‌ای)', () => {
  S.nations[0].laws.gov = 'constit';
  S.nations[0].electionCd = 1;
  S.phase = 'ruling'; S.prologue.step = 10; // دوران شاهزادی را رد می‌کنیم
  S.pendingEvent = null; S.eventCd = 99; S._famCd = 99; // جلوگیری از تداخل رویدادها
  SIM.tick(S);
  if (!S.pendingEvent || S.pendingEvent.id !== 'election') throw new Error('انتخابات فعال نشد');
  UIx.onTick(); // نمایش مودال رویداد (معادل حلقه اصلی بازی)
  const opt = document.querySelector('#event-modal .ev-opt');
  if (!opt) throw new Error('مودال انتخابات نمایش داده نشد');
  opt.click();
});
step('تکمیل مأموریت به‌صورت اجباری', () => {
  const pn = S.nations[0];
  pn.missionsDone = [];
  for (const p of S.map.provs.filter(p => p.owner === 0)) { p.bld.textile = 3; }
  SIM.tick(S);
  if (!(pn.missionsDone || []).includes('smoke')) throw new Error('مأموریت smoke تکمیل نشد');
});
step('پنل تاریخچه', () => { UIx.openPanel('log'); });
step('رویداد با دو نسخه‌ی متن (اصلی/ساده)', () => {
  const ev = EVENTS.find(e => e.t2);
  if (!ev) throw new Error('رویدادی با t2 نیست');
  S.pendingEvent = { ...ev, opts: ev.opts.slice() };
  UIx.onTick();
  const modal = document.getElementById('event-modal');
  if (modal.style.display !== 'flex') throw new Error('مودال رویداد باز نشد');
  const simpleBtn = document.querySelector('#event-box .ev-tab[data-tab="simple"]');
  if (!simpleBtn) throw new Error('دکمه‌ی ترجمه‌ی ساده نیست');
  const orig = document.querySelector('#event-box .ev-text').textContent;
  simpleBtn.click();
  const simple = document.querySelector('#event-box .ev-text').textContent;
  if (simple === orig || !simple) throw new Error('متن ساده جایگزین نشد');
  if (!document.querySelector('#event-box .ev-timer-bar')) throw new Error('نوار تایمر رویداد تصادفی نیست');
  document.querySelector('#event-box .ev-opt').click();
  if (S.pendingEvent) throw new Error('رویداد پس از انتخاب بسته نشد');
  if (modal.style.display === 'flex') throw new Error('مودال پس از انتخاب بسته نشد');
});
step('بستن خودکار رویداد تصادفی (تایمر)', () => {
  S.paused = true; S.pausedBeforeEvent = true;
  S.pendingEvent = { ...EVENTS.find(e => e.t2), opts: [] };
  UIx.onTick();
  if (document.getElementById('event-modal').style.display !== 'flex') throw new Error('مودال رویداد باز نشد');
  UIx.dismissEvent();
  if (S.pendingEvent) throw new Error('pendingEvent پاک نشد');
  if (document.getElementById('event-modal').style.display === 'flex') throw new Error('مودال بسته نشد');
  if (S.paused !== true) throw new Error('حالت مکث پیش از رویداد بازگردانده نشد');
  S.pausedBeforeEvent = undefined;
});
step('سختی افسانه‌ای: فقط پاز/آن‌پاز', () => {
  S.diffMods = { ...S.diffMods, noSpeed: true };
  UIx.refreshTopbar();
  if (document.getElementById('sp1').style.display !== 'none') throw new Error('دکمه سرعت ۱ پنهان نشد');
  if (document.getElementById('sp4').style.display !== 'none') throw new Error('دکمه سرعت ۴ پنهان نشد');
  if (document.getElementById('sp0').style.display === 'none') throw new Error('دکمه پاز نباید پنهان شود');
  UIx.setSpeed(3);
  if (S.speed === 3) throw new Error('تغییر سرعت در افسانه‌ای نباید مجاز باشد');
  S.paused = false;
  UIx.setSpeed(0);
  if (S.paused !== true) throw new Error('پاز در افسانه‌ای باید کار کند');
  S.diffMods = { ...S.diffMods, noSpeed: false };
  UIx.refreshTopbar();
});
step('هاور نقشه', () => { UIx.mapHover(500, 300); });
step('۴۰ تیک شبیه‌سازی + رندر و رویدادها', () => {
  for (let i = 0; i < 40; i++) {
    SIM.tick(S);
    UIx.onTick();
    R.draw(S, UIx.UI, i * 0.5, 0.016);
    if (S.pendingEvent) {
      const opt = document.querySelector('#event-modal .ev-opt');
      if (!opt) throw new Error('مودال رویداد گزینه ندارد');
      opt.click();
    }
    for (const o of [...(S.dipOffers || [])]) SIM.respondOffer(S, o.id, false);
  }
});
step('ذخیره و بارگذاری', () => {
  st.saveGame(S);
  const S2 = st.loadGame();
  if (!S2 || S2.week !== S.week) throw new Error('بازی بارگذاری نشد');
  if (S2.map.provs.length !== S.map.provs.length) throw new Error('استان‌ها ناسازگار');
});
step('سرعت‌گذاری و مکث', () => { UIx.setSpeed(4); UIx.setSpeed(0); });
step('منوی بازی/راهنما + توتوریال از راهنما', () => {
  UIx.showHelp(true);
  document.getElementById('help-tut').click();
  if (document.getElementById('tutorial-modal').style.display !== 'flex') throw new Error('توتوریال از راهنما باز نشد');
  document.getElementById('tut-close').click();
  if (document.getElementById('tutorial-modal').style.display === 'flex') throw new Error('توتوریال بسته نشد');
  document.getElementById('help-close').click();
});

console.log('\n— نتیجه —');
if (errors.length) { console.log('❌ خطاها:\n' + errors.join('\n---\n')); process.exit(1); }
console.log('✅ همه مراحل تست DOM موفق بود');
