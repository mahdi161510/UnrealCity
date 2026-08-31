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
const DYN = await import('../src/dynasty.js');
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
// ================== پنل‌های سامانه‌های تازه ==================
function openP(name) {
  const btn = document.querySelector(`#dock [data-panel="${name}"]`);
  if (!btn) throw new Error('دکمه‌ی داک نیست: ' + name);
  btn.click();
  const body = document.getElementById('panel-body');
  if (!body.innerHTML.trim()) throw new Error('پنل خالی رندر شد: ' + name);
  return body;
}
step('پنل دربار و فرماندهان (کابینه/ژنرال/دریاسالار)', () => {
  const body = openP('court');
  if (!body.querySelector('.cab-slot')) throw new Error('پست‌های کابینه رندر نشد');
  if (!body.querySelector('.chr-row')) throw new Error('فهرست فرماندهان رندر نشد');
});
step('انتصاب و برکناری وزیر از UI', () => {
  const pn = S.nations[S.playerId];
  pn.treasury += 20000;
  UIx.renderPanel();
  const hire = document.querySelector('#panel-body [data-act="hire-min"]');
  if (!hire) throw new Error('دکمه‌ی انتصاب نیست');
  const role = hire.dataset.role, id = +hire.dataset.id;
  hire.click();
  if (pn.cabinet[role] !== id) throw new Error('وزیر منصوب نشد');
  const fire = document.querySelector(`#panel-body [data-act="fire-min"][data-role="${role}"]`);
  if (fire) { fire.click(); document.getElementById('confirm-yes').click(); }
  if (pn.cabinet[role] === id) throw new Error('وزیر برکنار نشد');
});
step('پنل نیروی دریایی + سفارش کشتی', () => {
  const body = openP('navy');
  const pn = S.nations[S.playerId];
  pn.treasury += 20000;
  UIx.renderPanel();
  const buy = document.querySelector('#panel-body [data-act="build-ship"]');
  if (buy) {
    const p = S.map.provs[+buy.dataset.p];
    const before = (p.navyQueue || []).length;
    buy.click();
    if ((p.navyQueue || []).length !== before + 1) throw new Error('کشتی به صف نرفت');
  }
  if (!body.innerHTML.includes('توان دریایی')) throw new Error('آمار دریایی نیست');
});
step('برگزیدن ناوگان و فرمان حرکت روی نقشه', () => {
  UIx.renderPanel();
  const sel = document.querySelector('#panel-body [data-act="sel-fleet"]');
  if (!sel) return;
  sel.click();
  if (UIx.UI.selFleet === null) throw new Error('ناوگان برگزیده نشد');
  UIx.mapClick(50, 50);   // احتمالاً دریا یا خشکی — نباید خطا دهد
  UIx.UI.selFleet = null;
});
step('پنل سازمان اطلاعات + شروع عملیات', () => {
  const body = openP('spy');
  const pn = S.nations[S.playerId];
  pn.treasury += 20000;
  UIx.renderPanel();
  const op = document.querySelector('#panel-body [data-act="start-op"]');
  if (!op) throw new Error('دکمه‌ی عملیات نیست');
  const before = pn.ops.length;
  op.click();
  if (pn.ops.length !== before + 1) throw new Error('عملیات آغاز نشد');
  UIx.renderPanel();
  const ab = document.querySelector('#panel-body [data-act="abort-op"]');
  if (ab) ab.click();
});
step('پنل جامعه + سرکوب/مصالحه جنبش', () => {
  const body = openP('society');
  if (!body.querySelector('.mov-row')) throw new Error('جنبش‌ها رندر نشد');
  const pn = S.nations[S.playerId];
  pn.treasury += 20000;
  UIx.renderPanel();
  const sup = document.querySelector('#panel-body [data-act="suppress"]');
  const key = sup.dataset.k;
  const p0 = pn.movements[key].power;
  sup.click();
  if (pn.movements[key].power >= p0) throw new Error('سرکوب اثر نکرد');
  UIx.renderPanel();
  const app = document.querySelector('#panel-body [data-act="appease"]');
  if (app) app.click();
});
step('پنل تجارت: تعرفه، مسیر، شرکت', () => {
  const body = openP('trade');
  const pn = S.nations[S.playerId];
  pn.treasury += 30000;
  UIx.renderPanel();
  const tb = document.querySelector('#panel-body [data-act="tariff"][data-i="4"]');
  tb.click();
  if (pn.tariff !== 4) throw new Error('تعرفه تغییر نکرد');
  UIx.renderPanel();
  const orr = document.querySelector('#panel-body [data-act="open-route"]');
  if (orr) { const b4 = pn.routes.length; orr.click(); if (pn.routes.length !== b4 + 1) throw new Error('مسیر باز نشد'); }
  UIx.renderPanel();
  const fc = document.querySelector('#panel-body [data-act="found-co"]');
  if (fc) { const b4 = pn.companies.length; fc.click(); if (pn.companies.length !== b4 + 1) throw new Error('شرکت تأسیس نشد'); }
  UIx.renderPanel();
  const col = document.querySelector('#panel-body [data-act="colonize"]');
  if (col) { const b4 = pn.colonies.length; col.click(); if (pn.colonies.length !== b4 + 1) throw new Error('استعمار آغاز نشد'); }
});
step('۳۰ تیک با همه‌ی سامانه‌های تازه فعال', () => {
  for (let i = 0; i < 30; i++) {
    SIM.tick(S);
    UIx.onTick();
    R.draw(S, UIx.UI, i * 0.5, 0.016);
    if (S.pendingEvent) { const o = document.querySelector('#event-modal .ev-opt'); if (o) o.click(); }
    for (const o of [...(S.dipOffers || [])]) SIM.respondOffer(S, o.id, false);
  }
  for (const nm of ['court', 'navy', 'spy', 'society', 'trade']) openP(nm);
});
step('پنل شورای درباری: کرسی‌ها، فساد، تربیت وارث', () => {
  const body = openP('council');
  const pn = S.nations[S.playerId];
  if (!body.querySelector('.seat-card')) throw new Error('کرسی‌های شورا رندر نشد');
  pn.treasury += 40000;

  // بازرسی فساد باید عدد را پایین بیاورد
  pn.corruption = 40;
  UIx.renderPanel();
  const audit = document.querySelector('#panel-body [data-act="corr-audit"]');
  if (!audit) throw new Error('دکمه‌ی بازرسی نیست');
  audit.click();
  if (!(pn.corruption < 40)) throw new Error('بازرسی فساد را کم نکرد');

  // پاکسازی بزرگ (با تأیید)
  const before = pn.corruption;
  pn.corruption = 60;
  UIx.renderPanel();
  document.querySelector('#panel-body [data-act="corr-purge"]').click();
  document.getElementById('confirm-yes').click();
  if (!(pn.corruption < 60)) throw new Error('پاکسازی کار نکرد');

  // گماردن روی یک کرسی خالی
  UIx.renderPanel();
  const change = document.querySelector('#panel-body [data-act="seat-change"]');
  if (change) {
    change.click();
    const row = document.querySelector('#confirm-text .cand-row');
    if (row) {
      row.click();
      const k = change.dataset.k;
      if (!pn.council?.[k]) throw new Error('انتصاب انجام نشد');
    }
    // مودال باید بسته شده باشد
    if (document.getElementById('confirm-modal').style.display === 'flex') {
      document.getElementById('confirm-no').click();
    }
  }

  // تربیت وارث
  UIx.renderPanel();
  const edu = document.querySelector('#panel-body [data-act="edu-heir"]');
  if (edu) {
    const heir = pn.dyn.heirId;
    const r = S.royals.find(x => x.id === heir);
    if (r) {
      const before2 = r.stat[edu.dataset.k];
      pn.eduCd = 0;
      edu.click();
      if (!(r.stat[edu.dataset.k] >= before2)) throw new Error('تربیت وارث اثر نکرد');
    }
  }

  // پنل توطئه: یک توطئه‌ی ساختگی باید رندر شود
  const fac = pn.dyn.factions[0];
  pn.plot = { headId: fac.headId, facKey: fac.key, target: 'ruler', prog: 50, known: true, started: S.week };
  UIx.renderPanel();
  const b2 = document.getElementById('panel-body');
  if (!b2.querySelector('.plot-box')) throw new Error('جعبه‌ی توطئه رندر نشد (plot=' + JSON.stringify(pn.plot) + ')');
  document.querySelector('#panel-body [data-act="plot-guard"]').click();
  if (!(pn.plot.prog < 50)) throw new Error('تشدید محافظت اثر نکرد');
  document.querySelector('#panel-body [data-act="plot-arrest"]').click();
  document.getElementById('confirm-yes').click();
  if (pn.plot) throw new Error('دستگیری توطئه‌گر انجام نشد');
});
step('پنل سلسله + قانون جانشینی + خاندان‌ها', () => {
  const body = openP('dynasty');
  const pn = S.nations[S.playerId];
  if (!pn.dyn) throw new Error('سلسله ساخته نشد');
  if (!body.querySelector('.roy-card')) throw new Error('کارت پادشاه رندر نشد');
  if (!body.querySelector('.fac-row')) throw new Error('خاندان‌ها رندر نشد');
  pn.treasury += 40000;
  UIx.renderPanel();
  // پیشکش به خاندان
  const gift = document.querySelector('#panel-body [data-act="fac-gift"]');
  const f0 = pn.dyn.factions.find(f => f.house === gift.dataset.h);
  const loyB = f0.loyalty;
  gift.click();
  if (f0.loyalty <= loyB) throw new Error('پیشکش وفاداری را بالا نبرد');
  // تغییر قانون جانشینی
  UIx.renderPanel();
  const law = document.querySelector('#panel-body [data-act="succ-law"]');
  const newLaw = law.dataset.k;
  law.click();
  document.getElementById('confirm-yes').click();
  if (pn.dyn.succession !== newLaw) throw new Error('قانون جانشینی تغییر نکرد');
});
step('وصلت سلطنتی از UI', () => {
  const pn = S.nations[S.playerId];
  pn.treasury += 20000;
  for (const o of S.nations) if (o.id !== pn.id) pn.rel[o.id] = 40;
  UIx.renderPanel();
  const pm = document.querySelector('#panel-body [data-act="propose-marriage"]');
  if (!pm) return;
  const before = Object.keys(pn.dyn.marriages).length;
  pm.click();
  if (Object.keys(pn.dyn.marriages).length !== before + 1) throw new Error('وصلت انجام نشد');
});
step('مرگ پادشاه ⇒ جانشینی خودکار', () => {
  const pn = S.nations[S.playerId];
  const k = DYN.rulerOf(S, pn.id);
  const heirBefore = pn.dyn.heirId;
  if (!k) throw new Error('پادشاهی نیست');
  DYN.killRoyal(S, k, 'آزمون');
  const k2 = DYN.rulerOf(S, pn.id);
  if (!k2 || !k2.alive) throw new Error('جانشین بر تخت ننشست');
  if (k2.id === k.id) throw new Error('پادشاه مرده هنوز حکومت می‌کند');
  if (heirBefore && k2.id !== heirBefore) throw new Error('وارث تعیین‌شده جانشین نشد');
  if (!pn.ruler.includes(k2.name)) throw new Error('نام فرمانروا به‌روز نشد');
});
step('پنل جهان + بنای عظیم', () => {
  const body = openP('world');
  if (!S.regions?.length) throw new Error('مناطق ساخته نشد');
  const pn = S.nations[S.playerId];
  pn.treasury += 90000;
  const mine = S.map.provs.find(p => p.owner === pn.id);
  UIx.selectProv(mine.id);
  openP('world');
  const bw = document.querySelector('#panel-body [data-act="build-wonder"]:not(.dis-op)');
  if (bw) {
    bw.click();
    if (!(S.wonders || []).some(w => !w.done)) throw new Error('ساخت بنای عظیم آغاز نشد');
  }
});
step('پنل قدرت‌های بزرگ + بحران بین‌المللی', () => {
  const body = openP('powers');
  if (!body.querySelector('.gp-row')) throw new Error('رتبه‌بندی قدرت رندر نشد');
  const pn = S.nations[S.playerId];
  pn.treasury += 40000;
  UIx.renderPanel();
  const fab = document.querySelector('#panel-body [data-act="fabricate"]');
  if (fab) {
    const tid = +fab.dataset.id;
    fab.click();
    if (!(pn.dyn.claims[tid] > 0)) throw new Error('ادعای ارضی ساخته نشد');
  }
  UIx.renderPanel();
  const sc = document.querySelector('#panel-body [data-act="start-crisis"]');
  if (sc) sc.click();
});
step('سرزمین بکر: کلیک روی هر استان بدون خطا', () => {
  const free = S.map.provs.filter(p => p.owner < 0);
  if (!free.length) throw new Error('هیچ سرزمین بکری ساخته نشد — استعمار بی‌معنا می‌شود');
  // روی همه‌ی استان‌ها کلیک کن: صاحب‌دار، بکر، اشغالی
  for (const p of S.map.provs) {
    UIx.selectProv(p.id);
    UIx.openPanel('province');
    const bodyH = document.getElementById('panel-body').innerHTML;
    if (!bodyH.trim()) throw new Error('پنل استان خالی شد برای ' + p.name);
  }
  // هاور روی همه‌جا
  for (let i = 0; i < 40; i++) UIx.mapHover(i * 17 % 900, i * 23 % 600);
});
step('همه‌ی مُدهای نقشه با سرزمین بکر', () => {
  for (const m of ['political','terrain','population','production','unrest','culture','religion','naval','separatism','devast','houses','regions','power']) {
    UIx.UI.mapMode = m; R.mapMode = m; R.dirtyPol = true;
    R.draw(S, UIx.UI, 1, 0.016);
  }
  UIx.UI.mapMode = 'political'; R.mapMode = 'political'; R.dirtyPol = true;
});
step('ذخیره و بارگذاری', () => {
  st.saveGame(S);
  const S2 = st.loadGame();
  if (!S2 || S2.week !== S.week) throw new Error('بازی بارگذاری نشد');
  if (S2.map.provs.length !== S.map.provs.length) throw new Error('استان‌ها ناسازگار');
  if (!S2.chars || !S2.chars.length) throw new Error('شخصیت‌ها ذخیره/بازیابی نشدند');
  if (!S2.fleets) throw new Error('ناوگان‌ها بازیابی نشدند');
  const p2 = S2.nations[S2.playerId];
  if (p2.tariff === undefined || !p2.movements || !p2.spyNet) throw new Error('وضعیت سامانه‌های تازه بازیابی نشد');
  if (!S2.seaZones || !S2.seaZones.length) throw new Error('مناطق دریایی بازسازی نشدند');
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
