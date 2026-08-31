// ---------- نیروی دریایی: ناوگان، محاصره، حمل‌ونقل و نبرد دریایی ----------
// دریا به مناطق (sea zones) تقسیم می‌شود. هر ناوگان در یک منطقه‌ی دریایی است،
// می‌تواند بندرها را محاصره کند، سرباز حمل کند و با ناوگان دشمن بجنگد.

import { clamp, lerp, pick } from './utils.js';
import { charById, commanderPower, traitMods, addXP } from './characters.js';
import { projectMods } from './projects.js';

// ---------------- کلاس کشتی‌ها ----------------
export const SHIP_CLASSES = {
  frigate:   { name: 'ناو جنگی بادبانی', icon: '⛵', cost: 700,  weeks: 18, upkeep: 2.2, atk: 3,  hp: 10, spd: 1.25, cap: 1, era: 0,
               cons: { wood: 1.2 }, desc: 'ارزان و چابک؛ ستون ناوگان عصر بادبان.' },
  ironclad:  { name: 'زره‌پوش',          icon: '🛳️', cost: 1500, weeks: 30, upkeep: 4.5, atk: 8,  hp: 26, spd: 1.0,  cap: 1, era: 1,
               cons: { coal: 0.8, steel: 0.4 }, tech: 'steel', desc: 'بدنه‌ی آهنین و موتور بخار؛ ناوگان بادبانی را از رده خارج می‌کند.' },
  cruiser:   { name: 'رزم‌ناو',          icon: '🚢', cost: 2400, weeks: 42, upkeep: 7,   atk: 15, hp: 42, spd: 1.15, cap: 2, era: 2,
               cons: { coal: 1.2, steel: 1.0 }, tech: 'steelnavy', desc: 'سریع و پرتوان؛ خطوط تجاری را می‌بلعد.' },
  dread:     { name: 'ناو هواپیمابر/درنات', icon: '⚓', cost: 4200, weeks: 60, upkeep: 12, atk: 30, hp: 80, spd: 0.85, cap: 3, era: 3,
               cons: { coal: 2, steel: 2.2 }, tech: 'electric', desc: 'غول شناور؛ حضورش تعادل قدرت را جابه‌جا می‌کند.' },
  submarine: { name: 'زیردریایی',        icon: '🐋', cost: 1800, weeks: 34, upkeep: 5,   atk: 12, hp: 8,  spd: 1.4,  cap: 0, era: 2,
               cons: { steel: 0.8, coal: 0.4 }, tech: 'chemical', stealth: 1, desc: 'در سایه می‌جنگد؛ برای محاصره‌ی تجاری بی‌رقیب است.' },
  transport: { name: 'ناو ترابری',       icon: '🛥️', cost: 500,  weeks: 14, upkeep: 1.5, atk: 1,  hp: 8,  spd: 1.1,  cap: 4, era: 0,
               cons: { wood: 0.8 }, desc: 'سرباز و توپ را از دریا می‌گذراند.' },
};
export const SHIP_KEYS = Object.keys(SHIP_CLASSES);

export function shipUnlocked(S, n, key) {
  const c = SHIP_CLASSES[key];
  if (c.tech && !n.tech.includes(c.tech)) return false;
  if ((c.era || 0) > (S.era || 0) + 1) return false;
  return true;
}

// ---------------- مناطق دریایی ----------------
// دریا را به شبکه‌ی درشتِ ۴×۳ (فانتزی) یا ۶×۳ (نقشه‌ی واقعی) تقسیم می‌کنیم و
// هر منطقه را به بندرهای مجاورش وصل می‌کنیم.
export function buildSeaZones(S) {
  const map = S.map;
  const { gw, gh, cell, cells } = map.grid;
  const cols = map.real ? 6 : 4, rows = 3;
  const zones = [];
  const NAMES_R = [
    'اقیانوس اطلس شمالی', 'دریای شمال و بالتیک', 'اقیانوس هند غربی', 'اقیانوس آرام غربی', 'دریای چین', 'اقیانوس آرام شرقی',
    'اطلس مرکزی', 'مدیترانه و خاورمیانه', 'اقیانوس هند', 'دریای جنوب شرق آسیا', 'آرام مرکزی', 'کارائیب',
    'اطلس جنوبی', 'سواحل آفریقای جنوبی', 'اقیانوس هند جنوبی', 'دریای مرجان', 'آرام جنوبی', 'دماغه‌ی هورن',
  ];
  const NAMES_F = [
    'دریای سیمین شمال', 'خلیج مه‌آلود', 'اقیانوس بی‌کران خاور', 'دریای یخ‌بسته',
    'دریای میانه', 'خلیج بازرگانان', 'تنگه‌ی اژدها', 'دریای مروارید',
    'دریای جنوب', 'خلیج طوفان', 'اقیانوس تاریک', 'آب‌های دورافتاده',
  ];
  const names = map.real ? NAMES_R : NAMES_F;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const idx = r * cols + c;
    zones.push({
      id: idx,
      name: names[idx] || `منطقه‌ی دریایی ${idx + 1}`,
      x0: (c / cols) * map.w, x1: ((c + 1) / cols) * map.w,
      y0: (r / rows) * map.h, y1: ((r + 1) / rows) * map.h,
      cx: ((c + 0.5) / cols) * map.w, cy: ((r + 0.5) / rows) * map.h,
      ports: [], seaCells: 0, adj: [],
    });
  }
  // سلول‌های دریایی هر منطقه (برای پیدا کردن مرکز واقعی آب)
  const accX = new Float64Array(zones.length), accY = new Float64Array(zones.length);
  for (let y = 0; y < gh; y += 2) for (let x = 0; x < gw; x += 2) {
    if (cells[y * gw + x] >= 0) continue;
    const wx = (x + 0.5) * cell, wy = (y + 0.5) * cell;
    const zc = Math.min(cols - 1, Math.floor(wx / map.w * cols));
    const zr = Math.min(rows - 1, Math.floor(wy / map.h * rows));
    const z = zones[zr * cols + zc];
    z.seaCells++; accX[z.id] += wx; accY[z.id] += wy;
  }
  for (const z of zones) {
    if (z.seaCells > 0) { z.cx = accX[z.id] / z.seaCells; z.cy = accY[z.id] / z.seaCells; }
  }
  // بندرها: هر استان ساحلی به نزدیک‌ترین منطقه‌ی دریایی
  for (const p of map.provs) {
    if (!p.coast) continue;
    let best = zones[0], bd = 1e18;
    for (const z of zones) {
      if (z.seaCells < 4) continue;
      const d = Math.hypot(p.cx - z.cx, p.cy - z.cy);
      if (d < bd) { bd = d; best = z; }
    }
    p.seaZone = best.id;
    best.ports.push(p.id);
  }
  // همسایگی مناطق (شبکه‌ای)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const z = zones[r * cols + c];
    if (c > 0) z.adj.push(r * cols + c - 1);
    if (c < cols - 1) z.adj.push(r * cols + c + 1);
    if (r > 0) z.adj.push((r - 1) * cols + c);
    if (r < rows - 1) z.adj.push((r + 1) * cols + c);
    // چرخش کره‌ای برای نقشه‌ی واقعی (شرق ↔ غرب)
    if (map.real) { if (c === 0) z.adj.push(r * cols + cols - 1); if (c === cols - 1) z.adj.push(r * cols); }
  }
  S.seaZones = zones.filter(z => z.seaCells > 4);
  // بازنویسی id به شاخص فشرده
  const remap = new Map();
  S.seaZones.forEach((z, i) => { remap.set(z.id, i); });
  for (const z of S.seaZones) { z.adj = z.adj.map(a => remap.get(a)).filter(a => a !== undefined); }
  for (const p of map.provs) if (p.seaZone !== undefined) p.seaZone = remap.get(p.seaZone) ?? null;
  S.seaZones.forEach((z, i) => { z.id = i; });
  return S.seaZones;
}

export function zoneOf(S, id) { return (S.seaZones || [])[id] || null; }
export function fleetsOf(S, nid) { return (S.fleets || []).filter(f => f.n === nid && totalShips(f) > 0); }
export function totalShips(f) { let s = 0; for (const k in f.ships) s += f.ships[k]; return s; }

export function fleetPower(S, f) {
  const n = S.nations[f.n];
  let atk = 0, hp = 0;
  for (const k in f.ships) {
    const c = SHIP_CLASSES[k];
    atk += c.atk * f.ships[k];
    hp += c.hp * f.ships[k];
  }
  const adm = charById(S, f.admId);
  const tm = traitMods(adm);
  const cp = commanderPower(adm);
  // پروژه‌ی «ناوگان اقیانوس‌پیما» توان ناوگان را بالا می‌برد
  const projB = 1 + (projectMods(S, n).navalPower || 0);
  const techB = (1 + (n?.tech.includes('steelnavy') ? 0.18 : 0) + (n?.tech.includes('electric') ? 0.1 : 0)) * projB;
  return { atk: atk * cp * (1 + (tm.sea || 0)) * techB, hp, raw: atk };
}
export function fleetSpeed(S, f) {
  let s = 99;
  for (const k in f.ships) if (f.ships[k] > 0) s = Math.min(s, SHIP_CLASSES[k].spd);
  const adm = charById(S, f.admId);
  const tm = traitMods(adm);
  return (s === 99 ? 1 : s) * (1 + (tm.speed || 0) * 0.6);
}
export function fleetCapacity(f) {
  let c = 0;
  for (const k in f.ships) c += SHIP_CLASSES[k].cap * f.ships[k];
  return c;
}
export function fleetUpkeep(S, f) {
  let u = 0;
  for (const k in f.ships) u += SHIP_CLASSES[k].upkeep * f.ships[k];
  const adm = charById(S, f.admId);
  return u * (1 + (traitMods(adm).upkeep || 0));
}
export function navyUpkeep(S, nid) {
  return fleetsOf(S, nid).reduce((a, f) => a + fleetUpkeep(S, f), 0);
}
export function navalStrength(S, nid) {
  return fleetsOf(S, nid).reduce((a, f) => a + fleetPower(S, f).raw, 0);
}

// ---------------- ساخت کشتی ----------------
export function dockyardCap(S, p) {
  return (p.bld.port || 0) >= 1 ? (p.bld.port || 0) : 0;
}
export function startShip(S, prov, key) {
  const n = S.nations[prov.owner];
  const c = SHIP_CLASSES[key];
  if (!c) return { ok: false, why: 'کلاس نامعتبر' };
  if (!prov.coast || !(prov.bld.port > 0)) return { ok: false, why: 'نیازمند بندر در این استان' };
  if (!shipUnlocked(S, n, key)) return { ok: false, why: 'فناوری لازم را ندارید' };
  prov.navyQueue = prov.navyQueue || [];
  if (prov.navyQueue.length >= 3) return { ok: false, why: 'صف کارگاه دریایی پر است' };
  const cost = Math.round(c.cost * (1 - Math.min(0.25, (prov.bld.port - 1) * 0.06)));
  if (n.treasury < cost) return { ok: false, why: `خزانه کافی نیست (£${cost})` };
  n.treasury -= cost;
  prov.navyQueue.push({ key, prog: 0, weeks: c.weeks });
  return { ok: true, cost };
}
export function cancelShip(S, prov, idx) {
  const q = prov.navyQueue?.[idx];
  if (!q) return;
  const n = S.nations[prov.owner];
  n.treasury += Math.round(SHIP_CLASSES[q.key].cost * 0.5 * (1 - q.prog / q.weeks));
  prov.navyQueue.splice(idx, 1);
}

// کشتی تازه‌ساخته را به ناوگان مستقر در آن بندر می‌افزاید (یا ناوگان می‌سازد)
function deliverShip(S, prov, key) {
  const nid = prov.owner;
  const zone = prov.seaZone;
  if (zone === null || zone === undefined) return;
  let f = (S.fleets || []).find(x => x.n === nid && x.zone === zone && x.status !== 'sunk');
  if (!f) {
    f = newFleet(S, nid, zone, prov.id);
  }
  f.ships[key] = (f.ships[key] || 0) + 1;
  f.hp = fleetPower(S, f).hp;
}

export function newFleet(S, nid, zone, homePort) {
  const f = {
    id: S.nextFleetId++,
    n: nid, zone, home: homePort,
    ships: {}, hp: 0, org: 100,
    status: 'idle',           // idle | move | battle | blockade
    path: [], prog: 0,
    admId: null,
    cargo: 0,                 // گردان‌های سوارشده
    blockade: null,           // شناسه‌ی استانی که محاصره می‌کند
    name: null,
  };
  S.fleets.push(f);
  return f;
}

export function mergeFleets(S, a, b) {
  if (a.n !== b.n || a.zone !== b.zone) return false;
  for (const k in b.ships) a.ships[k] = (a.ships[k] || 0) + b.ships[k];
  a.cargo += b.cargo;
  a.hp = fleetPower(S, a).hp;
  b.ships = {}; b.cargo = 0;
  return true;
}

export function orderFleet(S, f, targetZone) {
  if (f.status === 'battle') return false;
  const path = seaPath(S, f.zone, targetZone);
  if (!path || path.length < 2) return false;
  f.path = path; f.status = 'move'; f.prog = 0; f.blockade = null;
  return true;
}
function seaPath(S, from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, -1]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const nb of zoneOf(S, cur)?.adj || []) {
      if (prev.has(nb)) continue;
      prev.set(nb, cur); q.push(nb);
    }
  }
  if (!prev.has(to)) return null;
  const path = [];
  let c = to;
  while (c !== -1) { path.unshift(c); c = prev.get(c); }
  return path;
}

// ---------------- محاصره‌ی دریایی ----------------
export function setBlockade(S, f, provId) {
  const p = S.map.provs[provId];
  if (!p || !p.coast) return { ok: false, why: 'استان ساحلی نیست' };
  if (p.seaZone !== f.zone) return { ok: false, why: 'ناوگان در منطقه‌ی دریایی این بندر نیست' };
  if (!atWarNav(S, f.n, p.owner)) return { ok: false, why: 'با صاحب این بندر در جنگ نیستید' };
  f.blockade = provId;
  f.status = 'blockade';
  return { ok: true };
}
function atWarNav(S, a, b) {
  if (a === b) return false;
  return (S.wars || []).some(w => (w.a === a && w.d === b) || (w.a === b && w.d === a) ||
    (w.aSide?.includes(a) && w.dSide?.includes(b)) || (w.aSide?.includes(b) && w.dSide?.includes(a)));
}

// شدت محاصره‌ی یک ملت (۰..۱) — روی تجارت و بندرها اثر می‌گذارد
export function blockadeLevel(S, nid) {
  let blocked = 0, total = 0;
  for (const p of S.map.provs) {
    if (p.owner !== nid || !(p.bld.port > 0)) continue;
    total += p.bld.port;
    if (p.blockaded) blocked += p.bld.port;
  }
  return total > 0 ? clamp(blocked / total, 0, 1) : 0;
}

// ---------------- حمل‌ونقل دریایی ----------------
export function loadArmy(S, f, army) {
  if (f.zone !== S.map.provs[army.prov].seaZone) return { ok: false, why: 'ارتش در بندر این منطقه نیست' };
  if (!S.map.provs[army.prov].coast) return { ok: false, why: 'ارتش باید در استان ساحلی باشد' };
  if (army.status === 'battle') return { ok: false, why: 'ارتش درگیر نبرد است' };
  const cap = fleetCapacity(f) - f.cargo;
  if (cap < army.size) return { ok: false, why: `ظرفیت ترابری کافی نیست (${Math.floor(cap)}/${Math.ceil(army.size)})` };
  f.cargo += army.size;
  f.cargoArmies = f.cargoArmies || [];
  f.cargoArmies.push({ size: army.size, org: army.org, mor: army.mor, genId: army.genId || null });
  army.size = 0; // ارتش سوار شد
  return { ok: true };
}
export function unloadArmy(S, f, provId) {
  const p = S.map.provs[provId];
  if (!p || !p.coast) return { ok: false, why: 'باید در استان ساحلی پیاده شود' };
  if (p.seaZone !== f.zone) return { ok: false, why: 'بندر در منطقه‌ی ناوگان نیست' };
  if (!f.cargoArmies?.length) return { ok: false, why: 'سربازی روی عرشه نیست' };
  for (const c of f.cargoArmies) {
    S.armies.push({
      id: S.nextArmyId++, n: f.n, home: provId, prov: provId,
      size: c.size, org: Math.max(30, c.org - 20), mor: Math.max(30, c.mor - 10),
      path: [], status: 'idle', prog: 0, dig: 0, genId: c.genId,
    });
  }
  f.cargoArmies = []; f.cargo = 0;
  return { ok: true };
}

// ---------------- شبیه‌سازی هفتگی ----------------
export function simNaval(S) {
  if (!S.fleets) return;

  // ۱) ساخت کشتی در بندرها
  for (const p of S.map.provs) {
    if (!p.navyQueue?.length) continue;
    if (p.controller !== p.owner) continue;
    const slots = Math.max(1, Math.floor((p.bld.port || 1) / 2));
    for (let i = 0; i < Math.min(slots, p.navyQueue.length); i++) {
      const q = p.navyQueue[i];
      q.prog++;
      if (q.prog >= q.weeks) {
        deliverShip(S, p, q.key);
        const n = S.nations[p.owner];
        if (!n) { p.navyQueue.splice(i, 1); i--; continue; }
        S.log.push({ w: S.week, icon: SHIP_CLASSES[q.key].icon, text: `${n.name}: «${SHIP_CLASSES[q.key].name}» در ${p.name} به آب انداخته شد.` });
        if (n.player) { S.pendingAlerts = S.pendingAlerts || []; S.pendingAlerts.push({ icon: '⚓', text: `${SHIP_CLASSES[q.key].name} آماده‌ی خدمت است`, w: S.week }); }
        p.navyQueue.splice(i, 1); i--;
      }
    }
  }

  // ۲) حرکت ناوگان‌ها
  for (const f of S.fleets) {
    if (totalShips(f) <= 0) continue;
    if (f.status === 'battle') continue;
    if (f.status === 'move' && f.path.length > 1) {
      f.prog += fleetSpeed(S, f) * 0.5;
      if (f.prog >= 1) {
        f.prog = 0; f.zone = f.path[1]; f.path.shift();
        if (f.path.length < 2) { f.status = 'idle'; f.path = []; }
      }
    }
    // بازسازی انسجام در آب‌های خودی
    const z = zoneOf(S, f.zone);
    const friendly = z && z.ports.some(pid => S.map.provs[pid].owner === f.n);
    f.org = clamp(f.org + (friendly ? 4 : 1.2), 0, 100);
  }

  // ۳) نبردهای دریایی: در هر منطقه، ناوگان‌های متخاصم برخورد می‌کنند
  const byZone = new Map();
  for (const f of S.fleets) {
    if (totalShips(f) <= 0 || f.status === 'move') continue;
    if (!byZone.has(f.zone)) byZone.set(f.zone, []);
    byZone.get(f.zone).push(f);
  }
  for (const [zid, list] of byZone) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (totalShips(A) <= 0 || totalShips(B) <= 0) continue;
      if (!atWarNav(S, A.n, B.n)) continue;
      navalBattle(S, A, B, zid);
    }
  }

  // ۴) محاصره‌ها
  for (const p of S.map.provs) p.blockaded = false;
  for (const f of S.fleets) {
    if (totalShips(f) <= 0 || f.status !== 'blockade' || f.blockade === null) continue;
    const p = S.map.provs[f.blockade];
    if (!p || p.seaZone !== f.zone || !atWarNav(S, f.n, p.owner)) { f.blockade = null; f.status = 'idle'; continue; }
    const adm = charById(S, f.admId);
    const tm = traitMods(adm);
    const pw = fleetPower(S, f).raw * (1 + (tm.blockade || 0));
    // دفاع بندر: پادگان + ناوگان مدافع در همین منطقه
    const defNaval = (S.fleets.filter(x => x.n === p.owner && x.zone === f.zone).reduce((a, x) => a + fleetPower(S, x).raw, 0));
    if (pw > defNaval * 1.1 + (p.bld.port || 0) * 2) {
      p.blockaded = true;
      p.unrest = clamp(p.unrest + 0.5, 0, 100);
    }
  }

  // ۵) پاک‌سازی
  S.fleets = S.fleets.filter(f => totalShips(f) > 0 || (f.cargoArmies?.length));
}

function navalBattle(S, A, B, zid) {
  const pa = fleetPower(S, A), pb = fleetPower(S, B);
  const admA = charById(S, A.admId), admB = charById(S, B.admId);
  const rndA = 0.78 + Math.random() * 0.44, rndB = 0.78 + Math.random() * 0.44;
  const sA = pa.atk * (A.org / 100) * rndA;
  const sB = pb.atk * (B.org / 100) * rndB;
  // تلفات: کشتی‌های ضعیف‌تر زودتر غرق می‌شوند
  sinkShips(S, A, sB * 0.055);
  sinkShips(S, B, sA * 0.055);
  A.org = Math.max(0, A.org - (8 + sB / Math.max(sA, 1) * 10));
  B.org = Math.max(0, B.org - (8 + sA / Math.max(sB, 1) * 10));
  const zone = zoneOf(S, zid);
  S.fx.push({ type: 'navy', x: zone.cx + (Math.random() - 0.5) * 60, y: zone.cy + (Math.random() - 0.5) * 40, t: 1, life: 1 });

  const aOut = A.org < 12 || totalShips(A) <= 0;
  const bOut = B.org < 12 || totalShips(B) <= 0;
  if (aOut || bOut) {
    const winner = aOut && bOut ? (totalShips(A) >= totalShips(B) ? A : B) : (aOut ? B : A);
    const loser = winner === A ? B : A;
    const wAdm = winner === A ? admA : admB;
    if (wAdm) { addXP(S, wAdm, 55); wAdm.battles++; wAdm.wins++; }
    const lAdm = winner === A ? admB : admA;
    if (lAdm) { addXP(S, lAdm, 18); lAdm.battles++; }
    // بازنده عقب می‌نشیند
    if (totalShips(loser) > 0) {
      const retreat = (zoneOf(S, loser.zone)?.adj || []).find(z =>
        zoneOf(S, z)?.ports.some(pid => S.map.provs[pid].owner === loser.n));
      if (retreat !== undefined) { loser.zone = retreat; loser.status = 'idle'; loser.path = []; loser.blockade = null; }
    }
    const wn = S.nations[winner.n], ln = S.nations[loser.n];
    S.log.push({ w: S.week, icon: '⚓', text: `نبرد دریایی در ${zone.name}: ناوگان ${wn.name} بر ${ln.name} چیره شد.` });
    if (winner.n === S.playerId || loser.n === S.playerId) {
      S.pendingAlerts = S.pendingAlerts || [];
      S.pendingAlerts.push({ icon: '⚓', text: `نبرد دریایی ${zone.name} — ${winner.n === S.playerId ? 'پیروز شدید!' : 'ناوگانتان شکست خورد'}`, w: S.week });
    }
    // امتیاز جنگ دریایی
    const war = (S.wars || []).find(w => (w.a === A.n && w.d === B.n) || (w.a === B.n && w.d === A.n));
    if (war) {
      const atkWon = winner.n === war.a;
      war.score = clamp(war.score + (atkWon ? 5 : -5), -100, 100);
    }
  }
}

function sinkShips(S, f, damage) {
  // ابتدا کشتی‌های سبک، سپس سنگین‌ها
  const order = ['transport', 'frigate', 'submarine', 'ironclad', 'cruiser', 'dread'];
  let dmg = damage;
  for (const k of order) {
    while (dmg > 0 && (f.ships[k] || 0) > 0) {
      const hp = SHIP_CLASSES[k].hp;
      if (dmg >= hp * 0.42) { f.ships[k]--; dmg -= hp * 0.42; }
      else break;
    }
    if (f.ships[k] === 0) delete f.ships[k];
  }
  if (f.cargoArmies?.length && Math.random() < damage * 0.03) {
    // بخشی از سربازان با ناوها غرق می‌شوند
    for (const c of f.cargoArmies) c.size *= 0.82;
    f.cargo = f.cargoArmies.reduce((a, c) => a + c.size, 0);
  }
  f.hp = fleetPower(S, f).hp;
}

// راه‌اندازی ناوگان آغازین
export function initNavy(S) {
  S.fleets = [];
  S.nextFleetId = 1;
  buildSeaZones(S);
  for (const n of S.nations) {
    if (!n.alive) continue;
    const myPorts = S.map.provs.filter(p => p.owner === n.id && p.coast && (p.bld.port || 0) > 0);
    if (!myPorts.length) continue;
    const home = myPorts[0];
    if (home.seaZone === null || home.seaZone === undefined) continue;
    const f = newFleet(S, n.id, home.seaZone, home.id);
    const era = S.era || 0;
    const scale = n.pers === 'trader' ? 1.5 : n.pers === 'aggressive' ? 1.2 : 1;
    if (era >= 3) { f.ships.cruiser = Math.round(2 * scale); f.ships.dread = 1; f.ships.transport = 2; }
    else if (era >= 2) { f.ships.ironclad = Math.round(2 * scale); f.ships.cruiser = 1; f.ships.transport = 2; }
    else if (era >= 1) { f.ships.ironclad = Math.round(1 * scale); f.ships.frigate = Math.round(3 * scale); f.ships.transport = 1; }
    else { f.ships.frigate = Math.round(3 * scale); f.ships.transport = 1; }
    f.hp = fleetPower(S, f).hp;
    // یک دریاسالار به ناوگان اصلی
    const adm = (S.chars || []).find(c => c.alive && c.owner === n.id && c.kind === 'admiral' && c.assigned === null);
    if (adm) { f.admId = adm.id; adm.assigned = f.id; }
  }
}
