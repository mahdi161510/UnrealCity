// ================================================================
// آبرو (بدنامی) و ائتلاف مهار
// ----------------------------------------------------------------
// در آزمون دیدیم نقشه در یک قرن تقریباً ایستاست و هیچ ترمزی برای
// توسعه‌طلبی وجود ندارد. طبق تصمیم کاربر («منصفانه ولی پرچالش»)
// ترمز نباید بونوس مخفی AI باشد، بلکه پیامد دیپلماتیکِ آشکار:
// هرچه بیشتر ضمیمه کنی، جهان بیشتر از تو می‌ترسد و سرانجام علیه‌ات
// متحد می‌شود. همان قواعد برای بازیکن و AI اجرا می‌شود.
// ================================================================
import { clamp } from './utils.js';

export const INFAMY_MAX = 100;
// آستانه‌ها
export const INF_WATCH = 30;    // جهان نگران می‌شود
export const INF_PARIAH = 55;   // منفور: جریمه‌های سنگین
export const INF_COALITION = 72; // ائتلاف مهار شکل می‌گیرد

export function initInfamy(S) {
  if (S.timelineId !== 'victoria') return;
  for (const n of S.nations) { n.infamy = 0; n.coalitionAgainst = null; }
  S.coalitions = [];
}

// افزودن بدنامی با سقف
export function addInfamy(S, n, amt, why) {
  if (S.timelineId !== 'victoria' || !n) return;
  n.infamy = clamp((n.infamy || 0) + amt, 0, INFAMY_MAX);
  if (n.player && amt > 0 && why) {
    S.pendingAlerts = S.pendingAlerts || [];
    S.pendingAlerts.push({ icon: '😠', text: `بدنامی +${Math.round(amt)} — ${why}`, w: S.week });
  }
}

// جریمه‌های بدنامی: هرچه منفورتر، جهان سردتر
export function infamyMods(n) {
  const inf = n?.infamy || 0;
  if (inf < INF_WATCH) return {};
  const t = (inf - INF_WATCH) / (INFAMY_MAX - INF_WATCH); // ۰..۱
  return {
    _infamy: inf,
    relGain: -0.5 * t,        // دیپلماسی کند می‌شود
    tradeCap: -0.25 * t,      // بازرگانان از تو می‌گریزند
    prestigeFlat: -14 * t,    // آبروی جهانی
  };
}

// آیا این ملت هدف ائتلاف است؟
export function coalitionAgainst(S, nid) {
  return (S.coalitions || []).find(c => c.target === nid && !c.done) || null;
}

export function simInfamy(S) {
  if (S.timelineId !== 'victoria') return;
  // ---- فرسایش آرام: زمان زخم آبرو را می‌شوید ----
  for (const n of S.nations) {
    if (!n.alive) continue;
    if (n.infamy > 0) {
      // دیپلمات‌های خوب سریع‌تر ترمیم می‌کنند
      // ترمیم پایه + بخشی متناسب با خودِ بدنامی، تا انباشت ابدی نشود
      const heal = 0.055 + (n.infamy / 100) * 0.05 + (n.ideas?.mods?.relGain || 0) * 0.05;
      n.infamy = clamp(n.infamy - heal, 0, INFAMY_MAX);
    }
  }
  // ---- تشکیل ائتلاف مهار ----
  if (S.week % 13 !== 0) return;
  for (const n of S.nations) {
    if (!n.alive || (n.infamy || 0) < INF_COALITION) continue;
    if (coalitionAgainst(S, n.id)) continue;
    // چه کسانی می‌ترسند؟ همسایگان و قدرت‌هایی که رابطه‌شان بد است
    const members = S.nations.filter(m => m.alive && m.id !== n.id
      && (m.rel[n.id] ?? 0) < 25
      && !m.pacts?.[n.id]);
    if (members.length < 3) continue;
    S.coalitions.push({
      target: n.id, members: members.map(m => m.id),
      started: S.week, done: false,
    });
    n.coalitionAgainst = S.week;
    for (const m of members) { m.rel[n.id] = Math.min(m.rel[n.id] ?? 0, -45); n.rel[m.id] = Math.min(n.rel[m.id] ?? 0, -45); }
    if (S.addLogFn) S.addLogFn(S, '⚔️', `ائتلافی از ${members.length} کشور برای مهار ${n.name} بسته شد!`);
    if (n.player) {
      S.pendingAlerts = S.pendingAlerts || [];
      S.pendingAlerts.push({ icon: '⚔️', text: `ائتلاف مهار علیه شما بسته شد! ${members.length} کشور.`, w: S.week });
      S.paused = true;
    }
  }
  // ---- انحلال ائتلاف وقتی خطر رفع شد ----
  for (const c of S.coalitions || []) {
    if (c.done) continue;
    const t = S.nations[c.target];
    if (!t?.alive || (t.infamy || 0) < INF_PARIAH) {
      c.done = true;
      if (S.addLogFn && t) S.addLogFn(S, '🕊️', `ائتلاف علیه ${t.name} از هم پاشید.`);
    }
  }
}

export function infamyLabel(inf) {
  if (inf < INF_WATCH) return { txt: 'محترم', cls: 'good' };
  if (inf < INF_PARIAH) return { txt: 'زیر نظر', cls: 'mid' };
  if (inf < INF_COALITION) return { txt: 'منفور', cls: 'bad' };
  return { txt: 'دشمن جهان', cls: 'bad' };
}
