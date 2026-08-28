// ---------- ابزارهای عمومی ----------
export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

// RNG قابل‌بازیابی (mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// نویز مقداری دوبعدی (value noise) برای زمین
export function makeNoise2D(rng) {
  const P = 256, perm = new Uint8Array(P * 2), vals = new Float32Array(P);
  for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = rng(); }
  for (let i = P - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < P; i++) perm[P + i] = perm[i];
  const g = (ix, iy) => vals[perm[(ix & 255) + perm[iy & 255]]];
  return function (x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = g(ix, iy), b = g(ix + 1, iy), c = g(ix, iy + 1), d = g(ix + 1, iy + 1);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  };
}
export function fbm(noise, x, y, oct = 4, lac = 2.02, gain = 0.5) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * noise(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
  return s / norm;
}

// ---------- قالب‌بندی اعداد فارسی ----------
const faNum = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const faNum1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
export function fd(n) { // رقم‌های فارسیِ گردشده
  if (!isFinite(n)) return '۰';
  return faNum.format(Math.round(n));
}
export function fd1(n) { return faNum1.format(n); }
export function fK(n) { // ۱۲٬۳۰۰ → ۱۲٫۳ هزار
  const a = Math.abs(n);
  if (a >= 1e6) return faNum1.format(n / 1e6) + ' میلیون';
  if (a >= 1e3) return faNum1.format(n / 1e3) + ' هزار';
  return fd(n);
}
export function fMoney(n) { // پول با علامت £
  const neg = n < 0;
  return (neg ? '−' : '') + '£' + fK(Math.abs(n));
}
export function fSign(n, digits = 0) {
  const s = digits ? faNum1.format(Math.abs(n)) : faNum.format(Math.round(Math.abs(n)));
  return (n >= 0 ? '+' : '−') + s;
}
export function fPct(x) { return faNum.format(Math.round(x * 100)) + '٪'; }

// تاریخ هفته‌ای از ۱ ژانویه ۱۸۳۶
export const FA_MONTHS = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
export function weekToDate(week) {
  const days = week * 7;
  const y = 1836 + Math.floor(days / 365.25);
  let d = Math.floor(days % 365.25);
  const ml = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let m = 0;
  while (m < 11 && d >= ml[m]) { d -= ml[m]; m++; }
  return { y, m, d: d + 1 };
}
export function fDate(week) {
  const t = weekToDate(week);
  return faNum.format(t.d) + ' ' + FA_MONTHS[t.m] + ' ' + faNum.format(t.y);
}
export function fYearMonth(week) {
  const t = weekToDate(week);
  return FA_MONTHS[t.m] + ' ' + faNum.format(t.y);
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
export function sum(obj) { let s = 0; for (const k in obj) s += obj[k]; return s; }
