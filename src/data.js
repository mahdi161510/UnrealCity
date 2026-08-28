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
  steel:     { name: 'فولاد',     icon: '🔩', base: 65 },
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
  steel_mill:{ name: 'فولادسازی',    icon: '🏗️', cost: 1500, weeks: 60, jobs: { worker: 3200, clerk: 250 }, prod: { steel: 4 }, cons: { iron: 2, coal: 1 }, cap: () => 6, urban: 1, unlock: 'steel' },
  barracks:  { name: 'پادگان',       icon: '🏰', cost: 600,  weeks: 36, jobs: { soldier: 1000, clerk: 80 }, prod: {}, cons: { arms: 0.25, grain: 0.8 }, cap: () => 8, battalions: 1 },
  university:{ name: 'دانشگاه',      icon: '🎓', cost: 1200, weeks: 52, jobs: { clerk: 1400 }, prod: {}, cons: { furniture: 0.15 }, cap: () => 5, urban: 1, innovation: 4 },
  railway:   { name: 'راه‌آهن',       icon: '🚂', cost: 1600, weeks: 64, jobs: { worker: 2200, clerk: 350 }, prod: {}, cons: { steel: 0.9, coal: 0.5 }, cap: () => 5, urban: 1, unlock: 'railway', infra: 1 },
  power:     { name: 'نیروگاه',      icon: '⚡', cost: 1800, weeks: 70, jobs: { worker: 1800, clerk: 300 }, prod: {}, cons: { coal: 1.2 }, cap: () => 2, urban: 1, unlock: 'electric', power: 1 },
};

// ---------------- فناوری‌ها ----------------
export const TECH_BRANCHES = { ind: 'صنعت', mil: 'نظامی', soc: 'جامعه' };
export const TECHS = {
  // صنعت
  mechani:  { br: 'ind', name: 'مکانیزاسیون',       icon: '⚙️', cost: 90,  desc: '«چرخ‌ها به نفع ما می‌چرخند.» +۱۰٪ تولید کارخانه‌ها', mods: { urbanOut: 0.10 } },
  steam:    { br: 'ind', name: 'موتور بخار',        icon: '🚂', cost: 190, desc: 'گشش بلورسازی؛ +۱۵٪ معادن', mods: { mineOut: 0.15 }, unlocks: ['glasswork'] },
  railway:  { br: 'ind', era: 1, name: 'راه‌آهن',           icon: '🛤️', cost: 320, desc: 'گشش راه‌آهن؛ +۱۰٪ درآمد مالیات', mods: { taxMult: 0.10 }, unlocks: ['railway'] },
  steel:    { br: 'ind', era: 1, name: 'فولاد بسمر',        icon: '🔩', cost: 300, desc: 'گشش فولادسازی؛ +۲۰٪ ابزار و سلاح', mods: { toolOut: 0.20 }, unlocks: ['steel_mill'] },
  assembly: { br: 'ind', era: 2, name: 'خط تولید',          icon: '🏗️', cost: 520, desc: '+۲۰٪ تولید کارخانه‌ها', mods: { urbanOut: 0.20 }, prereq: ['mechani'] },
  electric: { br: 'ind', era: 3, name: 'برق',               icon: '💡', cost: 640, desc: '+۱۵٪ همه‌ی تولید، +۲ نوآوری', mods: { allOut: 0.15, innov: 2 }, prereq: ['assembly'] },
  // نظامی
  rifling:  { br: 'mil', name: 'تفنگ خان‌دار',      icon: '🎯', cost: 90,  desc: '+۱۵٪ تهاجم ارتش', mods: { atk: 0.15 } },
  artillery:{ br: 'mil', era: 1, name: 'توپخانه میدانی',    icon: '💥', cost: 200, desc: '+۱۵٪ دفاع، +۵٪ تهاجم', mods: { def: 0.15, atk: 0.05 } },
  conscript:{ br: 'mil', era: 1, name: 'سربازگیری اجباری',  icon: '🪖', cost: 260, desc: '+۵۰٪ سقف گردان‌ها', mods: { recruit: 0.5 } },
  logistics:{ br: 'mil', era: 1, name: 'لجستیک مدرن',       icon: '🐎', cost: 360, desc: 'ارتش‌ها ۵۰٪ تندتر حرکت می‌کنند؛ +۱۰٪ تهاجم', mods: { speed: 0.5, atk: 0.10 } },
  trench:   { br: 'mil', era: 2, name: 'جنگ سنگری',         icon: '🕳️', cost: 480, desc: '+۳۰٪ دفاع', mods: { def: 0.30 }, prereq: ['artillery'] },
  steelnavy:{ br: 'mil', era: 2, name: 'زره‌پوش‌های دریایی', icon: '🚢', cost: 560, desc: '+۴ اعتبار، +۱۰٪ درآمد بندر', mods: { prestige: 4, portInc: 0.10 }, prereq: ['steel'] },
  // جامعه
  literacy: { br: 'soc', name: 'سوادآموزی عمومی',   icon: '📖', cost: 90,  desc: '+۲ نوآوری در هفته', mods: { innov: 2 } },
  banking:  { br: 'soc', name: 'بانکداری مدرن',     icon: '🏦', cost: 190, desc: '+۱۵٪ درآمد مالیات', mods: { taxMult: 0.15 } },
  medicine: { br: 'soc', era: 1, name: 'طب نوین',           icon: '⚕️', cost: 280, desc: '+۳۰٪ رشد جمعیت، +۲ امید به زندگی (ناآرامی−)', mods: { growth: 0.30, calm: 0.15 } },
  romantik: { br: 'soc', era: 1, name: 'رمانتیسم ملی',      icon: '🎻', cost: 240, desc: '+۳ اعتبار، تایید گروه‌ها +۴', mods: { prestige: 3, approval: 4 } },
  suffrage: { br: 'soc', era: 2, name: 'حق رأی عمومی',      icon: '🗳️', cost: 420, desc: 'تایید کارگران و روشنفکران +۸، قانون‌گذاری سریع‌تر', mods: { lawSpeed: 0.5, apprWorkers: 8 } },
  welfare:  { br: 'soc', era: 2, name: 'رفاه اجتماعی',      icon: '🏥', cost: 600, desc: 'ناآرامی به‌شدت کمتر می‌شود (+۰٫۲ آرامش)', mods: { calm: 0.2, solAll: 1 }, prereq: ['medicine'] },
  chemical: { br: 'ind', era: 2, name: 'شیمی صنعتی',        icon: '⚗️', cost: 560, desc: '+۱۰٪ معادن، +۸٪ کل تولید', mods: { mineOut: 0.10, allOut: 0.08 }, prereq: ['steel'] },
  drills:   { br: 'mil', era: 2, name: 'مانور کلان',         icon: '🎖️', cost: 480, desc: '+۶٪ تهاجم و دفاع؛ سنگر ژنرال‌ها عمیق‌تر', mods: { atk: 0.06, def: 0.06, dig: 10 }, prereq: ['artillery'] },
  journalism:{ br: 'soc', era: 2, name: 'مطبوعات خوانده',    icon: '📰', cost: 460, desc: 'تایید گروه‌ها به‌تدریج بهبود می‌یابد', mods: { press: 1 }, prereq: ['literacy'] },
  academy:  { br: 'soc', era: 3, name: 'فرهنگستان علوم',     icon: '🏫', cost: 760, desc: '+۳ نوآوری، هدف سواد +۵', mods: { innov: 3, litTarget: 5 }, prereq: ['welfare'] },
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
  { id: 'railmania', icon: '🚂', w: 4, cond: s => s.nations[s.playerId].tech.includes('railway'), title: 'تب راه‌آهن', text: 'سهامداران برای سهم راه‌آهن هجوم آورده‌اند. هر کوچه سخن از لکوموتیو است و سرمایه‌داران آماده‌ی سرمایه‌گذاری بزرگ‌اند.',
    opts: [
      { label: 'انتشار سهام دولتی', hint: 'خزانه +£۳هزار، سرمایه‌داران خرسند', fx: { money: 3000, approval: { industrialists: 6 } } },
      { label: 'احتیاط کنید', hint: 'نوآوری +۱۰ امتیاز', fx: { research: 10 } },
    ] },
  { id: 'exhibition', icon: '🏛️', w: 5, cond: s => s.nations[s.playerId].gdp > 1500, title: 'نمایشگاه جهانی', text: 'دعوت به برگزاری نمایشگاه بزرگ صنعت رسیده است. همه‌ی ملت‌ها نمونه‌های برگزیده می‌فرستند؛ نمایشی درخشان نام شما را جاودانه می‌کند.',
    opts: [
      { label: 'نمایشگاهی باشکوه', hint: 'خزانه −£۵هزار، اعتبار +۶', fx: { money: -5000, prestige: 6 } },
      { label: 'غرفه‌ای ساده', hint: 'خزانه −£۱هزار، اعتبار +۲', fx: { money: -1000, prestige: 2 } },
      { label: 'شرکت نکنیم', hint: 'روشنفکران کمی دلسرد', fx: { approval: { intelligentsia: -3 } } },
    ] },
  { id: 'strikebreaker', icon: '💼', w: 5, cond: s => s.nations[s.playerId].gdp > 1200, title: 'شیادی در کارخانه', text: 'مدیر یکی از کارخانه‌ها به‌تقلب در دستمزدها متهم شده است. کارگران خواهان انصاف‌اند و سهامداران خواهان حفظ آبرو.',
    opts: [
      { label: 'عزل و محاکمه مدیر', hint: 'کارگران خرسند، سرمایه‌داران ناراضی', fx: { approval: { workers: 6, industrialists: -5 } } },
      { label: 'پوشش بدهید', hint: 'سرمایه‌داران خرسند، ناآرامی +۴', fx: { approval: { industrialists: 5 }, unrestAll: 4 } },
    ] },
  { id: 'women', icon: '🎗️', w: 4, cond: s => (s.week / 52) > 40, title: 'جنبش زنان', text: 'زنان تحصیل‌کرده خواهان حق تحصیل و کار برابر شده‌اند. جنبش آرام اما ریشه‌دار است و روزنامه‌ها پر از بحث‌اند.',
    opts: [
      { label: 'بپذیرید', hint: 'نوآوری +۱۵، روشنفکران خرسند، روحانیون ناراضی', fx: { research: 15, approval: { intelligentsia: 5, clergy: -6 } } },
      { label: 'به تعویق بیندازید', hint: 'روحانیون خرسند', fx: { approval: { clergy: 4, intelligentsia: -3 } } },
    ] },
  { id: 'bazaar', icon: '🏺', w: 6, title: 'بازار مرزی', text: 'تجار خواهان گشایش بازارچه‌ای مرزی با همسایه‌اند. نگهبانان نگران قاچاق‌اند.',
    opts: [
      { label: 'گشایش بازارچه', hint: 'خزانه +£۱۸۰۰، روابط +۶', fx: { money: 1800, relAll: 6 } },
      { label: 'محاصره قاچاق', hint: 'ارتش خرسند، خزانه +£۶۰۰', fx: { money: 600, approval: { military: 3 } } },
    ] },
  { id: 'whale', icon: '🐋', w: 4, cond: s => s.map.provs.some(p => p.owner === s.playerId && p.coast), title: 'شکار نهنگ', text: 'شکارچیان نهنگ با کشتی‌های پر از روغن به بندر برگشته‌اند. بازار روغن و چراغ‌ها گرم است.',
    opts: [
      { label: 'صادرات سازمان‌یافته', hint: 'خزانه +£۲۲۰۰', fx: { money: 2200 } },
      { label: 'تقسیم میان تنگدستان', hint: 'ناآرامی −۶، سطح زندگی +۱', fx: { unrestAll: -6, solAll: 1 } },
    ] },
  { id: 'petition', icon: '📜', w: 6, cond: s => s.nations[s.playerId].laws.gov === 'absolut', title: 'طومار اصلاحات', text: 'طوماری با هزاران امضا خواهان تشکیل مجلس است. مشاوران میان شکافتن یا مذاکره دو‌مانده‌اند.',
    opts: [
      { label: 'گوش به فرمان', hint: 'روشنفکران و صنعتگران خرسند، اشراف ناراضی', fx: { approval: { intelligentsia: 6, industrialists: 4, landowners: -6 } } },
      { label: 'طومار را پاره کنید', hint: 'اشراف خرسند، ناآرامی +۶', fx: { approval: { landowners: 5 }, unrestAll: 6 } },
    ] },
  { id: 'assassin', icon: '🗡️', w: 3, cond: s => (s.nations[s.playerId].wars.length > 0), title: 'سایه‌ی ترور', text: 'عامل یک انجمن مخفی به‌زندگی شما تهدید کرده است. محافظان خواهان اقدام فوری‌اند.',
    opts: [
      { label: 'دستگیری‌های گسترده', hint: 'خزانه −£۸۰۰، ناآرامی +۳', fx: { money: -800, unrestAll: 3, approval: { military: 4 } } },
      { label: 'بی‌تفاوت بمانید', hint: 'ناآرامی −۲، اما اعتبار −۱', fx: { unrestAll: -2, prestige: -1 } },
    ] },
  { id: 'silk', icon: '🧵', w: 5, title: 'کاروان ابریشم', text: 'راه ابریشم از سرزمین شما می‌گذرد و بازرگانان خواهان امنیت جاده‌ها هستند.',
    opts: [
      { label: 'گشتی جاده‌ای برقرار کنید', hint: 'خزانه +£۱۵۰۰، روابط +۴', fx: { money: 1500, relAll: 4 } },
      { label: 'عوارض سنگین', hint: 'خزانه +£۳هزار، روابط −۶', fx: { money: 3000, relAll: -6 } },
    ] },
  // ============ رویدادهای سخت و زیان‌بار (نسخه‌ی ۳) ============
  { id: 'famine', icon: '🥀', w: 5, title: 'قحطی بزرگ', text: 'باران نیامده و دشت‌ها سوخته‌اند. انبارها خالی‌اند و قیمت نان به آسمان رسیده. راویان از گرسنگی در روستاهای دور دست سخن می‌گویند.',
    opts: [
      { label: 'واردات اضطراری غله', hint: '۱۲٪ خزانه می‌رود؛ گرسنگی مهار می‌شود', fx: { moneyMult: -0.12, unrestAll: -4, price: { grain: 1.1 } } },
      { label: 'نذر و دعا و تحمل', hint: 'جمعیت −۳٪، غلات +۴۰٪، ناآرامی +۷', fx: { popLoss: 0.03, price: { grain: 1.4 }, unrestAll: 7 } },
    ] },
  { id: 'bankrun', icon: '🏦', w: 4, cond: s => s.nations[s.playerId].treasury > 3000, title: 'هراس بانکی', text: 'بانکداری بزرگ ورشکست شده و سپرده‌گذاران در خیابان صف کشیده‌اند. اگر دولت دخالت نکند، اعتبار کل بازار فرومی‌ریزد.',
    opts: [
      { label: 'تزریق نجات مالی', hint: '۱۸٪ خزانه می‌رود؛ بازار آرام می‌شود', fx: { moneyMult: -0.18, approval: { industrialists: 6, intelligentsia: 3 } } },
      { label: 'به بازار واگذار کنید', hint: '۱۰٪ خزانه می‌سوزد، رکود موقت، سرمایه‌داران ناراضی', fx: { moneyMult: -0.10, boom: -8, approval: { industrialists: -8 }, unrestAll: 4 } },
    ] },
  { id: 'minefall', icon: '⛏️', w: 5, cond: s => s.map.provs.some(p => p.owner === s.playerId && (p.bld.coal_mine + p.bld.iron_mine) > 0), title: 'فرواپاشی معدن', text: 'سقف یکی از معادن اصلی فروریخته و ده‌ها کارگر زیر آوار گرفتارند. خانواده‌ها بر سر دروازه‌ی معدن‌اند.',
    opts: [
      { label: 'عملیات نجات پرهزینه', hint: 'خزانه −£۲هزار؛ کارگران سپاسگزار', fx: { money: -2000, approval: { workers: 6 }, prestige: 1 } },
      { label: 'بستن معدن و مشروب سکوت', hint: 'یک سطح معدن نابود می‌شود؛ کارگران دلخور', fx: { bldLoss: ['coal_mine', 'iron_mine'], approval: { workers: -7 }, money: -600 } },
    ] },
  { id: 'flood', icon: '🌊', w: 4, cond: s => s.map.provs.some(p => p.owner === s.playerId && p.river > 0), title: 'طغیان رودخانه', text: 'باران‌های پیاپی رودخانه‌ها را به طغیان آورده است. مزارع کرانه زیر آب‌اند و کوچک‌ترین اشتباه، فاجعه را دوچندان می‌کند.',
    opts: [
      { label: 'بازسازی سیل‌بان‌ها', hint: 'خزانه −£۳هزار؛ سطح زندگی حفظ می‌شود', fx: { money: -3000, approval: { landowners: 3 } } },
      { label: 'نجات تنها شهرهای بزرگ', hint: '۲ استان خراب؛ ناآرامی +۶', fx: { devastProv: 2, unrestAll: 6 } },
    ] },
  { id: 'locust', icon: '🦗', w: 4, title: 'طوفان ملخ', text: 'ابر سیاهی از ملخ بر آسمان ظاهر شده و هر چه سبز است می‌جود. نگهبانان زنگوله به دست‌اند اما ملخ‌ها بس بی‌رحم‌اند.',
    opts: [
      { label: 'بسیج مردمی علیه ملخ', hint: 'خزانه −£۱۵۰۰؛ خسارت نصفه', fx: { money: -1500, price: { grain: 1.25 }, approval: { workers: 2 } } },
      { label: 'قدرت ما نیست...', hint: 'غلات +۶۵٪، سطح زندگی −۱', fx: { price: { grain: 1.65 }, solAll: -1, unrestAll: 5 } },
    ] },
  { id: 'capfire', icon: '🔥', w: 3, cond: s => (s.week / 52) > 6, title: 'آتش‌سوزی پایتخت', text: 'شبگاه، شعله‌ای در محله‌ی بازار پایتخت زبانه کشید و تا سپیده‌دمان، عمارت‌ها خاکستر شدند. افواه از آتش‌افروزی سخن می‌گوید.',
    opts: [
      { label: 'بازسازی شکوهمند', hint: 'خزانه −£۴هزار؛ اعتبار +۲', fx: { money: -4000, prestige: 2 } },
      { label: 'بازسازی تدریجی', hint: 'یک ساختمان پایتخت از دست می‌رود؛ ناآرامی +۴', fx: { bldLoss: ['textile', 'tool_work', 'furniture', 'port', 'university'], unrestAll: 4 } },
    ] },
  { id: 'coup', icon: '🗡️', w: 4, cond: s => { const n = s.nations[s.playerId]; return (n.groups.military?.appr ?? 0) < -4 || n.taxLvl >= 4; }, title: 'توطئه در پادگان', text: 'گزارش محرمانه رسیده: گروهی از افسران ارشد قصد کودتا دارند. محافظان دربار آماده‌باش‌اند؛ هر تصمیم، تبعات عمیقی دارد.',
    opts: [
      { label: 'بازداشت و محاکمه', hint: 'ارتش ناراضی (−۹)، ناآرامی +۴، اعتبار −۱', fx: { approval: { military: -9 }, unrestAll: 4, prestige: -1 } },
      { label: 'مصالحه و ترفیع آن‌ها', hint: 'خزانه −£۲۵۰۰؛ ارتش ساکت می‌ماند (+۴)', fx: { money: -2500, approval: { military: 4 } } },
    ] },
  { id: 'ultimatum', icon: '⚠️', w: 4, cond: s => { const n = s.nations[s.playerId]; if (n.wars.length) return false; return s.nations.some(m => m.alive && m.id !== n.id && m.pers === 'aggressive' && m.battalions > n.battalions + 2 && (n.rel[m.id] ?? 0) < -10); }, title: 'اولتیماتوم همسایه', text: 'سفیر تهدیدآمیز نامه‌ای آورد: همسایه‌ی جنگجوی شما خواهان پرداخت غرامت است وگرنه «عواقب آن با شماست». سخنرانی افواه دربار جنگی است.',
    opts: [
      { label: 'غرامت را بپردازید', hint: '۱۲٪ خزانه می‌رود؛ صلح می‌خرید (اعتبار −۲)', fx: { moneyMult: -0.12, prestige: -2, approval: { military: -4 } } },
      { label: 'تهدیدش را پس بدهید!', hint: 'اعتبار +۲؛ ولی چند هفته‌ی دیگر جنگ خواهد شد…', fx: { prestige: 2, approval: { military: 3 }, ultim: true } },
    ] },
  { id: 'traitor', icon: '🕵️', w: 4, title: 'رشوه‌ی درباری', text: 'معاون خزانه‌داری به رشوه‌خواری متهم شده است. پرونده می‌گوید سال‌هاست از محل عوارض برای خودش برده.',
    opts: [
      { label: 'محاکمه و مصادره اموال', hint: 'خزانه +£۱۸۰۰؛ خوش‌رقص‌ها لرزان', fx: { money: 1800, approval: { landowners: -3, intelligentsia: 3 } } },
      { label: 'به‌به‌سازی پرونده', hint: 'اشراف راضی؛ خزانه −£۷۰۰', fx: { money: -700, approval: { landowners: 4 } } },
    ] },
  { id: 'smuggler', icon: '🏴‍☠️', w: 5, title: 'قاچاق سازمان‌یافته', text: 'مجموعه‌ای از تجار دور از چشم عوارضی‌ها کالا می‌گذارند. درآمد عوارض افت کرده و ماموران سست‌اند.',
    opts: [
      { label: 'سرکوب قاچاقچیان', hint: 'خزانه −£۹۰۰؛ خزانه‌ی بعدی بهتر (+عوارض بعداً)، ارتش خرسند', fx: { money: -900, approval: { military: 3 }, relAll: -3 } },
      { label: 'به نوبت‌شان نرسید', hint: '۸٪ خزانه فرومی‌ریزد؛ تجار خرسند', fx: { moneyMult: -0.08, approval: { industrialists: 4 } } },
    ] },
  { id: 'childlabor', icon: '👦', w: 4, cond: s => s.nations[s.playerId].gdp > 900, title: 'کار کودکان در کوره‌ها', text: 'گزارشی تکان‌دهنده از کودکانی که در معادن و کوره‌ها کار می‌کنند منتشر شده است. روشنفکران فریاد برآورده‌اند؛ کارخانه‌داران از توقف تولید می‌ترسند.',
    opts: [
      { label: 'ممنوعیت کار کودکان', hint: 'سطح زندگی +۱؛ تولید موقتاً افت می‌کند؛ صنعتگران ناراضی', fx: { solAll: 1, boom: -5, approval: { industrialists: -6, intelligentsia: 5 } } },
      { label: 'فعلاً چیزی نکنید', hint: 'روشنفکران و کارگران دلخور', fx: { approval: { intelligentsia: -4, workers: -3 } } },
    ] },
  { id: 'braindrain', icon: '🧠', w: 4, cond: s => { const n = s.nations[s.playerId]; return (n.innov || 0) > 6 && n.literacy > 20; }, title: 'مهاجرت مغزها', text: 'دانشمندان جوانتان پیشنهادهای فربه از بیرون مرزها می‌گیرند. اگر جلو مهاجرتشان را نگیرید، چراغ دانش کم‌سو می‌شود.',
    opts: [
      { label: 'حقوق خاص پژوهشگران', hint: 'خزانه −£۱۸۰۰؛ نوآوری حفظ می‌شود (+۱۰ امتیاز)', fx: { money: -1800, research: 10 } },
      { label: 'بگذارید بروند', hint: '۱۵ امتیاز پژوهش سوخته می‌شود؛ روشنفکران ناراضی', fx: { research: -15, approval: { intelligentsia: -4 } } },
    ] },
  { id: 'trainwreck', icon: '🚂', w: 3, cond: s => s.nations[s.playerId].tech.includes('railway') && s.map.provs.some(p => p.owner === s.playerId && p.bld.railway > 0), title: 'فاجعه ریلی', text: 'قطار مسافربری در پل از ریل خارج شد؛ ده‌ها کشته و رسانه‌ها حکومت را تقصیرکار می‌دانند. سهام راه‌آهن در حال فرنیفتادن است.',
    opts: [
      { label: 'جبران شکوه‌مند خسارت', hint: 'خزانه −£۲۲۰۰؛ اعتبار حفظ می‌شود', fx: { money: -2200, prestige: -1 } },
      { label: 'تحقیق و فرافکنی', hint: 'اعتبار −۴، امتیاز پژوهش +۱۵', fx: { prestige: -4, research: 15, unrestAll: 2 } },
    ] },
  { id: 'deserter', icon: '🏃', w: 5, cond: s => { const n = s.nations[s.playerId]; return n.wars.length > 0 && (s.goods.arms.fill ?? 1) < 0.7; }, title: 'سربازان فراری', text: 'کمبود سلاح سپاه را خسته کرده است؛ صدها سرباز از خط مقدم گریخته‌اند. فرماندهان خواهان تصمیم سخت‌اند.',
    opts: [
      { label: 'پاداش و جیره‌ی دوبرابر', hint: 'خزانه −£۱۵۰۰؛ روحیه برمی‌گردد', fx: { money: -1500, approval: { military: 6 } } },
      { label: 'برخوردهای سخت', hint: 'ارتش سردرگم (−۷)، ناآرامی +۵', fx: { approval: { military: -7 }, unrestAll: 5 } },
    ] },
  { id: 'plague', icon: '🦠', w: 3, cond: s => !s.nations[s.playerId].tech.includes('medicine'), title: 'طاعون ویرانگر', text: 'مغولِ بیماری‌ها چادرش را بر محله‌های تنگ برافراشته است؛ دردوم به‌شمارش مُردگان می‌نشیند. کسی چاره‌ای جدی ندارد.',
    opts: [
      { label: 'قرنطینه‌ی سخت‌گیرانه', hint: '۱۰٪ خزانه می‌رود؛ جمعیت −۱٪', fx: { moneyMult: -0.10, popLoss: 0.01, prestige: 1 } },
      { label: 'دستِ قضا', hint: 'جمعیت −۵٪؛ ناآرامی +۶؛ اعتبار −۲', fx: { popLoss: 0.05, unrestAll: 6, prestige: -2 } },
    ] },
  { id: 'aristo_ball', icon: '🥂', w: 4, title: 'مهمانی اشراف', text: 'اشراف کهنه‌پرور ضیافتی پنهانی برپا کرده‌اند و نام شما را به فهرست افتخار خوانده‌اند؛ دعوت‌نامه‌اش گران است!',
    opts: [
      { label: 'با هدیه‌ی سلطنتی حاضر شوید', hint: 'خزانه −£۱۲۰۰؛ اشراف مسرور', fx: { money: -1200, approval: { landowners: 6 } } },
      { label: 'به «مصلحت مملکت» رد کنید', hint: 'اشراف ناراضی، کارگران لبخند می‌زنند', fx: { approval: { landowners: -5, workers: 3 } } },
    ] },
  { id: 'ruin', icon: '🏛️', w: 3, cond: s => (s.week / 52) > 20, title: 'کشف بقایای کهن', text: 'کارگران هنگام حفری، تالاری از دوران باستان یافته‌اند: ستون‌ها با نگاره‌های ناشناخته. باستان‌شناسان هیجان‌زده‌اند.',
    opts: [
      { label: 'موزه‌ی ملی بسازید', hint: 'خزانه −£۲۵۰۰؛ اعتبار +۳، نوآوری +۱۲', fx: { money: -2500, prestige: 3, research: 12 } },
      { label: 'گنجینه‌ها را بفروشید', hint: 'خزانه +£۲۵۰۰؛ روشنفکران ناراضی', fx: { money: 2500, approval: { intelligentsia: -4 } } },
    ] },
  { id: 'orphan', icon: '🕊️', w: 3, title: 'صدای کودکان بی‌کفیل', text: 'پس از شورش‌ها و جنگ‌ها، خیابان‌ها از کودکان بی‌سرپرست پر شده است. خیریه‌ها گنجایش ندارند.',
    opts: [
      { label: 'بنیاد بی‌کفیلان', hint: 'خزانه −£۱۱۰۰؛ سطح زندگی +۱، کارگران مسرور', fx: { money: -1100, solAll: 1, approval: { workers: 4, clergy: 3 } } },
      { label: 'کارِ مملکت است…', hint: 'ناآرامی +۲ فعلاً', fx: { unrestAll: 2 } },
    ] },
];

// ---------------- عصرها (گشایش تدریجی در گذر زمان) ----------------
export const ERAS = [
  { name: 'طلوع صنعت', from: 1836 },
  { name: 'عصر بخار', from: 1855 },
  { name: 'عصر فولاد', from: 1875 },
  { name: 'عصر امپراتوری', from: 1890 },
];
// رشد تاریخی دستمزدها در طول قرن (اقتصاد را تدریجاً سخت‌تر می‌کند)
export const ERA_WAGES = [1, 1.10, 1.23, 1.38];
export function eraOfWeek(week) {
  const y = 1836 + week / 52;
  let e = 0;
  ERAS.forEach((x, i) => { if (y >= x.from) e = i; });
  return e;
}

// f داده‌های خانواده‌ی سلطنتی
export const FAMILY_PORTRAITS = {
  father: 'assets/family/father.jpg',
  mother: 'assets/family/mother.jpg',
  brother: 'assets/family/brother.jpg',
  sister: 'assets/family/sister.jpg',
  spouse: 'assets/family/spouse.jpg',
  son: 'assets/family/son.jpg',
  daughter: 'assets/family/daughter.jpg',
  vizier: 'assets/family/vizier.jpg',
  prince: 'assets/family/prince.jpg',
};
export const FAMILY_ROLES_FA = {
  father: 'پادشاه (پدر)', mother: 'مادر ملکه', brother: 'برادر بزرگ', sister: 'خواهر',
  spouse: 'شهبانو', son: 'ولیعهد', daughter: 'شاهدخت', vizier: 'وزیر اعظم',
};
export const SON_NAMES = ['فرهاد', 'آرش', 'بهرام', 'کاوه', 'سام', 'کیان', 'رستم', 'شاپور', 'مهرداد', 'دارا'];
export const DAUGHTER_NAMES = ['آناهیتا', 'شیرین', 'پوران', 'مهین', 'گلنار', 'ستاره', 'رعنا', 'نازلی', 'یگانه', 'بتول'];
export const GEN_NAMES = ['سرلشکر اردلان', 'سردار بهمن', 'امیر رستمی', 'سرهنگ کاویانی', 'سردار نادری', 'امیر تیموری', 'سرلشکر فرهمند', 'سردار قهرمان', 'امیر زرین', 'سردار آریا'];

// برچسب‌های گرایش بازیکن در پایان دوران شاهزادی
export const PERSONALITIES = {
  martial:  { name: 'جنگجو',      icon: '⚔️', mods: { atk: 0.06 },  desc: 'تاپ +۶٪ قدرت تهاجم ارتش' },
  scholar:  { name: 'دانش‌پژوه',  icon: '📚', mods: { innov: 2 },   desc: '+۲ نوآوری در هفته' },
  coin:     { name: 'بازرگان',    icon: '🪙', mods: { taxMult: 0.08 }, desc: '+۸٪ درآمد مالیاتی' },
  populist: { name: 'مردم‌دوست', icon: '🕊️', mods: { calm: 0.10, approval: 3 }, desc: 'آرامش بیشتر، تایید گروه‌ها +۳' },
};

// گفت‌وگو با خانواده: هر نقش، موضوعی‌ها با چند پاسخ (به‌علاوه‌ی برچسب خلق)
// t = موضوع: state (مملکت), family (خانواده), advice (توصیه), favor (درخواست یاری), chat (گپ خودمانی)
export const TALK_TOPICS = [
  { id: 'state', name: '🏛️ امور مملکت' },
  { id: 'family', name: '👨‍👩‍👧 احوال خانواده' },
  { id: 'advice', name: '💡 توصیه بخواه' },
  { id: 'favor', name: '🤲 درخواست یاری' },
  { id: 'chat', name: '☕ گپ خودمانی' },
];
export const DIALOGUES = {
  father: {
    state: ['«مملکت را پسر، با مِهر و گرما نگه می‌دارند، نه چماق… گرچه گاهی چماق لازم است.»', '«بدهی خزانه را کوچک مَشمار؛ اتشِ کوچک هم خانه را می‌سوزاند.»'],
    family: ['«تو وارث این خانه‌ای. یادت باشد تاج، سنگین‌تر از آهن است.»', '«از خواهرت غافل نشو؛ دربار بدون گندم خانواده، بی‌روح است.»'],
    advice: ['«پیش از هر تصمیم، ببین کدام گروه‌ها از آن می‌لرزند.»', '«شکوه پادشاه به صبر اوست، نه به سرعت شمشیرش.»'],
    favor: ['«هر کمکی بخواهی، تا وقتی نفس دارم کوتاه نمی‌آیم.»', '«از خزانه‌ی شخصی من گشایشی خواهی داشت.»'],
    chat: ['«جوانی من همقلب جنگ بود؛ اما این روزها باغ آرامم می‌کند.»', '«در قصر تنها من و تو از خنده‌ی موردها خبر داریم!»'],
  },
  mother: {
    state: ['«به گفتار من که مردان سلطنت را می‌چرخانند، اما زنان دربار را.»', '«دعای مادر پشتیبانِ تخت توست، فرزندم.»'],
    family: ['«غذا خورده‌ای؟ سلطنت مهم است، اما شکم سلطنت هم هست!»', '«با برادرت مهربان باش؛ رقیب است، ولی خون توست.»'],
    advice: ['«گوش به اعتراضات مردم بده پیش از آن‌که فریاد شود.»', '«همسرت را در کارها شریک کن؛ زنِ خرسند، درباری امن می‌سازد.»'],
    favor: ['«صندوق جواهراتم را می‌گشایم اگر لازم باشد.»', '«دست بازمن همیشه برای تو بسته نیست.»'],
    chat: ['«قصه‌ی دیروزت را بگو که دلم تازه شود.»', '«کودکی‌ات در همین باغ‌ها می‌گذشت… زمان چه زود گذشت.»'],
  },
  brother: {
    state: ['«بگذار ارتش را من بچینم؛ تو به امور دربار برس.»', '«همسایگان فی‌الواقع دوست نیستند؛ من فقط صادق‌ترم.»'],
    family: ['«من و تو از یک شاخه‌ایم، حتی اگر بادمان به دو سو ببرد.»', '«پدر گاهی به چشم من نگاه می‌کند گویی دنبال اشتباهی است… اهمیتی نمی‌دهم.»'],
    advice: ['«دشمن درون را جدی‌تر بگیر از دشمن بیرون.»', '«هر که امروز جلودار توست، فردا طمع تاج دارد.»'],
    favor: ['«بسته است به این‌که چقدر برایت عزیز باشم.»', '«یاری می‌کنم… ولی یادم می‌ماند.»'],
    chat: ['«تو شانس آوردی که اول به دنیا آمدی! اما خب… به هر حال برادرم.»', '«بیا شطرنج بازی کنیم؛ این بار البته شرط می‌بندم.»'],
  },
  sister: {
    state: ['«روزنامه‌چی‌ها بیشتر از وزیران حقیقت را می‌دانند؛ شاید هم بیشتر دروغ می‌گویند!»', '«من از پنجره‌ی دربار به شهر نگاه می‌کنم؛ گزارش‌هایم را نیز می‌شماریم؟»'],
    family: ['«عروسی‌ام کیست؟ نگرانم مرا به شاهزاده‌ای خشک بسپارند!»', '«مادر دیروز از خستگی گریست… با او مهربان‌تر باش.»'],
    advice: ['«مردم را خوشبخت نگه دار برادرم؛ زخم گرسنه، زخم عمیقی است.»', '«از میان دو راه بد، راهی را برگزین که قلبت را خواب بگذارد.»'],
    favor: ['«برایت هر کاری می‌کنم؛ فقط بگو.»', '«به شرط آن‌که وعده‌ی یک بازی شطرنج بدهی!»'],
    chat: ['«دیروز شاعر دربار را به زمین انداختم در دوره‌ی شعر! باید می‌گذاشتی می‌دیدی.»', '«اگر پادشاه نبودی چه می‌شدی؟ من فکر می‌کنم کتابدار درباری خوبی می‌بودی!»'],
  },
  spouse: {
    state: ['«من دوشادوست، نه پشت سریافت. کارهایت را با من در میان بگذار.»', '«دربار ما باید اعتبارش را حفظ کند؛ جهان چشم دید ندارد.»'],
    family: ['«دیروز ولیعهد اولین کلمه‌اش را گفت… "تاج"! قسم می‌خورم!»', '«خانه‌مان پناه توست، نه جنگ‌جویانت.»'],
    advice: ['«به گروه‌های ناراضی گوش بده؛ سکوتشان خطرناک‌تر است.»', '«پس‌انداز کن برای روز مبادا؛ تاریخ همیشه روی خوش نشان نمی‌دهد.»'],
    favor: ['«آن‌چه از من برآید انجام می‌دهم.»', '«جواهراتم را می‌فروشم اگر مملکت نیاز داشت.»'],
    chat: ['«امشب مهتاب زیباست؛ باغ را قدم بزنیم؟»', '«از وقتی به این قصر آمدم، فقط تو آرامشم هستی.»'],
  },
  son: {
    state: ['«بابا! وقتی بزرگ شدم، من هم ارتش می‌چینم!»', '«چرا همه از تو می‌ترسند؟ تو که مهربان‌ترینی!»'],
    family: ['«به خواهرم گفتم تاج او را من می‌پوشم، گریه کرد با خوشحالی!»', '«مامان می‌گوید من عین تو هستم… در بدخلقی!»'],
    advice: ['«معلم می‌گوید کتاب بهترین دوست است؛ من اسب را ترجیح می‌دهم!»', '«به فکر فردا باش بابا… معلم همین را یاد داده.»'],
    favor: ['«هر چه بخواهی… اگر با اسبم هم موافقت کنی!»', '«من که همه‌ی ثروتم یک سکه‌ی طلاست، ولی برای تو می‌گذارمش.»'],
    chat: ['«امروز توپخانه را دیدم؛ بم! فکر کن بزرگ شدم و توپ داشته باشم!»', '«بازی پنهان‌شدن شروع کن؟ تو اول بشمار!»'],
  },
  daughter: {
    state: ['«باباجان مردم عاشق تو هستند، خودم دیدم توی کتاب‌ها.»', '«من وقتی بزرگ شدم ملکه‌ی مهربانی می‌شوم.»'],
    family: ['«برادرم اسبش را از من سریع‌تر می‌دواند، اما من شعر بلدم!»', '«مامان گفت نگویم، اما قرار است خواهر کوچکی داشته باشیم!»'],
    advice: ['«مهربان باش؛ چشم‌های غمگین را دیدم از پنجره‌ی قصر.»', '«آدم‌ها را با شیرینی هم می‌شود نرم کرد، نه فقط سرباز.»'],
    favor: ['«عروسک‌هایم را هم داری تا می‌دهم!»', '«باشه، ولی اول قول بده قصه تعریف کنی.»'],
    chat: ['«عروسکم امروز سرد شد، دلم شکست… عصافه‌اش را دوختم!»', '«قصه‌ی دیشب را بی‌آید نگفتی! آداب بزرگ‌شدن این نیست!»'],
  },
  vizier: {
    state: ['«خزانه از هر جنگ، سست‌تر خالی می‌شود؛ فرمانروا به حساب‌ها نگاه کن.»', '«اخبار مرزنشینی‌ها را خوانده‌ام؛ وضعیت دیپلماسی شکننده است.»'],
    family: ['«خانواده‌ی سلطنتی ستون تخت است؛ ترک هر ستونی را جدی بگیرید.»', '«اعتماد برادر شما را… اندازه‌گیری کرده‌ام؛ محتاط باشید.»'],
    advice: ['«هرگز دو جنگ را با هم شروع نکنید.»', '«از آمار بترسید نه از شایعه؛ شایعه دود است، آمار آتش.»'],
    favor: ['«در خدمتم؛ منابع لازم را برآورد می‌کنم.»', '«چهره‌ها را خوب می‌شناسم؛ امضا بدهید تا گشایش شود.»'],
    chat: ['«جنابعالی امروز کمتر خسته به نظر می‌رسید؛ بشارت خوبی است.»', '«سی سال است با سه پادشاه کار کرده‌ام… اینجا قصر دیگری است.»'],
  },
};
// کلیدواژه‌های پیام آزاد بازیکن → موضوع
export const TALK_KEYWORDS = [
  ['جنگ', 'state'], ['لشکر', 'state'], ['ارتش', 'state'], ['ملک', 'state'], ['مالیات', 'state'], ['خزانه', 'state'], ['سیاست', 'state'],
  ['خانواده', 'family'], ['برادر', 'family'], ['مادر', 'family'], ['پدر', 'family'], ['بچه', 'family'], ['عشق', 'family'],
  ['چکار', 'advice'], ['توصیه', 'advice'], ['راهنمایی', 'advice'], ['چه کنم', 'advice'], ['نظر', 'advice'],
  ['پول', 'favor'], ['کمک', 'favor'], ['یاری', 'favor'], ['خواهش', 'favor'],
];
// فرمول واکنش بر اساس رابطه
export const REL_REACTIONS = {
  cold: ['(با سردی پاسخ می‌دهد)', '(به زور لبخند می‌زند)', '(به‌زحمت نگاهت می‌کند)'],
  warm: ['(گرُم لبخند می‌زند)', '(دوستانه دستت را فشار می‌دهد)', '(با علاقه گوش می‌دهد)'],
};

// ---------------- زنجیره‌ی روایی دوران شاهزادی -------------------------------
export const PROLOGUE = [
  {
    id: 'lesson', icon: '📜', img: 'assets/family/vizier.jpg', title: 'درس صغر و کبر',
    text: 'سال‌های نوجوانی است. وزیر اعظم، استاد قهاری است که فنون حکمرانی را به تو می‌آموزد. امروز می‌خواهد بداند دلت با کدام راه است…',
    opts: [
      { label: 'فن لشکرکشی را عمیق بیاموزم', hint: 'گرایش جنگجو — تهاجم ارتش +۶٪', trait: 'martial' },
      { label: 'ارقام خزانه و بازار را فرابگیرم', hint: 'گرایش بازرگان — درآمد مالیات +۸٪', trait: 'coin' },
      { label: 'زبان مردم و دلاویزان را بیاموزم', hint: 'گرایش مردم‌دوست — آرامش و تایید بیشتر', trait: 'populist' },
      { label: 'سراغ کتاب‌های حکمت و دانش بروم', hint: 'گرایش دانش‌پژوه — نوآوری هفتگی +۲', trait: 'scholar' },
    ],
  },
  {
    id: 'ride', icon: '🐎', img: 'assets/family/brother.jpg', title: 'مسابقه‌ی با برادر',
    text: 'برادر بزرگت، همیشه سایه‌ای بلند بر توست. امروز در میدان تاخت سوار بر تازه‌تَرین اسپ اردو، نگاهش به تو دوخته است. «قَرار است وارث تاج باشی یا برادرم؟»',
    opts: [
      { label: 'با تمام توان برنده شوم', hint: 'رابطه با برادر −۱۰، تایید ارتش +۴، افتخار +گرایش جنگجو', trait: 'martial', fx: { familyRel: { who: 'brother', d: -10 }, approval: { military: 4 } } },
      { label: 'اجازه بدهم برنده شود', hint: 'رابطه با برادر +۱۲، گرایش مردم‌دوست', trait: 'populist', fx: { familyRel: { who: 'brother', d: 12 } } },
    ],
  },
  {
    id: 'marry', icon: '💍', img: 'assets/family/spouse.jpg', title: 'ازدواج سلطنتی',
    text: 'دوران ازدواجت فرا رسیده است. دربار سه ولیعهد دخترِ هم‌درجه معرفی کرده؛ انتخاب تو شخصیت شهبانوی آینده و چهره‌ی دربار را رقم می‌زند…',
    opts: [
      { label: 'شهبانوی دانا و کتاب‌خوانده', hint: 'گرایش دانش‌پژوه، رابطه با همسر +۳۰', trait: 'scholar', fx: { familyRel: { who: 'spouse', d: 30 } } },
      { label: 'شهبانوی دولتمند و تدبیرگر', hint: 'گرایش بازرگان، رابطه با همسر +۳۰', trait: 'coin', fx: { familyRel: { who: 'spouse', d: 30 } } },
      { label: 'شهبانوی میدان‌دار و دلیر', hint: 'گرایش جنگجو، رابطه با همسر +۳۰', trait: 'martial', fx: { familyRel: { who: 'spouse', d: 30 } } },
    ],
  },
  {
    id: 'court', icon: '⚖️', img: 'assets/family/father.jpg', title: 'دادگاه در کنار پدر',
    text: 'پدر تو را به دیدار دادگاه برده است. دهقانی زار متهم به ربودن گوسفند اشراف است. نگاه پدر بر توست تا ببیند چگونه داوری می‌کنی…',
    opts: [
      { label: 'قانون را سخت اجرا کن', hint: 'اشراف خرسند، ناآرامی +۳، گرایش جنگجو', trait: 'martial', fx: { approval: { landowners: 5 }, unrestAll: 3 } },
      { label: 'رحم پادشاهانه بر متهم', hint: 'کارگران و روشنفکران خرسند، اشراف ناراضی، گرایش مردم‌دوست', trait: 'populist', fx: { approval: { workers: 4, intelligentsia: 3, landowners: -4 } } },
      { label: 'جریمه‌ای نقدی و آزادی', hint: 'خزانه +£۸۰۰، گرایش بازرگان', trait: 'coin', fx: { money: 800 } },
    ],
  },
  {
    id: 'sickbed', icon: '🕯️', img: 'assets/family/father.jpg', title: 'کنار بستر پدر',
    text: 'شب‌های گذشته پدر بیمار شده است و پزشکان جواب نمی‌دهند. در تاریکی اتاق کهکشانی، دستان سردش را می‌گیرد: «پسرم… این تاج، سنگین‌تر از آن است که فکرش را می‌کنی. به خانواده‌ات رسیده‌ای؟»',
    opts: [
      { label: '«قول می‌دهم بهترین فرمانروا شوم»', hint: 'اعتبار +۳ در آغاز سلطنت', trait: 'populist', fx: { prestige: 3 } },
      { label: '«مثل خودت سلطنت خواهم کرد»', hint: 'رابطه با خانواده +۶', trait: 'scholar', fx: { familyRelAll: 6 } },
      { label: '«سرت نگران اقتصاد نباش»', hint: 'گرایش بازرگان', trait: 'coin' },
    ],
  },
  {
    id: 'crown', icon: '👑', img: 'assets/family/prince.jpg', title: 'تاج‌گذاری',
    text: 'پدر به ملکوت پیوست. صدای شیپور در برج‌های قصر می‌پیچد و دربار زانو بر زمین می‌گذارد. امروز، تاج پادشاهی بر سر توست. دوران حکومتت از همین لحظه آغاز می‌شود…',
    opts: [
      { label: 'تاج بر سر نهم', hint: 'آغاز حکومت — شخصیت تو بر اساس انتخاب‌هایت شکل گرفت', fx: { coronation: true } },
    ],
  },
];

export const PROV_SYLL_A = ['کاش', 'سور', 'مهر', 'تیر', 'بار', 'شاه', 'رود', 'گُل', 'نار', 'دشت', 'کیش', 'سار', 'ور', 'مان', 'فر', 'راز', 'هوم', 'بال', 'ژاو', 'کوه', 'نی', 'زر', 'پار', 'لاد', 'آبا', 'چنار', 'برف', 'سیم'];
export const PROV_SYLL_B = ['ستان', 'آباد', 'گران', 'مر', 'دین', 'نار', 'سار', 'خان', 'بور', 'شهر', 'رود', 'گرد', 'لان', 'پور', 'ده', 'کلا', 'وند', 'جرد', 'ماز', 'تان'];

// ---------------- مأموریت‌ها (ژورنال) ----------------
// prog(state, helpers) → {cur, max} ؛ reward متنی است
export const MISSIONS = [
  { id: 'smoke', icon: '🏭', title: 'نخستین دود', desc: 'داشتن ۵ سطح کارخانه شهری (نساجی، ابزار، مبلمان، سلاح، فولاد، بلور)', reward: { money: 1500, prestige: 2 },
    prog: (S, h, n) => ({ cur: h.countBld(S, n, ['textile', 'tool_work', 'furniture', 'arms_ind', 'steel_mill', 'glasswork']), max: 5 }) },
  { id: 'granary', icon: '🌾', title: 'انبار امپراتوری', desc: 'داشتن ۱۴ سطح مزرعه و دامداری', reward: { money: 1200, prestige: 2 },
    prog: (S, h, n) => ({ cur: h.countBld(S, n, ['farm', 'ranch']), max: 14 }) },
  { id: 'lamp', icon: '🎓', title: 'چراغ دانش', desc: 'ساختن ۴ دانشگاه', reward: { money: 800, research: 60, prestige: 2 },
    prog: (S, h, n) => ({ cur: h.countBld(S, n, ['university']), max: 4 }) },
  { id: 'harbor', icon: '⚓', title: 'استادِ اسکله', desc: 'داشتن ۴ بندر', reward: { money: 1500, prestige: 3 },
    prog: (S, h, n) => ({ cur: h.countBld(S, n, ['port']), max: 4 }) },
  { id: 'ironroad', icon: '🚂', title: 'راه‌آهن سراسری', desc: 'داشتن ۳ خط راه‌آهن', reward: { money: 2000, prestige: 4 },
    prog: (S, h, n) => ({ cur: h.countBld(S, n, ['railway']), max: 3 }) },
  { id: 'ironarmy', icon: '🪖', title: 'ارتش آهنین', desc: 'داشتن ۱۲ گردان آماده', reward: { prestige: 3 },
    prog: (S, h, n) => ({ cur: Math.round(n.battalions + h.fielded(S, n.id)), max: 12 }) },
  { id: 'welfare', icon: '😊', title: 'تمدن بزرگ', desc: 'رساندن میانگین امید به زندگی به ۱۷', reward: { prestige: 5, solAll: 1 },
    prog: (S, h, n) => ({ cur: Math.round(h.avgSol(S, n.id)), max: 17 }) },
  { id: 'readers', icon: '📖', title: 'طبقه‌ی خوانده', desc: 'رساندن سواد به ۴۰٪', reward: { prestige: 3, approval: { intelligentsia: 6 } },
    prog: (S, h, n) => ({ cur: Math.round(n.literacy || 0), max: 40 }) },
  { id: 'indtech', icon: '⚙️', title: 'مهندسِ عصر', desc: 'کشف ۴ فناوری صنعتی', reward: { money: 1500, prestige: 3 },
    prog: (S, h, n) => ({ cur: n.tech.filter(t => TECHS[t].br === 'ind').length, max: 4 }) },
  { id: 'pacts', icon: '🤝', title: 'هم‌پیمان بزرگ', desc: 'داشتن ۲ پیمان فعال (تجاری یا اتحاد)', reward: { prestige: 3, money: 500 },
    prog: (S, h, n) => ({ cur: Object.keys(n.pacts).length, max: 2 }) },
  { id: 'conqueror', icon: '🏴‍☠️', title: 'فتح‌نامه', desc: 'الحاق یک استان در جنگ', reward: { prestige: 5 },
    prog: (S, h, n) => ({ cur: n.annexed || 0, max: 1 }) },
  { id: 'top', icon: '👑', title: 'قدرت برتر', desc: 'رسیدن به رتبه‌ی ۱ اعتبار جهان', reward: { prestige: 8, money: 3000 },
    prog: (S, h, n) => ({ cur: h.rankOf(S, n.id) === 1 ? 1 : 0, max: 1 }) },
];

// رویداد ساختگی انتخابات (هر ~۴ سال برای حکومت‌های مشروطه/جمهوری)
export const ELECTION_EVENT = {
  id: 'election', icon: '🗳️', w: 0, title: 'انتخابات عمومی',
  text: 'موعد انتخابات رسیده است. احزاب میدان برای مجلس دست‌وپنجه نرم می‌کنند و تبلیغات شهر را پر کرده. دولت شما می‌تواند از یک سو حمایت کند.',
  opts: [
    { label: 'حمایت از محافظه‌کاران', hint: 'اشراف و ارتش خرسند، روشنفکران ناراضی', fx: { approval: { landowners: 6, military: 4, intelligentsia: -5 }, elect: 'con' } },
    { label: 'حمایت از آزادی‌خواهان', hint: 'روشنفکران و صنعتگران خرسند، اشراف ناراضی', fx: { approval: { intelligentsia: 6, industrialists: 5, landowners: -5 }, elect: 'lib' } },
    { label: 'حمایت از کارگران', hint: 'کارگران خرسند، صنعتگران ناراضی', fx: { approval: { workers: 8, industrialists: -6 }, elect: 'soc' } },
  ],
};
