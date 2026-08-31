// تاریخ‌نگار: هر سال یک عکس فوری از وضعیت کشور بازیکن نگه می‌دارد
// تا بتوان روند رشد یا سقوط امپراتوری را به‌صورت نمودار نشان داد.
const YEAR_WK = 52;
export const CH_KEYS = ['gdp', 'provs', 'battalions', 'stability', 'literacy', 'treasury', 'prestige', 'infamy'];

export function initChronicle(S) {
  if (!S.chronicle) S.chronicle = { last: -1, rows: [] };
}

// یک عکس فوری از کشور بازیکن
function snap(S, n) {
  const provs = S.map.provs.filter(p => p.owner === S.playerId).length;
  return {
    y: 1836 + Math.floor(S.week / YEAR_WK),
    gdp: Math.round(n.gdp || 0),
    provs,
    battalions: Math.round(n.battalions || 0),
    stability: Math.round(n.stability || 0),
    literacy: Math.round(n.literacy || 0),
    treasury: Math.round(n.treasury || 0),
    prestige: Math.round(n.prestige || 0),
    infamy: Math.round(n.infamy || 0),
  };
}

// هر ۵۲ هفته یک ردیف ثبت می‌شود (فقط خط زمانی ویکتوریا)
export function simChronicle(S) {
  if (S.timelineId !== 'victoria') return;
  initChronicle(S);
  const yr = Math.floor(S.week / YEAR_WK);
  if (yr === S.chronicle.last) return;
  S.chronicle.last = yr;
  const n = S.nations[S.playerId];
  if (!n) return;
  S.chronicle.rows.push(snap(S, n));
  if (S.chronicle.rows.length > 80) S.chronicle.rows.shift();
}

// سری عددی یک شاخص
export function series(S, key) {
  if (!S.chronicle || !S.chronicle.rows.length) return [];
  return S.chronicle.rows.map(r => r[key] ?? 0);
}

// روند: درصد تغییر نسبت به n سال پیش
export function trend(S, key, back = 10) {
  const s = series(S, key);
  if (s.length < 2) return null;
  const now = s[s.length - 1];
  const then = s[Math.max(0, s.length - 1 - back)];
  if (!then) return null;
  return (now - then) / Math.abs(then) * 100;
}

// ---------- رسم اسپارک‌لاین SVG ----------
// یک نمودار کوچک درون‌خطی؛ بدون وابستگی بیرونی.
export function sparkline(vals, opt = {}) {
  const w = opt.w || 150, h = opt.h || 34, pad = 2;
  if (!vals || vals.length < 2) return `<svg class="spark" width="${w}" height="${h}"></svg>`;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const dx = (w - pad * 2) / (vals.length - 1);
  const pts = vals.map((v, i) => {
    const x = pad + i * dx;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const up = vals[vals.length - 1] >= vals[0];
  const col = opt.color || (up ? '#7fc08a' : '#c8776b');
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${(pad + (vals.length - 1) * dx).toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
  const id = 'sg' + Math.random().toString(36).slice(2, 8);
  const last = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".38"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="${col}"/>
  </svg>`;
}

// نمودار بزرگ‌تر برای صفحه‌ی پایان (با محور سال)
export function bigChart(S, key, opt = {}) {
  const rows = (S.chronicle && S.chronicle.rows) || [];
  if (rows.length < 2) return '<div class="dim">داده‌ی کافی برای نمودار نیست</div>';
  const vals = rows.map(r => r[key] ?? 0);
  const w = opt.w || 460, h = opt.h || 120, pad = 22;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const dx = (w - pad * 2) / (vals.length - 1);
  const pts = vals.map((v, i) => [pad + i * dx, h - pad - ((v - min) / span) * (h - pad * 2)]);
  const col = opt.color || '#d9b166';
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
  const id = 'bg' + Math.random().toString(36).slice(2, 8);
  return `<svg class="bigchart" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="rgba(200,170,110,.25)" stroke-width="1"/>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}
