// ---------- تجارت: مسیرهای بازرگانی، تعرفه، شرکت‌ها و استعمار ----------
// کالا فقط در یک بازار جهانی جادویی مبادله نمی‌شود؛ مسیرهای واقعی میان
// بندرها و پایتخت‌ها برقرار می‌شود که محاصره‌ی دریایی و جنگ آنها را می‌بُرد.

import { clamp, lerp, pick } from './utils.js';
import { GOODS } from './data.js';
import { cabinetMods } from './characters.js';
import { blockadeLevel, navalStrength } from './naval.js';
import { projectMods } from './projects.js';

// ---------------- شرکت‌های بازرگانی ----------------
// شرکت‌ها را با پول می‌سازید؛ هر یک روی کالایی تمرکز دارد و سود می‌دهد.
export const COMPANIES = {
  grain_co:   { name: 'کمپانی غلات شرق', icon: '🌾', good: 'grain',   cost: 2200, desc: '+۲۵٪ تولید مزارع، سود صادرات غلات' , mods: { prodMult: 0.25 } },
  textile_co: { name: 'اتحاد نساجان',    icon: '🧵', good: 'clothes', cost: 2600, desc: '+۲۵٪ نساجی و صادرات پوشاک', mods: { prodMult: 0.25 } },
  mining_co:  { name: 'کنسرسیوم معادن',  icon: '⛏️', good: 'coal',    cost: 3000, desc: '+۳۰٪ معادن زغال و آهن', mods: { prodMult: 0.30 } },
  steel_co:   { name: 'ذوب‌آهن بزرگ',    icon: '🔩', good: 'steel',   cost: 3600, desc: '+۳۰٪ فولاد و ابزار', mods: { prodMult: 0.30 }, tech: 'steel' },
  arms_co:    { name: 'کارتل اسلحه',     icon: '🔫', good: 'arms',    cost: 3400, desc: '+۳۰٪ سلاح‌سازی، ارتش ارزان‌تر', mods: { prodMult: 0.30, upkeep: -0.12 } },
  east_india: { name: 'کمپانی هند شرقی', icon: '🚢', good: 'luxury',  cost: 4200, desc: '+۴۰٪ لوکس، +۲ سرعت استعمار، درآمد بندر', mods: { prodMult: 0.40, colony: 2, portInc: 0.25 } },
  bank_co:    { name: 'بانک امپراتوری',  icon: '🏦', good: null,      cost: 4000, desc: '+۱۲٪ مالیات و بهره‌ی سرمایه', mods: { tax: 0.12 }, tech: 'banking' },
  rail_co:    { name: 'شرکت راه‌آهن',    icon: '🚂', good: null,      cost: 3800, desc: 'ساخت‌وساز ۲۵٪ سریع‌تر، حمل‌ونقل بهتر', mods: { build: 0.25, infra: 1 }, tech: 'railway' },
};
export const COMPANY_KEYS = Object.keys(COMPANIES);

export function canFound(S, n, key) {
  const c = COMPANIES[key];
  if (!c) return { ok: false, why: 'نامعتبر' };
  if ((n.companies || []).includes(key)) return { ok: false, why: 'این شرکت را دارید' };
  if ((n.companies || []).length >= 4) return { ok: false, why: 'بیش از ۴ شرکت ممکن نیست' };
  if (c.tech && !n.tech.includes(c.tech)) return { ok: false, why: 'فناوری لازم را ندارید' };
  if (n.treasury < c.cost) return { ok: false, why: `خزانه کافی نیست (£${c.cost})` };
  return { ok: true };
}
export function foundCompany(S, n, key) {
  const chk = canFound(S, n, key);
  if (!chk.ok) return chk;
  n.treasury -= COMPANIES[key].cost;
  n.companies = n.companies || [];
  n.companies.push(key);
  S.log.push({ w: S.week, icon: COMPANIES[key].icon, text: `${n.name}: «${COMPANIES[key].name}» تأسیس شد.` });
  return { ok: true };
}
export function companyMods(S, n) {
  const out = { prodMult: {}, tax: 0, upkeep: 0, build: 0, colony: 0, portInc: 0, infra: 0 };
  for (const k of n.companies || []) {
    const c = COMPANIES[k];
    if (!c) continue;
    if (c.good && c.mods.prodMult) out.prodMult[c.good] = (out.prodMult[c.good] || 0) + c.mods.prodMult;
    for (const m of ['tax', 'upkeep', 'build', 'colony', 'portInc', 'infra']) if (c.mods[m]) out[m] += c.mods[m];
  }
  return out;
}

// ---------------- تعرفه ----------------
export const TARIFF_LEVELS = [
  { name: 'تجارت آزاد',   icon: '🕊️', rate: 0.00, relBonus: 0.05, tradeMult: 1.30, appr: { industrialists: 6, landowners: -3 } },
  { name: 'تعرفه‌ی سبک',  icon: '🍃', rate: 0.08, relBonus: 0.02, tradeMult: 1.12, appr: {} },
  { name: 'تعرفه‌ی متوسط', icon: '⚖️', rate: 0.16, relBonus: 0,    tradeMult: 1.00, appr: { landowners: 3, industrialists: -2 } },
  { name: 'حمایت‌گرایی',  icon: '🛡️', rate: 0.26, relBonus: -0.03, tradeMult: 0.82, appr: { industrialists: 6, intelligentsia: -4 } },
  { name: 'خودکفایی',     icon: '🏰', rate: 0.38, relBonus: -0.07, tradeMult: 0.58, appr: { military: 5, industrialists: -6, workers: -3 } },
];

export function setTariff(S, n, lvl) {
  n.tariff = clamp(lvl | 0, 0, TARIFF_LEVELS.length - 1);
}

// ---------------- مسیرهای بازرگانی ----------------
// یک مسیر = پیوند دو ملت با یک کالا؛ در هر هفته حجم مشخصی مبادله می‌شود.
export function tradeCapacity(S, n) {
  let ports = 0, rails = 0;
  for (const p of S.map.provs) {
    if (p.owner !== n.id || p.controller !== n.id) continue;
    if (!p.blockaded) ports += (p.bld.port || 0);
    rails += (p.bld.railway || 0);
  }
  const cm = cabinetMods(S, n), co = companyMods(S, n);
  const base = ports * 2 + rails * 0.6 + 2 + (co.infra || 0) + (cm.prestige || 0) * 0.05;
  // بونوس تجاری آرمان ملی و پروژه‌های ملی (راه‌آهن، ناوگان، بانک بزرگ)
  const pm = projectMods(S, n);
  const cap = (n.ideas?.mods?.tradeCap || 0) + (pm.tradeCap || 0);
  return base * (1 + cap);
}

export function openRoute(S, n, partnerId, good) {
  const m = S.nations[partnerId];
  if (!m || !m.alive) return { ok: false, why: 'شریک نامعتبر' };
  n.routes = n.routes || [];
  if (n.routes.length >= Math.floor(tradeCapacity(S, n))) return { ok: false, why: 'ظرفیت بازرگانی پر است — بندر یا راه‌آهن بسازید' };
  if (n.routes.some(r => r.with === partnerId && r.good === good)) return { ok: false, why: 'این مسیر باز است' };
  if ((n.rel[partnerId] || 0) < -25) return { ok: false, why: 'روابط برای تجارت بسیار بد است' };
  const cost = 300;
  if (n.treasury < cost) return { ok: false, why: `هزینه‌ی گشایش £${cost}` };
  n.treasury -= cost;
  // جهت: اگر عرضه‌ی داخلی‌ات زیاد است، صادرات؛ وگرنه واردات
  const dir = (S.goods[good].fill ?? 1) > 1.0 ? 'export' : 'import';
  n.routes.push({ with: partnerId, good, dir, vol: 0, age: 0 });
  return { ok: true, dir };
}
export function closeRoute(S, n, idx) {
  if (!n.routes?.[idx]) return { ok: false };
  n.routes.splice(idx, 1);
  return { ok: true };
}

// ---------------- استعمار ----------------
// استان‌های «OTHER» یا بی‌صاحبِ کم‌جمعیت را می‌توان تدریجاً مستعمره کرد.
export function colonizable(S, n, p) {
  if (!p) return false;
  if (p.owner === n.id) return false;
  const owner = S.nations[p.owner];
  // فقط سرزمین‌های «سایر ملل» یا خالی
  if (owner && owner.playable !== false && owner.alive) return false;
  // باید مجاور خاک یا بندر شما باشد
  const near = p.adj.some(q => S.map.provs[q].owner === n.id);
  const bySea = p.coast && S.map.provs.some(q => q.owner === n.id && q.coast && q.seaZone === p.seaZone);
  return near || bySea;
}
export function startColony(S, n, provId) {
  const p = S.map.provs[provId];
  if (!colonizable(S, n, p)) return { ok: false, why: 'این سرزمین قابل استعمار نیست' };
  n.colonies = n.colonies || [];
  if (n.colonies.some(c => c.prov === provId)) return { ok: false, why: 'مأموریت استعماری در جریان است' };
  if (n.colonies.length >= 2 + (companyMods(S, n).colony || 0)) return { ok: false, why: 'بیش از این نمی‌توانید هم‌زمان استعمار کنید' };
  const cost = 1400;
  if (n.treasury < cost) return { ok: false, why: `هزینه £${cost}` };
  n.treasury -= cost;
  n.colonies.push({ prov: provId, prog: 0, started: S.week });
  return { ok: true, cost };
}
export function abandonColony(S, n, provId) {
  n.colonies = (n.colonies || []).filter(c => c.prov !== provId);
  return { ok: true };
}

// ---------------- شبیه‌سازی هفتگی ----------------
export function simTrade(S) {
  for (const n of S.nations) {
    if (!n.alive) continue;
    if (n.tariff === undefined) n.tariff = 2;
    n.routes = n.routes || [];
    n.colonies = n.colonies || [];
    const TL = TARIFF_LEVELS[n.tariff];
    const co = companyMods(S, n);
    const blk = blockadeLevel(S, n.id);
    const cap = tradeCapacity(S, n);

    // مسیرهایی که ظرفیت ندارند بسته می‌شوند
    while (n.routes.length > Math.floor(cap) + 1) n.routes.pop();

    let tariffInc = 0, tradeProfit = 0;
    for (let i = n.routes.length - 1; i >= 0; i--) {
      const r = n.routes[i];
      const m = S.nations[r.with];
      if (!m || !m.alive) { n.routes.splice(i, 1); continue; }
      // جنگ مسیر را می‌بندد
      const atWar = (S.wars || []).some(w => (w.a === n.id && w.d === r.with) || (w.a === r.with && w.d === n.id));
      if (atWar) { r.vol = 0; continue; }
      r.age++;
      // حجم: به بندرها، رابطه، تعرفه و محاصره بستگی دارد
      const relF = clamp(1 + (n.rel[r.with] || 0) / 160, 0.5, 1.5);
      const pactF = n.pacts?.[r.with] === 'trade' ? 1.45 : n.pacts?.[r.with] === 'ally' ? 1.25 : 1;
      const target = 2.4 * relF * pactF * TL.tradeMult * (1 - blk * 0.75) * (1 + Math.min(0.4, r.age / 260));
      r.vol = lerp(r.vol || 0, target, 0.18);
      const G = S.goods[r.good];
      if (r.dir === 'export') {
        G.d += r.vol;                                  // شریک از بازار می‌خرد
        tradeProfit += r.vol * G.price * 0.30;
      } else {
        G.s += r.vol * 0.85;                           // کالا وارد می‌شود
        tariffInc += r.vol * G.price * TL.rate * 0.30;
        tradeProfit -= r.vol * G.price * 0.06;         // هزینه‌ی حمل
      }
    }
    n._tradeIncome = tradeProfit + tariffInc;
    n._tariffIncome = tariffInc;
    n._blockade = blk;

    // ---- استعمار ----
    for (let i = n.colonies.length - 1; i >= 0; i--) {
      const c = n.colonies[i];
      const p = S.map.provs[c.prov];
      if (!p) { n.colonies.splice(i, 1); continue; }
      if (p.owner === n.id) { n.colonies.splice(i, 1); continue; }
      const speed = 1 + (co.colony || 0) * 0.35 + (navalStrength(S, n.id) > 20 ? 0.4 : 0)
        + (n.tech.includes('steelnavy') ? 0.3 : 0) + (n.tech.includes('medicine') ? 0.35 : 0);
      c.prog += speed;
      if (c.prog >= 100) {
        p.owner = n.id; p.controller = n.id;
        p.unrest = clamp(p.unrest + 22, 0, 100);
        p.assim = 0;
        n.colonies.splice(i, 1);
        n.prestige += 6;
        S.log.push({ w: S.week, icon: '🏴', text: `${n.name} سرزمین ${p.name} را به مستعمرات خود افزود.` });
        if (n.player) { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon: '🏴', text: `${p.name} مستعمره‌ی شما شد!`, w: S.week }); }
        // رقبا خوششان نمی‌آید
        for (const m of S.nations) if (m.id !== n.id && m.alive && m.playable !== false) {
          n.rel[m.id] = clamp((n.rel[m.id] || 0) - 3, -100, 100);
        }
      }
    }
  }
}

// AI: تجارت، شرکت و استعمار
export function aiTrade(S, n) {
  // تعرفه بر اساس شخصیت
  if (n.tariff === undefined) {
    n.tariff = n.pers === 'trader' ? 0 : n.pers === 'industrial' ? 3 : n.pers === 'aggressive' ? 4 : 2;
  }
  // شرکت
  if (Math.random() < 0.06 && (n.companies || []).length < 3 && n.treasury > 5000) {
    const opts = COMPANY_KEYS.filter(k => canFound(S, n, k).ok);
    if (opts.length) foundCompany(S, n, pick(Math.random, opts));
  }
  // مسیر بازرگانی
  if (Math.random() < 0.05 && (n.routes || []).length < Math.min(6, Math.floor(tradeCapacity(S, n)))) {
    const partners = S.nations.filter(m => m.alive && m.id !== n.id && (n.rel[m.id] || 0) > -10);
    if (partners.length) {
      const m = pick(Math.random, partners);
      const goods = Object.keys(GOODS);
      openRoute(S, n, m.id, pick(Math.random, goods));
    }
  }
  // استعمار
  if (Math.random() < 0.05 && n.treasury > 4000) {
    const cands = S.map.provs.filter(p => colonizable(S, n, p));
    if (cands.length) startColony(S, n, pick(Math.random, cands).id);
  }
}

export function initTrade(S) {
  for (const n of S.nations) {
    n.tariff = n.pers === 'trader' ? 1 : n.pers === 'aggressive' ? 3 : 2;
    n.routes = [];
    n.companies = [];
    n.colonies = [];
    n._tradeIncome = 0;
    n._tariffIncome = 0;
  }
}
