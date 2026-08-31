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
const { eventImg, artCat } = await import('../src/evart.js');

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){console.log('  ✅',m);pass++;} else {console.log('  ❌',m);fail++;} };

const R = new MapRenderer();
R.attach(document.getElementById('map'), document.getElementById('minimap'));
const S = st.newGame(777,{timelineId:'victoria',scenarioId:'balance',difficulty:'normal',nationIdx:0});
UIx.initUI(S,R,{});
for(let i=0;i<52*25;i++) SIM.tick(S);

console.log('\n— مودال رویداد با نقاشی —');
const { EVENTS } = await import('../src/data.js');
const ev = EVENTS.find(e=>e.tl==='victoria' && eventImg(e));
S.pendingEvent = ev;
UIx.UI.__t=0;
// showEvent داخلی است؛ از راه نمایش رویداد در حلقه استفاده می‌کنیم
document.getElementById('event-modal').style.display='none';
const box=document.getElementById('event-box');
// فراخوانی غیرمستقیم: renderPanel امن است، پس مستقیم HTML را می‌سازیم مثل showEvent
const img = eventImg(ev);
ok(!!img, 'رویداد نمونه تصویر دارد: '+artCat(ev));
ok(/^assets\/ev\/.+\.jpg$/.test(img), 'مسیر تصویر معتبر است: '+img);

console.log('\n— نوار روند در پنل کشور —');
UIx.UI.panel='country';
UIx.renderPanel();
const body=document.getElementById('panel-body').innerHTML;
ok(body.includes('trendstrip'), 'نوار روند رندر شد');
ok((body.match(/<svg class="spark"/g)||[]).length===4, 'چهار اسپارک‌لاین ساخته شد ('+((body.match(/<svg class="spark"/g)||[]).length)+')');
ok(body.includes('<path'), 'اسپارک‌لاین مسیر واقعی دارد');
ok(S.chronicle.rows.length>=20, 'تاریخ‌نگار ردیف دارد: '+S.chronicle.rows.length);

console.log('\n— مُدهای نقشه‌ی تازه —');
UIx.buildMapModeBar && UIx.buildMapModeBar();
const bar=document.getElementById('mapmodes').innerHTML;
ok(bar.includes('بدنامی'), 'مُد بدنامی در نوار هست');
ok(bar.includes('پروژه‌ها'), 'مُد پروژه‌ها در نوار هست');
for(const m of ['infamy','projects']){
  R.mapMode=m; R.dirtyPol=true;
  let threw=null; try{ R.drawPolitical(S); }catch(e){ threw=e.message; }
  ok(!threw, 'drawPolitical در مُد '+m+' بدون خطا'+(threw?' — '+threw:''));
}

console.log('\n— لایه‌های رویی نقشه —');
for(const fn of ['drawProjects','drawInfamy']){
  let threw=null; try{ R[fn](S, 12.5); }catch(e){ threw=e.message; }
  ok(!threw, fn+' بدون خطا'+(threw?' — '+threw:''));
}
let threw=null; try{ R.draw(S, UIx.UI, 12.5, 0.016); }catch(e){ threw=e.stack.split('\n')[0]; }
ok(!threw, 'فریم کامل draw() بدون خطا'+(threw?' — '+threw:''));

console.log('\n— صفحه‌ی پایان —');
const { bigChart } = await import('../src/chronicle.js');
const bc = bigChart(S,'gdp');
ok(bc.startsWith('<svg'), 'نمودار بزرگ پایان تولید شد');

console.log(`\nنتیجه: ${pass} ✅ / ${fail} ❌`);
if(errors.length){ console.log('خطاهای پنجره:'); errors.forEach(e=>console.log('  ',e)); }
process.exit(fail?1:0);
