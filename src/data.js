// ---------- تعاریف ثابت بازی: کالاها، ساختمان‌ها، فناوری، قوانین، ملت‌ها، رویدادها ----------

export const GOODS = {
  grain:     { name: 'غلات',      icon: '🌾', base: 20 },
  fabric:    { name: 'الیاف',     icon: '🧶', base: 30 },
  wood:      { name: 'چوب',       icon: '🪵', base: 15 },
  coal:      { name: 'زغال‌سنگ', icon: '🪨', base: 25 },
  iron:      { name: 'آهن',       icon: '⛓️', base: 40 },
  tools:     { name: 'ابزار',     icon: '🔧', base: 60 },
  clothes:   { name: 'پوشاک',     icon: '👕', base: 45 },
  furniture: { name: 'مبلمان',    icon: '🪑', base: 55 },
  luxury:    { name: 'اقلام لوکس', icon: '💎', base: 95 },
  arms:      { name: 'سلاح',      icon: '🗡️', base: 70 },
};

// نیازهای هفتگی هر ۱۰هزار نفر بر اساس طبقه (برای تقاضای بازار و سطح زندگی)
export const NEEDS = {
  farmer:     { grain: 1.0, clothes: 0.10 },
  worker:     { grain: 1.1, clothes: 0.22, furniture: 0.05 },
  clerk:      { grain: 1.1, clothes: 0.30, furniture: 0.14, luxury: 0.03 },
  capitalist: { grain: 1.3, clothes: 0.45, furniture: 0.30, luxury: 0.22 },
  aristocrat: { grain: 1.3, clothes: 0.50, furniture: 0.35, luxury: 0.30 },
  soldier:    { grain: 1.2, clothes: 0.15 },
  unemp:      { grain: 0.9 },
};

export const POP_CLASSES = {
  farmer:     { name: 'کشاورزان',   icon: '👨‍🌾', wage: 0.7, group: 'landowners' },
  worker:     { name: 'کارگران',    icon: '👷',   wage: 1.0, group: 'workers' },
  clerk:      { name: 'روشنفکران',  icon: '📜',   wage: 1.7, group: 'intelligentsia' },
  capitalist: { name: 'سرمایه‌داران', icon: '💼', wage: 3.2, group: 'industrialists' },
  aristocrat: { name: 'اشراف',      icon: '🎩',   wage: 3.6, group: 'landowners' },
  soldier:    { name: 'سربازان',    icon: '🪖',   wage: 1.1, group: 'military' },
  unemp:      { name: 'بی‌کاران',   icon: '🥀',   wage: 0.25, group: 'workers' },
};

// jobs = ظرفیت استخدام هر سطح؛ prod/cons = کالای تولیدی/مصرفی هر سطح در هفته
// cap(prov) = حداکثر سطح بر اساس زمین/منبع استان
export const BUILDINGS = {
  farm:      { name: 'مزرعه',        icon: '🌾', cost: 400,  weeks: 26, jobs: { farmer: 4200 }, prod: { grain: 7.5 }, cons: { tools: 0.22 }, cap: p => Math.round(2 + p.res.farm * 6), boostBy: 'tools' },
  ranch:     { name: 'دامداری',      icon: '🐑', cost: 450,  weeks: 26, jobs: { farmer: 3000 }, prod: { fabric: 4.5 }, cons: { grain: 1.2, tools: 0.1 }, cap: p => Math.round(1 + p.res.farm * 4) },
  lumber:    { name: 'قطع‌چوب',      icon: '🪓', cost: 350,  weeks: 20, jobs: { worker: 2600 }, prod: { wood: 6.5 }, cons: { tools: 0.18 }, cap: p => Math.round(p.res.wood * 8), boostBy: 'tools' },
  coal_mine: { name: 'معدن زغال‌سنگ', icon: '⛏️', cost: 700,  weeks: 40, jobs: { worker: 4200 }, prod: { coal: 6 }, cons: { tools: 0.4 }, cap: p => Math.round(p.res.coal * 9) },
  iron_mine: { name: 'معدن آهن',     icon: '🏔️', cost: 850,  weeks: 44, jobs: { worker: 4200 }, prod: { iron: 4.5 }, cons: { coal: 0.8, tools: 0.3 }, cap: p => Math.round(p.res.iron * 9) },
  tool_work: { name: 'کارخانه ابزار', icon: '🔧', cost: 1100, weeks: 52, jobs: { worker: 3400, clerk: 300 }, prod: { tools: 6 }, cons: { iron: 1.4, wood: 0.6 }, cap: () => 6, urban: 1 },
  textile:   { name: 'کارخانه نساجی', icon: '🏭', cost: 1000, weeks: 48, jobs: { worker: 4200, clerk: 300 }, prod: { clothes: 6.5 }, cons: { fabric: 2.2 }, cap: () => 8, urban: 1 },
  furniture: { name: 'مبلمان‌سازی',   icon: '🪑', cost: 900,  weeks: 44, jobs: { worker: 3000, clerk: 200 }, prod: { furniture: 4.5 }, cons: { wood: 1.8, tools: 0.2 }, cap: () => 6, urban: 1 },
  glasswork: { name: 'بلورسازی',     icon: '💎', cost: 1400, weeks: 60, jobs: { worker: 2600, clerk: 500, capitalist: 60 }, prod: { luxury: 3.2 }, cons: { coal: 1.2, wood: 0.4 }, cap: () => 5, urban: 1, unlock: 'steam' },
  arms_ind:  { name: 'سلاح‌سازی',    icon: '🔫', cost: 1300, weeks: 56, jobs: { worker: 3000, clerk: 250 }, prod: { arms: 4 }, cons: { iron: 1.2, coal: 0.8, tools: 0.3 }, cap: () => 6, urban: 1 },
  port:      { name: 'بندر',         icon: '⚓', cost: 800,  weeks: 40, jobs: { worker: 2400, clerk: 500 }, prod: {}, cons: {}, cap: p => p.coast ? 5 : 0, income: 260, trade: 1 },
  barracks:  { name: 'پادگان',       icon: '🏰', cost: 600,  weeks: 36, jobs: { soldier: 1000, clerk: 80 }, prod: {}, cons: { arms: 0.25, grain: 0.8 }, cap: () => 8, battalions: 1 },
  university:{ name: 'دانشگاه',      icon: '🎓', cost: 1200, weeks: 52, jobs: { clerk: 1400 }, prod: {}, cons: { furniture: 0.15 }, cap: () => 5, urban: 1, innovation: 4 },
  railway:   { name: 'راه‌آهن',       icon: '🚂', cost: 1600, weeks: 64, jobs: { worker: 2200, clerk: 350 }, prod: {}, cons: { coal: 0.7, iron: 0.4 }, cap: () => 5, urban: 1, unlock: 'railway', infra: 1 },
};

// ---------------- فناوری‌ها ----------------
export const TECH_BRANCHES = { ind: 'صنعت', mil: 'نظامی', soc: 'جامعه' };
export const TECHS = {
  // صنعت
  mechani:  { br: 'ind', name: 'مکانیزاسیون',       icon: '⚙️', cost: 90,  desc: '«چرخ‌ها به نفع ما می‌چرخند.» +۱۰٪ تولید کارخانه‌ها', mods: { urbanOut: 0.10 } },
  steam:    { br: 'ind', name: 'موتور بخار',        icon: '🚂', cost: 190, desc: 'گشش بلورسازی؛ +۱۵٪ معادن', mods: { mineOut: 0.15 }, unlocks: ['glasswork'] },
  railway:  { br: 'ind', name: 'راه‌آهن',           icon: '🛤️', cost: 320, desc: 'گشش راه‌آهن؛ +۱۰٪ درآمد مالیات', mods: { taxMult: 0.10 }, unlocks: ['railway'] },
  steel:    { br: 'ind', name: 'فولاد بسمر',        icon: '🔩', cost: 300, desc: '+۲۰٪ ابزار و سلاح', mods: { toolOut: 0.20 } },
  assembly: { br: 'ind', name: 'خط تولید',          icon: '🏗️', cost: 520, desc: '+۲۰٪ تولید کارخانه‌ها', mods: { urbanOut: 0.20 }, prereq: ['mechani'] },
  electric: { br: 'ind', name: 'برق',               icon: '💡', cost: 640, desc: '+۱۵٪ همه‌ی تولید، +۲ نوآوری', mods: { allOut: 0.15, innov: 2 }, prereq: ['assembly'] },
  // نظامی
  rifling:  { br: 'mil', name: 'تفنگ خان‌دار',      icon: '🎯', cost: 90,  desc: '+۱۵٪ تهاجم ارتش', mods: { atk: 0.15 } },
  artillery:{ br: 'mil', name: 'توپخانه میدانی',    icon: '💥', cost: 200, desc: '+۱۵٪ دفاع، +۵٪ تهاجم', mods: { def: 0.15, atk: 0.05 } },
  conscript:{ br: 'mil', name: 'سربازگیری اجباری',  icon: '🪖', cost: 260, desc: '+۵۰٪ سقف گردان‌ها', mods: { recruit: 0.5 } },
  logistics:{ br: 'mil', name: 'لجستیک مدرن',       icon: '🐎', cost: 360, desc: 'ارتش‌ها ۵۰٪ تندتر حرکت می‌کنند؛ +۱۰٪ تهاجم', mods: { speed: 0.5, atk: 0.10 } },
  trench:   { br: 'mil', name: 'جنگ سنگری',         icon: '🕳️', cost: 480, desc: '+۳۰٪ دفاع', mods: { def: 0.30 }, prereq: ['artillery'] },
  steelnavy:{ br: 'mil', name: 'زره‌پوش‌های دریایی', icon: '🚢', cost: 560, desc: '+۴ اعتبار، +۱۰٪ درآمد بندر', mods: { prestige: 4, portInc: 0.10 }, prereq: ['steel'] },
  // جامعه
  literacy: { br: 'soc', name: 'سوادآموزی عمومی',   icon: '📖', cost: 90,  desc: '+۲ نوآوری در هفته', mods: { innov: 2 } },
  banking:  { br: 'soc', name: 'بانکداری مدرن',     icon: '🏦', cost: 190, desc: '+۱۵٪ درآمد مالیات', mods: { taxMult: 0.15 } },
  medicine: { br: 'soc', name: 'طب نوین',           icon: '⚕️', cost: 280, desc: '+۳۰٪ رشد جمعیت، +۲ امید به زندگی (ناآرامی−)', mods: { growth: 0.30, calm: 0.15 } },
  romantik: { br: 'soc', name: 'رمانتیسم ملی',      icon: '🎻', cost: 240, desc: '+۳ اعتبار، تایید گروه‌ها +۴', mods: { prestige: 3, approval: 4 } },
  suffrage: { br: 'soc', name: 'حق رأی عمومی',      icon: '🗳️', cost: 420, desc: 'تایید کارگران و روشنفکران +۸، قانون‌گذاری سریع‌تر', mods: { lawSpeed: 0.5, apprWorkers: 8 } },
  welfare:  { br: 'soc', name: 'رفاه اجتماعی',      icon: '🏥', cost: 600, desc: 'ناآرامی به‌شدت کمتر می‌شود (+۰٫۲ آرامش)', mods: { calm: 0.2, solAll: 1 }, prereq: ['medicine'] },
};

// ---------------- قوانین ----------------
export const LAW_CATS = { tax: 'نظام مالیاتی', labor: 'حقوق کار', gov: 'نظام حکمرانی' };
export const LAWS = {
  tax: {
    poll:    { name: 'مالیات سرانه',    desc: 'بر فقیران سنگین است؛ کارگران ناراضی‌اند.', mods: { taxMult: 1.0,  appr: { workers: -8, landowners: 4 } } },
    land:    { name: 'مالیات بر زمین',  desc: 'بر دوش اشراف؛ اشراف ناراضی، کشاورزان خشنود.', mods: { taxMult: 1.1,  appr: { landowners: -10, workers: 4 } } },
    prop:    { name: 'مالیات تناسبی',   desc: 'عادلانه و مدرن؛ نیازمند دیوان کارآمد.', mods: { taxMult: 1.25, appr: { intelligentsia: 8, landowners: -6, industrialists: -4 }, tech: 'banking' } },
  },
  labor: {
    serf:    { name: 'سروگی',           desc: 'دهقانان به زمین بسته‌اند؛ تولید مزارع بالا ولی ناآرامی زیاد.', mods: { farmOut: 0.15, unrest: 0.18, appr: { landowners: 10, workers: -12 } } },
    poor:    { name: 'قانون فقرا',      desc: 'کمک اندک به نیازمندان؛ تعادل میانه.', mods: { unrest: -0.05, solAll: 0.2, appr: { workers: 2 } } },
    unions:  { name: 'اتحادیه‌های آزاد', desc: 'کارگران سازمان می‌یابند؛ اقتصاد انعطاف‌پذیرتر.', mods: { urbanOut: 0.08, appr: { workers: 10, industrialists: -8, intelligentsia: 5 }, tech: 'suffrage' } },
  },
  gov: {
    absolut: { name: 'سلطنت مطلقه',     desc: 'فرمان از بالا؛ ارتش و دربار قدرتمندند.', mods: { authority: 1, appr: { military: 8, landowners: 5, intelligentsia: -10 } } },
    constit: { name: 'سلطنت مشروطه',    desc: 'پادشاه و مجلس در کنار هم.', mods: { appr: { intelligentsia: 6, industrialists: 4, landowners: -4 } } },
    repub:   { name: 'جمهوری',          desc: 'حکومت برآمده از رأی؛ تحولی عمیق.', mods: { innov: 2, appr: { intelligentsia: 12, workers: 6, landowners: -14, military: -6 }, tech: 'romantik' } },
  },
};

// ---------------- گروه‌های ذی‌نفع ----------------
export const GROUPS = {
  landowners:     { name: 'اشراف و زمین‌داران', icon: '🏰', onWar: -2 },
  industrialists: { name: 'صنعتگران',          icon: '🏭', onWar: 0 },
  workers:        { name: 'کارگران و زحمتکشان', icon: '✊', onWar: -3 },
  intelligentsia: { name: 'روشنفکران',          icon: '📚', onWar: -4 },
  military:       { name: 'ارتش',               icon: '⚔️', onWar: 8 },
  clergy:         { name: 'روحانیون',           icon: '🕌', onWar: -1 },
};

export const TAX_LEVELS = [
  { name: 'بسیار پایین', mult: 0.5, unrest: -0.10, appr: 4 },
  { name: 'پایین',       mult: 0.75, unrest: -0.05, appr: 2 },
  { name: 'متوسط',       mult: 1.0, unrest: 0, appr: 0 },
  { name: 'بالا',        mult: 1.35, unrest: 0.10, appr: -4 },
  { name: 'بسیار بالا',  mult: 1.7, unrest: 0.20, appr: -8 },
];

// ---------------- ملت‌ها ----------------
export const NATION_DEFS = [
  { name: 'شاهنشاهی آریان',   adj: 'آریایی',   ruler: 'شاهنشاه بهرام دوم',  pers: 'balanced',    c1: '#2e7d6b', c2: '#e8c766', flag: { style: 'h2', emblem: 'sun' },     desc: 'امپراتوری کهنه‌سالار میان‌رودان؛ ارتش و زمین، ستون‌های تاج‌اند.' },
  { name: 'پادشاهی سِروشهر',  adj: 'سِروشهری', ruler: 'ملکه آناهیتا',        pers: 'industrial', c1: '#3a6b34', c2: '#f2efe4', flag: { style: 'h3', emblem: 'tree' },    desc: 'سرسبز و کارخانه‌دار؛ پیشرو در نساجی و ابزار.' },
  { name: 'امارت مرزبان',     adj: 'مرزبانی',  ruler: 'امیر طهمورث',        pers: 'aggressive', c1: '#8c2f39', c2: '#f2d8a7', flag: { style: 'v2', emblem: 'scimitar' }, desc: 'مرزبانان جنگ‌جو با اسب‌های تیزپا.' },
  { name: 'خان‌نشین توران',   adj: 'تورانی',   ruler: 'خان بزرگ اطلس',      pers: 'aggressive', c1: '#b26a21', c2: '#2b2118', flag: { style: 'h2', emblem: 'horse' },    desc: 'امپراتوری چابه‌سواران دشت‌های خشک.' },
  { name: 'دولت نیل‌پر',      adj: 'نیل‌پری',  ruler: 'خدیو ایوب',          pers: 'balanced',   c1: '#2b5d8a', c2: '#e9d8a6', flag: { style: 'h3', emblem: 'crescent' }, desc: 'نیایشگاه تمدن؛ دانه‌باغ غلات کرانه.' },
  { name: 'جمهور تجار آبان',  adj: 'آبانی',    ruler: 'دوج کاروان',         pers: 'trader',     c1: '#4b3b75', c2: '#d9c8f2', flag: { style: 'v3', emblem: 'coin' },     desc: 'جمهوری بندری که با سکه حرف می‌زند.' },
  { name: 'شاهنشاهی لاجورد',  adj: 'لاجوردی',  ruler: 'شاه پیروز لاجوردی',  pers: 'industrial', c1: '#1f4fa0', c2: '#cfe3ff', flag: { style: 'h2', emblem: 'mountain' },  desc: 'کوهستانِ سرشار از آهن و زغال.' },
  { name: 'پادشاهی گُل‌نار',  adj: 'گلناری',   ruler: 'پادشاه رزم‌آرا',     pers: 'balanced',   c1: '#a03355', c2: '#f4e3d0', flag: { style: 'v2', emblem: 'rose' },     desc: 'باغستان معروف به گل، شراب و دانش.' },
  { name: 'اتحاد کوم',        adj: 'کومی',     ruler: 'رهبر شورا',          pers: 'peaceful',   c1: '#557a46', c2: '#efe6c8', flag: { style: 'h3', emblem: 'star' },     desc: 'عشایر متحد دشت‌نشین؛ آرام ولی سرسخت.' },
  { name: 'سلطنت بیابان‌ما',  adj: 'بیابانی',  ruler: 'سلطان ریگ‌زاده',     pers: 'peaceful',   c1: '#b08d3c', c2: '#3a2f1d', flag: { style: 'h2', emblem: 'crescent' }, desc: 'کاروان‌سراهای شنی و دروازه‌ی راه‌ها.' },
];

export const TERRAIN = {
  plains:   { name: 'دشت',      icon: '🌱', def: 1.0,  speed: 1.0,  farm: 1.0 },
  forest:   { name: 'جنگل',     icon: '🌲', def: 1.15, speed: 0.85, farm: 0.55 },
  hills:    { name: 'تپه‌ما',   icon: '⛰️', def: 1.25, speed: 0.8,  farm: 0.5 },
  mountain: { name: 'کوهستان',  icon: '🏔️', def: 1.5,  speed: 0.55, farm: 0.2 },
  desert:   { name: 'بیابان',   icon: '🏜️', def: 1.0,  speed: 0.9,  farm: 0.15 },
  wetland:  { name: 'مرداب',    icon: '🌾', def: 1.15, speed: 0.7,  farm: 0.8 },
};

// ---------------- رویدادها ----------------
// effects: {money, moneyMult, prestige, solAll, unrestAll, approval:{grp:Δ}, price:{good:mult}, tech pts, army:{prov,size} }
export const EVENTS = [
  { id: 'harvest', icon: '🌾', w: 10, title: 'برداشت پربرکت', text: 'باران‌های به‌موقع، انبارها را لبریز کرده‌اند. کشاورزان شکرگزارند و بازار غله جوشیده است.',
    opts: [
      { label: 'غله را به بازار بسپارید', hint: 'قیمت غلات −۲۰٪، خزانه +£۲هزار', fx: { money: 2000, price: { grain: 0.8 } } },
      { label: 'ذخایر سلطنتی افزایش شود', hint: 'ناآرامی −۵، سطح زندگی +۱', fx: { unrestAll: -5, solAll: 1, money: -500 } },
    ] },
  { id: 'quake', icon: '🌋', w: 5, title: 'زمین‌لرزه ویرانگر', text: 'زمین‌لرزه‌ای مهیب یکی از شهرهای شما را لرزاند. خانه‌ها خراب‌اند و مردم در خیابان‌ها‌اند.',
    opts: [
      { label: 'بازسازی فوری', hint: 'خزانه −£۴هزار، اعتبار +۲', fx: { money: -4000, prestige: 2, unrestAll: -3 } },
      { label: 'بگذارید خودشان جبران کنند', hint: 'ناآرامی +۸، جمعیت کم می‌شود', fx: { unrestAll: 8, popLoss: 0.02 } },
    ] },
  { id: 'gold', icon: '🪙', w: 4, title: 'شکار طلا!', text: 'در کوهپایه‌ها رگه‌ای از طلا یافت شده و هر روز کارگران تازه‌ای به سوی معادن سرازیر می‌شوند.',
    opts: [
      { label: 'معادن را ملی کنید', hint: 'خزانه +£۶هزار، سرمایه‌داران ناراضی', fx: { money: 6000, approval: { industrialists: -6 } } },
      { label: 'امتیاز به بخش خصوصی', hint: 'سرمایه‌داران راضی، +۱ رشد اقتصادی موقت', fx: { approval: { industrialists: 8 }, boom: 8 } },
    ] },
  { id: 'strike', icon: '✊', w: 7, cond: s => s.nations[s.playerId].gdp > 900, title: 'اعتصاب بزرگ کارگری', text: 'کارگران کارخانه‌ها دست از کار کشیده‌اند و خواستار افزایش دستمزد هستند. سردمداران صنعت خواهان سرکوب‌اند.',
    opts: [
      { label: 'خواسته‌ها را بپذیرید', hint: 'سطح زندگی +۲، درآمد چند هفته کمتر می‌شود', fx: { solAll: 2, strike: 6, approval: { workers: 8, industrialists: -6 } } },
      { label: 'سرکوب کنید', hint: 'ناآرامی +۷، کارگران خشمگین', fx: { unrestAll: 7, approval: { workers: -10, industrialists: 6 } } },
    ] },
  { id: 'cholera', icon: '☠️', w: 5, title: 'شیوع وبا', text: 'وبا در محله‌های فقیرنشین پخش شده است. پزشکان خواهان قرنطینه و آب سالم‌اند.',
    opts: [
      { label: 'قرنطینه و بهداشت', hint: 'خزانه −£۳هزار، مرگ‌ومیر محدود', fx: { money: -3000, popLoss: 0.01, prestige: 1 } },
      { label: 'به قضا واگذارید', hint: 'جمعیت −۴٪', fx: { popLoss: 0.04, unrestAll: 3 } },
    ] },
  { id: 'inventor', icon: '💡', w: 8, title: 'مخترع نابغه', text: 'مخترعی جوانی دستگاهی تازه به دربار آورده و ادعا می‌کند کار کارگاه‌ها را دو برابر می‌کند.',
    opts: [
      { label: 'از او حمایت کنید', hint: 'خزانه −£۱۵۰۰، امتیاز پژوهش +۲۵', fx: { money: -1500, research: 25 } },
      { label: 'با احتیاط ردش کنید', hint: 'روشنفکران کمی ناراضی', fx: { approval: { intelligentsia: -3 } } },
    ] },
  { id: 'scandal', icon: '🗞️', w: 6, title: 'رسوایی دربار', text: 'روزنامه‌ها از اختلاس یکی از امرا می‌گویند. مردم خواهان پاسخ‌اند و مطبوعات دست‌کم نمی‌گیرند.',
    opts: [
      { label: 'محاکمه علنی', hint: 'اعتبار +۲، اشراف ناراضی', fx: { prestige: 2, approval: { landowners: -5, intelligentsia: 4 } } },
      { label: 'پنهانش کنید', hint: 'خزانه −£۱هزار (رشوه)', fx: { money: -1000 } },
    ] },
  { id: 'border', icon: '🎯', w: 6, cond: s => !s.nations[s.playerId].wars.length, title: 'درگیری مرزی', text: 'نگهبانان مرزی شما با گشته‌های همسایه درگیر شده‌اند. فضا ملتهب است؛ ارتش خواهان واکنش است.',
    opts: [
      { label: 'مهار دیپلماتیک', hint: 'روابط با همسایه‌ها +۸', fx: { relAll: 8 } },
      { label: 'نمایش قدرت', hint: 'اعتبار +۲، روابط −۸، ارتش خرسند', fx: { prestige: 2, relAll: -8, approval: { military: 6 } } },
    ] },
  { id: 'artist', icon: '🎨', w: 7, title: 'جنبش هنری', text: 'شاعران و نقاشان مکتب تازه‌ای پدید آورده‌اند و نام سرزمینتان بر زبان‌هاست.',
    opts: [
      { label: 'حمایت مالی از هنرمندان', hint: 'خزانه −£۱۲۰۰، اعتبار +۳، سطح زندگی +۱', fx: { money: -1200, prestige: 3, solAll: 1 } },
      { label: 'تماشا کنید', hint: 'اعتبار +۱', fx: { prestige: 1 } },
    ] },
  { id: 'drought', icon: '🏜️', w: 5, title: 'خشکسالی', text: 'چشمه‌ها خشکیده‌اند و زمین‌ها ترک برداشته. کشاورزان به شهرها می‌گریزند.',
    opts: [
      { label: 'کمک‌رسانی', hint: 'خزانه −£۲۵۰۰، جمعیت حفظ می‌شود', fx: { money: -2500, unrestAll: -4 } },
      { label: 'سختی را تحمل کنید', hint: 'جمعیت −۲٪، قیمت غلات +۲۵٪', fx: { popLoss: 0.02, price: { grain: 1.25 } } },
    ] },
  { id: 'caravan', icon: '🐪', w: 8, title: 'کاروان بزرگ شاهراه', text: 'کاروانی خیره‌کننده از شرق به بازارهای شما رسیده است؛ تجار خواهان امنیت و عوارض کمترند.',
    opts: [
      { label: 'عوارض را کم کنید', hint: 'خزانه +£۲هزار، روابط +۵', fx: { money: 2000, relAll: 5 } },
      { label: 'مالات سنگین ببندید', hint: 'خزانه +£۴هزار، روابط −۱۰', fx: { money: 4000, relAll: -10 } },
    ] },
  { id: 'mutiny', icon: '🔥', w: 4, cond: s => s.nations[s.playerId].taxLvl >= 3, title: 'شورش مالیاتی', text: 'در برخی روستاها مالیات‌گیران را بیرون کرده‌اند. حاکمان محلی خواهان کمک نظامی‌اند.',
    opts: [
      { label: 'عفو عمومی مالیاتی', hint: 'ناآرامی −۱۲، خزانه −£۲هزار', fx: { unrestAll: -12, money: -2000 } },
      { label: 'سرباز بفرستید', hint: 'ناآرامی +۵، خزانه +£۱۵۰۰', fx: { unrestAll: 5, money: 1500, approval: { military: 4 } } },
    ] },
  { id: 'scholar', icon: '📚', w: 6, title: 'دانشمند بزرگ', text: 'دانشمندی نامدار خواهان مهاجرت به دانشگاه‌های شماست؛ به شرط آزادی تدریس.',
    opts: [
      { label: 'بپذیرید', hint: 'امتیاز پژوهش +۲۰، روشنفکران خرسند', fx: { research: 20, approval: { intelligentsia: 5 } } },
      { label: 'سلیقه‌هایش سخت است...', hint: 'روحانیون خرسند', fx: { approval: { clergy: 5 } } },
    ] },
  { id: 'festival', icon: '🎆', w: 7, title: 'جشن ملی', text: 'سالگرد بنیان‌گذاری نزدیک است. دربار می‌خواهد جشنی باشکوه برگزار کند.',
    opts: [
      { label: 'جشنی بزرگ', hint: 'خزانه −£۲هزار، ناآرامی −۸، اعتبار +۲', fx: { money: -2000, unrestAll: -8, prestige: 2 } },
      { label: 'جشنی ساده', hint: 'تایید گروه‌ها +۲', fx: { approveAll: 2 } },
    ] },
];

export const PROV_SYLL_A = ['کاش', 'سور', 'مهر', 'تیر', 'بار', 'شاه', 'رود', 'گُل', 'نار', 'دشت', 'کیش', 'سار', 'ور', 'مان', 'فر', 'راز', 'هوم', 'بال', 'ژاو', 'کوه', 'نی', 'زر', 'پار', 'لاد', 'آبا', 'چنار', 'برف', 'سیم'];
export const PROV_SYLL_B = ['ستان', 'آباد', 'گران', 'مر', 'دین', 'نار', 'سار', 'خان', 'بور', 'شهر', 'رود', 'گرد', 'لان', 'پور', 'ده', 'کلا', 'وند', 'جرد', 'ماز', 'تان'];
