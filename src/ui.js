// ---------- رابط کاربری: منو، HUD، پنل‌ها، رویدادها ----------
import { GOODS, BUILDINGS, TECHS, TECH_BRANCHES, LAWS, LAW_CATS, GROUPS, TAX_LEVELS, POP_CLASSES, TERRAIN, NATION_DEFS, EVENTS, MISSIONS, ERAS, PERSONALITIES, TALK_TOPICS, FAMILY_ROLES_FA } from './data.js';
import { fd, fd1, fK, fMoney, fSign, fPct, fDate, fYearMonth, esc, el, clamp } from './utils.js';
import { TIMELINES, DIFFICULTIES, timelineById } from './timelines.js';
import * as SIM from './sim.js';
import { newGame, saveGame, loadGame, hasSave, clearSave, addLog } from './state.js';
import { REBEL } from './sim.js';
import { panelCourt, panelNavy, panelSpy, panelSociety, panelTrade } from './panels2.js';
import { panelDynasty, panelWorld, panelPowers, panelCouncil } from './panels3.js';
import { SEATS, SEAT_KEYS, seatScore, candidatesFor, appoint, dismiss, educateHeir, purgeCorruption } from './council.js';
import { rulerOf, heirOf, royalById, recalcHeir, arrangeMarriage, SUCCESSION_LAWS } from './dynasty.js';
import { startWonder, WONDERS, LANDMARKS, RARE_RES, regionOf } from './world.js';
import { addToSphere, leaveSphere, fabricateClaim, startCrisis, crisisAddBacker } from './greatpower.js';
import { SEASONS, seasonOfWeek } from './render.js';
import { appointMinister, dismissMinister, charById, charsOf, CABINET } from './characters.js';
import { startShip, cancelShip, orderFleet, setBlockade, loadArmy, unloadArmy, fleetsOf, totalShips, zoneOf, SHIP_CLASSES as SHIP_CLASSES2 } from './naval.js';
import { startOp, abortOp } from './espionage.js';
import { suppressMovement, appeaseMovement, culturalProgram } from './society.js';
import { foundCompany, openRoute, closeRoute, setTariff, startColony, abandonColony } from './trade.js';

export const UI = {
  selProv: -1, selArmy: null, hoverProv: -1, selFleet: null, hoverZone: -1,
  panel: null, mapMode: 'political',
};
let S = null, R = null, A = null, hooks = null;

// ---------- صدا (سینت ساده) ----------
export const Audio2 = {
  on: true, ctx: null,
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; } } },
  beep(f = 600, d = 0.06, type = 'sine', g = 0.05) {
    if (!this.on) return; this.ensure(); if (!this.ctx) return;
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type; o.frequency.value = f; o.connect(gn); gn.connect(this.ctx.destination);
    gn.gain.setValueAtTime(g, this.ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + d);
    o.start(); o.stop(this.ctx.currentTime + d);
  },
  click() { this.beep(650, 0.04, 'triangle', 0.03); },
  alert() { this.beep(420, 0.12, 'sine', 0.06); setTimeout(() => this.beep(520, 0.12, 'sine', 0.05), 110); },
  coin() { this.beep(880, 0.05, 'square', 0.025); },
  drum() { this.beep(90, 0.22, 'sine', 0.12); setTimeout(() => this.beep(70, 0.26, 'sine', 0.10), 130); },
};

export function initUI(state, renderer, h) {
  S = state; R = renderer; hooks = h;
  bindChrome();
  refreshTopbar();
  refreshAlerts();
  refreshDockBadges();
  if (UI.panel) openPanel(UI.panel);
  buildMapModeBar();
  syncDockWidth();
}

// داک روی نمایشگر کوتاه به چند ستون می‌شکند؛ پنل و نوار مُدها باید
// عرض واقعی‌اش را بدانند تا رویش نیفتند.
export function syncDockWidth() {
  const d = document.getElementById('dock');
  if (!d) return;
  const w = Math.ceil(d.getBoundingClientRect().width) + 16;
  document.documentElement.style.setProperty('--dock-w', w + 'px');
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => syncDockWidth());
}

// ================== منوی آغاز ==================
let menuHooks = null;
const menuPrefs = { tl: 'victoria', scenario: 'balance', diff: 'normal' };
try {
  const p = JSON.parse(localStorage.getItem('uc_menu') || '{}');
  if (p.tl && timelineById(p.tl).id === p.tl) menuPrefs.tl = p.tl;
  if (p.diff && DIFFICULTIES.some(d => d.id === p.diff)) menuPrefs.diff = p.diff;
  if (p.scenario) menuPrefs.scenario = p.scenario;
} catch (e) { /* ذخیره‌ی منو در دسترس نیست */ }
function saveMenuPrefs() { try { localStorage.setItem('uc_menu', JSON.stringify(menuPrefs)); } catch (e) { } }

const IDEA_LBL = {
  legitimacy: 'مشروعیت', armyMor: 'روحیه', taxIncome: 'درآمد', urbanOut: 'صنعت', buildCost: 'هزینه ساخت',
  moveSpeed: 'سرعت', armyAtk: 'تهاجم', upkeep: 'هزینه', farm: 'کشاورزی', popGrowth: 'رشد جمعیت',
  tradeCap: 'تجارت', ironBonus: 'آهن', prod: 'تولید', research: 'پژوهش', literacy: 'سواد',
  stability: 'ثبات', unrest: 'ناآرامی', relGain: 'دیپلماسی',
};
export function showMenu(cb) {
  if (cb) menuHooks = cb;
  const m = document.getElementById('menusc');
  m.style.display = 'flex';
  document.getElementById('game').style.display = 'none';
  document.getElementById('btn-continue').style.display = hasSave() ? '' : 'none';
  document.getElementById('menu-buttons').style.display = '';
  document.getElementById('menu-setup').style.display = 'none';
  document.getElementById('btn-new').onclick = () => { Audio2.click(); showSetup(); };
  document.getElementById('btn-continue').onclick = () => { Audio2.click(); menuHooks && menuHooks.continueGame(); };
  document.getElementById('btn-how').onclick = () => { Audio2.click(); showHelp(); };
  document.getElementById('btn-tut').onclick = () => { Audio2.click(); showTutorial(); };
  document.getElementById('tut-close').onclick = () => { Audio2.click(); document.getElementById('tutorial-modal').style.display = 'none'; };
}
export function hideMenu() {
  document.getElementById('menusc').style.display = 'none';
  document.getElementById('game').style.display = '';
}

// ---------- راه‌اندازی بازی جدید: خط زمانی ← سناریو ← سختی ← ملت ----------
function showSetup() {
  document.getElementById('menu-buttons').style.display = 'none';
  const setup = document.getElementById('menu-setup');
  setup.style.display = 'flex';
  // کارت‌های خط زمانی
  const tlc = document.getElementById('tl-cards');
  tlc.innerHTML = '';
  for (const t of TIMELINES) {
    const card = el(`<div class="tl-card" data-tl="${t.id}">
      <div class="tl-ic">${t.icon}</div>
      <div class="tl-nm">${esc(t.name)}</div>
      <div class="tl-tag">${esc(t.tagline)}</div>
      <div class="tl-kind">${t.mapKind === 'real' ? '🗺️ نقشه‌ی واقعی جهان' : '🏰 جهان فانتزی'}</div>
    </div>`);
    card.onclick = () => {
      Audio2.click();
      menuPrefs.tl = t.id;
      if (t.scenarios && t.scenarios.length && !t.scenarios.find(s => s.id === menuPrefs.scenario)) menuPrefs.scenario = t.scenarios[0].id;
      saveMenuPrefs();
      renderSetup();
    };
    tlc.appendChild(card);
  }
  renderSetup();
}

function renderSetup() {
  const tl = timelineById(menuPrefs.tl);
  document.getElementById('menu-title').textContent = tl.name;
  document.getElementById('menu-sub').textContent = `${tl.tagline} — ${tl.desc}`;
  document.querySelectorAll('#tl-cards .tl-card').forEach(c => c.classList.toggle('on', c.dataset.tl === tl.id));
  // سناریو (فقط ویکتوریا)
  const scSec = document.getElementById('scenario-section');
  if (tl.scenarios && tl.scenarios.length) {
    scSec.style.display = '';
    const sc = document.getElementById('scenario-chips');
    sc.innerHTML = '';
    for (const s of tl.scenarios) {
      const chip = el(`<button class="chip" data-sc="${s.id}"><b>${s.icon} ${esc(s.name)}</b><span class="dim">${esc(s.desc)}</span></button>`);
      chip.onclick = () => { Audio2.click(); menuPrefs.scenario = s.id; saveMenuPrefs(); renderSetup(); };
      sc.appendChild(chip);
    }
  } else scSec.style.display = 'none';
  // درجه‌ی سختی
  const dc = document.getElementById('diff-chips');
  dc.innerHTML = '';
  for (const d of DIFFICULTIES) {
    const chip = el(`<button class="chip" data-diff="${d.id}"><b>${d.icon} ${esc(d.name)}</b><span class="dim">${esc(d.desc)}</span></button>`);
    chip.onclick = () => { Audio2.click(); menuPrefs.diff = d.id; saveMenuPrefs(); renderSetup(); };
    dc.appendChild(chip);
  }
  // ملت‌ها
  const defs = tl.mapKind === 'real' ? tl.nations : NATION_DEFS;
  const sc = tl.scenarios && tl.scenarios.find(s => s.id === menuPrefs.scenario);
  const locked = sc && sc.lockedNation !== undefined ? sc.lockedNation : -1;
  const grid = document.getElementById('nation-grid');
  grid.style.display = 'grid';
  grid.innerHTML = '';
  if (locked >= 0 && defs[locked]) {
    grid.appendChild(el(`<div class="setup-note">🔒 این سناریو از نگاه «${esc(defs[locked].name)}» روایت می‌شود — تاریخ را با او پیش ببرید.</div>`));
  }
  defs.forEach((d, i) => {
    if (locked >= 0 && i !== locked) return;
    const card = el(`<div class="nation-card" tabindex="0">
      <div class="nc-flag" id="ncf-${i}"></div>
      <div class="nc-name">${esc(d.name)}</div>
      <div class="nc-ruler">${esc(d.ruler)}</div>
      <div class="nc-desc">${esc(d.desc)}</div>
      <div class="nc-pers">${({ balanced: '⚖️ متعادل', industrial: '🏭 صنعتی', aggressive: '⚔️ جنگ‌جو', trader: '💰 بازرگان', peaceful: '🕊️ صلح‌طلب' })[d.pers] || ''}</div>
      ${d.ideas ? `<div class="nc-idea"><b>${esc(d.ideas.name)}</b>
        <div class="mod-row small">${Object.entries(d.ideas.mods).map(([mk, mv]) => {
          const bad = ['upkeep', 'unrest', 'corruption', 'buildCost'].includes(mk);
          const good = bad ? mv < 0 : mv > 0;
          return `<span class="mod-chip ${good ? 'gd' : 'bd'}">${esc(IDEA_LBL[mk] || mk)} ${(mv > 0 ? '+' : '') + Math.round(mv * 100)}٪</span>`;
        }).join('')}</div></div>` : ''}
    </div>`);
    card.onclick = () => {
      Audio2.click();
      menuHooks && menuHooks.startGame({
        timelineId: tl.id,
        scenarioId: tl.scenarios ? menuPrefs.scenario : null,
        difficulty: menuPrefs.diff,
        nationIdx: i,
      });
    };
    grid.appendChild(card);
  });
  // پرچم‌ها با کانوس
  requestAnimationFrame(() => {
    const tmp = document.createElement('canvas'); tmp.width = 96; tmp.height = 60;
    defs.forEach((d, i) => {
      if (locked >= 0 && i !== locked) return;
      const holder = document.getElementById('ncf-' + i);
      if (!holder) return;
      const cv = tmp.cloneNode(); const ctx = cv.getContext('2d');
      R.drawFlag(ctx, { flag: d.flag, c1: d.c1, c2: d.c2, id: i }, 1, 1, 94, 58);
      holder.appendChild(cv);
    });
  });
  document.getElementById('setup-back').onclick = () => { Audio2.click(); showMenu(); };
}

// ================== کروم بازی ==================
function bindChrome() {
  // سرعت
  for (let i = 0; i <= 4; i++) {
    const b = document.getElementById('sp' + i);
    b.onclick = () => { Audio2.click(); setSpeed(i); };
  }
  // داک
  document.querySelectorAll('#dock .dock-btn').forEach(b => {
    b.onclick = () => { Audio2.click(); togglePanel(b.dataset.panel); };
  });
  document.getElementById('panel-close').onclick = () => { Audio2.click(); closePanel(); };
  // منو همبرگری
  document.getElementById('btn-burger').onclick = () => { Audio2.click(); showGameMenu(); };
}
export function setSpeed(i) {
  // در «افسانه‌ای» فقط پاز/آن‌پاز مجاز است
  if (i !== 0 && S && S.diffMods && S.diffMods.noSpeed) return;
  if (i === 0) { S.paused = !S.paused; }
  else { S.speed = i; S.paused = false; }
  refreshTopbar();
}
function buildMapModeBar() {
  const modes = [
    ['political', '🗺️ سیاسی'], ['terrain', '⛰️ زمین'], ['population', '👥 جمعیت'],
    ['production', '🏭 تولید'], ['unrest', '🔥 ناآرامی'],
    ['culture', '🌍 فرهنگ'], ['religion', '🕌 مذهب'],
    ['naval', '⚓ دریایی'], ['separatism', '🏴 جدایی‌طلبی'], ['devast', '💥 ویرانی'],
    ['houses', '🏰 خاندان‌ها'], ['regions', '🗺️ مناطق'], ['power', '🌟 قدرت'],
  ];
  const bar = document.getElementById('mapmodes');
  bar.innerHTML = '';
  for (const [m, label] of modes) {
    const b = el(`<button class="mm-btn ${UI.mapMode === m ? 'on' : ''}" data-m="${m}">${label}</button>`);
    b.onclick = () => {
      Audio2.click();
      UI.mapMode = m; R.mapMode = m; R.dirtyPol = true;
      bar.querySelectorAll('.mm-btn').forEach(x => x.classList.toggle('on', x.dataset.m === m));
    };
    bar.appendChild(b);
  }
}

// ================== نوار بالا ==================
export function refreshTopbar() {
  const pn = S.nations[S.playerId];
  document.getElementById('tb-flag').src = R.flagURL(pn);
  document.getElementById('tb-name').textContent = pn.name;
  const money = document.getElementById('tb-money');
  money.innerHTML = `${fMoney(pn.treasury)} <span class="dim">(${(pn.ledger ? (pn.ledger.balance >= 0 ? fSign(pn.ledger.balance) : fSign(pn.ledger.balance)) : '±۰')}/هفته)</span>`;
  money.classList.toggle('neg', pn.treasury < 0);
  money.classList.toggle('pos', pn.treasury >= 0);
  document.getElementById('tb-gdp').innerHTML = `🏭 ${fK(pn.gdp || 0)}`;
  document.getElementById('tb-prestige').innerHTML = `👑 ${fd(pn.prestige)}`;
  document.getElementById('tb-pop').innerHTML = `👥 ${fK(SIM.nationPop(S, pn.id))}`;
  document.getElementById('tb-innov').innerHTML = `🎓 ${pn.res && pn.res.key ? fd1(pn.res.pts) + '/' + fd(TECHS[pn.res.key].cost) : '—'}`;
  document.getElementById('tb-lit').innerHTML = `📖 ${fd(Math.round(pn.literacy || 0))}٪`;
  const b = document.getElementById('tb-army');
  b.innerHTML = `🪖 ${fd(Math.round(SIM.armiesOf(S, pn.id).reduce((a, x) => a + x.size, 0)))} + ${fd(Math.max(0, Math.floor(pn.battalions - SIM.armiesOf(S, pn.id).reduce((a, x) => a + x.size, 0))))}`;
  document.getElementById('tb-date').textContent = fDate(S.week);
  // فصل جاری
  const seEl = document.getElementById('tb-season');
  if (seEl) {
    const se = SEASONS[seasonOfWeek(S.week)];
    seEl.innerHTML = `${se.icon} ${se.name}`;
    seEl.title = 'فصل جاری — زمین، آب‌وهوا و حال‌وهوای نقشه با فصل عوض می‌شود';
  }
  // ثبات و مشروعیت
  const stEl = document.getElementById('tb-stab');
  if (stEl) {
    const st = Math.round(pn.stability ?? 50), lg = Math.round(pn.legitimacy ?? 60);
    stEl.innerHTML = `🏛️ ${fd(st)} / 👑 ${fd(lg)}`;
    stEl.className = 'stat' + (st < 25 ? ' neg' : st > 70 ? ' pos' : '');
    stEl.title = `ثبات ${st}٪ و مشروعیت ${lg}٪ — اگر هر دو خیلی پایین بروند، جنگ داخلی می‌شود`;
  }
  // توان دریایی
  const nvEl = document.getElementById('tb-navy');
  if (nvEl) {
    const ns = Math.round(SIM.navalStrengthOf(S, pn.id));
    nvEl.innerHTML = `⚓ ${fd(ns)}`;
    nvEl.title = 'توان ناوگان — برای محاصره، پیاده‌کردن سرباز و حفظ تجارت';
  }
  const eraEl = document.getElementById('tb-era');
  if (eraEl) { eraEl.textContent = `${ERAS[S.era || 0].name}${S.phase === 'prologue' ? ' — دوران شاهزادی' : ''}`; eraEl.title = 'عصر کنونی؛ فناوری‌ها و قابلیت‌های تازه با پیشروی زمان گشایش می‌یابند'; }
  const noSpeed = !!(S.diffMods && S.diffMods.noSpeed);
  for (let i = 0; i <= 4; i++) {
    const btn = document.getElementById('sp' + i);
    if (!btn) continue;
    btn.style.display = (i > 0 && noSpeed) ? 'none' : '';
    btn.classList.toggle('on', i === 0 ? S.paused : (!S.paused && S.speed === i));
    if (noSpeed && i > 0) btn.classList.remove('on');
  }
  // بنر جنگ
  const myWars = S.wars.filter(w => SIM.warHas(S, w, S.playerId));
  const wb = document.getElementById('war-banner');
  if (myWars.length) {
    const w = myWars[0];
    const side = SIM.warSide(S, w, S.playerId);
    const foe = S.nations[side === 'a' ? w.d : w.a];
    const sc = SIM.currentWarScore(S, w, S.playerId);
    wb.style.display = 'flex';
    wb.innerHTML = `⚔️ جنگ با <b>${esc(foe.name)}</b> <span class="wb-score ${sc >= 0 ? 'pos' : 'neg'}">${fSign(sc)}</span> <span class="dim">کلیک برای دیپلماسی</span>`;
    wb.onclick = () => { Audio2.click(); openPanel('diplomacy'); };
  } else wb.style.display = 'none';
}

// ================== هشدارها ==================
function computeAlerts() {
  const pn = S.nations[S.playerId];
  const out = [];
  if (!pn.alive) return out;
  if (pn.treasury < 0) out.push({ icon: '💸', text: 'خزانه منفی است! مالیات را بالا ببرید یا هزینه‌ها را کم کنید', panel: 'politics', lvl: 2 });
  const unrestP = S.map.provs.filter(p => p.owner === pn.id && p.unrest > 55);
  if (unrestP.length) out.push({ icon: '🔥', text: `ناآرامی بالا در ${fd(unrestP.length)} استان`, panel: null, lvl: unrestP.some(p => p.unrest > 75) ? 2 : 1, act: () => selectProv(unrestP[0].id) });
  const unempP = S.map.provs.filter(p => p.owner === pn.id && (p.unempShare || 0) > 0.25);
  if (unempP.length) out.push({ icon: '🥀', text: `بی‌کاری گسترده در ${fd(unempP.length)} استان — کار بسازید`, panel: null, act: () => selectProv(unempP[0].id) });
  if (!pn.res.key) out.push({ icon: '🎓', text: 'پژوهشی انتخاب نشده است', panel: 'tech', lvl: 1 });
  if ((S.goods.arms.fill ?? 1) < 0.75) out.push({ icon: '🔫', text: 'کمبود سلاح در بازار — کارخانه سلاح‌سازی', panel: 'market', lvl: 1 });
  if ((S.dipOffers || []).length) out.push({ icon: '✉️', text: `${fd(S.dipOffers.length)} پیشنهاد دیپلماتیک خوانده‌نشده`, panel: 'diplomacy', lvl: 1 });
  if (pn.treasury > 2500 && !S.map.provs.some(p => p.owner === pn.id && p.queue.length)) out.push({ icon: '🏗️', text: 'خزانه مازاد دارد — ساخت‌وساز را فراموش نکنید', panel: null, act: () => { const c = S.map.provs.find(p => p.owner === pn.id); if (c) selectProv(c.id); } });
  return out;
}
export function refreshAlerts() {
  const col = document.getElementById('alert-col');
  col.innerHTML = '';
  for (const a of computeAlerts()) {
    const d = el(`<div class="alert lvl${a.lvl}"><span class="al-ic">${a.icon}</span><span class="al-tx">${esc(a.text)}</span></div>`);
    d.onclick = () => { Audio2.click(); a.panel ? openPanel(a.panel) : (a.act && a.act()); };
    col.appendChild(d);
  }
}
export function refreshDockBadges() {
  const dip = document.querySelector('#dock [data-panel="diplomacy"]');
  const n = (S.dipOffers || []).length;
  dip.dataset.badge = n ? fd(n) : '';
}

// ================== پنل‌ها ==================
export function togglePanel(name) { UI.panel === name ? closePanel() : openPanel(name); }
export function openPanel(name) {
  UI.panel = name;
  document.querySelectorAll('#dock .dock-btn').forEach(b => b.classList.toggle('on', b.dataset.panel === name));
  const w = document.getElementById('panel-wrap');
  w.style.display = '';
  renderPanel();
}
export function closePanel() {
  UI.panel = null;
  document.querySelectorAll('#dock .dock-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('panel-wrap').style.display = 'none';
}
export function renderPanel() {
  if (!UI.panel) return;
  const body = document.getElementById('panel-body');
  const scroll = body.scrollTop;
  const head = document.getElementById('panel-title');
  const P2 = {
    court:   () => panelCourt(S, UI, R),
    navy:    () => panelNavy(S, UI, R),
    spy:     () => panelSpy(S, UI, R),
    society: () => panelSociety(S, UI, R),
    trade:   () => panelTrade(S, UI, R),
    dynasty: () => panelDynasty(S, UI, R),
    council: () => panelCouncil(S, UI, R),
    world:   () => panelWorld(S, UI, R),
    powers:  () => panelPowers(S, UI, R),
  };
  const fn = { province: panelProvince, market: panelMarket, tech: panelTech, politics: panelPolitics, diplomacy: panelDiplomacy, military: panelMilitary, ranking: panelRanking, log: panelLog, country: panelCountry, missions: panelMissions, family: panelFamily, ...P2 }[UI.panel];
  if (!fn) return;
  const res = fn();
  head.textContent = res.title;
  body.innerHTML = res.html;
  body.scrollTop = scroll;
  if (res.after) res.after();
  bindPanelActions();
}

// ---------- استان ----------
function panelProvince() {
  const p = S.map.provs[UI.selProv];
  if (!p) return { title: 'استان', html: '<div class="empty">روی یک استان کلیک کنید</div>' };
  const pn = S.nations[S.playerId];
  const n = S.nations[p.owner];
  const t = TERRAIN[p.terrain];
  const own = p.owner === S.playerId;
  const pop = Object.values(p.pops).reduce((a, b) => a + b, 0);
  const jobs = SIM.nationJobs(S, p);
  const occ = p.controller !== p.owner;
  let html = `
    <div class="pv-head">
      ${n ? `<img class="flag" src="${R.flagURL(n)}" alt="">` : '<span class="pv-tribe-ic">🏴</span>'}
      <div><div class="pv-name">${esc(p.name)}</div>
      <div class="dim">${n ? esc(n.name) : esc(p.tribe || 'سرزمین بکر') + ' — مستقل'}${occ && n ? ` — <b class="neg">${p.controller === REBEL ? '🔥 اشغال شورشیان' : '⚑ اشغال ' + esc(S.nations[p.controller]?.name || '')}</b>` : ''}</div></div>
    </div>
    <div class="pv-tags">
      <span class="tag">${t.icon} ${t.name}</span>
      ${p.coast ? '<span class="tag">⚓ ساحلی</span>' : ''}
      ${p.res.iron > 0.3 ? '<span class="tag">⛓️ آهن</span>' : ''}
      ${p.res.coal > 0.3 ? '<span class="tag">🪨 زغال</span>' : ''}
      ${p.res.wood > 0.5 ? '<span class="tag">🌲 چوب فراوان</span>' : ''}
      ${p.res.farm > 0.6 ? '<span class="tag">🌾 حاصلخیز</span>' : ''}
      ${n && p.id === n.capital ? '<span class="tag gold">★ پایتخت</span>' : ''}
      ${p.tribe ? `<span class="tag">🏴 ${esc(p.tribe)}</span>` : ''}
    </div>
    <div class="kv">
      <div>👥 جمعیت <b>${fK(pop)}</b></div>
      <div>🥀 بی‌کاری <b>${fPct(p.unempShare || 0)}</b></div>
    </div>
    <div class="bars">
      ${bar('امید به زندگی', (p.sol || 0) / 30, fd1(p.sol || 0), p.sol > 16 ? 'good' : p.sol > 10 ? 'mid' : 'bad')}
      ${bar('ناآرامی', (p.unrest || 0) / 100, fd(p.unrest || 0), p.unrest > 60 ? 'bad' : p.unrest > 30 ? 'mid' : 'good')}
      ${occ && p.occ ? bar('پیشرفت اشغال', p.occ / 100, fPct(p.occ / 100), 'bad') : ''}
    </div>`;
  // جمعیت به تفکیک طبقه
  html += `<div class="sec">جمعیت بر اساس طبقه</div><div class="pops">`;
  for (const c in POP_CLASSES) {
    const cnt = p.pops[c] || 0;
    const job = jobs[c] || 0;
    html += `<div class="pop-row" title="${esc(POP_CLASSES[c].name)}">
      <span>${POP_CLASSES[c].icon} ${POP_CLASSES[c].name}</span>
      <span class="dim">${job > 0 ? fK(Math.min(cnt, job)) + '/' + fK(job) + ' شاغل' : ''}</span>
      <b>${fK(cnt)}</b></div>`;
  }
  html += '</div>';

  // ساختمان‌ها
  html += `<div class="sec">ساختمان‌ها ${own ? '' : '<span class="dim">(فقط مشاهده)</span>'}</div>`;
  if (p.queue.length && own) {
    html += '<div class="queue">';
    p.queue.forEach((q, i) => {
      const bd = BUILDINGS[q.key];
      html += `<div class="q-item"><span>${bd.icon} ${bd.name}</span>
        <div class="q-bar"><i style="width:${clamp((q.prog / bd.weeks) * 100, 2, 100)}%"></i></div>
        <span class="dim">${fd(q.prog || 0)}/${fd(bd.weeks)}</span>
        <button class="mini-btn" data-act="cancel" data-i="${i}" title="لغو">✕</button></div>`;
    });
    html += '</div>';
  }
  html += '<div class="bld-list">';
  for (const k in BUILDINGS) {
    const bd = BUILDINGS[k];
    const lvl = p.bld[k] || 0;
    const cap = SIM.buildingCap(p, k);
    if (cap === 0 && lvl === 0) continue;
    const chk = own ? SIM.canBuild(S, p, k) : { ok: false };
    let prodTxt = [];
    for (const g in bd.prod) prodTxt.push(`${GOODS[g].icon}${bd.prod[g]}`);
    if (bd.income) prodTxt.push(`💰${fd(bd.income)}`);
    if (bd.battalions) prodTxt.push(`🪖${bd.battalions}`);
    if (bd.innovation) prodTxt.push(`🎓${bd.innovation}`);
    let consTxt = [];
    for (const g in bd.cons) consTxt.push(`${GOODS[g].icon}${bd.cons[g]}`);
    const prof = estProfit(k);
    html += `<div class="bld ${lvl ? '' : 'off'}">
      <div class="bld-ic">${bd.icon}</div>
      <div class="bld-mid">
        <div class="bld-name">${bd.name} <span class="lvl">${fd(lvl)}/${fd(cap)}</span></div>
        <div class="bld-sub dim">${prodTxt.join(' ')}${prodTxt.length && consTxt.length ? ' ← ' : ''}${consTxt.join(' ')}</div>
        <div class="bld-sub ${prof >= 0 ? 'pos' : 'neg'}" style="font-size:9.5px">${prof >= 0 ? '≈سود' : '≈زیان'} ${fMoney(prof)}/سطح</div>
      </div>
      ${own ? `<button class="plus ${chk.ok ? '' : 'dis'}" data-act="build" data-k="${k}" ${chk.ok ? '' : `title="${esc(chk.why || '')}"`}>
        +<span class="cost">${fMoney(bd.cost)}</span></button>` : ''}
    </div>`;
  }
  html += '</div>';

  // اقدام نظامی/دیپلماتیک برای استان غیرخودی
  if (!own && n) {
    html += `<div class="sec">اقدامات</div><div class="row-btns">
      ${!SIM.warBetween(S, p.owner, S.playerId) ? `<button class="btn danger" data-act="dow">⚔️ اعلام جنگ برای این استان</button>` : '<div class="dim">در حال جنگ با این ملت هستید</div>'}
      <button class="btn ghost" data-act="dip">🤝 دیپلماسی با ${esc(n.name)}</button>
    </div>`;
  } else if (!own && !n) {
    // سرزمین بکر: راه گرفتنش استعمار است، نه جنگ
    const already = (pn.colonies || []).find(c => c.prov === p.id);
    const near = p.adj.some(q => S.map.provs[q]?.owner === S.playerId);
    html += `<div class="sec">سرزمین بکر</div>
      <div class="dim small" style="margin-bottom:6px">${esc(p.tribe || 'قبیله‌ای مستقل')} در این سرزمین می‌زیند. با مأموریت استعماری می‌توانید آن را به قلمرو بیفزایید.</div>`;
    if (already) {
      html += `<div class="bar-row"><span class="bar-lb">پیشرفت استعمار</span><div class="bar"><i class="gold" style="width:${clamp(already.prog, 0, 100)}%"></i></div><b>${fd(Math.round(already.prog))}٪</b></div>
        <div class="row-btns"><button class="btn ghost" data-act="abandon-col" data-p="${p.id}">🏳️ رها کردن مأموریت</button></div>`;
    } else {
      html += `<div class="row-btns">
        <button class="btn ${near ? '' : 'ghost'}" data-act="colonize" data-p="${p.id}" ${near ? '' : 'title="باید هم‌مرز قلمرو شما باشد"'}>🏴 آغاز مأموریت استعماری</button>
      </div>`;
    }
  }
  return {
    title: `استان ${p.name}`, html,
    after() { }
  };
}
function bar(label, v, txt, cls) {
  return `<div class="bar-row"><span class="bar-lb">${label}</span><div class="bar"><i class="${cls}" style="width:${clamp(v * 100, 0, 100)}%"></i></div><b>${txt}</b></div>`;
}
// تخمین سود هفتگی هر سطح ساختمان با قیمت‌های جاری (مقیاس: PS=0.3، WAGE=9)
function estProfit(key) {
  const bd = BUILDINGS[key];
  const pn = S.nations[S.playerId];
  const wm = SIM.wageMult(S, pn);
  let rev = 0, mat = 0, wag = 0;
  for (const g in bd.prod) rev += bd.prod[g] * S.goods[g].price * 0.26;
  for (const g in bd.cons) mat += bd.cons[g] * S.goods[g].price * 0.26;
  for (const c in bd.jobs) wag += (bd.jobs[c] / 1000) * POP_CLASSES[c].wage * 9 * wm;
  if (bd.income) rev += bd.income;
  return rev - mat - wag;
}

// ---------- بازار ----------
function panelMarket() {
  let rows = '';
  for (const g in GOODS) {
    const G = S.goods[g], base = GOODS[g].base;
    const dev = (G.price - base) / base;
    const cls = dev > 0.15 ? 'up' : dev < -0.15 ? 'down' : '';
    const arrow = dev > 0.05 ? '▲' : dev < -0.05 ? '▼' : '•';
    const fill = clamp((G.fill ?? 1), 0, 1);
    rows += `<div class="mk-row">
      <span class="mk-ic">${GOODS[g].icon}</span>
      <span class="mk-name">${GOODS[g].name}<span class="dim mk-sub">پایه ${fd(base)}</span></span>
      <span class="mk-price ${cls}">${fK(G.price)} <i>${arrow}</i></span>
      <span class="mk-sd dim">عرضه ${fd1(G.s)}<br>تقاضا ${fd1(G.d)}</span>
      <span class="mk-fill"><i style="width:${fill * 100}%" class="${fill > 0.9 ? 'good' : fill > 0.6 ? 'mid' : 'bad'}"></i></span>
      <canvas class="spark" data-good="${g}" width="86" height="26"></canvas>
    </div>`;
  }
  return {
    title: '🏪 بازار جهانی', html: `<div class="dim hint">قیمت‌ها از عرضه و تقاضای همه ملت‌ها شکل می‌گیرد. کمبود، تولید و ارتش را مختل می‌کند.</div><div class="mk-list">${rows}</div>`,
    after() {
      document.querySelectorAll('canvas.spark').forEach(cv => {
        const g = cv.dataset.good;
        sparkline(cv, S.goods[g].hist, GOODS[g].base);
      });
    }
  };
}
export function sparkline(cv, data, baseline) {
  const c = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  if (!data || data.length < 2) return;
  const max = Math.max(...data, baseline || 0) * 1.05, min = Math.min(...data, baseline || 0) * 0.95;
  const rng = Math.max(max - min, 1e-6);
  if (baseline) {
    const by = h - ((baseline - min) / rng) * h;
    c.strokeStyle = 'rgba(200,180,140,0.35)'; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(0, by); c.lineTo(w, by); c.stroke(); c.setLineDash([]);
  }
  c.strokeStyle = '#e8c766'; c.lineWidth = 1.4;
  c.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / rng) * (h - 2) - 1;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.stroke();
}

// ---------- فناوری ----------
function panelTech() {
  const pn = S.nations[S.playerId];
  let cur = '';
  if (pn.res.key) {
    const t = TECHS[pn.res.key];
    cur = `<div class="cur-res"><span>${t.icon} در حال پژوهش: <b>${t.name}</b></span>
      <div class="bar big"><i class="good" style="width:${clamp(pn.res.pts / t.cost * 100, 1, 100)}%"></i></div>
      <span class="dim">${fd1(pn.res.pts)} / ${fd(t.cost)} — نوآوری ${fd1(pn.innov || 4)} در هفته</span></div>`;
  } else {
    cur = `<div class="cur-res dim">⚠️ پژوهشی فعال نیست — یک فناوری برگزینید (نوآوری ${fd1(pn.innov || 4)} در هفته)</div>`;
  }
  let cols = '';
  for (const br in TECH_BRANCHES) {
    cols += `<div class="tech-col"><div class="tech-br">${({ ind: '🏭', mil: '⚔️', soc: '📚' })[br]} ${TECH_BRANCHES[br]}</div>`;
    for (const k in TECHS) {
      const t = TECHS[k];
      if (t.br !== br) continue;
      const done = pn.tech.includes(k);
      const eraLocked = (t.era ?? 0) > (S.era || 0);
      const locked = (t.prereq && !t.prereq.every(x => pn.tech.includes(x))) || eraLocked;
      const active = pn.res.key === k;
      cols += `<div class="tech ${done ? 'done' : active ? 'active' : locked ? 'locked' : ''}" data-act="research" data-k="${k}" title="${esc(t.desc)}${eraLocked && !done ? ' — گشایش در ' + ERAS[t.era].name : ''}">
        <span class="tech-ic">${t.icon}</span>
        <span class="tech-nm">${t.name}${done ? ' ✓' : eraLocked ? ` <span class="chip lock">🔒 ${ERAS[t.era].name}</span>` : ''}</span>
        <span class="tech-cost dim">${done ? '' : fd(t.cost)}</span>
      </div>`;
    }
    cols += '</div>';
  }
  return { title: '🎓 فناوری', html: `${cur}<div class="tech-grid">${cols}</div>` };
}

// ---------- سیاست ----------
function panelPolitics() {
  const pn = S.nations[S.playerId];
  const L = pn.ledger || { taxIncome: 0, tariffs: 0, govWages: 0, armyUpkeep: 0, construction: 0, balance: 0 };
  let html = `<div class="sec">خزانه‌داری (هفتگی)</div>
  <div class="ledger">
    <div><span>💰 مالیات</span><b class="pos">${fMoney(L.taxIncome)}</b></div>
    <div><span>⚓ عوارض تجاری</span><b class="pos">${fMoney(L.tariffs)}</b></div>
    <div><span>🏛️ دیوان‌سالاری</span><b class="neg">−${fK(L.govWages)}</b></div>
    <div><span>⚙️ نگهداشت تأسیسات</span><b class="neg">−${fK(L.upkeep || 0)}</b></div>
    <div><span>🪖 ارتش</span><b class="neg">−${fK(L.armyUpkeep)}</b></div>
    <div><span>🏗️ ساخت‌وساز</span><b class="neg">−${fK(L.construction)}</b></div>
    <div class="total"><span>تراز</span><b class="${L.balance >= 0 ? 'pos' : 'neg'}">${fSign(L.balance)}</b></div>
  </div>
  <div class="dim">ذخیره خزانه: <b class="${pn.treasury < 0 ? 'neg' : 'pos'}">${fMoney(pn.treasury)}</b></div>
  <div class="sec">مالیات</div><div class="tax-btns">`;
  TAX_LEVELS.forEach((t, i) => {
    html += `<button class="tax-btn ${pn.taxLvl === i ? 'on' : ''}" data-act="tax" data-i="${i}" title="${fPct(t.mult)} درآمد">${t.name}</button>`;
  });
  html += `</div><div class="sec">گروه‌های ذی‌نفع</div><div class="groups">`;
  for (const g in GROUPS) {
    const G = pn.groups[g] || { clout: 0, appr: 0 };
    const ap = G.appr;
    const face = ap >= 10 ? '😊' : ap >= 0 ? '🙂' : ap > -10 ? '😟' : '😡';
    html += `<div class="grp">
      <span class="grp-ic">${GROUPS[g].icon}</span>
      <div class="grp-mid"><div class="grp-nm">${GROUPS[g].name} <span class="dim">${face} ${fSign(ap)}</span></div>
      <div class="bar"><i class="${ap >= 0 ? 'good' : 'bad'}" style="width:${clamp(G.clout, 1, 100)}%"></i></div></div>
      <b class="grp-cl">${fd(G.clout)}٪</b></div>`;
  }
  html += `</div><div class="sec">قوانین</div>`;
  if (pn.enact) {
    const e = pn.enact;
    html += `<div class="enact"><span>🏛️ در دست بررسی: <b>${esc(LAWS[e.cat][e.key].name)}</b></span>
      <div class="bar big"><i class="mid" style="width:${clamp(e.prog / e.total * 100, 1, 100)}%"></i></div>
      <span class="dim">شانس تصویب: ${fPct(e.chance())} — ${fd(e.prog)}/${fd(e.total)} هفته</span></div>`;
  }
  for (const cat in LAW_CATS) {
    html += `<div class="law-cat"><div class="law-cat-nm">${LAW_CATS[cat]}</div>`;
    for (const key in LAWS[cat]) {
      const Lw = LAWS[cat][key];
      const cur = pn.laws[cat] === key;
      const lockedTech = Lw.tech && !pn.tech.includes(Lw.tech);
      html += `<div class="law ${cur ? 'cur' : ''} ${lockedTech ? 'locked' : ''}" title="${esc(Lw.desc)}${lockedTech ? ' — نیازمند ' + TECHS[Lw.tech].name : ''}">
        <span>${cur ? '✓' : '○'} ${Lw.name}${lockedTech ? ' 🔒' : ''}</span>
        ${!cur && !lockedTech && !pn.enact ? `<button class="mini-btn" data-act="law" data-cat="${cat}" data-k="${key}">طرح تصویب</button>` : ''}
      </div>`;
    }
    html += '</div>';
  }
  const avgUnrest = S.map.provs.filter(p => p.owner === pn.id).reduce((a, p) => a + p.unrest, 0) / Math.max(1, S.map.provs.filter(p => p.owner === pn.id).length);
  html += `<div class="sec">ثبات</div>${bar('میانگین ناآرامی', avgUnrest / 100, fd(avgUnrest), avgUnrest > 55 ? 'bad' : avgUnrest > 30 ? 'mid' : 'good')}`;
  return { title: '🏛️ سیاست و خزانه', html };
}

// ---------- دیپلماسی ----------
function panelDiplomacy() {
  const pn = S.nations[S.playerId];
  let html = '';
  // پیشنهادها
  const offers = (S.dipOffers || []).filter(o => o.kind !== 'wardeclared');
  if (offers.length) {
    html += '<div class="sec">✉️ پیشنهادهای دریافتی</div>';
    for (const o of offers) {
      const from = S.nations[o.from];
      const kind = o.kind === 'trade' ? '🤝 پیمان تجاری' : o.kind === 'ally' ? '🛡️ اتحاد نظامی' : '🕊️ درخواست صلح';
      html += `<div class="offer"><img class="flag" src="${R.flagURL(from)}"><span><b>${esc(from.name)}</b> — ${kind}</span>
        <span class="row-btns"><button class="mini-btn ok" data-act="offer-yes" data-id="${o.id}">پذیرش</button>
        <button class="mini-btn no" data-act="offer-no" data-id="${o.id}">رد</button></span></div>`;
    }
  }
  // جنگ‌های جاری
  const wars = S.wars.filter(w => SIM.warHas(S, w, S.playerId));
  if (wars.length) {
    html += '<div class="sec">⚔️ جنگ‌های جاری</div>';
    for (const w of wars) {
      const side = SIM.warSide(S, w, S.playerId);
      const foe = S.nations[side === 'a' ? w.d : w.a];
      const sc = SIM.currentWarScore(S, w, S.playerId);
      const goal = w.goal !== null && w.goal !== undefined ? S.map.provs[w.goal].name : '—';
      html += `<div class="war-card">
        <div class="war-h">جنگ با <b>${esc(foe.name)}</b> <span class="dim">هدف: ${esc(goal)} — ${fd(w.weeks)} هفته</span></div>
        <div class="war-score"><i style="width:${clamp((sc + 100) / 2, 2, 98)}%" class="${sc >= 0 ? 'good' : 'bad'}"></i><span>${fSign(sc)}</span></div>
        <div class="row-btns"><button class="btn small" data-act="peace" data-id="${w.id}">🕊️ پیشنهاد صلح</button>
        <span class="dim">با امتیاز بالاتر از +۳۵ می‌توانید خواسته‌ها را تحمیل کنید</span></div>
      </div>`;
    }
  }
  html += '<div class="sec">ملت‌ها</div><div class="dip-list">';
  for (const n of S.nations) {
    if (n.id === S.playerId || !n.alive) continue;
    const rel = Math.round(pn.rel[n.id] ?? 0);
    const pact = pn.pacts[n.id];
    const war = SIM.warBetween(S, pn.id, n.id);
    const relCls = rel > 30 ? 'good' : rel > -20 ? 'mid' : 'bad';
    html += `<div class="dip-row">
      <img class="flag" src="${R.flagURL(n)}" alt="">
      <div class="dip-mid"><div class="dip-nm">${esc(n.name)} ${pact ? (pact === 'ally' ? '<span class="tag gold">🛡️ متحد</span>' : '<span class="tag">🤝 تجاری</span>') : ''} ${war ? '<span class="tag bad">⚔️ جنگ</span>' : ''}</div>
        <div class="dim small">${esc(n.ruler)} — ${({ balanced: 'متعادل', industrial: 'صنعتی', aggressive: 'جنگ‌جو', trader: 'بازرگان', peaceful: 'صلح‌طلب' })[n.pers]}</div>
        <div class="rel-bar"><i class="${relCls}" style="left:${clamp((rel + 100) / 2, 2, 98)}%"></i><span>${fSign(rel)}</span></div>
      </div>
      <div class="dip-btns">
        <button class="mini-btn" data-act="improve" data-n="${n.id}" title="۱۰۰£ — بهبود روابط">🕊️</button>
        ${!pact && !war ? `<button class="mini-btn" data-act="trade" data-n="${n.id}" title="پیمان تجاری (نیاز به روابط +۲۵)">🤝</button>` : ''}
        ${pact === 'trade' ? `<button class="mini-btn" data-act="ally" data-n="${n.id}" title="اتحاد (نیاز به روابط +۶۰)">🛡️</button>` : ''}
        ${pact ? `<button class="mini-btn no" data-act="break" data-n="${n.id}" title="لغو پیمان‌ها">✂️</button>` : ''}
        ${!war ? `<button class="mini-btn danger" data-act="war" data-n="${n.id}" title="اعلام جنگ">⚔️</button>` : ''}
      </div></div>`;
  }
  html += '</div>';
  return { title: '🤝 دیپلماسی', html };
}
// انتخاب استان هدف برای اعلام جنگ از پنل دیپلماسی
function pickWarGoalAndDeclare(targetNationId) {
  const mine = S.map.provs.filter(p => p.owner === S.playerId);
  const theirs = S.map.provs.filter(p => p.owner === targetNationId);
  if (!mine.length || !theirs.length) return toast('⚠️', 'جنگ ممکن نیست');
  const border = theirs.filter(p => p.adj.some(q => S.map.provs[q].owner === S.playerId));
  let goal;
  if (border.length) goal = border[Math.floor(Math.random() * border.length)];
  else {
    // نزدیک‌ترین استان دشمن به خاک ما
    goal = theirs.reduce((a, b) => {
      const da = Math.min(...mine.map(m => Math.hypot(m.cx - a.cx, m.cy - a.cy)));
      const db = Math.min(...mine.map(m => Math.hypot(m.cx - b.cx, m.cy - b.cy)));
      return db < da ? b : a;
    });
  }
  declareForProvince(goal.id);
}
function declareForProvince(pid) {
  const p = S.map.provs[pid];
  const n = S.nations[p.owner];
  if (!n) { toast('⚠️', 'این سرزمین صاحبی ندارد — با مأموریت استعماری آن را بگیرید'); return; }
  confirmBox(`اعلام جنگ به ${n.name}`, `آیا برای تصرف استان «${p.name}» به ${n.name} اعلام جنگ می‌دهید؟ این کار روابط شما با جهان را تیره می‌کند.`, () => {
    SIM.declareWar(S, S.playerId, p.owner, pid);
    R.dirtyBorders = true;
    renderPanel(); refreshTopbar();
    Audio2.drum();
  });
}

// ---------- نظامی ----------
function panelMilitary() {
  const pn = S.nations[S.playerId];
  const armies = SIM.armiesOf(S, pn.id);
  const fielded = armies.reduce((a, x) => a + x.size, 0);
  const cap = SIM.battalionCap(S, pn);
  const reserve = Math.max(0, pn.battalions - fielded);
  let html = `<div class="kv">
    <div>🪖 گردان‌ها <b>${fd(Math.round(fielded))} + ${fd(Math.floor(reserve))} ذخیره</b></div>
    <div>🏰 ظرفیت (پادگان) <b>${fd(cap)}</b></div>
    <div>🔥 خستگی جنگ <b class="${(pn.warExh || 0) > 35 ? 'neg' : ''}">${fd(Math.round(pn.warExh || 0))}٪</b></div>
  </div>
  <div class="dim hint">برای فرمان: ارتش را «برگزینید» و سپس روی استان مقصد کلیک کنید. خوابگاه در زمین خودی، سنگر می‌سازد؛ محاصره‌ی زمین دشمن تدارکات را می‌پوساند.</div>
  <div class="row-btns">
    <button class="btn small" data-act="newarmy">➕ ارتش تازه در پایتخت</button>
    ${UI.selArmy ? `<button class="btn small ghost" data-act="desel">لغو انتخاب ارتش</button>` : ''}
  </div>
  <div class="sec">ارتش‌ها (${fd(armies.length)})</div>`;
  if (!armies.length) html += '<div class="dim">ارتشی در میدان نیست.</div>';
  for (const a of armies) {
    const p = S.map.provs[a.prov];
    const st = a.status === 'battle' ? '⚔️ در نبرد' : a.status === 'move' ? `🏃 به‌سوی ${S.map.provs[a.path[a.path.length - 1]]?.name ?? ''}` : '🧍 آماده‌باش';
    const genTx = a.gen ? ` — ${esc(a.gen.name)}${a.gen.skill >= 1.15 ? ' ⭐' : ''}` : '';
    const digTx = (a.dig || 0) > 2 ? ` 🛡️+${fd(Math.round(a.dig))}` : '';
    html += `<div class="army ${UI.selArmy === a.id ? 'sel' : ''}">
      <div class="army-mid"><b>${fd(Math.round(a.size))} 🪖${genTx}${digTx}</b> در ${esc(p.name)} <span class="dim">— ${st}</span>
        <div class="bar"><i class="${a.org > 50 ? 'good' : 'mid'}" style="width:${a.org}%"></i></div></div>
      <div class="dip-btns">
        <button class="mini-btn" data-act="selarmy" data-id="${a.id}" title="برگزیدن برای فرمان">🎯</button>
        <button class="mini-btn no" data-act="disband" data-id="${a.id}" title="انحلال (بازگشت به ذخیره)">✕</button>
      </div></div>`;
  }
  // ارتش‌های شورشی
  const rebs = S.armies.filter(a => a.n === REBEL);
  if (rebs.length) {
    html += '<div class="sec">🔥 شورش‌ها</div>';
    for (const a of rebs) html += `<div class="army reb"><b>${fd(Math.round(a.size))} شورشی</b> در ${esc(S.map.provs[a.prov].name)}</div>`;
  }
  return { title: '🪖 نظام', html };
}

// ---------- رتبه‌بندی ----------
function panelRanking() {
  const rk = SIM.ranking(S);
  const max = rk[0]?.prestige || 1;
  let html = '<div class="dim hint">اعتبار از ترکیب تولید ناخالص، نیروی نظامی، فناوری و امید به زندگی محاسبه می‌شود. در سال ۱۹۰۰ قدرت نخست باشید!</div>';
  let gdpMax = 1;
  html += '<div class="rank-list">';
  rk.forEach((n, i) => {
    const crown = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : fd(i + 1) + '.';
    html += `<div class="rank ${n.player ? 'me' : ''} ${n.alive ? '' : 'dead'}">
      <span class="rank-pos">${crown}</span>
      <img class="flag" src="${R.flagURL(n)}">
      <div class="rank-mid"><b>${esc(n.name)}</b>
        <div class="bar"><i class="good" style="width:${clamp(n.prestige / max * 100, 1, 100)}%"></i></div>
        <div class="dim small">🏭 ${fK(n.gdp)} — 🪖 ${fd(Math.round(n.battalions + SIM.armiesOf(S, n.id).reduce((a, x) => a + x.size, 0)))} — 🎓 ${fd(n.tech.length)} — 😊 ${fd1(SIM.avgSol(S, n.id))}</div>
      </div>
      <b>${fd(n.prestige)}</b></div>`;
  });
  html += '</div>';
  html += '<div class="sec">مسیر تولید ناخالص</div><div class="gdp-chart"><canvas id="gdp-canvas" width="380" height="150"></canvas></div>';
  return {
    title: '👑 رتبه‌بندی قدرت‌ها', html,
    after() {
      const cv = document.getElementById('gdp-canvas');
      if (!cv) return;
      const c = cv.getContext('2d');
      const top = rk.filter(n => n.alive).slice(0, 5);
      let mx = 1;
      top.forEach(n => { const h = S.stats.gdp[n.id] || []; h.forEach(v => mx = Math.max(mx, v)); });
      c.fillStyle = 'rgba(240,230,200,0.06)'; c.fillRect(0, 0, cv.width, cv.height);
      for (const n of top) {
        const h = S.stats.gdp[n.id] || [];
        if (h.length > 1) {
          c.strokeStyle = n.c2 === '#2b2118' || n.c2 === '#3a2f1d' ? n.c1 : n.c2;
          c.lineWidth = n.player ? 2.4 : 1.3;
          c.beginPath();
          h.forEach((v, i) => {
            const x = (i / (h.length - 1)) * cv.width;
            const y = cv.height - (v / mx) * (cv.height - 8) - 4;
            i ? c.lineTo(x, y) : c.moveTo(x, y);
          });
          c.stroke();
        }
        // برچسب
      }
      let lx = 6, ly = 12;
      for (const n of top) { c.fillStyle = '#efe8d0'; c.font = '10px Vazirmatn'; c.textAlign = 'left'; c.fillText('■ ' + n.name, lx, ly); c.fillStyle = n.c1; lx += c.measureText('■ ' + n.name).width + 10; }
    }
  };
}

// ---------- تاریخچه ----------
function panelLog() {
  const items = S.log.slice().reverse();
  let html = '';
  for (const l of items) html += `<div class="log-row"><span class="log-ic">${l.icon}</span><span class="log-tx">${esc(l.text)}</span><span class="log-d dim">${fYearMonth(l.w)}</span></div>`;
  return { title: '📜 تاریخچه رویدادها', html };
}

// ---------- کشور (نمای کلی) ----------
function panelCountry() {
  const pn = S.nations[S.playerId];
  const rk = SIM.ranking(S).filter(n => n.alive);
  const rank = rk.findIndex(r => r.id === pn.id) + 1;
  const pops = {};
  let tot = 0, bldTot = 0;
  for (const p of S.map.provs) {
    if (p.owner !== pn.id) continue;
    for (const c in p.pops) { pops[c] = (pops[c] || 0) + p.pops[c]; tot += p.pops[c]; }
    for (const k in p.bld) bldTot += p.bld[k];
  }
  const popMax = Math.max(...Object.values(pops), 1);
  let rows = '';
  for (const c in POP_CLASSES) {
    const v = pops[c] || 0;
    rows += `<div class="bar-row"><span class="bar-lb">${POP_CLASSES[c].icon} ${POP_CLASSES[c].name}</span><div class="bar"><i class="mid" style="width:${clamp(v / popMax * 100, 0.5, 100)}%"></i></div><b>${fK(v)}</b></div>`;
  }
  const provN = S.map.provs.filter(p => p.owner === pn.id).length;
  const doneM = (pn.missionsDone || []).length;
  return {
    title: '🏰 کشور — نمای کلی',
    html: `
    <div class="kv">
      <div>👑 رتبه جهانی <b>${fd(rank)} از ${fd(rk.length)}</b></div>
      <div>🗺️ استان‌ها <b>${fd(provN)}</b></div>
      <div>🏢 ساختمان‌ها <b>${fd(bldTot)}</b></div>
      <div>👥 جمعیت <b>${fK(tot)}</b></div>
    </div>
    <div class="bar-row"><span class="bar-lb">📖 سواد</span><div class="bar"><i class="good" style="width:${clamp(pn.literacy || 0, 1, 100)}%"></i></div><b>${fd(Math.round(pn.literacy || 0))}٪</b></div>
    <div class="dim hint">سواد با دانشگاه و فناوری سوادآموزی رشد می‌کند و بر مشاغل منشی و سرعت پژوهش اثر دارد.</div>
    <div class="sec">مسیر تولید ناخالص</div>
    <div class="chart-box"><canvas id="cn-gdp" width="380" height="88"></canvas></div>
    <div class="sec">مسیر امید به زندگی</div>
    <div class="chart-box"><canvas id="cn-sol" width="380" height="66"></canvas></div>
    <div class="sec">ترکیب جمعیت</div>${rows}
    <div class="sec">مأموریت‌ها</div>
    <div class="dim">${fd(doneM)} از ${fd(MISSIONS.length)} تکمیل شده — برای جزئیات پنل 🎯 را ببینید</div>`,
    after() {
      const g = document.getElementById('cn-gdp');
      if (g) lineChart(g, S.stats.gdp[pn.id] || [], '#e8c766');
      const s2 = document.getElementById('cn-sol');
      if (s2) lineChart(s2, S.stats.sol[pn.id] || [], '#8fbc6a');
    }
  };
}
function lineChart(cv, data, color) {
  const c = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  c.fillStyle = 'rgba(240,230,200,0.05)'; c.fillRect(0, 0, w, h);
  if (!data || data.length < 2) { c.fillStyle = '#998f76'; c.font = '11px Vazirmatn'; c.fillText('جمع‌آوری داده…', 10, h / 2); return; }
  const mn = Math.min(...data), mx = Math.max(...data), r = Math.max(mx - mn, 1e-6);
  c.strokeStyle = color; c.lineWidth = 1.6; c.beginPath();
  data.forEach((v, i) => {
    const x = 3 + (i / (data.length - 1)) * (w - 6);
    const y = h - 4 - ((v - mn) / r) * (h - 10);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.stroke();
  c.fillStyle = '#e8dfc4'; c.font = '9.5px Vazirmatn'; c.textAlign = 'left';
  c.fillText(fK(mx), 4, 10);
  c.fillText(fK(mn), 4, h - 3);
}

// ---------- مأموریت‌ها ----------
function panelMissions() {
  const pn = S.nations[S.playerId];
  const done = pn.missionsDone || [];
  let html = '<div class="dim hint">هدف‌های کلان امپراتوری؛ با تکمیل هرکدام پاداش می‌گیرید.</div>';
  const sorted = MISSIONS.slice().sort((a, b2) => (done.includes(a.id) ? 1 : 0) - (done.includes(b2.id) ? 1 : 0));
  for (const m of sorted) {
    const isDone = done.includes(m.id);
    let p = { cur: 0, max: 1 };
    try { p = m.prog(S, SIM.missionHelpers, pn); } catch (e) { }
    const pct = clamp(p.cur / p.max * 100, 0, 100);
    const rw = [];
    if (m.reward.money) rw.push('💰' + fK(m.reward.money));
    if (m.reward.prestige) rw.push('👑+' + fd(m.reward.prestige));
    if (m.reward.research) rw.push('🎓+' + fd(m.reward.research));
    if (m.reward.solAll) rw.push('😊+' + fd(m.reward.solAll));
    html += `<div class="mission ${isDone ? 'done' : ''}">
      <span class="mi-ic">${m.icon}</span>
      <div class="mi-mid">
        <div class="mi-nm">${m.title} ${isDone ? '✅' : ''}</div>
        <div class="dim small">${m.desc}</div>
        <div class="bar"><i class="${isDone ? 'good' : 'mid'}" style="width:${pct}%"></i></div>
      </div>
      <div class="mi-side"><b>${fd(Math.min(Math.floor(p.cur), p.max))}/${fd(p.max)}</b><br><span class="dim small">${rw.join(' ')}</span></div>
    </div>`;
  }
  return { title: '🎯 مأموریت‌ها', html };
}

// ---------- دربار سلطنتی (خانواده) ----------
function panelFamily() {
  const pn = S.nations[S.playerId];
  const per = pn.personality ? PERSONALITIES[pn.personality] : null;
  let html = '';
  if (S.phase === 'prologue') {
    const done = (S.prologue?.step || 0), tot = 6;
    html += `<div class="prologue-banner">👑 <b>دوران شاهزادی</b> — پیش از تاج، سلسله تصمیم‌هایی در راه است که شخصیت حکومت شما را می‌سازد…
      <div class="bar big prolit"><i class="gold" style="width:${done / tot * 100}%"></i></div>`;
    const t = S.prologue?.traits || {};
    const tStr = Object.entries(t).map(([k, v]) => `${PERSONALITIES[k]?.icon || ''} ${PERSONALITIES[k]?.name || k} ×${fd(v)}`).join('، ');
    html += `<div class="dim small">${tStr ? 'گرایش‌های فعلی: ' + tStr : 'هنوز تصمیم معناداری نگرفته‌اید'}</div></div>`;
  } else if (per) {
    html += `<div class="prologue-banner">👑 فرمانروای ${esc(pn.name)} — سبک حکومت: <b>${per.icon} ${per.name}</b> <span class="dim">(${per.desc})</span></div>`;
  }
  html += `<div class="fam-card me"><img class="fam-avatar" src="assets/family/prince.jpg" alt="">
    <div class="fam-mid"><b>${S.phase === 'prologue' ? 'شاهزاده' : 'فرمانروا'} — شما</b>
    <div class="fam-traits"><span class="chip">${S.phase === 'prologue' ? 'وارث تاج' : 'تاج‌دار'}</span>${per ? `<span class="chip">${per.icon} ${per.name}</span>` : ''}</div></div></div>`;
  for (const m of S.family || []) {
    const relPct = Math.max(0, Math.min(100, m.rel));
    const sub = m.alive ? '' : (m.fled ? '(گریخته — مدعی تاج)' : '(درگذشت)');
    html += `<div class="fam-card ${m.alive ? '' : 'dead'}">
      <img class="fam-avatar" src="${m.avatar}" alt="">
      <div class="fam-mid">
        <b>${esc(m.name)}</b> <span class="dim small">${FAMILY_ROLES_FA[m.role] || m.role} — ${fd(Math.floor(m.age))} سال ${sub}</span>
        <div class="fam-traits">${(m.traits || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}${m.jailed && m.alive ? '<span class="chip bad">حصر سلطنتی</span>' : ''}</div>
      </div>
      <div class="fam-rel">${m.alive ? `<div class="bar"><i class="${relPct > 65 ? 'good' : relPct > 35 ? 'mid' : 'bad'}" style="width:${relPct}%"></i></div><span class="dim small">رابطه ${fd(Math.round(relPct))}</span>
        <button class="mini-btn" data-act="talk" data-id="${m.id}" title="گفت‌وگو">💬</button>` : '<span class="dim">🕯️</span>'}
      </div>
    </div>`;
  }
  html += `<div class="dim hint">💬 با اعضای دربار گفت‌وگو کنید؛ رابطه‌ی بالاتر یاری بیشتری می‌آورد (و «درخواست یاری» را ممکن می‌سازد). رابطه‌ی پایین برادر، خواب‌های خطرناک می‌پروراند…</div>`;
  return { title: '🏰 دربار سلطنتی', html };
}

// ---------- مودال گفت‌وگو ----------
let chatMember = null;
function topicName(id) { const t = TALK_TOPICS.find(x => x.id === id); return t ? t.name : id; }
function showChat(mId) {
  const m = (S.family || []).find(x => x.id === mId && x.alive);
  if (!m) return;
  chatMember = mId;
  document.getElementById('chat-modal').style.display = 'flex';
  renderChat();
}
function renderChat() {
  const m = (S.family || []).find(x => x.id === chatMember && x.alive);
  if (!m) { document.getElementById('chat-modal').style.display = 'none'; return; }
  const box = document.getElementById('chat-box');
  const relClass = m.rel >= 68 ? 'good' : m.rel > 32 ? 'mid' : 'bad';
  let histHtml = '';
  for (const h of (m.hist || [])) {
    histHtml += `<div class="chat-row q"><span class="chat-bubble">${esc(h.free || topicName(h.topic))}</span></div>
      <div class="chat-row a"><span class="chat-bubble">${esc(h.a)} <span class="dim small">${h.dRel > 0 ? `(+${fd(h.dRel)})` : h.dRel < 0 ? `(${fd(h.dRel)})` : ''} ${h.note ? esc(h.note) : ''}</span></span></div>`;
  }
  box.innerHTML = `
    <div class="chat-head">
      <img class="fam-avatar big" src="${m.avatar}" alt="">
      <div class="chat-head-mid"><b>${esc(m.name)}</b><div class="dim small">${FAMILY_ROLES_FA[m.role]} — ${fd(Math.floor(m.age))} سال</div>
      <div class="bar chatrel"><i class="${relClass}" style="width:${m.rel}%"></i></div></div>
      <button class="mini-btn" id="chat-close">✕</button>
    </div>
    <div class="chat-log" id="chat-log">${histHtml || '<div class="dim small">گفت‌وگو را آغاز کنید؛ موضوعی برگزینید یا چیزی بنویسید…</div>'}</div>
    <div class="chat-topics">${TALK_TOPICS.map(t => `<button class="mini-btn chat-tp" data-tp="${t.id}">${t.name}</button>`).join('')}</div>
    <div class="chat-input"><input id="chat-free" placeholder="چیزی بنویسید… مثلاً: درباره‌ی جنگ با همسایه‌ها چه می‌گویی؟"><button id="chat-send" class="mini-btn">➤</button></div>`;
  document.getElementById('chat-close').onclick = () => { Audio2.click(); document.getElementById('chat-modal').style.display = 'none'; if (UI.panel === 'family') renderPanel(); };
  box.querySelectorAll('.chat-tp').forEach(b => b.onclick = () => {
    Audio2.click();
    SIM.familyTalk(S, m.id, b.dataset.tp);
    renderChat(); refreshTopbar();
    if (UI.panel === 'family') renderPanel();
  });
  const send = () => {
    const inp = document.getElementById('chat-free');
    const txt = inp.value.trim();
    if (!txt) return;
    Audio2.click();
    SIM.familyTalk(S, m.id, null, txt);
    renderChat();
    const log = document.getElementById('chat-log');
    if (log) log.scrollTop = log.scrollHeight;
  };
  document.getElementById('chat-send').onclick = send;
  document.getElementById('chat-free').onkeydown = e => { if (e.key === 'Enter') send(); };
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

// ================== اکشن‌های پنل ==================
function bindPanelActions() {
  document.querySelectorAll('#panel-body [data-act]').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      const act = b.dataset.act;
      Audio2.click();
      doAction(act, b);
    };
  });
}
function doAction(act, b) {
  const pn = S.nations[S.playerId];
  const p = S.map.provs[UI.selProv];
  switch (act) {
    case 'build': {
      const r = SIM.startBuild(S, p, b.dataset.k);
      if (r.ok) { toast('🏗️', `ساخت ${BUILDINGS[b.dataset.k].name} در ${p.name} آغاز شد`); Audio2.coin(); }
      else toast('⚠️', r.why || 'ممکن نیست');
      break;
    }
    case 'cancel': SIM.cancelBuild(S, p, +b.dataset.i); break;
    case 'research': {
      const k = b.dataset.k;
      if (pn.tech.includes(k)) break;
      SIM.startResearch(S, pn, k);
      break;
    }
    case 'tax': SIM.setTax(S, pn.id, +b.dataset.i); refreshTopbar(); break;
    case 'law': {
      const cat = b.dataset.cat, k = b.dataset.k;
      const info = SIM.lawEnactInfo(S, pn, cat, k);
      confirmBox('طرح قانون', `تصویب «${LAWS[cat][k].name}» — شانس موفقیت ${fPct(info.chance)}، زمان حدود ${fd(info.total)} هفته. ادامه؟`, () => {
        SIM.startEnact(S, pn, cat, k); renderPanel();
      });
      return;
    }
    case 'improve': { const r = SIM.improveRelations(S, pn.id, +b.dataset.n); if (!r.ok) toast('⚠️', r.why); break; }
    case 'trade': { const r = SIM.proposePact(S, pn.id, +b.dataset.n, 'trade'); if (!r.ok) toast('⚠️', r.why); break; }
    case 'ally': { const r = SIM.proposePact(S, pn.id, +b.dataset.n, 'ally'); if (!r.ok) toast('⚠️', r.why); break; }
    case 'break': {
      confirmBox('لغو پیمان', 'پیمان‌ها لغو و روابط آسیب می‌بیند. ادامه؟', () => { SIM.breakPact(S, pn.id, +b.dataset.n); renderPanel(); });
      return;
    }
    case 'war': pickWarGoalAndDeclare(+b.dataset.n); return;
    case 'dow': declareForProvince(UI.selProv); return;
    case 'dip': openPanel('diplomacy'); return;
    case 'peace': {
      const r = SIM.playerOfferPeace(S, +b.dataset.id);
      toast(r.ok ? '🕊️' : '⚠️', r.ok ? (r.kind === 'enforce' ? 'خواسته‌ها تحمیل شد!' : 'صلح برقرار شد') : (r.why || 'صلح پذیرفته نشد'));
      refreshTopbar(); break;
    }
    case 'offer-yes': SIM.respondOffer(S, +b.dataset.id, true); refreshDockBadges(); break;
    case 'offer-no': SIM.respondOffer(S, +b.dataset.id, false); refreshDockBadges(); break;
    case 'newarmy': {
      const r = SIM.createArmy(S, pn.id, pn.capital);
      toast(r.ok ? '🪖' : '⚠️', r.ok ? 'ارتش تازه در پایتخت سازمان یافت' : r.why);
      break;
    }
    case 'selarmy': {
      UI.selArmy = +b.dataset.id;
      toast('🎯', 'ارتش برگزیده شد — روی استان مقصد کلیک کنید');
      break;
    }
    case 'desel': UI.selArmy = null; break;
    case 'disband': {
      const a = S.armies.find(x => x.id === +b.dataset.id);
      if (a) { SIM.disbandArmy(S, a); if (UI.selArmy === a.id) UI.selArmy = null; }
      break;
    }
    case 'talk': { showChat(+b.dataset.id); return; }

    // ---------- دربار و کابینه ----------
    case 'hire-min': {
      const r = appointMinister(S, pn, b.dataset.role, +b.dataset.id);
      toast(r.ok ? '🎩' : '⚠️', r.ok ? `به سِمت ${CABINET[b.dataset.role].name} منصوب شد (${fMoney(r.cost)})` : r.why);
      if (r.ok) Audio2.coin();
      break;
    }
    case 'fire-min': {
      const role = b.dataset.role;
      confirmBox('برکناری وزیر', `آیا ${CABINET[role].name} را برکنار می‌کنید؟ وفاداری‌اش به‌شدت می‌شکند.`, () => {
        const r = dismissMinister(S, pn, role);
        toast(r.ok ? '📜' : '⚠️', r.ok ? `${r.name} برکنار شد` : r.why);
        renderPanel(); refreshTopbar();
      });
      return;
    }
    case 'open-hire': { toast('📋', 'از فهرست «نامزدهای در دسترس» پایین همین پنل انتخاب کنید'); break; }

    // ---------- نیروی دریایی ----------
    case 'build-ship': {
      const p2 = S.map.provs[+b.dataset.p];
      const r = startShip(S, p2, b.dataset.k);
      toast(r.ok ? '⚓' : '⚠️', r.ok ? `ساخت ${SHIP_CLASSES2[b.dataset.k].name} در ${p2.name} آغاز شد` : r.why);
      if (r.ok) Audio2.coin();
      break;
    }
    case 'cancel-ship': { cancelShip(S, S.map.provs[+b.dataset.p], +b.dataset.i); break; }
    case 'sel-fleet': {
      UI.selFleet = +b.dataset.id; UI.selArmy = null;
      toast('🎯', 'ناوگان برگزیده شد — روی دریا کلیک کنید تا حرکت کند، یا روی بندر دشمن برای محاصره');
      break;
    }
    case 'desel-fleet': UI.selFleet = null; break;
    case 'assign-adm': {
      const f = S.fleets.find(x => x.id === +b.dataset.id);
      const adm = charsOf(S, pn.id, 'admiral').find(c => c.assigned === null && !c.post);
      if (!f) break;
      if (!adm) { toast('⚠️', 'دریاسالار آزادی ندارید'); break; }
      f.admId = adm.id; adm.assigned = f.id;
      toast('👤', `${adm.name} فرماندهی ناوگان را بر عهده گرفت`);
      break;
    }
    case 'load-army': {
      const f = S.fleets.find(x => x.id === +b.dataset.id);
      if (!f) break;
      const army = S.armies.find(a => a.n === pn.id && a.status === 'idle' && S.map.provs[a.prov].seaZone === f.zone && S.map.provs[a.prov].coast);
      if (!army) { toast('⚠️', 'ارتشی در بندرهای این منطقه آماده نیست'); break; }
      const r = loadArmy(S, f, army);
      toast(r.ok ? '🪖' : '⚠️', r.ok ? 'سربازان سوار شدند' : r.why);
      break;
    }
    case 'unload': {
      const f = S.fleets.find(x => x.id === +b.dataset.id);
      if (!f) break;
      const z = zoneOf(S, f.zone);
      const port = (z?.ports || []).map(id => S.map.provs[id])
        .find(p2 => p2.owner === pn.id || p2.controller === pn.id) || (z?.ports || []).map(id => S.map.provs[id])[0];
      if (!port) { toast('⚠️', 'بندری برای پیاده‌شدن نیست'); break; }
      const r = unloadArmy(S, f, port.id);
      toast(r.ok ? '🪖' : '⚠️', r.ok ? `سربازان در ${port.name} پیاده شدند` : r.why);
      if (r.ok) Audio2.drum();
      break;
    }

    // ---------- جاسوسی ----------
    case 'start-op': {
      const r = startOp(S, pn, b.dataset.k, +b.dataset.n, null);
      toast(r.ok ? '🕵️' : '⚠️', r.ok ? 'عملیات آغاز شد — نتیجه در چند هفته' : r.why);
      break;
    }
    case 'abort-op': { abortOp(S, pn, +b.dataset.id); toast('🚫', 'عملیات لغو شد'); break; }

    // ---------- جامعه ----------
    case 'suppress': {
      const r = suppressMovement(S, pn, b.dataset.k);
      toast(r.ok ? '🔨' : '⚠️', r.ok ? 'جنبش سرکوب شد — اما تندروتر شدند' : r.why);
      break;
    }
    case 'appease': {
      const r = appeaseMovement(S, pn, b.dataset.k);
      toast(r.ok ? '🕊️' : '⚠️', r.ok ? 'با جنبش مصالحه شد' : r.why);
      break;
    }
    case 'cult-prog': {
      const r = culturalProgram(S, pn, +b.dataset.p);
      toast(r.ok ? '📚' : '⚠️', r.ok ? 'برنامه‌ی فرهنگی اجرا شد' : r.why);
      break;
    }
    case 'goto-prov': { selectProv(+b.dataset.p); return; }

    // ---------- تجارت ----------
    case 'tariff': { setTariff(S, pn, +b.dataset.i); break; }
    case 'open-route': {
      const nSel = document.getElementById('route-nation'), gSel = document.getElementById('route-good');
      if (!nSel || !gSel) break;
      const r = openRoute(S, pn, +nSel.value, gSel.value);
      toast(r.ok ? '🛣️' : '⚠️', r.ok ? `مسیر ${r.dir === 'export' ? 'صادراتی' : 'وارداتی'} گشوده شد` : r.why);
      break;
    }
    case 'close-route': { closeRoute(S, pn, +b.dataset.i); break; }
    case 'found-co': {
      const r = foundCompany(S, pn, b.dataset.k);
      toast(r.ok ? '🏢' : '⚠️', r.ok ? 'شرکت تأسیس شد' : r.why);
      if (r.ok) Audio2.coin();
      break;
    }
    case 'colonize': {
      const r = startColony(S, pn, +b.dataset.p);
      toast(r.ok ? '🏴' : '⚠️', r.ok ? 'مأموریت استعماری آغاز شد' : r.why);
      break;
    }
    // ---------- شورای درباری، فساد، دسیسه، تربیت وارث ----------
    case 'corr-audit': { const r = purgeCorruption(S, pn, 'audit'); toast(r.ok ? '🔍' : '⛔', r.ok ? r.msg : r.why); break; }
    case 'corr-purge': {
      confirmBox('پاکسازی بزرگ', 'فساد به‌شدت کم می‌شود، اما خاندان‌های بزرگ کینه می‌گیرند و ناآرامی بالا می‌رود. مطمئنید؟', () => {
        const r = purgeCorruption(S, pn, 'purge'); toast(r.ok ? '⚔️' : '⛔', r.ok ? r.msg : r.why); renderPanel(); refreshTopbar();
      });
      break;
    }
    case 'seat-dismiss': {
      const k = b.dataset.k;
      confirmBox('عزل از شورا', `${SEATS[k].name} را عزل می‌کنید؟ خاندانش کینه خواهد گرفت.`, () => {
        dismiss(S, pn, k); toast('🏛️', 'عزل انجام شد'); renderPanel();
      });
      break;
    }
    case 'seat-change': {
      const k = b.dataset.k;
      const cands = candidatesFor(S, pn, k);
      if (!cands.length) { toast('⛔', 'نامزد شایسته‌ای در دربار نیست'); break; }
      const rows = cands.map(c => {
        const sc = seatScore(c.r, k);
        const kindTxt = c.kind === 'prince' ? 'شاهزاده' : `سرِ خاندان ${esc(c.fac?.house || '')}`;
        return `<button class="cand-row" data-rid="${c.r.id}">
          <span class="cand-n"><b>${esc(c.r.name)}</b><small>${kindTxt}</small></span>
          <span class="cand-s">${'●'.repeat(Math.round(sc / 4))}${'○'.repeat(Math.max(0, 5 - Math.round(sc / 4)))} <small>${sc}/۲۰</small></span>
        </button>`;
      }).join('');
      pickBox(`گماردن ${SEATS[k].name}`, rows, rid => {
        const r = appoint(S, pn, k, +rid);
        toast(r.ok ? '🏛️' : '⛔', r.ok ? 'انتصاب انجام شد' : r.why);
        renderPanel(); refreshTopbar();
      });
      break;
    }
    case 'edu-heir': {
      const r = educateHeir(S, pn, b.dataset.k);
      toast(r.ok ? '📚' : '⛔', r.ok ? 'استاد تازه گمارده شد' : r.why);
      break;
    }
    case 'plot-arrest': {
      if (!pn.plot) break;
      const head = royalById(S, pn.plot.headId);
      confirmBox('دستگیری توطئه‌گر', `${head?.name || 'او'} دستگیر می‌شود. خاندانش کینه‌ی سنگینی خواهد گرفت.`, () => {
        const f = (pn.dyn?.factions || []).find(x => x.key === pn.plot?.facKey);
        if (f) { f.grudge = Math.min(100, (f.grudge || 0) + 20); f.loyalty = Math.max(0, f.loyalty - 15); f.power = Math.max(4, f.power - 6); }
        pn.plot = null;
        pn.legitimacy = Math.min(100, (pn.legitimacy ?? 60) + 4);
        toast('⛓️', 'توطئه‌گر دستگیر شد');
        renderPanel(); refreshTopbar();
      });
      break;
    }
    case 'plot-guard': {
      if (pn.treasury < 2000) { toast('⛔', 'خزانه کافی نیست'); break; }
      pn.treasury -= 2000;
      if (pn.plot) pn.plot.prog = Math.max(0, pn.plot.prog - 35);
      pn.counterInt = (pn.counterInt || 0) + 5;
      toast('🛡️', 'محافظت دربار تشدید شد');
      break;
    }
    case 'abandon-col': { abandonColony(S, pn, +b.dataset.p); toast('🏳️', 'مأموریت رها شد'); break; }

    // ---------- سلسله ----------
    case 'educate': {
      const h = heirOf(S, pn.id);
      if (!h) { toast('⚠️', 'وارثی ندارید'); break; }
      if (h.age > 16) { toast('⚠️', 'وارث بزرگ‌تر از آن است که تربیت شود'); break; }
      h.education = b.dataset.e;
      const nm = { martial: 'نظامی', admin: 'دیوانی', diplo: 'دیپلماتیک', guile: 'فنون پنهان' }[b.dataset.e];
      toast('📚', `${h.name} زیر تربیت ${nm} قرار گرفت`);
      break;
    }
    case 'name-heir': {
      if (pn.dyn.succession !== 'appointed') { toast('⚠️', 'تنها با قانون «انتصابی» ممکن است'); break; }
      pn.dyn.appointedHeir = +b.dataset.id;
      recalcHeir(S, pn.id);
      const h2 = heirOf(S, pn.id);
      toast('👑', h2 ? `${h2.name} وارث تاج شد` : 'انجام شد');
      break;
    }
    case 'succ-law': {
      const key = b.dataset.k;
      const L = SUCCESSION_LAWS[key];
      if (pn.dyn.succession === key) break;
      if (pn.treasury < 4000) { toast('⚠️', 'خزانه کافی نیست (۴۰۰۰)'); break; }
      confirmBox('تغییر قانون جانشینی', `آیا قانون جانشینی را به «${L.name}» تغییر می‌دهید؟ ۴۰۰۰ سکه هزینه دارد و اشراف رنجیده می‌شوند.`, () => {
        pn.treasury -= 4000;
        pn.dyn.succession = key;
        for (const f of pn.dyn.factions) f.loyalty = clamp(f.loyalty - 8, 0, 100);
        pn.legitimacy = clamp((pn.legitimacy ?? 60) - 5, 0, 100);
        recalcHeir(S, pn.id);
        toast('📜', `قانون جانشینی به «${L.name}» تغییر کرد`);
        renderPanel(); refreshTopbar();
      });
      return;
    }
    case 'fac-gift': {
      const f = pn.dyn.factions.find(x => x.house === b.dataset.h);
      if (!f) break;
      if (pn.treasury < 1800) { toast('⚠️', 'خزانه کافی نیست (۱۸۰۰)'); break; }
      pn.treasury -= 1800;
      f.loyalty = clamp(f.loyalty + 15, 0, 100);
      f.grudge = Math.max(0, f.grudge - 12);
      toast('🎁', `خاندان ${f.house} پیشکش را پذیرفت`);
      Audio2.coin();
      break;
    }
    case 'fac-honor': {
      const f = pn.dyn.factions.find(x => x.house === b.dataset.h);
      if (!f) break;
      f.loyalty = clamp(f.loyalty + 25, 0, 100);
      f.power = clamp(f.power + 5, 3, 100);
      f.grudge = Math.max(0, f.grudge - 20);
      // خاندان‌های دیگر کمی حسادت می‌کنند
      for (const o of pn.dyn.factions) if (o !== f) o.loyalty = clamp(o.loyalty - 4, 0, 100);
      toast('🎖️', `سرکرده‌ی ${f.house} تکریم شد — اما دیگران حسود شدند`);
      break;
    }
    case 'fac-curb': {
      const f = pn.dyn.factions.find(x => x.house === b.dataset.h);
      if (!f) break;
      confirmBox('کوتاه‌کردن دست خاندان', `نفوذ خاندان ${f.house} را می‌شکنید؟ نفوذ −۱۵ اما وفاداری −۲۰ و کینه می‌ماند.`, () => {
        f.power = clamp(f.power - 15, 3, 100);
        f.loyalty = clamp(f.loyalty - 20, 0, 100);
        f.grudge = clamp(f.grudge + 15, 0, 100);
        toast('⛓️', `دست خاندان ${f.house} کوتاه شد`);
        renderPanel(); refreshTopbar();
      });
      return;
    }
    case 'propose-marriage': {
      const sel = document.getElementById('mar-nation');
      if (!sel) break;
      const tid = +sel.value;
      if (pn.treasury < 2000) { toast('⚠️', 'خزانه کافی نیست (۲۰۰۰)'); break; }
      if ((pn.rel[tid] || 0) < 0) { toast('⚠️', 'با روابط منفی وصلت نمی‌کنند'); break; }
      pn.treasury -= 2000;
      const r = arrangeMarriage(S, pn.id, tid);
      toast(r.ok ? '💍' : '⚠️', r.ok ? `پیوند با ${S.nations[tid].name} بسته شد` : r.why);
      break;
    }

    // ---------- جهان ----------
    case 'build-wonder': {
      if (UI.selProv < 0) { toast('⚠️', 'نخست استانی را برگزینید'); break; }
      const r = startWonder(S, pn, b.dataset.k, UI.selProv);
      toast(r.ok ? '🏯' : '⚠️', r.ok ? `ساخت ${WONDERS[b.dataset.k].name} آغاز شد` : r.why);
      if (r.ok) Audio2.coin();
      break;
    }

    // ---------- قدرت‌های بزرگ ----------
    case 'add-sphere': {
      const t = S.nations[+b.dataset.id];
      const r = addToSphere(S, pn, t);
      toast(r.ok ? '🎭' : '⚠️', r.ok ? `${t.name} به حوزه‌ی نفوذ شما پیوست` : r.why);
      break;
    }
    case 'leave-sphere': {
      const r = leaveSphere(S, pn);
      toast(r.ok ? '⛓️' : '⚠️', r.ok ? 'از حوزه‌ی نفوذ بیرون آمدید' : r.why);
      break;
    }
    case 'fabricate': {
      const t = S.nations[+b.dataset.id];
      const r = fabricateClaim(S, pn, t.id);
      toast(r.ok ? '📜' : '⚠️', r.ok ? `ادعای ارضی بر ${t.name} تقویت شد` : r.why);
      break;
    }
    case 'start-crisis': {
      const t = S.nations[+b.dataset.id];
      const c = startCrisis(S, pn.id, t.id, null);
      toast(c ? '🔥' : '⚠️', c ? `بحران بر سر ${S.map.provs[c.prov].name} آغاز شد` : 'استان مرزی مشترکی نیست');
      break;
    }
    case 'crisis-join': {
      const c = (S.crises || []).find(x => x.id === +b.dataset.id);
      if (!c) break;
      const side = b.dataset.s === 'a' ? 'backA' : 'backD';
      if (c.backA.includes(pn.id) || c.backD.includes(pn.id)) { toast('⚠️', 'پیش‌تر طرف گرفته‌اید'); break; }
      c[side].push(pn.id);
      const other = b.dataset.s === 'a' ? S.nations[c.d] : S.nations[c.a];
      const friend = b.dataset.s === 'a' ? S.nations[c.a] : S.nations[c.d];
      friend.rel[pn.id] = clamp((friend.rel[pn.id] || 0) + 18, -100, 100);
      other.rel[pn.id] = clamp((other.rel[pn.id] || 0) - 20, -100, 100);
      toast('⚖️', `از ${friend.name} پشتیبانی کردید`);
      break;
    }
    case 'crisis-back': {
      const c = (S.crises || []).find(x => x.id === +b.dataset.id);
      if (!c) break;
      if (pn.treasury < 2500) { toast('⚠️', 'خزانه کافی نیست (۲۵۰۰)'); break; }
      pn.treasury -= 2500;
      const mySide = c.a === pn.id ? 'backA' : 'backD';
      const free = S.nations.filter(x => x.alive && x.greatPower && !c.backA.includes(x.id) && !c.backD.includes(x.id));
      free.sort((x, y) => (pn.rel[y.id] || 0) - (pn.rel[x.id] || 0));
      if (free[0]) { c[mySide].push(free[0].id); toast('🤝', `${free[0].name} به پشتیبانی شما آمد`); }
      else toast('⚠️', 'قدرت بزرگ آزادی نمانده است');
      break;
    }
    case 'crisis-fold': {
      const c = (S.crises || []).find(x => x.id === +b.dataset.id);
      if (!c) break;
      c.active = false; c.resolved = 'عقب‌نشینی';
      pn.prestige = Math.max(0, (pn.prestige || 0) - 6);
      toast('🏳️', 'عقب نشستید — جنگ نشد، اما آبرو رفت');
      break;
    }
  }
  renderPanel();
  refreshTopbar();
  refreshAlerts();
  refreshDockBadges();
}

// ================== انتخاب استان/نقشه ==================
export function selectProv(id) {
  UI.selProv = id;
  R.dirtyPol = R.dirtyPol; // highlight handled per frame
  openPanel('province');
  const p = S.map.provs[id];
  if (p) R.focusOn(p.cx, p.cy);
}
export function mapClick(sx, sy, shift) {
  // ارتش نزدیک؟
  const army = S.armies.find(a => {
    const t = R.toScreen(state_provXY(S, a).x, state_provXY(S, a).y);
    return Math.hypot(t.x - sx, t.y - sy) < 16;
  });
  if (army && army.n === S.playerId && !UI.selArmy) {
    UI.selArmy = army.id;
    toast('🎯', 'ارتش برگزیده شد — مقصد را کلیک کنید');
    openPanel('military');
    Audio2.click();
    return;
  }
  const pid = R.pickProv(S, sx, sy);

  // ---- فرمان به ناوگان برگزیده ----
  if (UI.selFleet !== null && UI.selFleet !== undefined) {
    const f = S.fleets.find(x => x.id === UI.selFleet);
    if (f && f.status !== 'battle') {
      if (pid >= 0) {
        // کلیک روی بندر دشمن ⇒ محاصره
        const p2 = S.map.provs[pid];
        const r = setBlockade(S, f, pid);
        if (r.ok) { toast('🚫', `محاصره‌ی بندر ${p2.name} آغاز شد`); Audio2.drum(); }
        else toast('⚠️', r.why);
      } else {
        // کلیک روی دریا ⇒ حرکت به آن منطقه
        const w = R.toWorld(sx, sy);
        let best = null, bd = 1e18;
        for (const z of S.seaZones || []) { const d = Math.hypot(w.x - z.cx, w.y - z.cy); if (d < bd) { bd = d; best = z; } }
        if (best) {
          const ok = orderFleet(S, f, best.id);
          toast(ok ? '🌊' : '⚠️', ok ? `ناوگان به‌سوی ${best.name}` : 'مسیر دریایی یافت نشد');
          if (ok) Audio2.click();
        }
      }
      if (UI.panel === 'navy') renderPanel();
      return;
    }
    UI.selFleet = null;
  }

  if (pid < 0) return;
  if (UI.selArmy) {
    const a = S.armies.find(x => x.id === UI.selArmy);
    if (a && a.status !== 'battle') {
      const ok = SIM.orderArmy(S, a, pid);
      toast(ok ? '🏃' : '⚠️', ok ? `ارتش به‌سوی ${S.map.provs[pid].name}` : 'مسیری برای حرکت نیست (خاک بی‌گانه بسته است)');
      if (ok) Audio2.drum();
    }
    return;
  }
  selectProv(pid);
  Audio2.click();
}
function state_provXY(S2, a) {
  const p = S2.map.provs[a.prov];
  return { x: p.cx, y: p.cy - 16 };
}
export function mapHover(sx, sy) {
  const pid = R.pickProv(S, sx, sy);
  UI.hoverProv = pid;
  const cv = document.getElementById('map');
  cv.style.cursor = UI.selArmy ? 'crosshair' : pid >= 0 ? 'pointer' : 'grab';
  // تولتیپ
  const tip = document.getElementById('map-tip');
  if (pid >= 0) {
    const p = S.map.provs[pid];
    const n = S.nations[p.owner];
    tip.style.display = '';
    tip.textContent = `${TERRAIN[p.terrain].icon} ${p.name} — ${n ? n.name : (p.tribe || 'سرزمین بکر')}`;
    tip.style.left = (sx + 14) + 'px';
    tip.style.top = (sy + 8) + 'px';
  } else tip.style.display = 'none';
}

// ================== تیک ==================
export function onTick() {
  R.dirtyPol = true;
  // هشدارهای تازه از sim
  if (S.pendingAlerts && S.pendingAlerts.length) {
    for (const a of S.pendingAlerts) { toast(a.icon, a.text); }
    S.pendingAlerts.length = 0;
    Audio2.alert();
  }
  refreshTopbar();
  refreshAlerts();
  refreshDockBadges();
  if (UI.panel) renderPanel();
  if (S.pendingEvent) showEvent();
  checkWarOffers();
  if (!R.dirtyBorders) R.dirtyBorders = false;
  if (S.week % 26 === 0) saveGame(S);
  checkEnd();
}

// ================== مودال رویداد ==================
// رویدادهای تصادفی پس از این مدت بدون انتخاب بسته می‌شوند (نمایش کوتاه‌تر)
export const EV_TIMEOUT_MS = 20000;
let evTimerId = null;
function clearEvTimer() { if (evTimerId) { clearTimeout(evTimerId); evTimerId = null; } }
export function dismissEvent() {
  clearEvTimer();
  const e = S && S.pendingEvent;
  if (!e) return;
  S.pendingEvent = null;
  S.paused = S.pausedBeforeEvent ?? false;
  document.getElementById('event-modal').style.display = 'none';
  addLog(S, '⏳', `رویداد «${e.title}» بی‌پاسخ ماند.`);
  refreshTopbar();
}
function showEvent() {
  const e = S.pendingEvent;
  const m = document.getElementById('event-modal');
  m.style.display = 'flex';
  const box = document.getElementById('event-box');
  // رویدادهای کلیدی (آغاز خط زمانی، دوران شاهزادی، انتخابات) تا تصمیم باز می‌مانند
  const keyEv = !!(e.id && (String(e.id).startsWith('tl_') || String(e.id).startsWith('pr') || e.id === 'election' || S.phase === 'prologue'));
  const timed = !keyEv;
  box.innerHTML = `${e.img ? `<img class="ev-img" src="${e.img}" alt="">` : `<div class="ev-ic">${e.icon}</div>`}
    <div class="ev-title">${esc(e.title)}</div>
    <div class="ev-tabs">
      <button class="ev-tab on" data-tab="orig">📜 نسخه‌ی اصلی</button>
      ${e.t2 ? `<button class="ev-tab" data-tab="simple">💬 ترجمه‌ی ساده</button>` : ''}
    </div>
    <div class="ev-text" data-text="orig">${esc(e.text)}</div>
    ${timed ? `<div class="ev-timer"><div class="ev-timer-bar"></div><span class="dim">بدون انتخاب، رویداد پس از چند لحظه بسته می‌شود</span></div>` : ''}
    <div class="ev-opts"></div>`;
  box.querySelectorAll('.ev-tab').forEach(tb => {
    tb.onclick = () => {
      Audio2.click();
      box.querySelectorAll('.ev-tab').forEach(x => x.classList.toggle('on', x === tb));
      const txt = box.querySelector('.ev-text');
      txt.textContent = tb.dataset.tab === 'simple' ? (e.t2 || e.text) : e.text;
    };
  });
  const opts = box.querySelector('.ev-opts');
  e.opts.forEach((o, i) => {
    const b = el(`<button class="ev-opt"><b>${esc(o.label)}</b><span class="dim">${esc(o.hint)}</span></button>`);
    b.onclick = () => { Audio2.click(); clearEvTimer(); SIM.applyEventChoice(S, e, i); m.style.display = 'none'; refreshTopbar(); renderPanel(); refreshAlerts(); };
    opts.appendChild(b);
  });
  if (timed) {
    const bar = box.querySelector('.ev-timer-bar');
    bar.style.animation = 'none'; void bar.offsetWidth; // ری‌استارت نوار
    bar.style.animation = '';
    clearEvTimer();
    evTimerId = setTimeout(dismissEvent, EV_TIMEOUT_MS);
  }
}
// اعلان جنگ رسیده
function checkWarOffers() {
  const o = (S.dipOffers || []).find(x => x.kind === 'wardeclared');
  if (!o) return;
  const from = S.nations[o.from];
  const w = S.wars.find(x => x.id === o.warId);
  S.dipOffers = S.dipOffers.filter(x => x.id !== o.id);
  S.paused = true;
  confirmBox('🔥 اعلام جنگ!',
    `${from.name} به شما اعلام جنگ داد${w && w.goal !== undefined && w.goal !== null ? ` — هدف آن‌ها استان «${S.map.provs[w.goal].name}» است` : ''}. ارتش‌ها را آماده کنید!`,
    () => { S.paused = false; refreshTopbar(); }, 'به میدان می‌رویم!');
  Audio2.drum();
}

// ================== تاییدیه و تست و پایان ==================
// انتخاب از میان چند نامزد (مودال فهرستی)
function pickBox(title, rowsHtml, onPick) {
  const m = document.getElementById('confirm-modal');
  m.style.display = 'flex';
  document.getElementById('confirm-title').textContent = title;
  const tx = document.getElementById('confirm-text');
  tx.innerHTML = `<div class="cand-list">${rowsHtml}</div>`;
  const yes = document.getElementById('confirm-yes');
  yes.style.display = 'none';
  const close = () => { m.style.display = 'none'; yes.style.display = ''; tx.innerHTML = ''; };
  tx.querySelectorAll('.cand-row').forEach(btn => {
    btn.onclick = () => { const rid = btn.dataset.rid; close(); onPick(rid); };
  });
  document.getElementById('confirm-no').onclick = close;
}

function confirmBox(title, text, onYes, yesLabel = 'تایید') {
  const m = document.getElementById('confirm-modal');
  m.style.display = 'flex';
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  const yes = document.getElementById('confirm-yes');
  yes.textContent = yesLabel;
  yes.onclick = () => { m.style.display = 'none'; onYes(); };
  document.getElementById('confirm-no').onclick = () => { m.style.display = 'none'; if (title.includes('اعلام جنگ')) S.paused = false; };
}
function toast(icon, text) {
  const box = document.getElementById('toasts');
  const t = el(`<div class="toast"><span>${icon}</span><span>${esc(text)}</span></div>`);
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
  while (box.children.length > 5) box.firstChild.remove();
}
export { toast };

let endShown = false;
function checkEnd() {
  const pn = S.nations[S.playerId];
  const m = document.getElementById('endscreen');
  if (m.style.display === 'flex' || endShown) return;
  if (S.gameOver) {
    const rk = SIM.ranking(S).filter(n2 => n2.alive);
    const rank = rk.findIndex(r => r.id === pn.id) + 1;
    const win = rank === 1;
    showEnd(win ? '👑' : '📜', win ? 'پیروزی بزرگ!' : 'پایان قرن', '');
    const rows = rk.map((n2, i) => {
      const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : fd(i + 1) + '.';
      return `<div class="endrow ${n2.player ? 'me' : ''}"><span>${medal}</span><b>${esc(n2.name)}</b><span class="dim">اعتبار ${fd(Math.round(n2.prestige))}</span></div>`;
    }).join('');
    const endTxt = S.tl && S.tl.endText ? S.tl.endText : `سال ${fd(S.tl ? S.tl.endYear : 1900)} فرا رسید. رتبه نهایی شما: <b class="gold">${fd(rank)}</b> از ${fd(rk.length)}`;
    document.getElementById('end-text').innerHTML =
      `${endTxt}<div class="endtable">${rows}</div>`;
  } else if (S.defeat) {
    showEnd('💀', 'سقوط', 'سرزمین شما به‌تمامی از دست رفت. تاریخ، صفحه‌تراش تازه‌ای خواهد یافت...');
  } else if (S.victory) {
    showEnd('👑', 'پیروزی!', `${pn.name} به بزرگ‌ترین قدرت جهان بدل شد!`);
  }
}
function showEnd(icon, title, text) {
  const m = document.getElementById('endscreen');
  endShown = true;
  m.style.display = 'flex';
  document.getElementById('end-ic').textContent = icon;
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  document.getElementById('end-continue').onclick = () => { Audio2.click(); m.style.display = 'none'; S.paused = false; refreshTopbar(); };
  document.getElementById('end-menu').onclick = () => { location.reload(); };
}

// ================== منوی بازی/راهنما ==================
function showGameMenu() {
  showHelp(true);
}
export function showHelp(inGame) {
  const m = document.getElementById('help-modal');
  const tlName = S && S.tl ? S.tl.name : 'امپراتوری';
  const endYear = S && S.tl ? S.tl.endYear : 1900;
  const noSpeed = S && S.diffMods && S.diffMods.noSpeed;
  m.style.display = 'flex';
  document.getElementById('help-body').innerHTML = `
    <h2>🏛️ ${tlName}</h2>
    <p class="dim">استراتژی بزرگ — اقتصاد، جامعه، دیپلماسی و جنگ را هم‌زمان مدیریت کنید.</p>
    <h3>چرخه بازی</h3>
    <ul>
      <li>🌾 <b>اقتصاد:</b> در استان‌ها ساختمان بسازید (هزینه از خزانه کم می‌شود)؛ کالاها در بازار جهانی قیمت می‌گیرند. اقتصاد در همه‌ی خطوط زمانی کلید پیروزی است.</li>
      <li>👥 <b>جمعیت:</b> طبقات مختلف نیازهایی دارند؛ امید به زندگی بالا = رشد و آرامش.</li>
      <li>🔥 <b>ناآرامی:</b> مالیات سنگین و بی‌کاری شورش می‌آورد.</li>
      <li>🎓 <b>فناوری:</b> با دانشگاه نوآوری بسازید و فناوری انتخاب کنید.</li>
      <li>🏛️ <b>سیاست:</b> قوانین را با شانس متکی بر گروه‌های ذی‌نفع تصویب کنید.</li>
      <li>⚔️ <b>جنگ:</b> پادگان بسازید، ارتش بسازید و با کلیک روی نقشه فرمان دهید.</li>
      <li>👑 <b>هدف:</b> تا سال ${fd(endYear)} بزرگ‌ترین قدرت جهان شوید (بیشترین اعتبار).</li>
    </ul>
    <h3>سامانه‌های ژرف</h3>
    <ul>
      <li>🎩 <b>دربار و فرماندهان:</b> هشت پست کابینه را از میان نامزدها پر کنید؛ هر وزیر بر بخشی از کشور اثر می‌گذارد. ژنرال‌ها ویژگی و تجربه دارند، در نبرد رشد می‌کنند، زخم می‌خورند و گاه می‌میرند. به وفاداری‌شان چشم داشته باشید.</li>
      <li>⚓ <b>نیروی دریایی:</b> در بندرها ناو بسازید (از ناوچه تا ناوشکار و زیردریایی)، ناوگان را روی مناطق دریایی بچرخانید، بندر دشمن را محاصره کنید و با ناو ترابری، ارتش را به ساحل دشمن پیاده کنید. ناوگان برگزیده را با کلیک روی دریا حرکت دهید.</li>
      <li>🕵️ <b>سازمان اطلاعات:</b> نخست در کشور هدف «شبکه» بسازید، سپس دزدی فناوری، خرابکاری، تحریک شورش، رشوه، ترور یا کودتا را کلید بزنید. هر عملیات ریسک لو رفتن دارد و روابط را می‌سوزاند.</li>
      <li>🌍 <b>جامعه:</b> فرهنگ و مذهب استان‌ها با کشور شما فرق می‌کند؛ اقلیت‌های ناراضی فشار جدایی‌طلبی می‌سازند. شش جنبش سیاسی قدرت می‌گیرند — سرکوب یا مصالحه کنید. اگر <b>ثبات</b> و <b>مشروعیت</b> هر دو سقوط کنند، جنگ داخلی می‌شود.</li>
      <li>🛣️ <b>تجارت و مستعمرات:</b> تعرفه بگذارید، مسیرهای صادرات/واردات با کشورهای دیگر بگشایید، شرکت‌های بزرگ تأسیس کنید و سرزمین‌های بی‌صاحب را مستعمره کنید. محاصره‌ی دریایی تجارت‌تان را می‌خشکاند.</li>
    </ul>
    <h3>سلسله و جهان (ویژه‌ی ویکتوریا فانتزی)</h3>
    <ul>
      <li>👑 <b>سلسله و جانشینی:</b> پادشاه شما پیر می‌شود، بیمار می‌شود و می‌میرد. وارثش با صفات نیمه‌ارثی بر تخت می‌نشیند. وارث خردسال را <b>تربیت</b> کنید (نظامی/دیوانی/دیپلماتیک) تا پادشاه بهتری شود. اگر زیر ۱۶ سال به تخت برسد، <b>نیابت سلطنت</b> می‌شود و کشور نیمه‌فلج می‌ماند.</li>
      <li>📜 <b>قانون جانشینی:</b> پنج قانون دارید — ارشدیت پسری، ارشدیت مطلق، ارشدیت خاندان، انتخابی و انتصابی. هر کدام روی ثبات، مشروعیت و وفاداری اشراف اثر متفاوت دارد. تغییرش پول و آبرو می‌برد.</li>
      <li>🏰 <b>خاندان‌های بزرگ:</b> هر کشور ۳ تا ۵ خاندان اشرافی دارد با نفوذ و وفاداری. مالیات سنگین، جنگ طولانی، پادشاه خودکامه و بی‌ثباتی، وفاداری‌شان را می‌خورد. با <b>پیشکش</b> و <b>تکریم</b> آرامشان کنید یا <b>دست‌شان را کوتاه</b> کنید. اگر خیلی خشمگین شوند مدعی تاج می‌شوند و در نهایت <b>جنگ جانشینی</b> راه می‌اندازند — اما این نادر است و تقریباً همیشه نتیجه‌ی بدحکومتی.</li>
      <li>💍 <b>ازدواج سیاسی:</b> با دربارهای دیگر وصلت کنید: روابط جهش می‌کند، خویشاوندان به‌سختی به هم می‌تازند، و ادعای متقابل بر تاج شکل می‌گیرد. اگر هم‌پیمانِ خویشاوندتان بی‌وارث بمیرد، ممکن است <b>اتحاد تاجی</b> رخ دهد و دو تاج بر یک سر بنشیند.</li>
      <li>🌟 <b>قدرت‌های بزرگ:</b> هشت کشور برتر جهان جایگاه ویژه دارند. قدرت بزرگ می‌تواند کشورهای کوچک را به <b>حوزه‌ی نفوذ</b> خود بکشد و از تجارتشان سود ببرد.</li>
      <li>🔥 <b>بحران بین‌المللی:</b> به‌جای اعلان جنگ ناگهانی، بر سر یک استان بحران شکل می‌گیرد. هر دو سو چند هفته وقت دارند پشتیبان جذب کنند. اگر یک طرف آشکارا قوی‌تر باشد، طرف دیگر بدون جنگ کوتاه می‌آید؛ اگر توازن باشد، جنگ درمی‌گیرد.</li>
      <li>📜 <b>ادعای ارضی:</b> با جعل سند، ادعای خود بر سرزمین دیگران را تقویت کنید تا جنگ‌هایتان مشروع‌تر باشد.</li>
      <li>🌐 <b>جهان داستان‌دار:</b> نقشه به <b>مناطق نام‌دار</b> تقسیم شده است. روی زمین <b>آثار باستانی</b> (جاده‌ی شاهی، آب‌راه کهن، دژ متروک…) و <b>منابع کمیاب</b> (سنگ گران‌بها، شوره، اسب اصیل…) پخش‌اند که بونوس واقعی می‌دهند. بخشی از جهان هم <b>سرزمین بکر</b> است با قبایل مستقل — با مأموریت استعماری بگیریدشان.</li>
      <li>🏯 <b>بناهای عظیم:</b> شش بنای عظیم در جهان هست و هر کدام تنها <b>یک بار</b> ساخته می‌شود. گران و چندساله‌اند، اما اعتبار و قدرت بزرگی می‌دهند. رقبا هم دنبالشان‌اند.</li>
      <li>🏛️ <b>شورای درباری:</b> پنج کرسی (وزیر اعظم، خزانه‌دار، سپهسالار، قاضی‌القضات، رئیس تشریفات) را از میان شاهزادگان و سران خاندان‌ها پر می‌کنید. هر کرسی به‌اندازه‌ی مهارت شاغلش بونوس می‌دهد؛ کرسی خالی یعنی دیوانِ لنگ. انتصاب، وفاداری می‌خرد و عزل، کینه می‌سازد.</li>
      <li>💰 <b>فساد:</b> با مالیات سنگین، کشور بزرگ و شورای ناراست‌کردار رشد می‌کند و از درآمد می‌بلعد. <b>بازرسی</b> ارزان و بی‌دردسر است؛ <b>پاکسازی بزرگ</b> بسیار مؤثر ولی خاندان‌ها را خشمگین می‌کند.</li>
      <li>🕯️ <b>دسیسه:</b> بلندپایگانِ حیله‌گر و دل‌آزرده در سایه توطئه می‌چینند. اگر کشفش کنید می‌توانید دستگیر کنید یا محافظت را تشدید کنید؛ توطئه‌ی کشف‌نشده گاهی به ترور می‌انجامد. مثل بقیه‌ی درام‌ها، <b>کمیاب است و نتیجه‌ی بدحکومتی</b>.</li>
      <li>🎭 <b>رقابت وارثان:</b> شاهزادگان هوادار جمع می‌کنند. اگر برادرِ رقیب بسیار محبوب‌تر از وارث رسمی شود، خطر جنگ جانشینی جدی می‌شود. تربیت وارث و دادن کرسی به او، بهترین بیمه است.</li>
    </ul>
    <h3>رویدادها</h3>
    <p class="dim">بیش از <b>۱۲۵ رویداد</b> در بازی هست و <b>هر رویداد داستانی تنها یک بار در هر بازی می‌آید</b> — پس هیچ‌وقت همان متن تکرار نمی‌شود و هر بازی ترکیب تازه‌ای دارد. برخی رویدادها <b>زنجیره‌ای</b>اند: تصمیم امروزتان پرده‌ی بعدی را ماه‌ها بعد رقم می‌زند و بازی انتخاب شما را به یاد می‌سپارد. هر رویداد دو نسخه‌ی متن دارد: رسمی و محاوره‌ای.</p>
    <h3>مُدهای نقشه</h3>
    <p class="dim">جز سیاسی/زمین/جمعیت/تولید/ناآرامی، اکنون <b>فرهنگ</b>، <b>مذهب</b>، <b>دریایی</b>، <b>جدایی‌طلبی</b>، <b>ویرانی</b>، <b>خاندان‌ها</b>، <b>مناطق</b> و <b>قدرت</b> هم دارید. نقشه فصل‌ها را نشان می‌دهد (برف زمستان، طلای پاییز) و شب‌ها چراغ شهرها روشن می‌شود.</p>
    <h3>کلیدها</h3>
    <ul>
      <li><b>Space</b> مکث/ادامه — <b>1 تا 4</b> سرعت${noSpeed ? ' <span class="neg">(در «افسانه‌ای» فقط پاز/آن‌پاز فعال است)</span>' : ''}</li>
      <li><b>Esc</b> بستن پنل / لغو انتخاب</li>
      <li>درگ برای حرکت دوربین، اسکرول برای بزرگ‌نمایی</li>
    </ul>
    <div class="row-btns" style="margin-top:8px">
      <button class="btn small" id="help-tut">📖 توتوریال کامل</button>
      ${inGame ? `<button class="btn small" id="help-save">💾 ذخیره</button>
      <button class="btn small ghost" id="help-sound">🔊 صدا: روشن/خاموش</button>
      <button class="btn small danger" id="help-quit">خروج به منو</button>` : ''}
    </div>`;
  document.getElementById('help-close').onclick = () => { Audio2.click(); m.style.display = 'none'; };
  document.getElementById('help-tut').onclick = () => { Audio2.click(); m.style.display = 'none'; showTutorial(); };
  if (inGame) {
    document.getElementById('help-save').onclick = () => { saveGame(S); toast('💾', 'بازی ذخیره شد'); };
    document.getElementById('help-sound').onclick = () => { Audio2.on = !Audio2.on; toast('🔊', Audio2.on ? 'صدا روشن شد' : 'صدا خاموش شد'); };
    document.getElementById('help-quit').onclick = () => { saveGame(S); location.reload(); };
  }
}

// ================== توتوریال کامل ==================
const TUTORIAL_PAGES = [
  { icon: '👑', title: 'خوش آمدید', items: [
    'به «امپراتوری» خوش آمدید — استراتژی بزرگی که در آن اقتصاد، سیاست، دیپلماسی و جنگ به هم گره خورده‌اند.',
    'چهار خط زمانی دارید: ویکتوریا فانتزی ۱۸۳۶ (با چند سناریو)، جنگ جهانی اول ۱۹۱۴، جنگ جهانی دوم ۱۹۳۸ و دنیای مدرن ۲۰۲۶.',
    'خط‌های ۱۹۱۴/۱۹۳۸/۲۰۲۶ روی نقشه‌ی واقعی جهان با نام کشورهای واقعی جریان دارند؛ فقط ۱۸۳۶ فانتزی است.',
    'هدف نهایی: با رشد اقتصاد و اعتبار (Prestige)، کشورتان را به برترین قدرت جهان برسانید.',
  ] },
  { icon: '🗺️', title: 'نقشه و دوربین', items: [
    'نقشه‌ی جهان بزرگ و دقیق است؛ با کشیدن ماوس (درگ) دوربین را جابه‌جا کنید و با اسکرول بزرگ‌نمایی کنید.',
    'روی مینی‌مپ گوشه‌ی پایین راست کلیک کنید تا دوربین به آن نقطه بپرد.',
    'حالت‌های نقشه (سیاسی، زمین، جمعیت، تولید، ناآرامی) را از نوار پایین نقشه عوض کنید.',
    'روی هر استان کلیک کنید تا پنل استان باز شود: ساختمان‌ها، جمعیت، منابع و ناآرامی آن‌جا است.',
  ] },
  { icon: '📊', title: 'نوار بالا', items: [
    'نوار بالا وضعیت کشورتان را نشان می‌دهد: پول (خزانه)، تولید ناخالص، اعتبار، جمعیت، پژوهش، سواد، ارتش و تاریخ.',
    'عدد کنار پول، تراز هفتگی است؛ اگر منفی شد هزینه‌ها را کم کنید یا مالیات و تولید را بالا ببرید.',
    'دکمه‌ی ☰ منوی بازی (ذخیره، صدا، توتوریال، خروج) را باز می‌کند.',
  ] },
  { icon: '🏭', title: 'اقتصاد — قلب بازی', items: [
    'اقتصاد در همه‌ی خطوط زمانی نقش کلیدی دارد: بدون درآمد، نه ارتشی می‌ماند نه رفاهی.',
    'در پنل استان ساختمان بسازید: مزرعه و دامداری (غذا)، معدن زغال و آهن، کارخانه‌ی نساجی و ابزارسازی، بندر و راه‌آهن.',
    'هر ساختمان هزینه‌ی کامل خود را هنگام شروع ساخت از خزانه کم می‌کند؛ ساخت چند هفته طول می‌کشد و سپس کالا تولید می‌کند.',
    'بازار (🏪) قیمت کالاها را نشان می‌دهد؛ کمبودها را جبران کنید و مازاد را بفروشید.',
    'صنعت: مواد خام را به کالای صنعتی تبدیل کنید — ارزش افزوده ثروت واقعی است.',
  ] },
  { icon: '👥', title: 'جمعیت و جامعه', items: [
    'هر استان طبقاتی دارد: کشاورز، کارگر، کارمند، سرمایه‌دار، اشراف، سرباز و بیکار.',
    'شغل و درآمد طبقات، امید به زندگی (SOL) و ناآرامی را می‌سازد؛ ناآرامی بالا = شورش.',
    'سواد را با مدرسه/دانشگاه بالا ببرید؛ سواد، پژوهش و درآمد کارگران را افزایش می‌دهد.',
    'رشد جمعیت به غذا، بهداشت (پزشکی) و ثبات بستگی دارد.',
  ] },
  { icon: '🎓', title: 'فناوری', items: [
    'پنل فناوری (🎓): یک فناوری را برای پژوهش انتخاب کنید؛ امتیاز پژوهش هر هفته از دانشگاه‌ها و سواد می‌آید.',
    'فناوری‌ها در شاخه‌های اقتصادی، نظامی و اجتماعی دسته‌بندی شده‌اند و هر کدام ساختمان یا توانایی تازه‌ای را باز می‌کنند.',
    'در خط‌های زمانی واقعی، فناوری‌های پایه‌ی همان دوره از پیش کشف شده‌اند.',
  ] },
  { icon: '🏛️', title: 'سیاست و خزانه', items: [
    'پنل سیاست: نرخ مالیات را تنظیم کنید (بالاتر = درآمد بیشتر اما نارضایتی بیشتر).',
    'قوانین (حقوق کارگران، حکومت، نظام مالیاتی) را پیشنهاد دهید؛ گروه‌های ذی‌نفع (اشراف، سرمایه‌داران، کارگران…) موافق یا مخالف‌اند.',
    'تصویب قانون زمان می‌برد؛ رضایت گروه‌های قدرتمند یعنی ثبات کشور.',
  ] },
  { icon: '🤝', title: 'دیپلماسی و جنگ', items: [
    'پنل دیپلماسی: روابط با کشورها را بهبود دهید یا پیمان ببندید؛ با انتخاب هدفِ جنگ، اعلان جنگ کنید.',
    'گردان‌ها با پادگان تأمین می‌شوند؛ از پنل نظام، ارتش بسازید و با کلیک روی نقشه فرمان حرکت دهید.',
    'ارتش‌ها با هم می‌جنگند، استان‌ها را تصرف می‌کنند و شورشیان را سرکوب می‌کنند.',
    'جنگ هزینه و فرسودگی دارد؛ بیهوده جنگ را آغاز نکنید.',
  ] },
  { icon: '🫅', title: 'دربار و مأموریت‌ها', items: [
    'دربار سلطنتی (فقط خط ویکتوریا): اعضای خانواده رابطه و خواسته‌های خود را دارند؛ با آن‌ها گفتگو کنید و مشورت بگیرید.',
    'مأموریت‌ها (🎯) راهنمای پیشرفت‌اند و پاداش می‌دهند.',
    'رتبه‌بندی (👑) جایگاه جهانی شما را نشان می‌دهد و تاریخچه (📜) رویدادهای گذشته را ثبت می‌کند.',
  ] },
  { icon: '🎩', title: 'کابینه و فرماندهان', items: [
    'پنل «دربار و فرماندهان» (🎩) هشت پست کابینه دارد: صدراعظم، دارایی، جنگ، خارجه، کشور، رئیس اطلاعات، صنایع و آموزش.',
    'هر نامزد مهارت (۱ تا ۵ ستاره) و ویژگی‌های شخصیتی دارد؛ وزیر خوب درصدهای واقعی به اقتصاد، پژوهش یا ارتش شما اضافه می‌کند — اما حقوق می‌گیرد.',
    'ژنرال‌ها به‌طور خودکار به ارتش‌ها گمارده می‌شوند. ویژگی‌هایشان (تهاجمی، پدافندی، مهندس، بی‌رحم…) مستقیماً روی توان نبرد، سرعت حرکت، سنگربندی و تلفات اثر می‌گذارد.',
    'ژنرال با پیروزی تجربه می‌گیرد و ارتقا می‌یابد؛ در شکست ممکن است کشته شود. وفاداری پایین یعنی خطر خیانت و کودتا.',
  ] },
  { icon: '⚓', title: 'نیروی دریایی', items: [
    'برای ساخت ناو، استان ساحلی باید «بندر» داشته باشد. کلاس‌های ناو با عصر باز می‌شوند: ناوچه، زره‌پوش، رزم‌ناو، ناوِ بزرگ، زیردریایی و ترابری.',
    'جهان به مناطق دریایی تقسیم شده است. ناوگان را از پنل ⚓ برگزینید، سپس روی دریا کلیک کنید تا حرکت کند.',
    'کلیک روی بندر دشمن = محاصره. بندر محاصره‌شده تولید و تجارت خود را از دست می‌دهد و کشورش زیر فشار می‌رود.',
    'ناوهای ترابری، ارتش را سوار می‌کنند؛ ناوگان را به منطقه‌ی دشمن ببرید و سرباز پیاده کنید — حمله‌ی دریایی به پشت خطوط.',
    'ناوگان‌ها در دریا با هم می‌جنگند؛ توان ناوگان و دریاسالار فرمانده، نتیجه را رقم می‌زند.',
  ] },
  { icon: '🕵️', title: 'جاسوسی و توطئه', items: [
    'پنل 🕵️ سازمان اطلاعات است. برای هر کاری نخست باید در کشور هدف «شبکه» بسازید — بدون شبکه، عملیات سنگین ممکن نیست.',
    'با شبکه‌ی قوی: جمع‌آوری اطلاعات (دیدن آمار واقعی دشمن)، دزدی فناوری، خرابکاری در صنایع، تحریک شورش، تأمین مالی اپوزیسیون، رشوه به وزیر، ترور و در نهایت کودتا.',
    'هر عملیات ریسک لو رفتن دارد: اگر شکست بخورد، روابط می‌سوزد، کینه می‌ماند و ممکن است به جنگ برسد.',
    'ضدجاسوسی را فعال کنید تا شبکه‌های دشمن در کشور شما شکار شوند. رئیس اطلاعاتِ زبده، هر دو سو را تقویت می‌کند.',
  ] },
  { icon: '🌍', title: 'فرهنگ، مذهب و جنگ داخلی', items: [
    'پنل 🌍 جامعه: کشور شما یک فرهنگ و مذهب رسمی دارد، اما استان‌ها لزوماً همان را ندارند. اقلیت‌های پذیرفته‌نشده ناآرام می‌شوند.',
    'شش جنبش سیاسی وجود دارد: مشروطه‌خواه، جمهوری‌خواه، سوسیالیست، ناسیونالیست، روحانی و جدایی‌طلب. قدرت و تندروی هر کدام را زیر نظر داشته باشید.',
    '«سرکوب» فوری قدرتشان را کم می‌کند اما تندروترشان می‌کند و ثبات را می‌خورد؛ «مصالحه» پول و امتیاز می‌گیرد ولی آرامشان می‌کند.',
    '«برنامه‌ی فرهنگی» روی استان‌های غیرهسته‌ای، آن‌ها را به‌مرور هم‌گون می‌کند و فشار جدایی‌طلبی را می‌خواباند.',
    'هشدار: اگر ثبات زیر ۱۴ و مشروعیت زیر ۳۰ برود، <b>جنگ داخلی</b> می‌شود و استان‌ها به دست شورشیان می‌افتد. مُد نقشه‌ی «جدایی‌طلبی» نقاط خطر را نشان می‌دهد.',
  ] },
  { icon: '🛣️', title: 'تجارت، شرکت‌ها و مستعمرات', items: [
    'پنل 🛣️: «تعرفه» را از آزاد تا حمایتی تنظیم کنید — تعرفه‌ی بالا درآمد گمرکی می‌دهد ولی حجم تجارت و روابط را کم می‌کند.',
    'با کشورهای دوست مسیر صادرات/واردات باز کنید. هر مسیر با گذشت زمان پخته‌تر و پرسودتر می‌شود. ظرفیت مسیرها به بندر، راه‌آهن و توان دریایی بستگی دارد.',
    'هشت شرکت بزرگ (غله، نساجی، معدن، فولاد، تسلیحات، کمپانی هند شرقی، بانک، راه‌آهن) می‌توانید تأسیس کنید — حداکثر چهار تا. هر کدام بخشی از اقتصاد را جهش می‌دهد.',
    'سرزمین‌های بی‌صاحب را می‌توان مستعمره کرد: مأموریت استعماری چند هفته طول می‌کشد و در پایان استان به شما می‌رسد.',
    'مراقب باشید: محاصره‌ی دریایی دشمن، مسیرهای تجاری و درآمد گمرکی شما را می‌خشکاند.',
  ] },
  { icon: '👑', title: 'سلسله: تاج فناپذیر است', items: [
    'در خط ویکتوریا فانتزی، پادشاه شما یک نام تزئینی نیست: سن دارد، سلامت دارد، چهار مهارت دارد (کشورداری، نظامی، دیپلماسی، تدبیر) و صفاتی که مستقیماً روی کشور اثر می‌گذارند.',
    'پادشاه پیر می‌شود و می‌میرد. وارثش — که صفات را نیمه‌ارثی برده — جانشین می‌شود. در یک بازی کامل معمولاً دو تا سه بار تاج دست‌به‌دست می‌شود.',
    'وارث خردسال را تربیت کنید: هر سال زیر تربیت، یکی از مهارت‌هایش رشد می‌کند. پادشاه آینده را شما می‌سازید.',
    'اگر وارث زیر ۱۶ سال به تخت برسد، نیابت سلطنت می‌شود: مشروعیت سقوط می‌کند و اشراف قدرت می‌گیرند. اگر هیچ وارثی نباشد، بحران جانشینی و شاید از دست رفتن تاج.',
    'قانون جانشینی را از پنل 👑 عوض کنید. «انتخابی» اشراف را راضی می‌کند اما تاج را لرزان؛ «ارشدیت پسری» پایدار است اما اگر پسری نباشد فاجعه است.',
  ] },
  { icon: '🏰', title: 'خاندان‌های بزرگ', items: [
    'هر کشور سه تا پنج خاندان اشرافی دارد: سپاهی، زمین‌دار، بازرگان، روحانی و دیوانی. هر کدام نفوذ، وفاداری و استان‌های تحت کنترل دارند.',
    'خاندان وفادار به کشور بونوس می‌دهد. خاندان خشمگین بونوس را پس می‌گیرد و کینه می‌انبارد.',
    'وفاداری از چیزهای واقعی آب می‌خورد: مالیات سنگین، جنگ طولانی، بی‌ثباتی، نیابت سلطنت و پادشاه خودکامه یا سنگ‌دل. پادشاه دادگر و دلربا آرامشان می‌کند.',
    'ابزارهای شما: «پیشکش» (پول در برابر وفاداری)، «تکریم» (وفاداری زیاد اما دیگران حسود می‌شوند) و «کوتاه‌کردن دست» (نفوذ کم، اما کینه زیاد).',
    'اگر خاندانی به‌قدر کافی خشمگین و پرنفوذ شود، مدعی تاج می‌شود و در بدترین حالت جنگ جانشینی راه می‌اندازد. این نادر است — تقریباً همیشه نتیجه‌ی سال‌ها بدحکومتی. فرمانروای دادگر کمابیش هرگز آن را نمی‌بیند.',
  ] },
  { icon: '💍', title: 'ازدواج سیاسی و اتحاد تاجی', items: [
    'از پنل 👑 با دربارهای دیگر وصلت کنید. روابط ۲۲ واحد جهش می‌کند و پیوند خویشاوندی برقرار می‌شود.',
    'خویشاوندان به‌سختی به هم حمله می‌کنند — شبکه‌ی وصلت‌ها یک سپر دیپلماتیک واقعی است.',
    'وصلت، ادعای متقابل بر تاج طرف مقابل می‌سازد. اگر هم‌پیمانِ خویشاوندتان بی‌وارث بمیرد، ممکن است اتحاد تاجی رخ دهد و شما هر دو تاج را داشته باشید. بسیار نادر، اما ممکن.',
    'دربارهای دیگر هم با هم وصلت می‌کنند؛ شبکه‌ی خویشاوندی جهان زنده است و در پنل سلسله دنبالش کنید.',
  ] },
  { icon: '🌟', title: 'قدرت‌های بزرگ و بحران‌ها', items: [
    'هشت کشور برتر جهان «قدرت بزرگ» شمرده می‌شوند. جایگاه از تولید، ارتش، ناوگان، استان و اعتبار می‌آید و مدام جابه‌جا می‌شود.',
    'قدرت بزرگ می‌تواند کشور کوچک را به حوزه‌ی نفوذ خود بکشد و از تجارت و اعتبارش سود ببرد. اگر خودتان زیر نفوذ کسی باشید، می‌توانید بیرون بیایید — به بهای رابطه.',
    'جنگ‌ها دیگر ناگهانی شروع نمی‌شوند: نخست بحران بین‌المللی بر سر یک استان شکل می‌گیرد و چند هفته طول می‌کشد.',
    'در بحران، هر دو سو پشتیبان جذب می‌کنند. اگر یک طرف آشکارا قوی‌تر شود، طرف دیگر بدون جنگ عقب می‌نشیند (و استان یا آبرو را می‌بازد). اگر توازن باشد، جنگ درمی‌گیرد و پشتیبانان هم وارد می‌شوند.',
    'می‌توانید در بحران دیگران هم طرف بگیرید — دوستی می‌خرید و دشمنی.',
  ] },
  { icon: '🌐', title: 'جهانِ داستان‌دار', items: [
    'نقشه هر بار تازه ساخته می‌شود، اما دیگر بی‌روح نیست: به مناطق نام‌دار تقسیم شده («کرانه‌ی زرین»، «دشت‌های بی‌پایان»…) که در زوم دور روی نقشه دیده می‌شوند.',
    'روی زمین آثار باستانی پخش‌اند: جاده‌ی شاهی، آب‌راه کهن، ویرانه‌ی کتابخانه، دژ متروک، بازار بزرگ و… هر کدام بونوس واقعی به استان می‌دهند. فتحشان ارزش دارد.',
    'منابع کمیاب هم هست: سنگ گران‌بها، شوره (باروت)، اسب اصیل، رنگ ارغوان، نقره و… خوراک تجارت و انگیزه‌ی جنگ.',
    'حدود یک‌ششم جهان سرزمین بکر است با قبایل مستقل. با مأموریت استعماری (از پنل استان یا تجارت) آن‌ها را به قلمرو بیفزایید — اما رقبا هم همین را می‌خواهند.',
    'شش بنای عظیم در جهان وجود دارد و هر کدام تنها یک بار ساخته می‌شود: کاخ بزرگ، فرهنگستان، آب‌راه بزرگ، ارگ استوار، نیایشگاه بزرگ و تالار بورس. گران و چندساله، اما شکوه‌آفرین.',
  ] },
  { icon: '🏛️', title: 'شورای درباری، فساد و دسیسه', items: [
    'پنج کرسی شورا (وزیر اعظم، خزانه‌دار، سپهسالار، قاضی‌القضات، رئیس تشریفات) را از میان شاهزادگان و سران خاندان‌های بزرگ پر می‌کنید. هر کرسی به‌اندازه‌ی مهارت شاغلش بونوس می‌دهد.',
    'به هر خاندان کرسی بدهید، وفاداری‌اش بالا می‌رود؛ محرومش کنید یا عزلش کنید، کینه می‌گیرد. شاهزاده‌ای که کرسی نگیرد، مدعیِ فرداست.',
    'فساد به‌مرور رشد می‌کند — با مالیات سنگین، کشور بزرگ و شورای ناراست‌کردار تندتر. از درآمد می‌بلعد، تولید را کند می‌کند و ناآرامی می‌سازد.',
    'دو ابزار در برابر فساد دارید: «بازرسی» (پول می‌خواهد، بی‌دردسر) و «پاکسازی بزرگ» (بسیار مؤثر، اما خاندان‌ها کینه می‌گیرند و ناآرامی بالا می‌رود).',
    'بلندپایگان حیله‌گرِ دل‌آزرده توطئه می‌چینند. اگر کشفش کنید، می‌توانید دستگیرشان کنید یا محافظت را تشدید کنید. توطئه‌ی کشف‌نشده ممکن است به ترور فرمانروا یا وارث بینجامد.',
    'وارث را می‌توانید تربیت کنید (دیوان، رزم، دیپلماسی، نیرنگ). وارث ورزیده یعنی سلطنت آینده‌ی قدرتمندتر — و رقابت کمتر میان شاهزادگان.',
  ] },
  { icon: '⚡', title: 'رویدادها و تصمیم‌ها', items: [
    'در جریان بازی رویدادهای تصادفی پیش می‌آیند؛ هر تصمیم واقعاً روی کشور اثر می‌گذارد (پول، ارتش، ناآرامی، روابط…).',
    'هر رویداد دو نسخه دارد: «نسخه‌ی اصلی» (رسمی و ادبی) و «ترجمه‌ی ساده» (محاوره‌ای) — با دکمه‌های بالای متن جابه‌جا شوید.',
    'هر رویداد داستانی تنها یک بار در هر بازی می‌آید؛ پس هیچ‌وقت همان متن را دو بار نمی‌بینید و هر بازی ترکیب تازه‌ای دارد.',
    'برخی رویدادها زنجیره‌ای‌اند: تصمیم امروزتان پرده‌ی بعدی را ماه‌ها بعد رقم می‌زند. بازی تصمیم شما را به یاد می‌سپارد.',
    'رویدادهای تصادفی پس از چند لحظه خودبه‌خود بسته می‌شوند؛ اگر تصمیمی نگیرید بدون اثر می‌مانند.',
    'رویدادهای کلیدی (آغاز خط زمانی، انتخابات، دوران شاهزادی) تا وقتی تصمیم نگیرید باز می‌مانند.',
  ] },
  { icon: '⏱️', title: 'کنترل زمان و سختی', items: [
    'Space مکث/ادامه؛ کلیدهای 1 تا 4 سرعت بازی را بالا می‌برند (1 کندترین، 4 سریع‌ترین).',
    'در درجه‌ی سختی «افسانه‌ای» فقط پاز/آن‌پاز فعال است و سرعت‌بخشی غیرفعال می‌شود.',
    'سختی روی هوش AI، رشد جمعیت، پیچیدگی اقتصاد (نوسان قیمت و هزینه‌ها) و بسامد رویدادها اثر می‌گذارد.',
  ] },
  { icon: '🏁', title: 'پایان', items: [
    'بازی تا سال پایان خط زمانی ادامه دارد؛ برنده کسی است که بیشترین اعتبار را داشته باشد.',
    'اگر همه‌ی استان‌هایتان را از دست بدهید، شکست خورده‌اید.',
    'بازی هر ۲۶ هفته خودکار ذخیره می‌شود؛ از منوی ☰ هم می‌توانید دستی ذخیره کنید.',
    'حالا نوبت شماست! 🚀 روی یک استان کلیک کنید و ساختمان بسازید.',
  ] },
];

export function showTutorial() {
  const m = document.getElementById('tutorial-modal');
  if (!m) return;
  m.style.display = 'flex';
  let page = 0;
  const n = TUTORIAL_PAGES.length;
  const body = document.getElementById('tut-body');
  const next = document.getElementById('tut-next');
  const prev = document.getElementById('tut-prev');
  const skip = document.getElementById('tut-skip');
  const render = () => {
    const p = TUTORIAL_PAGES[page];
    body.innerHTML = `<div class="tut-ic">${p.icon}</div>
      <div class="tut-title">${esc(p.title)} <span class="dim">(${fd(page + 1)} / ${fd(n)})</span></div>
      <ul class="tut-items">${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
      <div class="tut-dots">${TUTORIAL_PAGES.map((_, i) => `<span class="tut-dot ${i === page ? 'on' : ''}"></span>`).join('')}</div>`;
    prev.style.visibility = page === 0 ? 'hidden' : 'visible';
    next.textContent = page === n - 1 ? '🚀 شروع کن!' : 'بعدی ←';
  };
  render();
  next.onclick = () => {
    Audio2.click();
    if (page < n - 1) { page++; render(); }
    else {
      m.style.display = 'none';
      if (S) {
        if (S.pendingEvent) showEvent();
        else { S.paused = false; refreshTopbar(); } // توتوریال تمام شد؛ بازی را آغاز کن
      }
    }
  };
  prev.onclick = () => { Audio2.click(); if (page > 0) { page--; render(); } };
  const closeTut = () => {
    m.style.display = 'none';
    if (S && S.pendingEvent) showEvent();
  };
  skip.onclick = () => { Audio2.click(); closeTut(); };
  document.getElementById('tut-close').onclick = () => { Audio2.click(); closeTut(); };
}
