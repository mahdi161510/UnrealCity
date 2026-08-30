// ---------- رابط کاربری: منو، HUD، پنل‌ها، رویدادها ----------
import { GOODS, BUILDINGS, TECHS, TECH_BRANCHES, LAWS, LAW_CATS, GROUPS, TAX_LEVELS, POP_CLASSES, TERRAIN, NATION_DEFS, EVENTS, MISSIONS, ERAS, PERSONALITIES, TALK_TOPICS, FAMILY_ROLES_FA } from './data.js';
import { fd, fd1, fK, fMoney, fSign, fPct, fDate, fYearMonth, esc, el, clamp } from './utils.js';
import { TIMELINES, DIFFICULTIES, timelineById } from './timelines.js';
import * as SIM from './sim.js';
import { newGame, saveGame, loadGame, hasSave, clearSave, addLog } from './state.js';
import { REBEL } from './sim.js';

export const UI = {
  selProv: -1, selArmy: null, hoverProv: -1,
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
  const fn = { province: panelProvince, market: panelMarket, tech: panelTech, politics: panelPolitics, diplomacy: panelDiplomacy, military: panelMilitary, ranking: panelRanking, log: panelLog, country: panelCountry, missions: panelMissions, family: panelFamily }[UI.panel];
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
      <img class="flag" src="${R.flagURL(n)}" alt="">
      <div><div class="pv-name">${esc(p.name)}</div>
      <div class="dim">${esc(n.name)}${occ ? ` — <b class="neg">${p.controller === REBEL ? '🔥 اشغال شورشیان' : '⚑ اشغال ' + esc(S.nations[p.controller].name)}</b>` : ''}</div></div>
    </div>
    <div class="pv-tags">
      <span class="tag">${t.icon} ${t.name}</span>
      ${p.coast ? '<span class="tag">⚓ ساحلی</span>' : ''}
      ${p.res.iron > 0.3 ? '<span class="tag">⛓️ آهن</span>' : ''}
      ${p.res.coal > 0.3 ? '<span class="tag">🪨 زغال</span>' : ''}
      ${p.res.wood > 0.5 ? '<span class="tag">🌲 چوب فراوان</span>' : ''}
      ${p.res.farm > 0.6 ? '<span class="tag">🌾 حاصلخیز</span>' : ''}
      ${p.id === n.capital ? '<span class="tag gold">★ پایتخت</span>' : ''}
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
  if (!own) {
    html += `<div class="sec">اقدامات</div><div class="row-btns">
      ${!SIM.warBetween(S, p.owner, S.playerId) ? `<button class="btn danger" data-act="dow">⚔️ اعلام جنگ برای این استان</button>` : '<div class="dim">در حال جنگ با این ملت هستید</div>'}
      <button class="btn ghost" data-act="dip">🤝 دیپلماسی با ${esc(n.name)}</button>
    </div>`;
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
    tip.textContent = `${TERRAIN[p.terrain].icon} ${p.name} — ${n.name}`;
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
  { icon: '⚡', title: 'رویدادها و تصمیم‌ها', items: [
    'در جریان بازی رویدادهای تصادفی پیش می‌آیند؛ هر تصمیم واقعاً روی کشور اثر می‌گذارد (پول، ارتش، ناآرامی، روابط…).',
    'هر رویداد دو نسخه دارد: «نسخه‌ی اصلی» (رسمی و ادبی) و «ترجمه‌ی ساده» (محاوره‌ای) — با دکمه‌های بالای متن جابه‌جا شوید.',
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
