// ---------- تولید نقشه قطعی از روی seed ----------
import { mulberry32, makeNoise2D, fbm, pick } from './utils.js';
import { PROV_SYLL_A, PROV_SYLL_B, NATION_DEFS } from './data.js';

export const GW = 320, GH = 160;        // شبکه سلولی (بزرگ‌تر — نقشه‌ی عظیم‌تر)
export const CELL = 10;                  // پیکسل هر سلول (منطقی)
export const W = GW * CELL, H = GH * CELL;

export function genMap(seed) {
  const rng = mulberry32(seed);
  const noiseE = makeNoise2D(rng), noiseM = makeNoise2D(rng), noiseD = makeNoise2D(rng);
  const cells = new Int16Array(GW * GH).fill(-1); // id استان یا -1 دریا
  const elev = new Float32Array(GW * GH), moist = new Float32Array(GW * GH);

  // ارتفاع با فرکانس‌های ترکیبی + افت شعاعی (جزیره/قاره)
  const cx0 = GW / 2, cy0 = GH / 2;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const nx = x / GW, ny = y / GH;
    let e = fbm(noiseE, nx * 5.2, ny * 5.2, 5) * 0.78 + fbm(noiseD, nx * 13, ny * 13, 3) * 0.34;
    const dx = (x - cx0) / (GW * 0.52), dy = (y - cy0) / (GH * 0.5);
    const d = Math.sqrt(dx * dx + dy * dy);
    e += (0.62 - d * d) * 0.52; // قاره مرکزی
    const i = y * GW + x;
    elev[i] = e;
    moist[i] = fbm(noiseM, nx * 6.5 + 9, ny * 6.5 + 3, 4);
  }
  const SEA = 0.535, MOUNT = 0.775, HILL = 0.685;
  const isSea = i => elev[i] < SEA;
  const landCount = (() => { let n = 0; for (let i = 0; i < cells.length; i++) if (!isSea(i)) n++; return n; })();

  // ---- رشد استان‌ها از بذرها (flood trading) ----
  const nProv = Math.max(80, Math.min(112, Math.round(landCount / 185)));
  const seeds = [];
  let guard = 0;
  while (seeds.length < nProv && guard++ < 6000) {
    const x = 2 + Math.floor(rng() * (GW - 4)), y = 2 + Math.floor(rng() * (GH - 4));
    const i = y * GW + x;
    if (isSea(i) || cells[i] !== -1) continue;
    let ok = true;
    for (const s of seeds) { const ddx = s.x - x, ddy = s.y - y; if (ddx * ddx + ddy * ddy < 20) { ok = false; break; } }
    if (ok) seeds.push({ x, y, id: seeds.length });
  }
  // صف رشد تصادفی
  const queue = [];
  for (const s of seeds) { const i = s.y * GW + s.x; cells[i] = s.id; queue.push(i); }
  while (queue.length) {
    const qi = Math.floor(rng() * queue.length);
    const cur = queue[qi]; queue[qi] = queue[queue.length - 1]; queue.pop();
    const curId = cells[cur];
    const cx = cur % GW, cy = (cur / GW) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx2 = cx + dx, ny2 = cy + dy;
      if (nx2 < 1 || ny2 < 1 || nx2 >= GW - 1 || ny2 >= GH - 1) continue;
      const ni = ny2 * GW + nx2;
      if (isSea(ni) || cells[ni] !== -1) continue;
      cells[ni] = curId;
      queue.push(ni);
    }
  }

  // ---- ساختار استان‌ها ----
  const provs = [];
  for (let p = 0; p < seeds.length; p++) provs.push({ id: p, cells: [], adjSet: new Set(), cx: 0, cy: 0 });
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, p = cells[i];
    if (p < 0) continue;
    const pr = provs[p];
    pr.cells.push(i); pr.cx += x; pr.cy += y;
    // همسایگی
    if (x > 0 && cells[i - 1] !== p && cells[i - 1] >= 0) pr.adjSet.add(cells[i - 1]);
    if (y > 0 && cells[i - GW] !== p && cells[i - GW] >= 0) pr.adjSet.add(cells[i - GW]);
    if (x < GW - 1 && cells[i + 1] !== p && cells[i + 1] >= 0) pr.adjSet.add(cells[i + 1]);
    if (y < GH - 1 && cells[i + GW] !== p && cells[i + GW] >= 0) pr.adjSet.add(cells[i + GW]);
  }
  // حذف استان‌های خیلی کوچک (ادغام در همسایه)
  for (const p of provs) {
    if (p.cells.length < 14 && p.adjSet.size) {
      const target = [...p.adjSet][0];
      const tp = provs[target];
      for (const i of p.cells) cells[i] = target, tp.cells.push(i);
      p.cells.length = 0; p.dead = true;
    }
  }
  const alive = provs.filter(p => !p.dead && p.cells.length);
  alive.forEach((p, ix) => { p.id = ix; });
  // بازنویسی cells با id جدید
  const remap = new Map(provs.filter(p => !p.dead).map(p => [seeds[p.id]?.id ?? -1, p.id]));
  // به‌جای remap پیچیده: پس از ادغام idها را از cells بازخوانی می‌کنیم
  const finalIds = new Set(); for (const p of alive) for (const i of p.cells) finalIds.add(cells[i]);
  const idMap = new Map(); let nid = 0;
  for (const oldId of finalIds) idMap.set(oldId, nid++);
  const provList = [];
  for (const i2 of idMap.values()) provList.push({ id: i2, cells: [], adj: [], cx: 0, cy: 0, coast: false, elev: 0, moist: 0 });
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) continue;
    const p = provList[idMap.get(cells[i])];
    const x = i % GW, y = (i / GW) | 0;
    p.cells.push(i); p.cx += x; p.cy += y; p.elev += elev[i]; p.moist += moist[i];
  }
  for (const p of provList) {
    const n = p.cells.length;
    p.cx = (p.cx / n + 0.5) * CELL; p.cy = (p.cy / n + 0.5) * CELL;
    p.elev /= n; p.moist /= n;
  }
  // همسایگی نهایی + ساحل
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x; const a = cells[i];
    if (a < 0) continue;
    const pa = provList[idMap.get(a)];
    const dirs = [[1, 0], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx2 = x + dx, ny2 = y + dy;
      if (nx2 >= GW || ny2 >= GH) continue;
      const j = ny2 * GW + nx2; const b = cells[j];
      if (b < 0) { pa.coast = true; continue; }
      if (b !== a) { const pb = idMap.get(b); if (!pa.adj.includes(pb)) pa.adj.push(pb), provList[pb].adj.includes(pa.id) || provList[pb].adj.push(pa.id); }
    }
    if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) pa.coast = pa.coast || false;
    if (x > 0 && cells[i - 1] < 0) pa.coast = true;
    if (y > 0 && cells[i - GW] < 0) pa.coast = true;
  }
  // بازنویسی نهایی cells با شناسه‌های جدید استان‌ها
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] >= 0) cells[i] = idMap.get(cells[i]);
  }

  // ---- رودخانه‌ها: جریان از بلندی به سمت دریا ----
  const rivers = [];
  const coastSea = [];
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const i = y * GW + x;
    if (isSea(i)) {
      // سلول دریای کنار خشکی (برای امواج)
      if (!isSea(i - 1) || !isSea(i + 1) || !isSea(i - GW) || !isSea(i + GW)) coastSea.push(i);
    }
  }
  const isSeaF = isSea;
  for (let rTry = 0; rTry < 18; rTry++) {
    let guard = 0, start = -1;
    while (guard++ < 400) {
      const x = 2 + Math.floor(rng() * (GW - 4)), y = 2 + Math.floor(rng() * (GH - 4));
      const i = y * GW + x;
      if (!isSeaF(i) && elev[i] > 0.71) { start = i; break; }
    }
    if (start < 0) continue;
    const path = [start];
    const seen = new Set(path);
    let cur = start;
    while (path.length < 150) {
      const cx = cur % GW, cy = (cur / GW) | 0;
      const nbs = [];
      let nearSea = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= GW - 1 || ny >= GH - 1) continue;
        const ni = ny * GW + nx;
        if (isSeaF(ni)) { nearSea = true; continue; }
        if (!seen.has(ni)) nbs.push(ni);
      }
      if (nearSea) break;
      if (!nbs.length) break;
      nbs.sort((a, b) => (elev[a] - elev[b]) + (rng() - 0.5) * 0.06);
      const next = nbs[0];
      if (elev[next] > elev[cur] + 0.05) break; // نمی‌تواند بالا رود
      cur = next; seen.add(cur); path.push(cur);
    }
    if (path.length > 9) rivers.push(path);
  }

  for (const p of provList) {
    // زمین غالب
    if (p.elev > MOUNT) p.terrain = 'mountain';
    else if (p.elev > HILL) p.terrain = 'hills';
    else if (p.moist > 0.62 && p.elev < 0.62) p.terrain = 'forest';
    else if (p.moist < 0.36) p.terrain = 'desert';
    else if (p.moist > 0.70) p.terrain = 'wetland';
    else p.terrain = 'plains';
    // منابع 0..1
    p.res = {
      farm: p.terrain === 'plains' ? 0.9 : p.terrain === 'wetland' ? 0.75 : p.terrain === 'forest' ? 0.4 : p.terrain === 'hills' ? 0.35 : p.terrain === 'desert' ? 0.12 : 0.05,
      wood: p.terrain === 'forest' ? 1 : p.terrain === 'hills' ? 0.45 : p.terrain === 'wetland' ? 0.3 : 0.08,
      iron: 0, coal: 0,
    };
    const r = rng();
    if (p.terrain === 'mountain') { p.res.iron = 0.35 + r * 0.65; if (rng() < 0.55) p.res.coal = 0.3 + rng() * 0.7; }
    else if (p.terrain === 'hills') { p.res.coal = rng() < 0.5 ? 0.3 + rng() * 0.6 : 0; p.res.iron = rng() < 0.45 ? 0.3 + rng() * 0.55 : 0; }
    else if (rng() < 0.12) { p.res.coal = 0.4 + rng() * 0.5; }
    p.river = 0;
    p.name = pick(rng, PROV_SYLL_A) + pick(rng, PROV_SYLL_B);
  }
  // تاثیر رودخانه روی استان‌ها (حاصلخیزی)
  for (const path of rivers) {
    for (const i of path) {
      const pid = cells[i];
      if (pid >= 0) {
        const pv = provList[pid];
        pv.river++;
        pv.res.farm = Math.min(1, pv.res.farm + 0.06);
      }
    }
  }

  // ---- ملت‌ها: بذر دورافتاده + رشد منطقه‌ای ----
  const NN = NATION_DEFS.length;
  const sizeTier = [10, 9, 8, 8, 7, 7, 7, 6, 6, 5]; // تعداد استان تقریبی
  const total = sizeTier.reduce((a, b) => a + b, 0);
  const quota = sizeTier.map(t => Math.max(2, Math.round(t * provList.length / total)));
  // انتخاب بذرها با بیشترین فاصله
  const seeds2 = [Math.floor(rng() * provList.length)];
  while (seeds2.length < NN) {
    let best = -1, bd = -1;
    for (const p of provList) {
      let dm = 1e9;
      for (const s of seeds2) { const q = provList[s]; const d = Math.hypot(p.cx - q.cx, p.cy - q.cy); if (d < dm) dm = d; }
      const dd = dm * (0.7 + rng() * 0.6);
      if (dd > bd) { bd = dd; best = p.id; }
    }
    seeds2.push(best);
  }
  const owner = new Array(provList.length).fill(-1);
  const fronts = seeds2.map(s => [s]);
  seeds2.forEach((s, n) => owner[s] = n);
  let turn = 0, done = false;
  while (!done) {
    done = true;
    for (let n = 0; n < NN; n++) {
      if (fronts[n].length === 0 || provList.filter(p2 => owner[p2.id] === n).length >= quota[n]) continue;
      done = false;
      const f = fronts[n];
      const cur = f.splice(Math.floor(rng() * f.length), 1)[0];
      for (const nb of provList[cur].adj) {
        if (owner[nb] === -1) { owner[nb] = n; f.push(nb); break; }
      }
      if (f.length === 0) f.push(cur);
      turn++;
    }
    if (turn > 4000) break;
  }
  // استان‌های بدون مالک باقیمانده → به نزدیک‌ترین
  for (const p of provList) {
    if (owner[p.id] === -1) {
      let best = -1, bd = 1e9;
      for (const q of provList) if (owner[q.id] !== -1) { const d = Math.hypot(p.cx - q.cx, p.cy - q.cy); if (d < bd) { bd = d; best = owner[q.id]; } }
      owner[p.id] = best;
    }
  }
  provList.forEach((p, i) => { p.owner = owner[i]; p.controller = owner[i]; });

  // پایتخت: دورترین از مرزهای خارجی (حتماً روی بخش سرزمین-اصلی ملت، نه جزیره‌ی کوچک)
  const compOf = new Array(provList.length).fill(-1);
  let compCount = 0;
  for (let i = 0; i < provList.length; i++) {
    if (compOf[i] !== -1) continue;
    const stack = [i]; compOf[i] = compCount;
    while (stack.length) {
      const c = stack.pop();
      for (const nb of provList[c].adj) if (compOf[nb] === -1) { compOf[nb] = compCount; stack.push(nb); }
    }
    compCount++;
  }
  const capitals = new Array(NN).fill(0);
  for (let n = 0; n < NN; n++) {
    const mine = provList.filter(p => p.owner === n);
    // مؤلفه‌ی برتر خشکی سبزِ این ملت (بخش اصلی قاره — ثروت اصلی این‌جاست؛ جزیره‌ها جدا)
    const compSize = {};
    for (const p of mine) compSize[compOf[p.id]] = (compSize[compOf[p.id]] || 0) + 1;
    // پیش از آن بر اساس بزرگ‌ترین مؤلفه‌ی خشکیِ سبز (نه جزیره‌ها) تعیین کن
    const greenCompSize = {};
    for (const p of mine) if (p.land !== 'island_ish') greenCompSize[compOf[p.id]] = (greenCompSize[compOf[p.id]] || 0) + 1;
    const bestComp = Object.keys(greenCompSize).length
      ? Object.entries(greenCompSize).sort((a2, b2) => b2[1] - a2[1])[0][0]
      : Object.entries(compSize).sort((a2, b2) => b2[1] - a2[1])[0]?.[0];
    const mainland = mine.filter(p => String(compOf[p.id]) === String(bestComp));
    let best = mainland[0] || mine[0], bd = -1;
    for (const p of mainland.length ? mainland : mine) {
      let dm = 1e9;
      for (const q of provList) if (q.owner !== n) { const d = Math.hypot(p.cx - q.cx, p.cy - q.cy); if (d < dm) dm = d; }
      const score = dm + (p.coast ? 30 : 0);
      if (score > bd) { bd = score; best = p; }
    }
    capitals[n] = best.id;
  }

  return {
    seed,
    grid: { gw: GW, gh: GH, cell: CELL, cells, elev, moist, seaLevel: SEA },
    provs: provList,
    nNations: NN,
    capitals,
    rivers,
    coastSea,
    w: W, h: H,
  };
}

// BFS مسیر بین دو استان با شرط عبور
export function findPath(provs, from, to, canPass) {
  if (from === to) return [from];
  const prev = new Map([[from, -1]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const nb of provs[cur].adj) {
      if (prev.has(nb)) continue;
      if (nb !== to && !canPass(nb)) continue;
      prev.set(nb, cur);
      if (nb === to) {
        const path = [to]; let c = to;
        while (prev.get(c) !== -1) { c = prev.get(c); path.push(c); }
        return path.reverse();
      }
      q.push(nb);
    }
  }
  return null;
}
