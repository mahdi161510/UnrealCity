// ---------- پنل‌های سامانه‌های تازه: دربار، ناوگان، اطلاعات، جامعه، تجارت ----------
// هر تابع { title, html, after? } برمی‌گرداند — دقیقاً مثل پنل‌های ui.js

import { fd, fd1, fK, fMoney, fSign, fPct, fYearMonth, esc, clamp } from './utils.js';
import { GOODS, BUILDINGS } from './data.js';
import {
  CABINET, CABINET_KEYS, GEN_TRAITS, MIN_TRAITS, charById, charsOf,
  cabinetMods, traitMods, commanderPower, xpToNext,
} from './characters.js';
import {
  SHIP_CLASSES, SHIP_KEYS, shipUnlocked, fleetsOf, totalShips, fleetPower,
  fleetCapacity, fleetUpkeep, navalStrength, zoneOf, blockadeLevel, dockyardCap,
} from './naval.js';
import { OPS, OP_KEYS, spyPower, counterPower, networkIn } from './espionage.js';
import { MOVEMENTS, MOVE_KEYS, CULTURES, RELIGIONS, isAccepted, religiousTension } from './society.js';
import {
  COMPANIES, COMPANY_KEYS, TARIFF_LEVELS, canFound, tradeCapacity, colonizable, companyMods,
} from './trade.js';

// ---------- ابزارهای مشترک ----------
function bar(label, v, txt, cls) {
  return `<div class="bar-row"><span class="bar-lb">${label}</span>
    <div class="bar"><i class="${cls || (v > 66 ? 'good' : v > 33 ? 'mid' : 'bad')}" style="width:${clamp(v, 0, 100)}%"></i></div>
    <span class="dim" style="min-width:52px;text-align:left;direction:ltr">${txt}</span></div>`;
}
function traitChips(c) {
  const pool = c.kind === 'minister' ? MIN_TRAITS : GEN_TRAITS;
  return (c.traits || []).map(t => {
    const T = pool[t]; if (!T) return '';
    const cls = T.good > 0 ? 'gold' : T.good < 0 ? 'bad' : '';
    return `<span class="tag ${cls}" title="${esc(T.desc)}">${T.icon} ${esc(T.name)}</span>`;
  }).join('');
}
function skillStars(s) {
  const full = Math.round(clamp(s, 0, 12) / 2.4);
  return '★'.repeat(clamp(full, 0, 5)) + '☆'.repeat(clamp(5 - full, 0, 5));
}
function loyalClass(l) { return l >= 65 ? 'good' : l >= 35 ? 'mid' : 'bad'; }

// ================== ۱) دربار و فرماندهان ==================
export function panelCourt(S, UI, R) {
  const pn = S.nations[S.playerId];
  const cm = cabinetMods(S, pn);
  const gens = charsOf(S, pn.id, 'general');
  const adms = charsOf(S, pn.id, 'admiral');
  const mins = charsOf(S, pn.id, 'minister');
  const salary = CABINET_KEYS.reduce((a, r) => { const c = charById(S, pn.cabinet?.[r]); return a + (c && c.alive ? c.salary : 0); }, 0);
  const filled = CABINET_KEYS.filter(r => charById(S, pn.cabinet?.[r])?.alive).length;

  let html = `<div class="dim hint">وزیران کاردان کل کشور را بالا می‌کشند و ژنرال‌های باتجربه جنگ را می‌برند.
    وفاداری پایین یعنی توطئه؛ حواستان به آن باشد.</div>
  <div class="kv">
    <div>🏛️ کابینه <b>${fd(filled)}/${fd(CABINET_KEYS.length)}</b></div>
    <div>💰 حقوق هفتگی <b>${fMoney(salary)}</b></div>
    <div>🎖️ فرماندهان <b>${fd(gens.length + adms.length)}</b></div>
  </div>`;

  // ---- اثر کل کابینه ----
  const eff = [];
  if (cm.tax) eff.push(`مالیات ${fSign(cm.tax * 100, 1)}٪`);
  if (cm.stability) eff.push(`ثبات ${fSign(cm.stability, 1)}`);
  if (cm.legit) eff.push(`مشروعیت ${fSign(cm.legit, 1)}`);
  if (cm.unrest) eff.push(`ناآرامی ${fSign(cm.unrest, 1)}`);
  if (cm.atk || cm.def) eff.push(`رزم ${fSign((cm.atk + cm.def) / 2 * 100, 1)}٪`);
  if (cm.innov) eff.push(`نوآوری ${fSign(cm.innov, 1)}`);
  if (cm.spy) eff.push(`جاسوسی ${fSign(cm.spy * 100, 0)}٪`);
  if (cm.build) eff.push(`ساخت ${fSign(cm.build * 100, 0)}٪`);
  if (cm.corrupt > 0.02) eff.push(`<span class="neg">فساد ${fPct(cm.corrupt * 0.14)}</span>`);
  if (eff.length) html += `<div class="cur-res">اثر کنونی کابینه: ${eff.join(' • ')}</div>`;

  // ---- پست‌های کابینه ----
  html += '<div class="sec">🏛️ کابینه‌ی دولت</div><div class="cab-grid">';
  for (const role of CABINET_KEYS) {
    const P = CABINET[role];
    const c = charById(S, pn.cabinet?.[role]);
    const live = c && c.alive;
    html += `<div class="cab-slot ${live ? '' : 'empty'}">
      <div class="cab-role"><span class="cab-ic">${P.icon}</span><b>${esc(P.name)}</b></div>
      <div class="dim small">${esc(P.desc)}</div>`;
    if (live) {
      html += `<div class="cab-person">
        <div class="cab-nm">${esc(c.name)} <span class="gold">${skillStars(c.skill)}</span></div>
        <div class="dim small">سن ${fd(Math.round(c.age))} — حقوق ${fMoney(c.salary)}/هفته</div>
        <div class="bar" title="وفاداری"><i class="${loyalClass(c.loyalty)}" style="width:${c.loyalty}%"></i></div>
        <div class="pv-tags">${traitChips(c)}</div>
      </div>
      <div class="row-btns"><button class="mini-btn no" data-act="fire-min" data-role="${role}">برکناری</button></div>`;
    } else {
      html += `<div class="cab-person dim">— این پست خالی است —</div>
        <div class="row-btns"><button class="mini-btn ok" data-act="open-hire" data-role="${role}">انتصاب</button></div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // ---- نامزدها ----
  const cands = (pn.candidates || []).map(id => charById(S, id)).filter(c => c && c.alive && !c.post);
  html += `<div class="sec">📋 نامزدهای در دسترس <span class="dim small">هزینه‌ی انتصاب = ۸ برابر حقوق</span></div>`;
  if (!cands.length) html += '<div class="dim">فعلاً نامزدی در دربار نیست؛ چند ماه صبر کنید.</div>';
  for (const c of cands) {
    html += `<div class="chr-row">
      <div class="chr-mid">
        <div><b>${esc(c.name)}</b> <span class="gold">${skillStars(c.skill)}</span> <span class="dim small">سن ${fd(Math.round(c.age))}</span></div>
        <div class="pv-tags">${traitChips(c)}</div>
        <div class="dim small">حقوق ${fMoney(c.salary)}/هفته — انتصاب ${fMoney(c.salary * 8)}</div>
      </div>
      <div class="dip-btns">
        ${CABINET_KEYS.map(r => `<button class="mini-btn" data-act="hire-min" data-role="${r}" data-id="${c.id}" title="${esc(CABINET[r].name)}">${CABINET[r].icon}</button>`).join('')}
      </div></div>`;
  }

  // ---- ژنرال‌ها ----
  html += `<div class="sec">🎖️ ژنرال‌ها (${fd(gens.length)})</div>`;
  if (!gens.length) html += '<div class="dim">ژنرالی در خدمت نیست.</div>';
  for (const c of gens.sort((a, b) => (b.lvl * 10 + b.skill) - (a.lvl * 10 + a.skill))) {
    const xp = xpToNext(c);
    const army = S.armies.find(a => a.genId === c.id);
    html += `<div class="chr-row ${army ? 'on-duty' : ''}">
      <div class="chr-av">🎖️</div>
      <div class="chr-mid">
        <div><b>${esc(c.name)}</b> <span class="gold">${skillStars(c.skill)}</span>
          <span class="tag gold">سطح ${fd(c.lvl)}</span></div>
        <div class="dim small">سن ${fd(Math.round(c.age))} — ${fd(c.wins)}/${fd(c.battles)} پیروزی
          ${army ? `— <span class="pos">فرمانده‌ی ارتش ${fd(Math.round(army.size))} گردانی در ${esc(S.map.provs[army.prov].name)}</span>` : '— <span class="dim">بی‌کار</span>'}</div>
        ${xp ? `<div class="bar" title="تجربه تا سطح بعد"><i class="mid" style="width:${xp.cur / xp.max * 100}%"></i></div>` : ''}
        <div class="bar" title="وفاداری ${fd(Math.round(c.loyalty))}٪"><i class="${loyalClass(c.loyalty)}" style="width:${c.loyalty}%"></i></div>
        <div class="pv-tags">${traitChips(c)}</div>
      </div></div>`;
  }

  // ---- دریاسالاران ----
  html += `<div class="sec">⚓ دریاسالاران (${fd(adms.length)})</div>`;
  if (!adms.length) html += '<div class="dim">دریاسالاری در خدمت نیست.</div>';
  for (const c of adms) {
    const fleet = (S.fleets || []).find(f => f.admId === c.id);
    html += `<div class="chr-row ${fleet ? 'on-duty' : ''}">
      <div class="chr-av">⚓</div>
      <div class="chr-mid">
        <div><b>${esc(c.name)}</b> <span class="gold">${skillStars(c.skill)}</span> <span class="tag gold">سطح ${fd(c.lvl)}</span></div>
        <div class="dim small">${fleet ? `فرمانده‌ی ناوگان ${fd(totalShips(fleet))} فروندی در ${esc(zoneOf(S, fleet.zone)?.name || '')}` : 'بی‌کار — در پنل ناوگان به او فرمان دهید'}</div>
        <div class="pv-tags">${traitChips(c)}</div>
      </div></div>`;
  }

  return { title: '🎩 دربار و فرماندهان', html };
}

// ================== ۲) نیروی دریایی ==================
export function panelNavy(S, UI, R) {
  const pn = S.nations[S.playerId];
  const fleets = fleetsOf(S, pn.id);
  const strength = navalStrength(S, pn.id);
  const blk = blockadeLevel(S, pn.id);
  const upkeep = fleets.reduce((a, f) => a + fleetUpkeep(S, f), 0);
  const ports = S.map.provs.filter(p => p.owner === pn.id && p.coast && (p.bld.port || 0) > 0);

  let html = `<div class="dim hint">ناوگان دریاها را نگه می‌دارد: بندر دشمن را محاصره کنید تا اقتصادش خفه شود،
    سرباز از دریا پیاده کنید و مسیرهای بازرگانی‌تان را امن نگه دارید.</div>
  <div class="kv">
    <div>⚓ توان دریایی <b>${fd(Math.round(strength))}</b></div>
    <div>🚢 ناوگان <b>${fd(fleets.length)}</b></div>
    <div>💰 نگهداری <b class="${upkeep > 60 ? 'neg' : ''}">${fMoney(upkeep)}</b></div>
    ${blk > 0.01 ? `<div class="neg">🚫 بندرهای شما ${fPct(blk)} محاصره‌اند!</div>` : ''}
  </div>`;

  // رتبه‌بندی دریایی جهان
  const navRank = S.nations.filter(n => n.alive).map(n => ({ n, s: navalStrength(S, n.id) })).sort((a, b) => b.s - a.s);
  const myRank = navRank.findIndex(x => x.n.id === pn.id) + 1;
  html += `<div class="cur-res">رتبه‌ی دریایی شما در جهان: <b class="gold">${fd(myRank)}</b> از ${fd(navRank.length)}
    — قدرت نخست: ${esc(navRank[0].n.name)} (${fd(Math.round(navRank[0].s))})</div>`;

  // ---- ناوگان‌ها ----
  html += `<div class="sec">🚢 ناوگان‌های شما</div>`;
  if (!fleets.length) html += '<div class="dim">ناوگانی ندارید. در بندرهایتان کشتی سفارش دهید.</div>';
  for (const f of fleets) {
    const z = zoneOf(S, f.zone);
    const pw = fleetPower(S, f);
    const adm = charById(S, f.admId);
    const cap = fleetCapacity(f);
    const st = f.status === 'move' ? `🌊 در راهِ ${esc(zoneOf(S, f.path[f.path.length - 1])?.name || '')}`
      : f.status === 'blockade' ? `🚫 محاصره‌ی ${esc(S.map.provs[f.blockade]?.name || '')}`
      : f.status === 'battle' ? '⚔️ در نبرد' : '⚓ لنگر انداخته';
    html += `<div class="fleet ${UI.selFleet === f.id ? 'sel' : ''}">
      <div class="fl-head">
        <b>ناوگان ${fd(f.id)}</b> <span class="dim">— ${esc(z?.name || '')}</span>
        <span class="tag ${f.status === 'battle' ? 'bad' : ''}">${st}</span>
      </div>
      <div class="fl-ships">${Object.entries(f.ships).filter(([, v]) => v > 0)
        .map(([k, v]) => `<span class="tag" title="${esc(SHIP_CLASSES[k].name)}">${SHIP_CLASSES[k].icon} ${fd(v)}</span>`).join('') || '<span class="dim">خالی</span>'}</div>
      <div class="dim small">💥 توان ${fd(Math.round(pw.raw))} — 🧭 انسجام ${fd(Math.round(f.org))}٪
        — 🎒 ظرفیت ${fd(Math.round(f.cargo))}/${fd(Math.round(cap))} گردان
        ${adm ? `— 👤 ${esc(adm.name)} ${skillStars(adm.skill)}` : '— <span class="neg">بی‌فرمانده</span>'}</div>
      <div class="bar"><i class="${f.org > 50 ? 'good' : 'mid'}" style="width:${f.org}%"></i></div>
      <div class="dip-btns">
        <button class="mini-btn" data-act="sel-fleet" data-id="${f.id}" title="برگزیدن برای فرمان">🎯</button>
        ${!adm ? `<button class="mini-btn ok" data-act="assign-adm" data-id="${f.id}" title="گماردن دریاسالار">👤</button>` : ''}
        ${f.cargoArmies?.length ? `<button class="mini-btn ok" data-act="unload" data-id="${f.id}" title="پیاده‌کردن سربازان">🪖⬇</button>` : ''}
        <button class="mini-btn" data-act="load-army" data-id="${f.id}" title="سوارکردن ارتش هم‌بندر">🪖⬆</button>
      </div></div>`;
  }
  if (UI.selFleet) {
    html += `<div class="cur-res">🎯 ناوگان ${fd(UI.selFleet)} برگزیده است — روی نقشه یک <b>منطقه‌ی دریایی</b> کلیک کنید
      یا برای محاصره روی <b>بندر دشمن</b>. <button class="mini-btn no" data-act="desel-fleet">لغو</button></div>`;
  }

  // ---- کارگاه‌های دریایی ----
  html += `<div class="sec">🛠️ کارگاه‌های دریایی</div>`;
  if (!ports.length) html += '<div class="dim">بندری ندارید — در استان ساحلی بندر بسازید.</div>';
  for (const p of ports) {
    html += `<div class="dock-prov"><b>⚓ ${esc(p.name)}</b> <span class="dim small">— بندر سطح ${fd(p.bld.port)}
      ${p.blockaded ? '<span class="neg">(محاصره‌شده!)</span>' : ''}</span>`;
    if (p.navyQueue?.length) {
      html += '<div class="queue">';
      p.navyQueue.forEach((q, i) => {
        html += `<div class="q-item">${SHIP_CLASSES[q.key].icon} ${esc(SHIP_CLASSES[q.key].name)}
          <div class="q-bar"><i style="width:${q.prog / q.weeks * 100}%"></i></div>
          <span class="dim">${fd(Math.max(0, q.weeks - q.prog))} هفته</span>
          <button class="mini-btn no" data-act="cancel-ship" data-p="${p.id}" data-i="${i}">✕</button></div>`;
      });
      html += '</div>';
    }
    html += '<div class="ship-buy">';
    for (const k of SHIP_KEYS) {
      const c = SHIP_CLASSES[k];
      const unl = shipUnlocked(S, pn, k);
      const afford = pn.treasury >= c.cost;
      html += `<button class="plus ${unl && afford ? '' : 'dis'}" data-act="build-ship" data-p="${p.id}" data-k="${k}"
        title="${esc(c.desc)}${unl ? '' : ' — نیازمند فناوری'}">
        ${c.icon} <span class="cost">${fMoney(c.cost)} / ${fd(c.weeks)}هـ</span></button>`;
    }
    html += '</div></div>';
  }

  // ---- مناطق دریایی ----
  html += '<div class="sec">🌊 مناطق دریایی</div>';
  for (const z of S.seaZones || []) {
    const mine = (S.fleets || []).filter(f => f.zone === z.id && f.n === pn.id && totalShips(f) > 0).length;
    const foes = (S.fleets || []).filter(f => f.zone === z.id && f.n !== pn.id && totalShips(f) > 0);
    const foeN = [...new Set(foes.map(f => S.nations[f.n].name))];
    html += `<div class="zone-row"><b>${esc(z.name)}</b>
      <span class="dim small">${fd(z.ports.length)} بندر
      ${mine ? `— <span class="pos">${fd(mine)} ناوگان شما</span>` : ''}
      ${foeN.length ? `— <span class="neg">${esc(foeN.slice(0, 2).join('، '))}</span>` : ''}</span></div>`;
  }
  return { title: '⚓ نیروی دریایی', html };
}

// ================== ۳) سازمان اطلاعات ==================
export function panelSpy(S, UI, R) {
  const pn = S.nations[S.playerId];
  const sp = spyPower(S, pn), cp = counterPower(S, pn);
  const spymaster = charById(S, pn.cabinet?.spymaster);

  let html = `<div class="dim hint">در سایه بجنگید: شبکه بسازید، نقشه بدزدید، کارخانه منفجر کنید و اگر جسارتش را دارید،
    حکومتی را واژگون کنید. هر عملیات ممکن است لو برود و آبرویتان را ببرد.</div>
  <div class="kv">
    <div>🕵️ توان جاسوسی <b>${fd1(sp)}</b></div>
    <div>🛡️ ضدجاسوسی <b>${fd1(cp)}</b></div>
    <div>📋 عملیات جاری <b>${fd((pn.ops || []).length)}/۳</b></div>
  </div>
  ${spymaster ? `<div class="cur-res">👤 رئیس اطلاعات: <b>${esc(spymaster.name)}</b> ${skillStars(spymaster.skill)}</div>`
    : '<div class="cur-res neg">⚠️ رئیس اطلاعات ندارید — در دربار یکی را منصوب کنید تا عملیات‌ها بسیار مؤثرتر شوند.</div>'}`;

  // ---- عملیات جاری ----
  if ((pn.ops || []).length) {
    html += '<div class="sec">⏳ عملیات در جریان</div>';
    for (const o of pn.ops) {
      const op = OPS[o.key];
      const t = S.nations[o.target];
      html += `<div class="op-row">
        <span class="op-ic">${op.icon}</span>
        <div class="chr-mid"><b>${esc(op.name)}</b> <span class="dim">— ${esc(t?.name || 'خودی')}</span>
          <div class="q-bar"><i style="width:${clamp(o.prog / o.weeks * 100, 0, 100)}%"></i></div>
          <div class="dim small">${fd(Math.max(0, Math.ceil(o.weeks - o.prog)))} هفته مانده</div></div>
        <button class="mini-btn no" data-act="abort-op" data-id="${o.id}">لغو</button></div>`;
    }
  }

  // ---- شبکه‌ها و هدف‌ها ----
  html += '<div class="sec">🎯 کشورهای هدف</div>';
  const targets = S.nations.filter(n => n.alive && n.id !== pn.id && n.playable !== false);
  for (const t of targets) {
    const net = networkIn(S, pn, t.id);
    const hasIntel = pn.intel?.[t.id] !== undefined;
    html += `<div class="spy-target">
      <div class="fl-head"><img class="flag" src="${R.flagURL(t)}"><b>${esc(t.name)}</b>
        <span class="dim small">— رابطه ${fSign(pn.rel[t.id] || 0)}</span></div>
      ${bar('شبکه‌ی نفوذ', net, fPct(net / 100), net > 60 ? 'good' : net > 25 ? 'mid' : 'bad')}`;
    if (hasIntel) {
      const navy = navalStrength(S, t.id);
      html += `<div class="intel-box">
        <div class="dim small">📄 گزارش اطلاعاتی (${fYearMonth(pn.intel[t.id], S.startYear)})</div>
        <div class="kv small">
          <div>💰 ${fMoney(t.treasury)}</div><div>🪖 ${fd(Math.round(t.battalions))}</div>
          <div>⚓ ${fd(Math.round(navy))}</div><div>🎓 ${fd(t.tech.length)}</div>
          <div>🏛️ ثبات ${fd(Math.round(t.stability ?? 50))}</div><div>👑 مشروعیت ${fd(Math.round(t.legitimacy ?? 60))}</div>
        </div></div>`;
    }
    html += '<div class="op-buttons">';
    for (const k of OP_KEYS) {
      const op = OPS[k];
      if (op.self) continue;
      const enough = net >= op.net;
      const afford = pn.treasury >= op.cost;
      const busy = (pn.ops || []).length >= 3;
      html += `<button class="mini-btn ${enough && afford && !busy ? '' : 'dis-op'}"
        data-act="start-op" data-k="${k}" data-n="${t.id}"
        title="${esc(op.desc)}\n${esc(op.hint)}\nهزینه ${op.cost} — شبکه‌ی لازم ${op.net}٪ — خطر ${Math.round(op.risk * 100)}٪">
        ${op.icon} ${esc(op.name)}</button>`;
    }
    html += '</div></div>';
  }

  // ---- ضدجاسوسی ----
  html += `<div class="sec">🛡️ دفاع از خودی</div>
    <div class="dim hint">جاسوسان بیگانه هم در خاک شما می‌گردند. ${(pn.counterBoost || 0) > 0 ? '<b class="pos">مأموران شما هوشیارند.</b>' : ''}</div>
    <button class="btn small" data-act="start-op" data-k="counter" data-n="${pn.id}">🛡️ عملیات ضدجاسوسی (${fMoney(OPS.counter.cost)})</button>`;
  // چه کسی به ما نفوذ کرده؟
  const spies = S.nations.filter(n => n.id !== pn.id && (n.spyNet?.[pn.id] || 0) > 12);
  if (spies.length) {
    html += '<div class="sec">⚠️ نفوذ بیگانه در خاک شما</div>';
    for (const n of spies) html += `<div class="dim">🕸️ ${esc(n.name)} — شبکه‌ی تخمینی ${fPct(clamp((n.spyNet[pn.id] - 10) / 100, 0, 1))}</div>`;
  }
  return { title: '🕵️ سازمان اطلاعات', html };
}

// ================== ۴) جامعه ==================
export function panelSociety(S, UI, R) {
  const pn = S.nations[S.playerId];
  const own = S.map.provs.filter(p => p.owner === pn.id);
  const cult = CULTURES[pn.culture] || { name: pn.culture, icon: '🏛️' };
  const rel = RELIGIONS[pn.religion] || { name: pn.religion, icon: '🕌' };

  let html = `<div class="dim hint">کشور فقط اقتصاد نیست: مردم فرهنگ و باور دارند، جنبش‌ها می‌جوشند و اگر
    مشروعیت و ثبات بشکند، جنگ داخلی در می‌گیرد.</div>
  <div class="kv">
    <div>${cult.icon} فرهنگ حاکم <b>${esc(cult.name)}</b></div>
    <div>${rel.icon} مذهب رسمی <b>${esc(rel.name)}</b></div>
  </div>
  ${bar('🏛️ ثبات', pn.stability ?? 50, fd(Math.round(pn.stability ?? 50)) + '٪')}
  ${bar('👑 مشروعیت', pn.legitimacy ?? 60, fd(Math.round(pn.legitimacy ?? 60)) + '٪')}`;

  if (pn.civilWar) {
    const held = own.filter(p => p.controller === -2).length;
    html += `<div class="civil-war">⚔️ <b>جنگ داخلی!</b> ${esc(pn.civilWar.causeName)} علیه تاج قیام کرده‌اند.
      <div class="dim small">${fd(held)} از ${fd(own.length)} استان در دست شورشیان است.
      اگر بیش از ۶۲٪ کشور را بگیرند، خواسته‌شان تحمیل می‌شود.</div></div>`;
  } else if ((pn.stability ?? 50) < 25) {
    html += `<div class="civil-war warn">⚠️ کشور در آستانه‌ی فروپاشی است — اگر ثبات و مشروعیت پایین‌تر بروند، جنگ داخلی می‌شود.</div>`;
  }

  // ---- جنبش‌ها ----
  html += '<div class="sec">🚩 جنبش‌های سیاسی</div>';
  const movs = MOVE_KEYS.map(k => ({ k, ...MOVEMENTS[k], ...(pn.movements?.[k] || { power: 0, radical: 0 }) }))
    .sort((a, b) => (b.power + b.radical) - (a.power + a.radical));
  for (const m of movs) {
    const danger = m.radical > 40 ? 'bad' : m.radical > 18 ? 'mid' : '';
    html += `<div class="mov-row ${danger}">
      <div class="fl-head"><span class="op-ic">${m.icon}</span><b>${esc(m.name)}</b>
        ${m.radical > 30 ? '<span class="tag bad">رادیکال!</span>' : ''}</div>
      <div class="dim small">${esc(m.desc)}</div>
      ${bar('قدرت', m.power, fd(Math.round(m.power)) + '٪')}
      ${m.radical > 3 ? bar('تندروی', m.radical, fd(Math.round(m.radical)) + '٪', 'bad') : ''}
      <div class="dip-btns">
        <button class="mini-btn no" data-act="suppress" data-k="${m.k}"
          title="قدرتش را می‌شکند ولی تندروتر و خشمگین‌تر می‌شوند">🔨 سرکوب (${fMoney(Math.round(400 + m.power * 22))})</button>
        <button class="mini-btn ok" data-act="appease" data-k="${m.k}"
          title="امتیاز می‌دهید؛ تندروی فرو می‌نشیند">🕊️ مصالحه (${fMoney(Math.round(700 + m.power * 32))})</button>
      </div></div>`;
  }

  // ---- ترکیب فرهنگی استان‌ها ----
  const byCult = {};
  for (const p of own) {
    const pop = Object.values(p.pops).reduce((a, b) => a + b, 0);
    byCult[p.culture] = (byCult[p.culture] || 0) + pop;
  }
  const totalPop = Object.values(byCult).reduce((a, b) => a + b, 0) || 1;
  html += '<div class="sec">🌍 ترکیب فرهنگی جمعیت</div>';
  for (const [c, pop] of Object.entries(byCult).sort((a, b) => b[1] - a[1])) {
    const C = CULTURES[c] || { name: c, icon: '•' };
    const acc = c === pn.culture;
    html += `<div class="pop-row"><span>${C.icon} ${esc(C.name)} ${acc ? '<span class="tag gold">پذیرفته</span>' : ''}</span>
      <b>${fPct(pop / totalPop)}</b></div>`;
  }

  // ---- استان‌های ناهم‌گون ----
  const foreign = own.filter(p => p.culture !== pn.culture).sort((a, b) => b.sepPressure - a.sepPressure);
  if (foreign.length) {
    html += `<div class="sec">🏴 استان‌های ناهم‌فرهنگ (${fd(foreign.length)})</div>
      <div class="dim hint">با «برنامه‌ی فرهنگی» می‌توانید هم‌گونی را بالا ببرید — گران است و موقتاً ناآرامی می‌آورد.</div>`;
    for (const p of foreign.slice(0, 10)) {
      const C = CULTURES[p.culture] || { name: p.culture, icon: '•' };
      const RE = RELIGIONS[p.religion] || { name: p.religion, icon: '•' };
      html += `<div class="mov-row">
        <div class="fl-head"><b>${esc(p.name)}</b>
          <span class="tag">${C.icon} ${esc(C.name)}</span>
          <span class="tag ${p.religion !== pn.religion ? 'bad' : ''}">${RE.icon} ${esc(RE.name)}</span></div>
        ${bar('هم‌گونی', p.assim || 0, fd(Math.round(p.assim || 0)) + '٪')}
        ${(p.sepPressure || 0) > 5 ? bar('جدایی‌طلبی', p.sepPressure, fd(Math.round(p.sepPressure)) + '٪', 'bad') : ''}
        <div class="dip-btns">
          <button class="mini-btn ok" data-act="cult-prog" data-p="${p.id}">📚 برنامه‌ی فرهنگی (${fMoney(900)})</button>
          <button class="mini-btn" data-act="goto-prov" data-p="${p.id}">🔍 نمایش</button>
        </div></div>`;
    }
  }
  return { title: '🌍 جامعه و فرهنگ', html };
}

// ================== ۵) تجارت ==================
export function panelTrade(S, UI, R) {
  const pn = S.nations[S.playerId];
  const TL = TARIFF_LEVELS[pn.tariff ?? 2];
  const cap = tradeCapacity(S, pn);
  const co = companyMods(S, pn);
  const blk = blockadeLevel(S, pn.id);

  let html = `<div class="dim hint">تجارت رگ حیات امپراتوری است: مسیر باز کنید، تعرفه تنظیم کنید،
    شرکت‌های بزرگ تأسیس کنید و سرزمین‌های دوردست را مستعمره سازید.</div>
  <div class="kv">
    <div>🚢 ظرفیت مسیر <b>${fd((pn.routes || []).length)}/${fd(Math.floor(cap))}</b></div>
    <div>💰 درآمد تجاری <b class="${(pn._tradeIncome || 0) >= 0 ? 'pos' : 'neg'}">${fMoney(pn._tradeIncome || 0)}</b></div>
    ${blk > 0.01 ? `<div class="neg">🚫 محاصره ${fPct(blk)}</div>` : ''}
  </div>`;

  // ---- تعرفه ----
  html += '<div class="sec">⚖️ سیاست تعرفه</div><div class="tax-row">';
  TARIFF_LEVELS.forEach((t, i) => {
    html += `<button class="tax-btn ${(pn.tariff ?? 2) === i ? 'on' : ''}" data-act="tariff" data-i="${i}"
      title="نرخ ${Math.round(t.rate * 100)}٪ — حجم تجارت ×${t.tradeMult}">${t.icon}<span>${esc(t.name)}</span></button>`;
  });
  html += `</div><div class="dim small">نرخ کنونی <b>${fPct(TL.rate)}</b> — حجم تجارت ×${fd1(TL.tradeMult)}
    ${TL.relBonus ? `— روابط ${fSign(TL.relBonus * 100, 0)}` : ''}</div>`;

  // ---- مسیرها ----
  html += '<div class="sec">🛣️ مسیرهای بازرگانی</div>';
  if (!(pn.routes || []).length) html += '<div class="dim">مسیری باز نکرده‌اید. از فهرست پایین شریک و کالا برگزینید.</div>';
  (pn.routes || []).forEach((r, i) => {
    const m = S.nations[r.with];
    const G = GOODS[r.good];
    html += `<div class="route-row">
      <span class="op-ic">${G.icon}</span>
      <div class="chr-mid"><b>${esc(G.name)}</b> ${r.dir === 'export' ? '📤 صادرات به' : '📥 واردات از'} <b>${esc(m?.name || '?')}</b>
        <div class="dim small">حجم ${fd1(r.vol || 0)} — عمر ${fd(Math.round((r.age || 0) / 52))} سال</div></div>
      <button class="mini-btn no" data-act="close-route" data-i="${i}">✕</button></div>`;
  });
  // گشایش مسیر تازه
  if ((pn.routes || []).length < Math.floor(cap)) {
    const partners = S.nations.filter(n => n.alive && n.id !== pn.id && (pn.rel[n.id] || 0) >= -25);
    html += `<div class="new-route">
      <select id="route-nation" class="sel-in">${partners.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select>
      <select id="route-good" class="sel-in">${Object.entries(GOODS).map(([k, g]) => `<option value="${k}">${g.icon} ${esc(g.name)}</option>`).join('')}</select>
      <button class="mini-btn ok" data-act="open-route">➕ گشایش (${fMoney(300)})</button></div>`;
  } else {
    html += '<div class="dim small">⚠️ ظرفیت پر است — بندر یا راه‌آهن بسازید تا بیشتر تجارت کنید.</div>';
  }

  // ---- شرکت‌ها ----
  html += `<div class="sec">🏢 شرکت‌های بازرگانی (${fd((pn.companies || []).length)}/۴)</div>`;
  for (const k of COMPANY_KEYS) {
    const C = COMPANIES[k];
    const owned = (pn.companies || []).includes(k);
    const chk = canFound(S, pn, k);
    html += `<div class="comp-row ${owned ? 'owned' : ''}">
      <span class="op-ic">${C.icon}</span>
      <div class="chr-mid"><b>${esc(C.name)}</b>
        <div class="dim small">${esc(C.desc)}</div></div>
      ${owned ? '<span class="tag gold">✔ تأسیس‌شده</span>'
        : `<button class="mini-btn ${chk.ok ? 'ok' : 'dis-op'}" data-act="found-co" data-k="${k}"
             title="${chk.ok ? '' : esc(chk.why)}">${fMoney(C.cost)}</button>`}</div>`;
  }

  // ---- استعمار ----
  const colTargets = S.map.provs.filter(p => colonizable(S, pn, p));
  const maxCol = 2 + (co.colony || 0);
  html += `<div class="sec">🏴 مأموریت‌های استعماری (${fd((pn.colonies || []).length)}/${fd(maxCol)})</div>`;
  for (const c of pn.colonies || []) {
    const p = S.map.provs[c.prov];
    html += `<div class="route-row"><span class="op-ic">🏴</span>
      <div class="chr-mid"><b>${esc(p?.name || '?')}</b>
        <div class="q-bar"><i style="width:${clamp(c.prog, 0, 100)}%"></i></div>
        <div class="dim small">${fd(Math.round(c.prog))}٪ — سرعت با ناوگان، طب نوین و کمپانی هند شرقی بیشتر می‌شود</div></div>
      <button class="mini-btn no" data-act="abandon-col" data-p="${c.prov}">✕</button></div>`;
  }
  if (!colTargets.length) html += '<div class="dim">سرزمین قابل استعماری در دسترس نیست (باید مجاور خاک یا بندرهای شما باشد).</div>';
  else if ((pn.colonies || []).length < maxCol) {
    html += '<div class="dim hint">سرزمین‌های در دسترس:</div>';
    for (const p of colTargets.slice(0, 8)) {
      html += `<div class="route-row"><span class="op-ic">🗺️</span>
        <div class="chr-mid"><b>${esc(p.name)}</b> <span class="dim small">— ${esc(p.terrain)}${p.coast ? ' • ساحلی' : ''}</span></div>
        <button class="mini-btn ok" data-act="colonize" data-p="${p.id}">🏴 ${fMoney(1400)}</button></div>`;
    }
  }
  return { title: '🛣️ تجارت و مستعمرات', html };
}
