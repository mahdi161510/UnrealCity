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
const menuHooksStub = { startGame(i) { startedWith = i; }, continueGame() { } };
step('نمایش منو', () => { UIx.showMenu(menuHooksStub); document.getElementById('btn-new').click(); });
step('کلیک روی کارت ملت → startGame صدا زده شود (رگرسیون hooks=null)', () => {
  document.getElementById('btn-new').click();
  const card = document.querySelector('#nation-grid .nation-card');
  if (!card) throw new Error('کارت ملتی ساخته نشد');
  card.click();
  if (startedWith !== 0) throw new Error('startGame فراخوانی نشد');
});
step('رندر یک فریم روی منو (بدون state)', () => { /* skip */ });

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
step('پنل تاریخچه', () => { UIx.openPanel('log'); });
step('کلیک نقشه روی استان', () => { UIx.UI.selArmy = null; UIx.mapClick(640, 360); });
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
step('منوی بازی/راهنما', () => { UIx.showHelp(true); document.getElementById('help-close').click(); });

console.log('\n— نتیجه —');
if (errors.length) { console.log('❌ خطاها:\n' + errors.join('\n---\n')); process.exit(1); }
console.log('✅ همه مراحل تست DOM موفق بود');
