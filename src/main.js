// ---------- راه‌انداز و حلقه اصلی ----------
import { MapRenderer } from './render.js';
import { newGame, loadGame, saveGame } from './state.js';
import { tick } from './sim.js';
import * as UIx from './ui.js';
import { UI, initUI, showMenu, hideMenu, onTick, refreshTopbar, selectProv, mapClick, mapHover, setSpeed, closePanel } from './ui.js';
import { clamp } from './utils.js';

const R = new MapRenderer();
let S = null;
let running = false;

window.addEventListener('DOMContentLoaded', () => {
  const cv = document.getElementById('map');
  const mini = document.getElementById('minimap');
  R.attach(cv, mini);
  bindInput(cv, mini);
  showMenu(hooks);
  // تولید نقشه پیش‌نمایش برای پس‌منو
  requestAnimationFrame(loop);
});

const hooks = {
  startGame(nationIdx) {
    S = newGame(Math.floor(Math.random() * 1e9), nationIdx);
    boot();
    const cap = S.map.provs[S.nations[S.playerId].capital];
    R.focusOn(cap.cx, cap.cy, 0.75);
    UIx.toast('🏛️', `فرمانروایی ${S.nations[S.playerId].name} آغاز شد — با کلیک روی استان‌ها شروع کنید`);
  },
  continueGame() {
    S = loadGame();
    if (!S) { UIx.toast('⚠️', 'ذخیره‌ای یافت نشد'); return; }
    boot();
    const cap = S.map.provs[S.nations[S.playerId].capital];
    R.focusOn(cap.cx, cap.cy, 0.75);
    UIx.toast('📜', 'بازی بارگذاری شد');
  },
};

function boot() {
  R.dirtyTerrain = R.dirtyPol = R.dirtyBorders = true;
  hideMenu();
  initUI(S, R, hooks);
  running = true;
  saveGame(S);
}

// ---------- حلقه ----------
const WEEK_MS = [Infinity, 1400, 950, 560, 300]; // سرعت 1..4
let last = performance.now(), acc = 0, tickBusy = false;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running && S) {
    if (!S.paused && !tickBusy) {
      acc += dt * 1000;
      const step = WEEK_MS[S.speed] || 900;
      while (acc >= step) {
        acc -= step;
        tickBusy = true;
        try {
          tick(S);
          onTick();
        } catch (err) {
          console.error('خطای شبیه‌سازی:', err);
          S.paused = true;
          UIx.toast('⚠️', 'خطایی رخ داد؛ بازی متوقف شد (کنسول)');
        }
        tickBusy = false;
        if (S.pendingEvent) { acc = 0; break; }
      }
    } else acc = 0;
    R.draw(S, UI, now / 1000, dt);
    // نوار تاریخ همیشه به‌روز
    if ((now | 0) % 5 === 0) { /* سبک */ }
  }
  requestAnimationFrame(loop);
}

// ---------- ورودی ----------
function bindInput(cv, mini) {
  let dragging = false, moved = 0, lx = 0, ly = 0;
  cv.addEventListener('mousedown', e => { dragging = true; moved = 0; lx = e.offsetX; ly = e.offsetY; cv.style.cursor = 'grabbing'; });
  cv.addEventListener('mousemove', e => {
    if (!running || !S) return;
    if (dragging) {
      const dx = e.offsetX - lx, dy = e.offsetY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      R.cam.x -= dx / R.cam.z; R.cam.y -= dy / R.cam.z;
      R.clampCam();
      lx = e.offsetX; ly = e.offsetY;
    } else mapHover(e.offsetX, e.offsetY);
  });
  addEventListener('mouseup', e => {
    if (dragging && moved < 6 && running && S) {
      const r = cv.getBoundingClientRect();
      mapClick(e.clientX - r.left, e.clientY - r.top);
    }
    dragging = false;
    cv.style.cursor = UI.selArmy ? 'crosshair' : 'grab';
  });
  cv.addEventListener('wheel', e => {
    if (!running || !S) return;
    e.preventDefault();
    R.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.14 : 1 / 1.14);
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.style.cursor = 'grab';

  // لمس موبایل (پایه)
  let tLast = null;
  cv.addEventListener('touchstart', e => { const t = e.touches[0]; tLast = { x: t.clientX, y: t.clientY, moved: 0 }; }, { passive: true });
  cv.addEventListener('touchmove', e => {
    if (!tLast || !running) return;
    const t = e.touches[0];
    const dx = t.clientX - tLast.x, dy = t.clientY - tLast.y;
    tLast.moved += Math.abs(dx) + Math.abs(dy);
    R.cam.x -= dx / R.cam.z; R.cam.y -= dy / R.cam.z; R.clampCam();
    tLast.x = t.clientX; tLast.y = t.clientY;
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchend', e => {
    if (tLast && tLast.moved < 12 && running && S) {
      const r = cv.getBoundingClientRect();
      mapClick(tLast.x - r.left, tLast.y - r.top);
    }
    tLast = null;
  });

  // مینی‌مپ: کلیک → پرش دوربین
  const miniGo = (e) => {
    if (!running || !S) return;
    const r = mini.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    R.cam.x = nx * S.map.w;
    R.cam.y = ny * S.map.h;
    R.clampCam();
  };
  mini.addEventListener('mousedown', miniGo);

  // کیبورد
  addEventListener('keydown', e => {
    if (!running || !S) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(0); }
    else if (e.key >= '1' && e.key <= '4') setSpeed(+e.key);
    else if (e.key === 'Escape') {
      if (UI.selArmy) { UI.selArmy = null; UIx.renderPanel(); }
      else closePanel();
    }
    else if (e.key === '+' || e.key === '=') setSpeed(Math.min(4, S.speed + 1));
    else if (e.key === '-') setSpeed(Math.max(1, S.speed - 1));
  });

  // ذخیره هنگام خروج
  addEventListener('beforeunload', () => { if (running && S) saveGame(S); });
}
