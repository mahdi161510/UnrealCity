// ---------- خطوط زمانی، سناریوها، درجه‌های سختی و تعریف ملت‌های واقعی ----------

// درجه‌های سختی
// aiThink: فاصله‌ی فکر AI (کمتر = باهوش‌تر) | aiAggr: پرخاشگری AI
// popGrowth: رشد جمعیت | priceVol: نوسان قیمت | upkeep: هزینه‌ی نگهداری
// startMoney: ضریب خزانه‌ی آغازین | unrestBias: سخت‌گیری مردم
// eventFreq: بسامد رویدادها | noSpeed: فقط پاز/آن‌پاز
export const DIFFICULTIES = [
  { id: 'easy',   name: 'آسان',      icon: '🍃', desc: 'تجربه‌ای روان؛ اقتصاد آسان‌تر و همسایگان مهربان‌تر',
    mods: { aiThink: 10, aiAggr: 0.5,  popGrowth: 1.30, priceVol: 0.7,  upkeep: 0.7,  startMoney: 1.4,  unrestBias: -4, eventFreq: 1.3 } },
  { id: 'normal', name: 'معمولی',    icon: '⚖️', desc: 'تعادل کلاسیک؛ همان‌طور که تاریخ رقم خورد',
    mods: { aiThink: 6,  aiAggr: 1.0,  popGrowth: 1.00, priceVol: 1.0,  upkeep: 1.0,  startMoney: 1.0,  unrestBias: 0,  eventFreq: 1.0 } },
  { id: 'hard',   name: 'سخت',       icon: '🔥', desc: 'AI باهوش‌تر، مردم سخت‌گیرتر، اقتصاد پیچیده‌تر',
    mods: { aiThink: 4,  aiAggr: 1.6,  popGrowth: 0.80, priceVol: 1.35, upkeep: 1.25, startMoney: 0.75, unrestBias: 5,  eventFreq: 0.85 } },
  { id: 'legend', name: 'افسانه‌ای', icon: '💀', desc: 'سخت‌ترین تجربه؛ تایم فقط پاز/آن‌پاز — سرعت‌بخشی غیرفعال است',
    mods: { aiThink: 3,  aiAggr: 2.2,  popGrowth: 0.65, priceVol: 1.6,  upkeep: 1.5,  startMoney: 0.55, unrestBias: 10, eventFreq: 0.7, noSpeed: true } },
];

// ---------- خطوط زمانی ----------
export const TIMELINES = [
  {
    id: 'victoria', name: 'ویکتوریا فانتزی ۱۸۳۶', icon: '👑', year: 1836, endYear: 1900, mapKind: 'fantasy',
    tagline: 'عصر بخار و امپراتوری — جهان خیالی آریان',
    desc: 'جهانِ خیالیِ ده قدرت در آستانه‌ی انقلاب صنعتی. چندین سناریوی آغازین.',
    genNames: null, // از data.js (GEN_NAMES) استفاده می‌شود
    scenarios: [
      { id: 'balance', name: 'توازن امپراتوری‌ها', icon: '⚖️',
        desc: 'تجربه‌ی کلاسیک؛ ده قدرت فانتزی با فرصت‌های برابر. هر ملتی را برگزینید.',
        mods: {} },
      { id: 'persia', name: 'رستاخیز آریان', icon: '🏛️',
        desc: 'شاهنشاهی آریان پس از سال‌ها افول، سر برمی‌آورد. رقبا تشنه‌ی خون‌اند؛ آریان را برگزینید.',
        lockedNation: 0, mods: { treasuryMult: 1.25, aiAggr: 1.2, unrestBias: 2 } },
      { id: 'machine', name: 'عصر ماشین', icon: '🏭',
        desc: 'کارخانه‌ها از پیش روشن‌اند اما خزانه خالی است و رقبا تند پیش می‌روند. اقتصاد را نجات دهید.',
        mods: { industry: true, treasuryMult: 0.6, researchStart: 40, aiSmart: 1.3 } },
      { id: 'ironstorm', name: 'طوفان آهنین', icon: '⚔️',
        desc: 'همه‌ی ملت‌ها جنگجو شده‌اند و مرزها شعله می‌کشند. زنده بمانید و مسلط شوید.',
        mods: { allAggressive: true, aiAggr: 1.8, treasuryMult: 1.1 } },
    ],
    intro: null,
  },
  {
    id: 'ww1', name: 'جنگ جهانی اول ۱۹۱۴', icon: '🎖️', year: 1914, endYear: 1919, mapKind: 'real',
    tagline: 'جنگ بزرگ — نقشه‌ی واقعی جهان',
    desc: 'اوت ۱۹۱۴. اروپا به آتش کشیده شده. با یکی از قدرت‌های بزرگ وارد معرکه شوید.',
    genNames: ['ژنرال فون کلر', 'فیلدمارشال هارتمن', 'ژنرال رومانوف', 'سردار کارادنیز', 'ژنرال شارف', 'مارشال وایت', 'ژنرال یاماموتو', 'سردار برینگ', 'ژنرال وِبر', 'فیلدمارشال لینده'],
    intro: {
      id: 'tl_ww1', icon: '🎖️',
      title: 'جنگ بزرگ شعله‌ور شد',
      text: 'تابستان ۱۹۱۴. پس از ترور آرشیدوک، زنجیره‌ی پیمان‌ها جهان را به آتش کشید. شیپورهای بسیج در پایتخت‌ها طنین‌انداز است و هیچ‌کس نمی‌داند این طوفان تا کجا خواهد راند. فرمانروای شما باید راهِ این ملت را در میان خون و بخار برگزیند.',
      t2: 'خب، جنگ جهانی شروع شده! همه‌جا خبر از جنگ و بسیجه. حالا تو باید تصمیم بگیری کشورت توی این غائله چی کار کنه.',
      opts: [
        { label: 'بسیج عمومی و تسلیح فوری', hint: '۴ گردان تازه، خزانه −£۱۵۰۰، ناآرامی +۵', fx: { army: 4, money: -1500, unrestAll: 5 } },
        { label: 'بی‌طرفی مسلحانه', hint: '۲ گردان تازه، اعتبار +۲', fx: { army: 2, prestige: 2 } },
      ],
    },
    nations: [
      { key: 'GBR', name: 'بریتانیا', adj: 'بریتانیایی', ruler: 'پادشاه جرج پنجم', pers: 'balanced', c1: '#a93226', c2: '#eceff4', flag: { style: 'v2', emblem: 'star' }, regions: ['GBR', 'IRL'], capital: 'لندن', desc: 'امپراتوری‌ای که آفتاب در آن غروب نمی‌کند؛ ناوگان و زر و سرمایه.' },
      { key: 'FRA', name: 'فرانسه', adj: 'فرانسوی', ruler: 'رئیس‌جمهور پوانکاره', pers: 'balanced', c1: '#2e4fa8', c2: '#f2f4f8', flag: { style: 'v3', emblem: 'star' }, regions: ['FRA'], capital: 'پاریس', desc: 'جمهوری بزرگ با ارتشی آماده‌ی انتقام.' },
      { key: 'GER', name: 'آلمان', adj: 'آلمانی', ruler: 'قیصر ویلهلم دوم', pers: 'aggressive', c1: '#2f2f35', c2: '#e8e4d8', flag: { style: 'h3', emblem: 'mountain' }, regions: ['GER'], capital: 'برلین', desc: 'امپراتوری تازه‌نفس؛ فولاد، علوم و جاه‌طلبی بی‌پایان.' },
      { key: 'RUS', name: 'روسیه', adj: 'روسی', ruler: 'تزار نیکولای دوم', pers: 'aggressive', c1: '#3a5f8a', c2: '#f0e9d2', flag: { style: 'h2', emblem: 'crescent' }, regions: ['RUS', 'FIN', 'BAL', 'POL', 'KAZ'], capital: 'مسکو', desc: 'غول اوراسیا؛ سپاهی بی‌پایان اما خزانه‌ای لرزان.' },
      { key: 'AUT', name: 'اتریش-مجارستان', adj: 'اتریشی', ruler: 'امپراتور فرانتس یوزف', pers: 'balanced', c1: '#8a3a2f', c2: '#efe6d4', flag: { style: 'h2', emblem: 'sun' }, regions: ['AUT', 'HUN', 'CZE', 'YUG'], capital: 'وین', desc: 'امپراتوری چندملیتی کهن در برابر سیل ناسیونالیسم.' },
      { key: 'ITA', name: 'ایتالیا', adj: 'ایتالیایی', ruler: 'پادشاه ویکتور امانوئل', pers: 'balanced', c1: '#2e8a4e', c2: '#f2f0e8', flag: { style: 'v3', emblem: 'sun' }, regions: ['ITA'], capital: 'رم', desc: 'پادشاهی جوان با رویاهای امپراتوری در مدیترانه.' },
      { key: 'TUR', name: 'امپراتوری عثمانی', adj: 'عثمانی', ruler: 'سلطان محمد پنجم', pers: 'aggressive', c1: '#7c2f39', c2: '#e9dcc2', flag: { style: 'h2', emblem: 'crescent' }, regions: ['TUR', 'LEV', 'IRQ', 'ARB', 'EGY'], capital: 'استانبول', desc: 'مرد بیمار اروپا؛ اما هنوز اربابِ تنگه‌ها و خاورمیانه.' },
      { key: 'USA', name: 'آمریکا', adj: 'آمریکایی', ruler: 'پرزیدنت ویلسون', pers: 'peaceful', c1: '#274a78', c2: '#c0392b', flag: { style: 'h3', emblem: 'star' }, regions: ['USA'], capital: 'واشنگتن', desc: 'قدرت نوظهور آنسوی اقیانوس؛ سرمایه و صنعت بی‌نهایت.' },
      { key: 'JPN', name: 'ژاپن', adj: 'ژاپنی', ruler: 'امپراتور تایشو', pers: 'aggressive', c1: '#b03a3a', c2: '#f4f4f4', flag: { style: 'h2', emblem: 'sun' }, regions: ['JPN', 'KOR', 'TWN'], capital: 'توکیو', desc: 'جزیره‌ی سامورایی‌ها که ارتشش مدرن‌ترین آسیاست.' },
      { key: 'CHN', name: 'چین', adj: 'چینی', ruler: 'رئیس‌جمهور یوان شیکای', pers: 'balanced', c1: '#b0873a', c2: '#eae2cc', flag: { style: 'h3', emblem: 'tree' }, regions: ['CHN', 'MAN', 'MON'], capital: 'پکن', desc: 'امپراتوری میانه در هرج‌ومرج؛ جمعیتی که تاریخ را می‌سازد.' },
    ],
  },
  {
    id: 'ww2', name: 'جنگ جهانی دوم ۱۹۳۸', icon: '💥', year: 1938, endYear: 1950, mapKind: 'real',
    tagline: 'طوفان فولاد — نقشه‌ی واقعی جهان',
    desc: 'آستانه‌ی جنگ. دیکتاتورها مسلح می‌شوند و دموکراسی‌ها تردید دارند. جهان را نجات دهید یا تسخیر کنید.',
    genNames: ['ژنرال اشتاینر', 'فیلدمارشال کروگر', 'ژنرال واسیلیف', 'سردار رضایی', 'ژنرال مک‌کلود', 'مارشال چن', 'ژنرال تاناکا', 'ژنرال مانتین', 'فیلدمارشال وِس', 'ژنرال کوردو'],
    intro: {
      id: 'tl_ww2', icon: '💥',
      title: 'ابرهای طوفان',
      text: 'پاییز ۱۹۳۸. آلمان سرزمین‌ها را یکی پس از دیگری می‌بلعد و جهان تماشا می‌کند. راديوها از «صلحِ نسلِ ما» می‌گویند اما بوی باروت از شرق می‌آید. فرمانروای شما میان تسلیح و دیپلماسی باید راه خود را بیابد.',
      t2: 'اوضاع خرابه! آلمان داره کشورها رو یکی‌یکی قورت می‌ده و دنیا هم فقط نگاه می‌کنه. حالا تو باید تصمیم بگیری: ارتش بسازی یا سیاست بازی کنی؟',
      opts: [
        { label: 'تسلیح مجدد فوری', hint: '۴ گردان تازه، خزانه −£۲۰۰۰، اعتبار +۱', fx: { army: 4, money: -2000, prestige: 1 } },
        { label: 'دیپلماسی و پیمان‌ها', hint: 'روابط با همه +۱۰، اعتبار +۳', fx: { relAll: 10, prestige: 3 } },
      ],
    },
    nations: [
      { key: 'GER', name: 'آلمان', adj: 'آلمانی', ruler: 'پیشوا آدولف هیتلر', pers: 'aggressive', c1: '#3a3a3a', c2: '#c0392b', flag: { style: 'h2', emblem: 'scimitar' }, regions: ['GER', 'AUT', 'CZE'], capital: 'برلین', desc: 'رایش سوم؛ بلیتزکریگ، پانزر و جاه‌طلبی بی‌کران.' },
      { key: 'UK', name: 'بریتانیا', adj: 'بریتانیایی', ruler: 'نخست‌وزیر چمبرلن', pers: 'balanced', c1: '#a93226', c2: '#eceff4', flag: { style: 'v2', emblem: 'star' }, regions: ['GBR', 'IRL'], capital: 'لندن', desc: 'جزیره‌ای تسخیرناپذیر؛ ناوگان و امپراتوری.' },
      { key: 'FRA', name: 'فرانسه', adj: 'فرانسوی', ruler: 'رئیس‌جمهور لبرن', pers: 'balanced', c1: '#2e4fa8', c2: '#f2f4f8', flag: { style: 'v3', emblem: 'star' }, regions: ['FRA'], capital: 'پاریس', desc: 'جمهوری با خط دفاعی آهنین و روحی خسته.' },
      { key: 'ITA', name: 'ایتالیا', adj: 'ایتالیایی', ruler: 'دوسه موسولینی', pers: 'aggressive', c1: '#2e8a4e', c2: '#f2f0e8', flag: { style: 'v3', emblem: 'sun' }, regions: ['ITA'], capital: 'رم', desc: 'امپراتوری رومِ نو در مدیترانه.' },
      { key: 'USSR', name: 'شوروی', adj: 'شوروی', ruler: 'مارشال استالین', pers: 'aggressive', c1: '#8c2f2f', c2: '#f0e9d2', flag: { style: 'h2', emblem: 'star' }, regions: ['RUS', 'FIN', 'BAL', 'KAZ', 'MON'], capital: 'مسکو', desc: 'امپراتوری سرخ؛ میلیون‌ها سرباز و صنایع اورال.' },
      { key: 'USA', name: 'آمریکا', adj: 'آمریکایی', ruler: 'پرزیدنت روزولت', pers: 'peaceful', c1: '#274a78', c2: '#c0392b', flag: { style: 'h3', emblem: 'star' }, regions: ['USA'], capital: 'واشنگتن', desc: 'آرسنال دموکراسی؛ اقتصاد که جهان را می‌چرخاند.' },
      { key: 'JPN', name: 'ژاپن', adj: 'ژاپنی', ruler: 'امپراتور هیروهیتو', pers: 'aggressive', c1: '#b03a3a', c2: '#f4f4f4', flag: { style: 'h2', emblem: 'sun' }, regions: ['JPN', 'KOR', 'TWN', 'MAN'], capital: 'توکیو', desc: 'امپراتوری خورشید؛ ناوگان اقیانوس آرام.' },
      { key: 'CHN', name: 'چین', adj: 'چینی', ruler: 'ژنرالیسیمو چیانگ کای‌شک', pers: 'balanced', c1: '#b0873a', c2: '#eae2cc', flag: { style: 'h3', emblem: 'tree' }, regions: ['CHN'], capital: 'پکن', desc: 'ملتِ کهن در آتش تهاجم؛ مقاومت بی‌پایان.' },
      { key: 'POL', name: 'لهستان', adj: 'لهستانی', ruler: 'مارشال ریدز-اشمیگلی', pers: 'balanced', c1: '#a8a8b0', c2: '#c0392b', flag: { style: 'h2', emblem: 'horse' }, regions: ['POL'], capital: 'ورشو', desc: 'سواره‌نظامی که میان دو گرگ ایستاده است.' },
      { key: 'TUR', name: 'ترکیه', adj: 'ترکی', ruler: 'آتاتورک', pers: 'peaceful', c1: '#8c2f39', c2: '#f2e9d2', flag: { style: 'h2', emblem: 'crescent' }, regions: ['TUR'], capital: 'آنکارا', desc: 'جمهوری تازه‌نفس بر ویرانه‌ی امپراتوری؛ پل میان دو جهان.' },
    ],
  },
  {
    id: 'modern', name: 'دنیای مدرن ۲۰۲۶', icon: '🌐', year: 2026, endYear: 2040, mapKind: 'real',
    tagline: 'هیپرپاورها و بحران — نقشه‌ی واقعی جهان',
    desc: 'قرن بیست‌ویکم: اقتصاد دیجیتال، ابرقدرت‌های تازه و تنش‌های جهانی. جهان را رهبری کنید.',
    genNames: ['ژنرال وولکوف', 'ژنرال پارسا', 'سردار تهرانی', 'ژنرال مک‌لین', 'مارشال لی', 'ژنرال تاناکا', 'ژنرال کروز', 'فیلدمارشال هیل', 'ژنرال آدمو', 'سردار یامادا'],
    intro: {
      id: 'tl_modern', icon: '🌐',
      title: 'دنیای مدرن',
      text: 'سال ۲۰۲۶. اقتصادها به داده و انرژی گره خورده‌اند؛ ابرقدرت‌ها در شبکه‌ی پیچیده‌ای از وابستگی و رقابت‌اند. رسانه‌ها از بحران انرژی و تنش در چند نقطه‌ی جهان می‌گویند. اکنون، رهبری کشورتان در دستان شماست.',
      t2: 'سلام! الان سال ۲۰۲۶هست؛ دنیای مدرن با اینترنت و انرژی و کلی رقابت جهانی. حالا تو رهبر کشورت هستی و باید اقتصاد و ارتش رو مدیریت کنی. بریم شروع کنیم!',
      opts: [
        { label: 'سرمایه‌گذاری در فناوری', hint: 'امتیاز پژوهش +۳۰، خزانه −£۱۵۰۰', fx: { research: 30, money: -1500 } },
        { label: 'نوسازی ارتش', hint: '۳ گردان تازه، خزانه −£۱۵۰۰', fx: { army: 3, money: -1500 } },
      ],
    },
    nations: [
      { key: 'USA', name: 'آمریکا', adj: 'آمریکایی', ruler: 'پرزیدنت مارکوس کین', pers: 'balanced', c1: '#274a78', c2: '#c0392b', flag: { style: 'h3', emblem: 'star' }, regions: ['USA'], capital: 'واشنگتن', desc: 'ابرقدرت اقتصادی و نظامی؛ دره‌ی سیلیکون و ناوگان جهانی.' },
      { key: 'CHN', name: 'چین', adj: 'چینی', ruler: 'مارشال لی وِی', pers: 'aggressive', c1: '#b03a2f', c2: '#f2d24a', flag: { style: 'h2', emblem: 'star' }, regions: ['CHN', 'MAN', 'TWN'], capital: 'پکن', desc: 'کارخانه‌ی جهان؛ ابرقدرت در حال صعود.' },
      { key: 'RUS', name: 'روسیه', adj: 'روسی', ruler: 'ژنرال ایوان وولکوف', pers: 'aggressive', c1: '#3a5f8a', c2: '#f0e9d2', flag: { style: 'h2', emblem: 'crescent' }, regions: ['RUS'], capital: 'مسکو', desc: 'موشک‌ها، نفت و روحیه‌ی مقاومت.' },
      { key: 'GBR', name: 'بریتانیا', adj: 'بریتانیایی', ruler: 'نخست‌وزیر هلن بریج', pers: 'balanced', c1: '#a93226', c2: '#eceff4', flag: { style: 'v2', emblem: 'star' }, regions: ['GBR', 'IRL'], capital: 'لندن', desc: 'مرکز مالی اروپا؛ سیتی و میراث امپراتوری.' },
      { key: 'FRA', name: 'فرانسه', adj: 'فرانسوی', ruler: 'رئیس‌جمهور الکساندر مارسو', pers: 'balanced', c1: '#2e4fa8', c2: '#f2f4f8', flag: { style: 'v3', emblem: 'star' }, regions: ['FRA'], capital: 'پاریس', desc: 'قدرت هسته‌ای و دیپلماسی اروپایی.' },
      { key: 'GER', name: 'آلمان', adj: 'آلمانی', ruler: 'مستشار کلاوس راینهارت', pers: 'balanced', c1: '#2f2f35', c2: '#e8e4d8', flag: { style: 'h3', emblem: 'mountain' }, regions: ['GER', 'AUT', 'CHE', 'BEN'], capital: 'برلین', desc: 'موتور اقتصادی اروپا؛ مهندسی و صادرات.' },
      { key: 'JPN', name: 'ژاپن', adj: 'ژاپنی', ruler: 'نخست‌وزیر کنجی تاناکا', pers: 'balanced', c1: '#b03a3a', c2: '#f4f4f4', flag: { style: 'h2', emblem: 'sun' }, regions: ['JPN'], capital: 'توکیو', desc: 'فناوری پیشرفته و نظم اجتماعی.' },
      { key: 'IND', name: 'هند', adj: 'هندی', ruler: 'نخست‌وزیر آرون مالهوترا', pers: 'peaceful', c1: '#e08a2e', c2: '#f4f4f4', flag: { style: 'h2', emblem: 'sun' }, regions: ['IND', 'PAK', 'BUR'], capital: 'دهلی', desc: 'پرتراکم‌ترین دموکراسی؛ نرم‌افزار و جمعیت جوان.' },
      { key: 'IRN', name: 'ایران', adj: 'ایرانی', ruler: 'ژنرال آرش پارسا', pers: 'balanced', c1: '#2e7d4e', c2: '#d43b3b', flag: { style: 'h3', emblem: 'crescent' }, regions: ['IRN'], capital: 'تهران', desc: 'چهارراه انرژی خاورمیانه؛ تمدنی با هزاران سال تاریخ.' },
      { key: 'TUR', name: 'ترکیه', adj: 'ترکی', ruler: 'رئیس‌جمهور دمیر آتالای', pers: 'balanced', c1: '#8c2f39', c2: '#f2e9d2', flag: { style: 'h2', emblem: 'crescent' }, regions: ['TUR'], capital: 'آنکارا', desc: 'پل آسیا و اروپا؛ قدرت میانه‌ی منطقه.' },
      { key: 'BRA', name: 'برزیل', adj: 'برزیلی', ruler: 'رئیس‌جمهور رافائل مندس', pers: 'peaceful', c1: '#2e8a4e', c2: '#f2d24a', flag: { style: 'h2', emblem: 'star' }, regions: ['BRA'], capital: 'برازیلیا', desc: 'آمازون و آهن؛ غول کشاورزی جهان.' },
      { key: 'KOR', name: 'کره‌ی جنوبی', adj: 'کره‌ای', ruler: 'رئیس‌جمهور پارک جی-هون', pers: 'balanced', c1: '#274a78', c2: '#f2f4f8', flag: { style: 'h2', emblem: 'sun' }, regions: ['KOR'], capital: 'سئول', desc: 'نیمه‌رسانا و کی‌پاپ؛ اقتصاد تیغ‌زبان.' },
      { key: 'ARB', name: 'عربستان', adj: 'سعودی', ruler: 'ملک فیصل بن خالد', pers: 'peaceful', c1: '#2e6e4e', c2: '#e9e4d8', flag: { style: 'h2', emblem: 'scimitar' }, regions: ['ARB', 'IRQ', 'LEV'], capital: 'ریاض', desc: 'سلطان نفت؛ خزانه‌ای که بازارها را می‌لرزاند.' },
      { key: 'EGY', name: 'مصر', adj: 'مصری', ruler: 'رئیس‌جمهور عبدالرحمن قندیل', pers: 'balanced', c1: '#b08d3c', c2: '#d43b3b', flag: { style: 'h3', emblem: 'crescent' }, regions: ['EGY'], capital: 'قاهره', desc: 'کانال سوئز و قلب جهان عرب.' },
    ],
  },
];

// ملتِ پرکننده برای منطقه‌های بدون صاحب در خطوط زمانی واقعی
export const OTHER_NATION = {
  key: 'OTHER', name: 'کشورهای دیگر', adj: 'بی‌طرف', ruler: '—', pers: 'peaceful',
  c1: '#8a8578', c2: '#6b665c', flag: { style: 'h2', emblem: 'tree' },
  regions: [], capital: null, desc: 'مجموعه‌ی کشورهای بی‌طرف و کوچک.',
};

export function timelineById(id) { return TIMELINES.find(t => t.id === id) || TIMELINES[0]; }
export function difficultyById(id) { return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1]; }
