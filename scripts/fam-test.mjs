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
const UIx = await import('../src/ui.js');
const { MapRenderer } = await import('../src/render.js');
const st = await import('../src/state.js');
const SIM = await import('../src/sim.js');
let pass=0,fail=0; const ok=(c,m)=>{c?(console.log('  ✅',m),pass++):(console.log('  ❌',m),fail++)};

const R=new MapRenderer(); R.attach(document.getElementById('map'),document.getElementById('minimap'));
const S=st.newGame(777,{timelineId:'victoria',scenarioId:'balance',difficulty:'normal',nationIdx:0});
UIx.initUI(S,R,{});
// فرزندان را دستی می‌سازیم تا حالت «۴ کارت» بازتولید شود
S.family.push({id:99,role:'son',name:'شاهزاده آرش',avatar:'assets/family/son.jpg',rel:88,age:5,alive:true,traits:[],talkCd:0,hist:[]});
S.family.push({id:100,role:'daughter',name:'شاهدخت مهتاب',avatar:'assets/family/daughter.jpg',rel:88,age:3,alive:true,traits:[],talkCd:0,hist:[]});
UIx.UI.panel='family'; UIx.renderPanel();
const h=document.getElementById('panel-body').innerHTML;

console.log('\n— تفکیک فرزند از خویشاوند —');
ok(h.includes('فرزندان شما'), 'بخش «فرزندان شما» هست');
ok(h.includes('خویشاوندان و دربار'), 'بخش «خویشاوندان» جداست');
ok(h.includes('اینان فرزند شما نیستند'), 'توضیح صریح داده شده');

console.log('\n— شمارنده‌ی سهمیه —');
ok(h.includes('پسر ۱/۱')||h.includes('پسر 1/1'), 'شمارنده‌ی پسر ۱/۱');
ok(h.includes('دختر ۱/۱')||h.includes('دختر 1/1'), 'شمارنده‌ی دختر ۱/۱');

console.log('\n— نام خواهر/برادر دیگر با «شاهزاده» شروع نمی‌شود —');
const bro=S.family.find(m=>m.role==='brother'), sis=S.family.find(m=>m.role==='sister');
ok(!/^شاهزاده /.test(bro.name), 'برادر: '+bro.name);
ok(!/^شاهزاده /.test(sis.name), 'خواهر: '+sis.name);

console.log('\n— شمارش واقعی کارت‌ها —');
const kids=S.family.filter(m=>m.role==='son'||m.role==='daughter');
ok(kids.length===2, 'دقیقاً ۲ فرزند در داده ('+kids.length+')');
const idxKids=h.indexOf('فرزندان شما'), idxKin=h.indexOf('خویشاوندان و دربار');
ok(idxKids>=0&&idxKin>idxKids, 'فرزندان پیش از خویشاوندان نمایش داده می‌شوند');

console.log(`\nنتیجه: ${pass} ✅ / ${fail} ❌`);
if(errors.length) errors.forEach(e=>console.log('  خطا:',e));
process.exit(fail?1:0);
