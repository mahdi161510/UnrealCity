// ---------- پنل‌های سلسله، جهان و قدرت‌های بزرگ ----------
import { esc, fd, fd1, fMoney, fSign, fPct, fDate } from './utils.js';
import {
  ROYAL_TRAITS, SUCCESSION_LAWS, SUCCESSION_KEYS, FACTION_KINDS,
  rulerOf, heirOf, royalById, childrenOf, factionsOf, royalMods,
} from './dynasty.js';
import {
  LANDMARKS, RARE_RES, WONDERS, WONDER_KEYS, worldMods, regionOf, canBuildWonder,
} from './world.js';
import { powerScore, sphereLord, sphereOf, claimStrength, canSphere } from './greatpower.js';
import { SEATS, SEAT_KEYS, seatScore, candidatesFor } from './council.js';

// ---------- کمکی ----------
function bar(v, max, cls, h = 6) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar" style="height:${h}px"><i class="${cls || ''}" style="width:${pct}%"></i></div>`;
}
function loyalClass(v) { return v >= 65 ? 'good' : v >= 38 ? 'mid' : 'bad'; }
function statDots(v) {
  // ۱..۲۰ را به ۵ دایره تبدیل می‌کند
  const n = Math.round(v / 4);
  return `<span class="stat-dots" title="${v}/۲۰">${'●'.repeat(Math.max(0, n))}${'○'.repeat(Math.max(0, 5 - n))}</span>`;
}
function traitChips(traits) {
  return (traits || []).map(t => {
    const T = ROYAL_TRAITS[t];
    if (!T) return '';
    return `<span class="rt-chip ${T.good > 0 ? 'gd' : 'bd'}" title="${esc(T.desc)}">${T.icon} ${esc(T.name)}</span>`;
  }).join('');
}
function ageBadge(r) {
  const c = r.health < 30 ? 'bad' : r.health < 60 ? 'mid' : 'good';
  return `<span class="age-b">${fd(r.age)} ساله</span> <span class="hp-b ${c}" title="سلامت">♥ ${fd(Math.round(r.health))}</span>`;
}
function royalCard(S, r, label, extra = '') {
  if (!r) return `<div class="roy-card empty"><div class="roy-lbl">${label}</div><div class="dim">— کسی نیست —</div></div>`;
  const s = r.stat;
  return `<div class="roy-card">
    <div class="roy-lbl">${label}</div>
    <div class="roy-head">
      <span class="roy-av">${r.male ? '🤴' : '👸'}</span>
      <div class="roy-id">
        <b>${esc(r.name)}</b>
        <div class="dim">از خاندان ${esc(r.house)} · ${ageBadge(r)}</div>
      </div>
    </div>
    <div class="roy-stats">
      <span title="کشورداری — درآمد و کارایی">🏛️ ${statDots(s.admin)}</span>
      <span title="نظامی — توان نبرد">⚔️ ${statDots(s.martial)}</span>
      <span title="دیپلماسی — روابط و مشروعیت">🕊️ ${statDots(s.diplo)}</span>
      <span title="تدبیر — جاسوسی و ضدتوطئه">🦊 ${statDots(s.guile)}</span>
    </div>
    <div class="rt-row">${traitChips(r.traits)}</div>
    ${extra}
  </div>`;
}

// ================== پنل سلسله ==================
export function panelDynasty(S, UI, R) {
  const n = S.nations[S.playerId];
  if (!n.dyn) return { title: 'سلسله', html: '<div class="sec"><div class="dim">در این خط زمانی سلسله‌ی پادشاهی وجود ندارد.</div></div>' };

  const d = n.dyn;
  const k = rulerOf(S, S.playerId);
  const h = heirOf(S, S.playerId);
  const rm = royalMods(S, S.playerId);
  let html = '';

  // --- نیابت سلطنت ---
  if (d.regency) {
    html += `<div class="civil-war warn">👑 <b>نیابت سلطنت</b> — ${esc(n.ruler)} خردسال است و <b>${esc(d.regentName || 'شورا')}</b> زمام امور را در دست دارد.
      مشروعیت و کارایی کشور تا سن قانونی (۱۶ سالگی) آسیب می‌بیند.</div>`;
  }
  // --- جنگ جانشینی ---
  if (d.pretenderWar) {
    html += `<div class="civil-war">⚔️ <b>جنگ جانشینی!</b> خاندان <b>${esc(d.pretenderWar.house)}</b> مدعی تاج است و استان‌هایی را در تصرف دارد.
      تا سرکوبشان نکنید یا با آنان مصالحه نکنید، تاج در خطر است.</div>`;
  }
  // --- اتحاد تاجی ---
  if (d.unionWith != null && S.nations[d.unionWith]) {
    html += `<div class="sec"><div class="union-box">⚜️ <b>اتحاد تاجی</b> با ${esc(S.nations[d.unionWith].name)} — یک تاج بر دو سر.</div></div>`;
  }

  // --- پادشاه و وارث ---
  const reign = Math.floor((S.week - (k?.reignStart || 0)) / 52);
  html += `<div class="sec"><h4>👑 تخت و تاج</h4>
    <div class="kv">
      <div><span>خاندان فرمانروا</span><b>${esc(d.house)}</b></div>
      <div><span>سال‌های سلطنت</span><b>${fd(reign)} سال</b></div>
      <div><span>مشروعیت</span><b class="${(n.legitimacy ?? 60) < 40 ? 'neg' : 'pos'}">${fd(Math.round(n.legitimacy ?? 60))}٪</b></div>
      <div><span>ثبات</span><b class="${(n.stability ?? 50) < 30 ? 'neg' : 'pos'}">${fd(Math.round(n.stability ?? 50))}٪</b></div>
    </div>
    <div class="roy-grid">
      ${royalCard(S, k, 'فرمانروا')}
      ${royalCard(S, h, 'وارث تاج', h && h.age < 17 ? `<div class="edu-row">
        <span class="dim small">تربیت:</span>
        ${['martial', 'admin', 'diplo', 'guile'].map(e => `<button class="mini-btn ${h.education === e ? 'on' : ''}" data-act="educate" data-e="${e}"
          title="${{ martial: 'پرورش نظامی', admin: 'پرورش دیوانی', diplo: 'پرورش دیپلماتیک', guile: 'پرورش در فنون پنهان' }[e]}">${{ martial: '⚔️', admin: '🏛️', diplo: '🕊️', guile: '🦊' }[e]}</button>`).join('')}
      </div>` : '')}
    </div>`;

  // اثر پادشاه بر کشور
  const shown = [
    ['admin', 'کارایی دیوان'], ['taxIncome', 'درآمد'], ['research', 'پژوهش'], ['armyAtk', 'تهاجم'],
    ['relGain', 'دیپلماسی'], ['legitimacy', 'مشروعیت'], ['stability', 'ثبات'], ['spy', 'جاسوسی'],
    ['unrest', 'ناآرامی'], ['upkeep', 'هزینه‌ها'], ['corruption', 'فساد'],
  ].filter(([kk]) => Math.abs(rm[kk] || 0) > 0.001);
  if (shown.length) {
    html += `<div class="mod-row">${shown.map(([kk, lbl]) => {
      const v = rm[kk];
      const bad = ['unrest', 'upkeep', 'corruption'].includes(kk);
      const good = bad ? v < 0 : v > 0;
      return `<span class="mod-chip ${good ? 'gd' : 'bd'}">${esc(lbl)} ${fSign(Math.round(v * 100))}٪</span>`;
    }).join('')}</div>`;
  }
  html += `</div>`;

  // --- فرزندان ---
  const kids = k ? childrenOf(S, k) : [];
  if (kids.length) {
    html += `<div class="sec"><h4>👶 فرزندان (${fd(kids.length)})</h4>`;
    for (const c of kids.sort((a, b) => b.age - a.age)) {
      const isHeir = h && h.id === c.id;
      html += `<div class="chr-row ${isHeir ? 'on-duty' : ''}">
        <div class="chr-av">${c.male ? '🤴' : '👸'}</div>
        <div class="chr-mid">
          <div><b>${esc(c.name)}</b> ${isHeir ? '<span class="tag gold">وارث</span>' : ''} <span class="dim">${ageBadge(c)}</span></div>
          <div class="roy-stats small">
            <span>🏛️${statDots(c.stat.admin)}</span><span>⚔️${statDots(c.stat.martial)}</span>
            <span>🕊️${statDots(c.stat.diplo)}</span><span>🦊${statDots(c.stat.guile)}</span>
          </div>
          <div class="rt-row">${traitChips(c.traits)}</div>
        </div>
        ${d.succession === 'appointed' && !isHeir ? `<div class="dip-btns"><button class="mini-btn" data-act="name-heir" data-id="${c.id}" title="این فرزند را وارث کن">👑</button></div>` : ''}
      </div>`;
    }
    html += `</div>`;
  }

  // --- قانون جانشینی ---
  html += `<div class="sec"><h4>📜 قانون جانشینی</h4>
    <div class="dim small">تغییر قانون ۴۰۰۰ سکه هزینه دارد و اشراف را می‌رنجاند.</div>
    <div class="succ-list">`;
  for (const key of SUCCESSION_KEYS) {
    const L = SUCCESSION_LAWS[key];
    const on = d.succession === key;
    html += `<div class="succ-row ${on ? 'on' : ''}">
      <div class="succ-main">
        <b>${L.icon} ${esc(L.name)}</b>
        <div class="dim small">${esc(L.desc)}</div>
        <div class="mod-row small">
          <span class="mod-chip ${L.stability >= 0 ? 'gd' : 'bd'}">ثبات ${fSign(L.stability)}</span>
          <span class="mod-chip ${L.legitimacy >= 0 ? 'gd' : 'bd'}">مشروعیت ${fSign(L.legitimacy)}</span>
          <span class="mod-chip ${L.factionLoyal >= 0 ? 'gd' : 'bd'}">وفاداری اشراف ${fSign(L.factionLoyal)}</span>
        </div>
      </div>
      ${on ? '<span class="tag gold">جاری</span>' : `<button class="mini-btn" data-act="succ-law" data-k="${key}">برگزین</button>`}
    </div>`;
  }
  html += `</div></div>`;

  // --- خاندان‌های اشرافی ---
  const facs = factionsOf(S, S.playerId);
  html += `<div class="sec"><h4>🏰 خاندان‌های بزرگ (${fd(facs.length)})</h4>
    <div class="dim small">وفاداری پایین + مشروعیت پایین = خطر ادعای تاج. با زر آرامشان کنید یا نفوذشان را بشکنید.</div>`;
  for (const f of facs) {
    const K = FACTION_KINDS[f.key];
    const head = royalById(S, f.headId);
    html += `<div class="fac-row ${f.pretender ? 'pretender' : ''}">
      <div class="fac-head">
        <span class="fac-ic">${K.icon}</span>
        <div class="fac-id">
          <b>خاندان ${esc(f.house)}</b> ${f.pretender ? '<span class="tag bad">مدعی تاج</span>' : ''}
          <div class="dim small">${esc(K.name)} · سرکرده: ${head ? esc(head.name) : '—'} · ${fd(f.provs.filter(id => S.map.provs[id]?.owner === n.id).length)} استان</div>
        </div>
      </div>
      <div class="bar-row"><span class="bar-lb">وفاداری</span>${bar(f.loyalty, 100, loyalClass(f.loyalty))}<span class="bar-v">${fd(Math.round(f.loyalty))}</span></div>
      <div class="bar-row"><span class="bar-lb">نفوذ</span>${bar(f.power, 100, 'mid')}<span class="bar-v">${fd(Math.round(f.power))}</span></div>
      ${f.grudge > 25 ? `<div class="bar-row"><span class="bar-lb">کینه</span>${bar(f.grudge, 100, 'bad')}<span class="bar-v">${fd(Math.round(f.grudge))}</span></div>` : ''}
      <div class="row-btns">
        <button class="mini-btn" data-act="fac-gift" data-h="${esc(f.house)}" title="۱۸۰۰ سکه — وفاداری +۱۵">🎁 پیشکش</button>
        <button class="mini-btn" data-act="fac-honor" data-h="${esc(f.house)}" title="سرکرده را به کابینه دعوت کن — وفاداری +۲۵، نفوذ +۵">🎖️ تکریم</button>
        <button class="mini-btn danger" data-act="fac-curb" data-h="${esc(f.house)}" title="نفوذ −۱۵ اما وفاداری −۲۰">⛓️ کوتاه‌کردن دست</button>
      </div>
    </div>`;
  }
  html += `</div>`;

  // --- وصلت‌ها ---
  const mar = Object.keys(d.marriages || {});
  html += `<div class="sec"><h4>💍 پیوندهای خویشاوندی</h4>`;
  if (!mar.length) html += `<div class="dim">هنوز با هیچ دربار دیگری وصلت نکرده‌اید.</div>`;
  else {
    for (const oid of mar) {
      const o = S.nations[+oid];
      if (!o) continue;
      html += `<div class="mar-row">
        <img class="flag" src="${R.flagURL(o)}" alt="">
        <div class="mar-mid"><b>${esc(o.name)}</b>
          <div class="dim small">خاندان ${esc(o.dyn?.house || '—')} · از ${fDate(d.marriages[oid].since)} · روابط ${fSign(n.rel[o.id] || 0)}</div>
        </div>
        <span class="tag gold">خویشاوند</span>
      </div>`;
    }
  }
  // پیشنهاد وصلت
  const cands = S.nations.filter(o => o.alive && o.id !== n.id && o.dyn && !d.marriages[o.id]);
  if (cands.length) {
    html += `<div class="new-route">
      <select class="sel-in" id="mar-nation">${cands.map(o => `<option value="${o.id}">${esc(o.name)} (روابط ${fSign(n.rel[o.id] || 0)})</option>`).join('')}</select>
      <button class="mini-btn" data-act="propose-marriage" title="۲۰۰۰ سکه — نیازمند روابط مثبت">💍 پیشنهاد وصلت</button>
    </div>`;
  }
  html += `</div>`;

  // --- اخبار دربارهای جهان ---
  const news = (S.royalNews || []).slice(0, 26);
  html += `<div class="sec"><h4>📰 اخبار دربارهای جهان</h4>`;
  if (!news.length) html += `<div class="dim">هنوز خبری نرسیده است.</div>`;
  for (const nw of news) {
    const nn = S.nations[nw.nid];
    html += `<div class="news-row">
      <span class="news-ic">${nw.icon}</span>
      <div class="news-mid"><span class="dim small">${fDate(nw.w)}${nn ? ' · ' + esc(nn.name) : ''}</span><div>${esc(nw.text)}</div></div>
    </div>`;
  }
  html += `</div>`;

  return { title: 'سلسله و دربار', html };
}

// ================== پنل جهان ==================
export function panelWorld(S, UI, R) {
  const n = S.nations[S.playerId];
  const wm = worldMods(S, S.playerId);
  let html = '';

  // --- خلاصه ---
  const myLm = S.map.provs.filter(p => p.owner === n.id && p.landmark);
  const myRare = S.map.provs.filter(p => p.owner === n.id && p.rare);
  const freeProvs = S.map.provs.filter(p => p.owner < 0);
  html += `<div class="sec"><h4>🌐 جهان شناخته‌شده</h4>
    <div class="kv">
      <div><span>مناطق جهان</span><b>${fd((S.regions || []).length)}</b></div>
      <div><span>سرزمین‌های بکر</span><b>${fd(freeProvs.length)}</b></div>
      <div><span>آثار در دست شما</span><b>${fd(myLm.length)}</b></div>
      <div><span>منابع کمیاب شما</span><b>${fd(myRare.length)}</b></div>
    </div></div>`;

  // --- بناهای عظیم ---
  const mine = (S.wonders || []).filter(w => w.nid === n.id);
  const building = mine.find(w => !w.done);
  html += `<div class="sec"><h4>🏯 بناهای عظیم</h4>
    <div class="dim small">هر بنا در سراسر جهان تنها یک بار ساخته می‌شود. هم‌زمان تنها یک پروژه ممکن است.</div>`;
  if (building) {
    const W = WONDERS[building.key];
    const p = S.map.provs[building.prov];
    html += `<div class="wonder-row building">
      <span class="wo-ic">${W.icon}</span>
      <div class="wo-mid">
        <b>${esc(W.name)}</b> <span class="dim small">در ${esc(p?.name || '—')}</span>
        ${bar(building.prog, 100, 'gold', 7)}
        <div class="dim small">${fd(Math.round(building.prog))}٪ — حدود ${fd(Math.ceil((100 - building.prog) / (100 / W.weeks)))} هفته مانده</div>
      </div>
    </div>`;
  }
  for (const key of WONDER_KEYS) {
    const W = WONDERS[key];
    const done = (S.wonders || []).find(w => w.key === key && w.done);
    if (done) {
      const own = S.nations[done.nid];
      const isMine = done.nid === n.id;
      html += `<div class="wonder-row ${isMine ? 'mine' : 'taken'}">
        <span class="wo-ic">${W.icon}</span>
        <div class="wo-mid"><b>${esc(W.name)}</b>
          <div class="dim small">${isMine ? 'شکوه شماست' : 'ساخته‌ی ' + esc(own?.name || '—')}</div>
        </div>
        ${isMine ? '<span class="tag gold">از آنِ شما</span>' : '<span class="tag">ساخته شده</span>'}
      </div>`;
      continue;
    }
    if (building) continue;
    const sel = UI.selProv >= 0 ? S.map.provs[UI.selProv] : null;
    const chk = sel ? canBuildWonder(S, n, key, sel.id) : { ok: false, why: 'نخست استانی برگزینید' };
    html += `<div class="wonder-row">
      <span class="wo-ic">${W.icon}</span>
      <div class="wo-mid">
        <b>${esc(W.name)}</b>
        <div class="dim small">${esc(W.desc)}</div>
        <div class="mod-row small">${Object.entries(W.mods).map(([mk, mv]) =>
          `<span class="mod-chip gd">${esc(modLabel(mk))} ${mk.endsWith('Flat') ? fSign(mv) : fSign(Math.round(mv * 100)) + '٪'}</span>`).join('')}</div>
        <div class="dim small">${fMoney(W.cost)} · ${fd(W.weeks)} هفته${W.needCoast ? ' · نیازمند استان ساحلی' : ''}</div>
      </div>
      <button class="mini-btn ${chk.ok ? '' : 'dis-op'}" data-act="build-wonder" data-k="${key}"
        title="${chk.ok ? 'ساخت در ' + esc(sel.name) : esc(chk.why)}">🏗️</button>
    </div>`;
  }
  html += `</div>`;

  // --- مناطق ---
  html += `<div class="sec"><h4>🗺️ مناطق جهان</h4>`;
  for (const rg of S.regions || []) {
    const provs = rg.provs.map(id => S.map.provs[id]).filter(Boolean);
    const mineC = provs.filter(p => p.owner === n.id).length;
    const freeC = provs.filter(p => p.owner < 0).length;
    html += `<div class="zone-row">
      <span><b>${esc(rg.name)}</b> <span class="dim small">${fd(provs.length)} استان</span></span>
      <span class="dim small">${mineC ? `<b class="pos">${fd(mineC)} از شما</b>` : ''}${freeC ? ` · ${fd(freeC)} بکر` : ''}</span>
    </div>`;
  }
  html += `</div>`;

  // --- آثار و منابع من ---
  if (myLm.length || myRare.length) {
    html += `<div class="sec"><h4>💎 گنجینه‌های قلمرو</h4>`;
    for (const p of myLm) {
      const L = LANDMARKS[p.landmark];
      html += `<div class="lm-row" data-act="goto-prov" data-p="${p.id}">
        <span class="lm-ic">${L.icon}</span>
        <div class="lm-mid"><b>${esc(L.name)}</b> <span class="dim small">— ${esc(p.name)}</span>
          <div class="dim small">${esc(L.desc)}</div>
          <div class="mod-row small">${Object.entries(L.mods).map(([mk, mv]) =>
            `<span class="mod-chip gd">${esc(modLabel(mk))} ${mk.endsWith('Flat') ? fSign(mv) : fSign(Math.round(mv * 100)) + '٪'}</span>`).join('')}</div>
        </div>
      </div>`;
    }
    for (const p of myRare) {
      const Rr = RARE_RES[p.rare];
      html += `<div class="lm-row" data-act="goto-prov" data-p="${p.id}">
        <span class="lm-ic">${Rr.icon}</span>
        <div class="lm-mid"><b>${esc(Rr.name)}</b> <span class="dim small">— ${esc(p.name)}</span>
          <div class="dim small">${esc(Rr.desc)}</div>
          <div class="mod-row small">${Object.entries(Rr.mods).map(([mk, mv]) =>
            `<span class="mod-chip gd">${esc(modLabel(mk))} ${mk.endsWith('Flat') ? fSign(mv) : fSign(Math.round(mv * 100)) + '٪'}</span>`).join('')}</div>
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  // --- سرزمین‌های بکر ---
  if (freeProvs.length) {
    html += `<div class="sec"><h4>🏴 سرزمین‌های بکر (${fd(freeProvs.length)})</h4>
      <div class="dim small">قبایل مستقل. با مأموریت استعماری (پنل تجارت) می‌توانید آن‌ها را به قلمرو بیفزایید.</div>`;
    for (const p of freeProvs.slice(0, 14)) {
      const near = p.adj.some(q => S.map.provs[q]?.owner === n.id);
      html += `<div class="zone-row" data-act="goto-prov" data-p="${p.id}" style="cursor:pointer">
        <span>${esc(p.name)} <span class="dim small">${esc(p.tribe || 'قبیله')}</span>${p.rare ? ' ' + RARE_RES[p.rare].icon : ''}${p.landmark ? ' ' + LANDMARKS[p.landmark].icon : ''}</span>
        <span class="dim small">${near ? '<b class="pos">هم‌مرز شما</b>' : 'دوردست'}</span>
      </div>`;
    }
    html += `</div>`;
  }

  return { title: 'جهان', html };
}

function modLabel(k) {
  return {
    tradeCap: 'ظرفیت تجاری', moveSpeed: 'سرعت حرکت', farm: 'کشاورزی', popGrowth: 'رشد جمعیت',
    research: 'پژوهش', literacy: 'سواد', defense: 'پدافند', digCap: 'سنگربندی', taxIncome: 'درآمد',
    prod: 'تولید', unrest: 'ناآرامی', navy: 'نیروی دریایی', prestigeFlat: 'اعتبار', legitimacy: 'مشروعیت',
    stability: 'ثبات', ironBonus: 'آهن', armyAtk: 'تهاجم', armyMor: 'روحیه', armsProd: 'تولید سلاح',
    relGain: 'دیپلماسی', admin: 'دیوان', spy: 'جاسوسی', counter: 'ضدجاسوسی', upkeep: 'هزینه',
    corruption: 'فساد', buildCost: 'هزینه ساخت',
  }[k] || k;
}

// ================== پنل قدرت‌های بزرگ ==================
export function panelPowers(S, UI, R) {
  const n = S.nations[S.playerId];
  const ranked = S.nations.filter(x => x.alive).sort((a, b) => powerScore(S, b) - powerScore(S, a));
  const myLord = sphereLord(S, n.id);
  const mySubs = sphereOf(S, n.id);
  let html = '';

  html += `<div class="sec"><h4>🌟 جایگاه شما</h4>
    <div class="kv">
      <div><span>رتبه‌ی جهانی</span><b>${fd(n.gpRank || '—')}</b></div>
      <div><span>وضعیت</span><b class="${n.greatPower ? 'pos' : ''}">${n.greatPower ? 'قدرت بزرگ' : 'قدرت میانه'}</b></div>
      <div><span>امتیاز قدرت</span><b>${fd(Math.round(powerScore(S, n)))}</b></div>
      <div><span>کشورهای زیر نفوذ</span><b>${fd(mySubs.length)}</b></div>
    </div>`;
  if (myLord) {
    html += `<div class="civil-war warn">⛓️ شما در حوزه‌ی نفوذ <b>${esc(myLord.name)}</b> هستید.
      <button class="mini-btn danger" data-act="leave-sphere">بیرون آمدن</button></div>`;
  }
  html += `</div>`;

  // --- رتبه‌بندی ---
  html += `<div class="sec"><h4>👑 قدرت‌های جهان</h4>`;
  ranked.forEach((x, i) => {
    const isGP = x.greatPower;
    const lord = sphereLord(S, x.id);
    const subs = sphereOf(S, x.id);
    const claim = n.dyn ? claimStrength(S, n.id, x.id) : 0;
    const chk = x.id === n.id ? null : canSphere(S, n, x);
    html += `<div class="gp-row ${isGP ? 'gp' : ''} ${x.id === n.id ? 'me' : ''}">
      <span class="gp-rank">${fd(i + 1)}</span>
      <img class="flag" src="${R.flagURL(x)}" alt="">
      <div class="gp-mid">
        <div><b>${esc(x.name)}</b> ${isGP ? '<span class="tag gold">قدرت بزرگ</span>' : ''}
          ${lord ? `<span class="tag" title="در حوزه‌ی نفوذ">⛓️ ${esc(lord.name)}</span>` : ''}</div>
        <div class="dim small">امتیاز ${fd(Math.round(powerScore(S, x)))} · اعتبار ${fd(Math.round(x.prestige || 0))}
          ${subs.length ? ` · ${fd(subs.length)} کشور زیر نفوذ` : ''}
          ${x.id !== n.id ? ` · روابط ${fSign(n.rel[x.id] || 0)}` : ''}
          ${claim > 0 ? ` · <b class="gold">ادعا ${fd(Math.round(claim))}٪</b>` : ''}</div>
      </div>
      ${x.id === n.id ? '' : `<div class="dip-btns">
        ${n.greatPower && !x.greatPower && x.sphere !== n.id
          ? `<button class="mini-btn ${chk?.ok ? '' : 'dis-op'}" data-act="add-sphere" data-id="${x.id}" title="${chk?.ok ? 'کشیدن به حوزه‌ی نفوذ — ۲۶۰۰ سکه' : esc(chk?.why || '')}">🎭</button>` : ''}
        <button class="mini-btn" data-act="fabricate" data-id="${x.id}" title="جعل ادعای ارضی — ۱۸۰۰ سکه، روابط −۱۴">📜</button>
        <button class="mini-btn" data-act="start-crisis" data-id="${x.id}" title="آغاز بحران بین‌المللی بر سر یک استان مرزی">🔥</button>
      </div>`}
    </div>`;
  });
  html += `</div>`;

  // --- بحران‌های جاری ---
  const active = (S.crises || []).filter(c => c.active);
  html += `<div class="sec"><h4>🔥 بحران‌های بین‌المللی</h4>`;
  if (!active.length) html += `<div class="dim">جهان فعلاً آرام است.</div>`;
  for (const c of active) {
    const a = S.nations[c.a], dN = S.nations[c.d], p = S.map.provs[c.prov];
    const sA = c.backA.reduce((s, id) => s + powerScore(S, S.nations[id]), 0);
    const sD = c.backD.reduce((s, id) => s + powerScore(S, S.nations[id]), 0);
    const tot = Math.max(1, sA + sD);
    const involved = c.a === n.id || c.d === n.id || c.backA.includes(n.id) || c.backD.includes(n.id);
    html += `<div class="crisis-box ${involved ? 'mine' : ''}">
      <div><b>🔥 ${esc(a?.name)}</b> در برابر <b>${esc(dN?.name)}</b> بر سر <b>${esc(p?.name || '—')}</b></div>
      <div class="crisis-bar">
        <div class="cb-a" style="width:${(sA / tot) * 100}%"></div>
        <div class="cb-d" style="width:${(sD / tot) * 100}%"></div>
      </div>
      <div class="kv small">
        <div><span>پشتیبانان مدعی</span><b>${c.backA.map(id => esc(S.nations[id]?.name)).join('، ')}</b></div>
        <div><span>پشتیبانان مدافع</span><b>${c.backD.map(id => esc(S.nations[id]?.name)).join('، ')}</b></div>
        <div><span>مهلت</span><b>${fd(Math.max(0, c.deadline - S.week))} هفته</b></div>
        <div><span>تنش</span><b class="${c.tension > 70 ? 'neg' : ''}">${fd(Math.round(c.tension))}٪</b></div>
      </div>
      ${involved && (c.a !== n.id && c.d !== n.id) ? '' : involved ? `<div class="row-btns">
        <button class="mini-btn" data-act="crisis-back" data-id="${c.id}" title="۲۵۰۰ سکه — جذب یک قدرت بزرگ">🤝 جذب پشتیبان</button>
        <button class="mini-btn danger" data-act="crisis-fold" data-id="${c.id}" title="اعتبار −۶، اما جنگ نمی‌شود">🏳️ عقب‌نشینی</button>
      </div>` : `<div class="row-btns">
        <button class="mini-btn" data-act="crisis-join" data-id="${c.id}" data-s="a">پشتیبانی از ${esc(a?.name)}</button>
        <button class="mini-btn" data-act="crisis-join" data-id="${c.id}" data-s="d">پشتیبانی از ${esc(dN?.name)}</button>
      </div>`}
    </div>`;
  }
  html += `</div>`;

  // --- حوزه‌ی نفوذ من ---
  if (mySubs.length) {
    html += `<div class="sec"><h4>🎭 حوزه‌ی نفوذ شما</h4>`;
    for (const sN of mySubs) {
      html += `<div class="zone-row"><span><img class="flag" src="${R.flagURL(sN)}" alt=""> ${esc(sN.name)}</span>
        <span class="dim small">از ${fDate(sN.sphereSince || 0)}</span></div>`;
    }
    html += `</div>`;
  }

  return { title: 'قدرت‌های بزرگ', html };
}

// ---------- پنل شورای درباری، فساد و دسیسه ----------
export function panelCouncil(S, UI, R) {
  const n = S.nations[S.playerId];
  if (S.timelineId !== 'victoria' || !n.dyn) {
    return { title: '🏛️ شورای درباری', html: '<div class="empty">شورای درباری تنها در خط زمانی «ویکتوریا فانتزی» برپاست.</div>' };
  }
  const ruler = rulerOf(S, n.id);
  const heir = heirOf(S, n.id);
  const corr = n.corruption || 0;
  const corrCls = corr < 15 ? 'good' : corr < 35 ? 'mid' : 'bad';
  let h = '';

  // --- فساد ---
  h += `<div class="sec"><div class="sec-t">💰 فساد دیوان</div>
    <div class="row"><span>میزان فساد</span><b class="${corrCls}">${fd1(corr)}٪</b></div>
    ${bar(corr, 100, corrCls, 8)}
    <div class="hint">فساد از درآمد مالیاتی می‌کاهد، تولید را کند می‌کند و ناآرامی می‌سازد. شورای درست‌کار جلویش را می‌گیرد.</div>
    <div class="btn-row">
      <button class="btn sm" data-act="corr-audit">🔍 بازرسی (£۳هزار)</button>
      <button class="btn sm warn" data-act="corr-purge">⚔️ پاکسازی بزرگ</button>
    </div></div>`;

  // --- کرسی‌ها ---
  h += `<div class="sec"><div class="sec-t">🏛️ کرسی‌های شورا</div>`;
  for (const k of SEAT_KEYS) {
    const seat = SEATS[k];
    const c = n.council?.[k];
    const r = c ? royalById(S, c.rid) : null;
    if (r?.alive) {
      const sc = seatScore(r, k);
      const hon = c.honesty || 50;
      const honCls = hon > 65 ? 'good' : hon > 40 ? 'mid' : 'bad';
      h += `<div class="seat-card">
        <div class="seat-h"><span class="seat-i">${seat.icon}</span>
          <div class="seat-n"><b>${seat.name}</b><small>${esc(seat.desc)}</small></div>
        </div>
        <div class="row"><span>${esc(r.name)} <small class="dim">(${esc(r.house)})</small></span>${statDots(sc)}</div>
        <div class="row"><span>درست‌کاری</span><b class="${honCls}">${fd(hon)}٪</b></div>
        ${traitChips(r.traits)}
        <div class="btn-row"><button class="btn xs" data-act="seat-change" data-k="${k}">تعویض</button>
          <button class="btn xs warn" data-act="seat-dismiss" data-k="${k}">عزل</button></div>
      </div>`;
    } else {
      h += `<div class="seat-card empty-seat">
        <div class="seat-h"><span class="seat-i">${seat.icon}</span>
          <div class="seat-n"><b>${seat.name}</b><small class="bad">خالی — دیوان لنگ می‌زند</small></div></div>
        <div class="btn-row"><button class="btn xs" data-act="seat-change" data-k="${k}">گماردن</button></div>
      </div>`;
    }
  }
  h += `</div>`;

  // --- دسیسه ---
  h += `<div class="sec"><div class="sec-t">🕯️ دسیسه</div>`;
  if (n.plot?.known) {
    const head = royalById(S, n.plot.headId);
    const tgt = n.plot.target === 'heir' ? (heir?.name || 'وارث') : (ruler?.name || 'فرمانروا');
    h += `<div class="plot-box bad">
      <div><b>توطئه‌ای کشف شده است!</b></div>
      <div class="row"><span>سردسته</span><b>${esc(head?.name || '؟')}</b></div>
      <div class="row"><span>هدف</span><b>${esc(tgt)}</b></div>
      <div class="row"><span>پیشرفت نقشه</span><b>${fd(n.plot.prog)}٪</b></div>
      ${bar(n.plot.prog, 100, 'bad', 7)}
      <div class="btn-row">
        <button class="btn sm" data-act="plot-arrest">⛓️ دستگیری (کینه‌ی خاندان)</button>
        <button class="btn sm" data-act="plot-guard">🛡️ تشدید محافظت (£۲هزار)</button>
      </div></div>`;
  } else if (n.plot) {
    h += `<div class="hint">هیچ توطئه‌ی شناخته‌شده‌ای نیست… اما زمزمه‌هایی در راهروها هست.</div>`;
  } else {
    h += `<div class="hint good">دربار آرام است. هیچ توطئه‌ای در جریان نیست.</div>`;
  }
  h += `</div>`;

  // --- وارث و رقابت ---
  if (heir) {
    h += `<div class="sec"><div class="sec-t">👑 وارث و تربیت او</div>
      <div class="row"><span>${esc(heir.name)}</span><small class="dim">${heir.age} ساله</small></div>
      <div class="row"><span>دیوان</span>${statDots(heir.stat.admin)}</div>
      <div class="row"><span>رزم</span>${statDots(heir.stat.martial)}</div>
      <div class="row"><span>دیپلماسی</span>${statDots(heir.stat.diplo)}</div>
      <div class="row"><span>نیرنگ</span>${statDots(heir.stat.guile)}</div>`;
    if (heir.age <= 22) {
      h += `<div class="hint">استاد بگمارید تا وارث ورزیده‌تر شود (£۲۲۰۰ هر بار).</div>
      <div class="btn-row">
        <button class="btn xs" data-act="edu-heir" data-k="admin">📜 دیوان</button>
        <button class="btn xs" data-act="edu-heir" data-k="martial">🗡️ رزم</button>
        <button class="btn xs" data-act="edu-heir" data-k="diplo">🤝 دیپلماسی</button>
        <button class="btn xs" data-act="edu-heir" data-k="guile">🎭 نیرنگ</button>
      </div>`;
    } else {
      h += `<div class="hint dim">${esc(heir.name)} از سن آموزش گذشته است.</div>`;
    }
    if (n.heirRisk) h += `<div class="warn-box">⚠️ برادرِ رقیب هواداران بیشتری از وارث دارد. خطر جنگ جانشینی جدی است.</div>`;
    h += `</div>`;
  }

  // --- شاهزادگان ---
  if (ruler) {
    const kids = childrenOf(S, ruler).filter(c => c.age >= 14);
    if (kids.length) {
      h += `<div class="sec"><div class="sec-t">🎭 شاهزادگان و پشتیبانی</div>`;
      for (const c of kids.sort((a, b) => (b.support || 0) - (a.support || 0))) {
        const sup = c.support || 0;
        const isHeir = heir && c.id === heir.id;
        h += `<div class="row"><span>${isHeir ? '👑 ' : ''}${esc(c.name)} <small class="dim">${c.age}</small>${c.slighted ? ' <small class="bad">دل‌آزرده</small>' : ''}</span><b>${fd(sup)}٪</b></div>
          ${bar(sup, 100, isHeir ? 'good' : sup > 55 ? 'mid' : '', 5)}`;
      }
      h += `</div>`;
    }
  }
  return { title: '🏛️ شورای درباری', html: h };
}
