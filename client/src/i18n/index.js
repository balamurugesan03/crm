import { create } from 'zustand';

const STORAGE_KEY = 'nexuscrm-lang';

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
];

const DICT = {
  en: {},
  ta: {
    // Navigation sections
    'nav.Workspace': 'பணியிடம்',
    'nav.CRM': 'CRM',
    'nav.Sales': 'விற்பனை',
    'nav.Engage': 'தொடர்பு',
    'nav.Finance': 'நிதி',
    'nav.Receivables': 'பெற வேண்டியவை',
    'nav.GST returns': 'GST தாக்கல்',
    // Navigation items
    'nav.Dashboard': 'முகப்பு',
    'nav.Calendar': 'நாட்காட்டி',
    'nav.Tasks': 'பணிகள்',
    'nav.Leads': 'வாய்ப்புகள்',
    'nav.Deals': 'ஒப்பந்தங்கள்',
    'nav.Contacts': 'தொடர்புகள்',
    'nav.Companies': 'நிறுவனங்கள்',
    'nav.Products': 'பொருட்கள்',
    'nav.Quotes': 'விலைப்புள்ளிகள்',
    'nav.Invoices': 'விலைப்பட்டியல்கள்',
    'nav.Targets': 'இலக்குகள்',
    'nav.Reports': 'அறிக்கைகள்',
    'nav.Tickets': 'ஆதரவு கோரிக்கைகள்',
    'nav.Campaigns': 'பிரச்சாரங்கள்',
    'nav.Web forms': 'வலை படிவங்கள்',
    'nav.Automations': 'தானியக்கங்கள்',
    'nav.Settings': 'அமைப்புகள்',
    // Header
    'header.search': 'பதிவுகளைத் தேடு…',
    'header.create': 'உருவாக்கு',
    'header.quickCreate': 'விரைவாக உருவாக்கு',
    'header.askAi': 'AI-யிடம் கேள்',
    'header.myProfile': 'என் சுயவிவரம்',
    'header.settings': 'அமைப்புகள்',
    'header.platformAdmin': 'தள நிர்வாகம்',
    'header.logout': 'வெளியேறு',
    'header.language': 'மொழி',
    'create.Lead': 'வாய்ப்பு',
    'create.Deal': 'ஒப்பந்தம்',
    'create.Contact': 'தொடர்பு',
    'create.Task': 'பணி',
    'create.Meeting': 'சந்திப்பு',
    'create.Ticket': 'ஆதரவு கோரிக்கை',
    // Dashboard
    'dash.goodMorning': 'காலை வணக்கம்',
    'dash.goodAfternoon': 'மதிய வணக்கம்',
    'dash.goodEvening': 'மாலை வணக்கம்',
    'dash.calendar': 'நாட்காட்டி',
    'dash.openPipeline': 'பைப்லைனைத் திற',
    'dash.pipelineValue': 'பைப்லைன் மதிப்பு',
    'dash.wonThisMonth': 'இந்த மாத வெற்றி',
    'dash.newLeads': 'புதிய வாய்ப்புகள்',
    'dash.tasksDueToday': 'இன்றைய பணிகள்',
    'dash.vsLastMonth': 'கடந்த மாதத்துடன்',
    'dash.thisMonth': 'இந்த மாதம்',
    'dash.overdue': 'தாமதமானவை',
    'dash.nothingOverdue': 'தாமதம் எதுவும் இல்லை',
    'dash.weighted': 'எடையிட்ட',
    'dash.deals': 'ஒப்பந்தங்கள்',
    'dash.revenueTrend': 'வருவாய் போக்கு',
    'dash.last6Months': 'கடந்த 6 மாதங்கள்',
    'dash.winRate': 'வெற்றி விகிதம்',
    'dash.closedWon': 'வென்றவை',
    'dash.pipelineByStage': 'நிலை வாரியாக பைப்லைன்',
    'dash.topPerformers': 'சிறந்த செயல்பாட்டாளர்கள்',
    'dash.hotLeads': 'சூடான வாய்ப்புகள்',
    'dash.upcomingMeetings': 'வரவிருக்கும் சந்திப்புகள்',
    'dash.myTasks': 'என் பணிகள்',
    'dash.needsAttention': 'கவனம் தேவைப்படும் ஒப்பந்தங்கள்',
    'dash.recentActivity': 'சமீபத்திய செயல்பாடுகள்',
    'dash.viewAll': 'அனைத்தையும் காண்க',
    'dash.atRisk': 'ஆபத்தில்',
    // Portal
    'portal.title': 'வாடிக்கையாளர் தளம்',
    'portal.welcome': 'வரவேற்கிறோம்',
    'portal.support': 'ஆதரவு',
    'portal.invoices': 'விலைப்பட்டியல்கள்',
    'portal.quotes': 'விலைப்புள்ளிகள்',
    'portal.yourRequests': 'உங்கள் ஆதரவு கோரிக்கைகள்',
    'portal.newRequest': 'புதிய கோரிக்கை',
    'portal.noRequests': 'இதுவரை கோரிக்கைகள் இல்லை. உதவி தேவையா? புதிய கோரிக்கையை உருவாக்குங்கள்.',
    'portal.subject': 'தலைப்பு',
    'portal.describe': 'பிரச்சினையை விவரிக்கவும்',
    'portal.priority': 'முன்னுரிமை',
    'portal.submit': 'சமர்ப்பி',
    'portal.cancel': 'ரத்து',
    'portal.reply': 'பதில் எழுதுங்கள்…',
    'portal.send': 'அனுப்பு',
    'portal.allRequests': 'அனைத்து கோரிக்கைகளும்',
    'portal.view': 'பார்',
    'portal.viewPay': 'பார்த்து செலுத்து',
    'portal.accept': 'ஏற்கிறேன்',
    'portal.decline': 'நிராகரி',
    'portal.outstanding': 'நிலுவைத் தொகை',
    'portal.needHelp': 'உதவி தேவையா?',
    'portal.linkInvalid': 'இணைப்பு செல்லாது',
    // Public form
    'form.thanks': 'நன்றி!',
    'form.poweredBy': 'NexusCRM மூலம் இயக்கப்படுகிறது',
  },
};

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICT[saved]) return saved;
  } catch {
    // storage unavailable
  }
  return 'en';
}

const startLang = initialLang();
document.documentElement.lang = startLang;

export const useLangStore = create((set) => ({
  lang: startLang,
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage unavailable
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

// t('nav.Leads', 'Leads') -> Tamil when available, otherwise the English fallback.
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key, fallback) => DICT[lang]?.[key] ?? fallback ?? key;
}
