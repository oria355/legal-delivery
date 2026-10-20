import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { createPortal } from "react-dom";
import {
  Briefcase,
  Truck,
  BarChart3,
  Search,
  Upload,
  FileText,
  Zap,
  MapPin,
  Navigation,
  Mic,
  Square,
  Camera,
  X,
  Check,
  CircleAlert,
  Clock,
  RotateCcw,
  DoorClosed,
  PenTool,
  Trash2,
  Download,
  Filter,
  ChevronDown,
  User,
  Phone,
  Home,
  Building2,
  ScrollText,
  Gavel,
  Plus,
  Printer,
  ExternalLink,
  ArrowRight,
  ImageIcon,
  Timer,
  BadgeCheck,
  UserCheck,
  Wallet,
  Pencil,
  RefreshCw,
  Coins,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  PlusCircle,
  MinusCircle,
  Hourglass,
  Users,
  Mail,
  Map as MapIcon,
  CreditCard,
  UserPlus,
  Bell,
  ShieldCheck,
  TrendingUp,
  LogOut,
  Calculator,
  QrCode,
  Smartphone,
  Eye,
  EyeOff,
} from "lucide-react";

/* =========================================================================
   FONT INJECTION — Heebo (Google Fonts)
   ========================================================================= */
function useHeebo() {
  useEffect(() => {
    if (document.getElementById("heebo-font-link")) return;
    const link = document.createElement("link");
    link.id = "heebo-font-link";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* =========================================================================
   CONSTANTS & MOCK DATA
   ========================================================================= */
// Delivery tracks (stored in orders.data.deliveryTrack; missing = "legal", so
// every existing order keeps its exact Regulation-161 behaviour).
const DELIVERY_TRACKS = {
  legal: { key: "legal", label: "⚖️ מסירה משפטית (תקנה 161 — עד 3 ביקורים + תצהיר)", badge: "⚖️ מסירה משפטית", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  municipal: { key: "municipal", label: "🏛️ מסירה לעיריות ורשויות (מכרזים / התראות / צווים)", badge: "🏛️ מסירה מוסדית/עירייה", tone: "bg-teal-50 text-teal-700 ring-teal-200" },
  standard: { key: "standard", label: "✉️ מסירת מסמכים רשמית", sub: "מסירת מסמכים רשמיים, חוזים ודואר רשום מבוקר למוסדות ותאגידים — באישור מסירה חתום", badge: "✉️ מסירת מסמכים רשמית", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  // Banks / financial institutions: personal delivery to the addressee only,
  // with mandatory ID verification (type + last 4 digits). No door posting.
  bank: { key: "bank", label: "🏦 מסירה בנקאית מאובטחת", sub: "לנמען בלבד · חובת זיהוי ת.ז. · חיסיון בנקאי", badge: "🏦 מסירה בנקאית — לנמען בלבד", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
};
// Who received the document (Regulation 163(b)) and how residence was verified
// before posting on the door (Regulation 161(4)(b)(2)).
const DELIVERED_TO = {
  self: "הנמען בעצמו",
  family: "בן משפחה הגר עמו (מעל גיל 18 למראית עין)",
  authorized: "מורשה לקבלה / מזכירות (בתאגיד/עסק)",
};
const RESIDENCE_VERIFY = {
  door: "שם הנמען מופיע על הדלת / תיבת הדואר / אינטרקום",
  neighbor: "אומת מול שכן כי הנמען מתגורר בכתובת",
  business: "אומת מול בית העסק / השומר במקום",
};
const MUNICIPAL_DOC_TYPES = ["התראת ארנונה / גבייה", "צו עירוני / הנדסה", "מכתב רשמי / מכרז", "אחר"];
// "✉️ מסירת מסמכים רשמית" (internal key stays "standard" for DB compatibility).
const STANDARD_DOC_TYPES = ["מכתב רשמי / דואר רשום", "חוזה / הסכם לחתימה", "מסמכי מכרז / רכש", "הודעה רשמית מטעם מוסד/תאגיד", "אחר"];
function trackOf(o) {
  const t = o && o.deliveryTrack;
  return t === "municipal" || t === "standard" || t === "bank" ? t : "legal";
}
// Legal = 3, standard = 1, municipal / bank = the chosen 1 or 3 (default 1).
function maxVisitsOf(o) {
  const t = trackOf(o);
  if (t === "legal") return 3;
  if (t === "standard") return 1;
  return Number(o.maxVisits) === 3 ? 3 : 1;
}
function isSingleVisit(o) {
  return maxVisitsOf(o) === 1;
}
// Documents with a court-style affidavit: legal orders, and municipal
// statutory (3-visit) deliveries.
function usesAffidavit(o) {
  return trackOf(o) === "legal" || ((trackOf(o) === "municipal" || trackOf(o) === "bank") && maxVisitsOf(o) === 3);
}

// ---- Bank track (בנק ישראל / סודיות בנקאית) -------------------------------
// Only the addressee himself, or an identified corporate signatory, may take
// the envelope. Stored in orders.data.deliveryTrack = "bank" and, per visit,
// visits.data.verifiedIdType / verifiedIdLast4 — no SQL change.
const DELIVERED_TO_BANK = {
  self: "הנמען בעצמו (זיהוי אישי בתעודה מזהה)",
  authorized: "מורשה חתימה מזוהה בתאגיד",
};
const ID_DOC_TYPES = ["תעודת זהות", "דרכון", "רישיון נהיגה"];
const BANK_DOC_TYPES = ["מסמכי אשראי / משכנתא לחתימה", "ערבות בנקאית / שיק בנקאי", "התראה בנקאית רשומה", "אחר"];
const BANK_MASK_TEXT = "🔒 מעטפה בנקאית חסויה";
// Bank confidentiality: the courier must not see what is inside the envelope.
function isBankConfidential(o) {
  return !!o && ((trackOf(o) === "bank" && o.bankConfidential !== false) || o.bankConfidential === true);
}
// Courier-facing copy of an order: document type and reference are hidden.
// (The real order is never changed; admin and the owning client see everything.)
function maskOrderForCourier(o) {
  if (!isBankConfidential(o)) return o;
  return { ...o, docType: BANK_MASK_TEXT, customDocType: "", caseNumber: BANK_MASK_TEXT, fileName: "" };
}
function courierDocLabel(o) {
  if (isBankConfidential(o)) return BANK_MASK_TEXT;
  return o.docType === "אחר" && o.customDocType ? o.customDocType : o.docType;
}
// "סוג תעודה מזהה: … · 4 ספרות אחרונות: …" for a visit that recorded it.
function idVerificationText(a) {
  return a && a.verifiedIdType ? `סוג תעודה מזהה: ${a.verifiedIdType} · 4 ספרות אחרונות: ${a.verifiedIdLast4 || "—"}` : "";
}

const DOC_TYPES = [
  "כתב תביעה",
  "הזמנה לדין",
  'אזהרת הוצל"פ',
  "צו בית משפט / צו מניעה",
  "התראה לפני פינוי מושכר",
  "בקשה / תגובה / הודעה לתיק",
  "זימון עד",
  "פסק דין / החלטה",
  "אחר",
];

/* -------------------------------------------------------------------------
   PRICING MODEL (client-facing price list, base origin: Hadera)
   -------------------------------------------------------------------------
   The client price of an order = zone base price + service-speed surcharge
   + optional advanced services. The zone is derived from the delivery city.
   The courier is paid separately (calcOrderEarnings: ₪20 per attempt, capped
   at ₪60 per completed task), so Net Margin = Client Total - Courier Cost.
   ------------------------------------------------------------------------- */
const PRICING_ZONES = [
  {
    key: "local",
    label: "אזור מקומי (חדרה, פרדס חנה, חריש)",
    short: "אזור מקומי",
    price: 110,
    cities: [
      "חדרה",
      "פרדס חנה-כרכור",
      "חריש",
      "גן שמואל",
      "עין שמר",
      "להבות חביבה",
      "מענית",
      "ברקאי",
      "אור עקיבא",
      "קיסריה",
      "בית אליעזר",
      "אלוני יצחק",
      "בנימינה-גבעת עדה",
      "גבעת עדה",
      "כפר גליקסון",
      "עמיקם",
      "אביאל",
      "עין עירון",
      "בית חנניה",
    ],
  },
  {
    key: "sharon",
    label: "אזור השרון / נתניה",
    short: "שרון / נתניה",
    price: 140,
    cities: [
      "נתניה",
      "פולג",
      "אבן יהודה",
      "כפר יונה",
      "כפר סבא",
      "רעננה",
      "הוד השרון",
      "תל מונד",
      "כוכב יאיר",
      "צור יצחק",
      "צור משה",
      "בית ינאי",
      "בני דרור",
      "בארותיים",
      "בית יצחק-שער חפר",
      "גבעת חיים איחוד",
      "גבעת חיים מאוחד",
      "גבעת שפירא",
      "חבצלת השרון",
      "חגור",
      "ינוב",
      "כפר ויתקין",
      "כפר חיים",
      "כפר מונש",
      "מכמורת",
      "מעברות",
      "משמרת",
      "נורדיה",
      "עין החורש",
      "עין ורד",
      "שדה ורבורג",
      "שער אפרים",
      "תנובות",
      "אמץ",
      "אביחיל",
      "אלישיב",
      "ביתן אהרן",
      "בית חרות",
      "חרב לאת",
      "יד חנה",
      "כפר מל\"ל",
      "כפר ידידיה",
      "עולש",
      "פורת",
      "קדימה-צורן",
      "רשפון",
      "תל יצחק",
      "חופית",
      "גאולים",
      "גן יאשיה",
      "גן חיים",
      "אליכין",
      "ג'לג'וליה",
      "טייבה",
      "טירה",
      "קלנסווה",
      "באקה אל-גרבייה",
      "ג'ת",
      "אום אל-פחם",
      "מעלה עירון",
      "ערערה",
      "כפר קרע",
      "ברטעה",
      "מועאוויה",
      "כפר ברא",
      "בחן",
      "זכרון יעקב",
      "צופית",
      "פרדסיה",
      "עזריאל",
      "כפר יעבץ",
      "בני ציון",
      "חורשים",
      "עין שריד",
      "נירית",
      "אלישמע",
      "גנות הדר",
      "ניצני עוז",
      "ג'סר א-זרקא",
      "בת חפר",
      "בית הלוי",
    ],
  },
  {
    key: "haifa",
    label: "חיפה והקריות",
    short: "חיפה והקריות",
    price: 160,
    cities: [
      "חיפה",
      "קריית אתא",
      "קריית ביאליק",
      "קריית מוצקין",
      "קריית ים",
      "נשר",
      "טירת כרמל",
      "דאליית אל-כרמל",
      "עספיא",
      "עתלית",
      "נווה ים",
      "עין הוד",
      "כרם מהר\"ל",
      "בית אורן",
      "מעגן מיכאל",
      "בת שלמה",
      "כפר ביאליק",
      "יגור",
      "כפר חסידים",
      "אושה",
      "כפר המכבי",
      "רמת יוחנן",
      "קריית טבעון",
      "רכסים",
      "אלונים",
      "ניר עציון",
      "נחשולים",
      "דור",
      "מעיין צבי",
      "שדות ים",
      "עין אילה",
      "נופית",
      "חוף הכרמל",
      "צרופה",
      "כפר גלים",
    ],
  },
  {
    key: "center",
    label: "מרכז / גוש דן (אזור תל אביב)",
    short: "מרכז / גוש דן",
    price: 170,
    cities: [
      "תל אביב",
      "יפו",
      "רמת גן",
      "גבעתיים",
      "בני ברק",
      "פתח תקווה",
      "חולון",
      "בת ים",
      "הרצליה",
      "ראשון לציון",
      "קריית אונו",
      "אור יהודה",
      "יהוד-מונוסון",
      "אזור",
      "גני תקווה",
      "גבעת שמואל",
      "סביון",
      "כפר שמריהו",
      "רמת השרון",
      "ראש העין",
      "אלעד",
      "בני עטרות",
      "נווה מונוסון",
      "שוהם",
      "מגשימים",
      "תל השומר",
      "גליל ים",
      "הרצליה פיתוח",
      "כפר סירקין",
      "כפר אז\"ר",
      "עינת",
    ],
  },
  {
    key: "north_jlm",
    label: "צפון / ירושלים / שפלה",
    short: "צפון / ירושלים / שפלה",
    price: 210,
    cities: [
      "ירושלים",
      "מבשרת ציון",
      "אבו גוש",
      "מעלה החמישה",
      "צור הדסה",
      "בית שמש",
      "הראל",
      "קריית ענבים",
      "צובה",
      "נטף",
      "עין נקובא",
      "אורה",
      "עמינדב",
      "בית זית",
      "תרום",
      "מוצא עילית",
      "עין כרם",
      "נחם",
      "צרעה",
      "אשתאול",
      "קריית יערים",
      "נווה אילן",
      "רחובות",
      "נס ציונה",
      "לוד",
      "רמלה",
      "מודיעין-מכבים-רעות",
      "מודיעין עילית",
      "אשדוד",
      "יבנה",
      "גדרה",
      "קריית עקרון",
      "מזכרת בתיה",
      "גן יבנה",
      "באר יעקב",
      "נצר סרני",
      "בית דגן",
      "צריפין",
      "יד בנימין",
      "גזר",
      "שילת",
      "חדיד",
      "בן שמן",
      "שדה עוזיהו",
      "נתיב הל\"ה",
      "בית חנן",
      "כפר ביל\"ו",
      "כפר אביב",
      "עשרת",
      "בני ראם",
      "גני יוחנן",
      "בית עזרא",
      "בני דרום",
      "גבעת ברנר",
      "כפר מנחם",
      "כפר הנגיד",
      "כפר אוריה",
      "נען",
      "גבעתי",
      "חפץ חיים",
      "בית אלעזרי",
      "פלמחים",
      "ינון",
      "יסודות",
      "גן שורק",
      "סתריה",
      "נס הרים",
      "מסלול",
      "בית נחמיה",
      "ברקת",
      "גנות",
      "מצליח",
      "מתתיהו",
      "לפיד",
      "חשמונאים",
      "מבוא מודיעין",
      "נחשונים",
      "בית עריף",
      "בית חילקיה",
      "חולדה",
      "כפר בן נון",
      "נוף איילון",
      "שעלבים",
      "זרחיה",
      "עפולה",
      "נצרת",
      "נוף הגליל",
      "טבריה",
      "עכו",
      "נהריה",
      "כרמיאל",
      "צפת",
      "קריית שמונה",
      "מעלות-תרשיחא",
      "שלומי",
      "מטולה",
      "מגדל העמק",
      "בית שאן",
      "יקנעם עילית",
      "יקנעם מושבה",
      "מגאר",
      "סח'נין",
      "עראבה",
      "דיר חנא",
      "כאבול",
      "טמרה",
      "פקיעין",
      "ראש פינה",
      "רמת ישי",
      "כפר תבור",
      "יבנאל",
      "כנרת",
      "אפיקים",
      "דגניה א'",
      "דגניה ב'",
      "גינוסר",
      "כפר נהר הירדן",
      "אלומות",
      "תל קציר",
      "עין גב",
      "מעגן",
      "אשדות יעקב איחוד",
      "אשדות יעקב מאוחד",
      "נוף גינוסר",
      "שדמות דבורה",
      "כפר גדעון",
      "מרחביה",
      "אילניה",
      "נהלל",
      "גבע",
      "בית אלפא",
      "חפציבה",
      "גן נר",
      "עין חרוד איחוד",
      "עין חרוד מאוחד",
      "תל יוסף",
      "גדעונה",
      "מזרע",
      "יפעת",
      "כפר יהושע",
      "בית זרע",
      "בית קשת",
      "שדה אליהו",
      "בלפוריה",
      "אלון הגליל",
      "שריד",
      "מגידו",
      "עין דור",
      "כפר החורש",
      "כפר קיש",
      "ציפורי",
      "כפר כנא",
      "ריינה",
      "עילוט",
      "יפיע",
      "זרזיר",
      "עילבון",
      "בועיינה-נוג'ידאת",
      "כסרא-סמיע",
      "ג'דיידה-מכר",
      "ג'ולס",
      "ג'ש",
      "פסוטה",
      "מעיליא",
      "ירכא",
      "בית ג'ן",
      "חורפיש",
      "שייח' דנון",
      "אבו סנאן",
      "כפר יסיף",
      "יאנוח-ג'ת",
      "עין אל-אסד",
      "מג'ד אל-כרום",
      "דיר אל-אסד",
      "בענה",
      "נחף",
      "ראמה",
      "סאג'ור",
      "אכסאל",
      "דבוריה",
      "קצרין",
      "מג'דל שמס",
      "מסעדה",
      "בוקעאתא",
      "עין קיניה",
      "אלוני הבשן",
      "נאות גולן",
      "מרום גולן",
      "רמות",
      "חספין",
      "אורטל",
      "אניעם",
      "גשור",
      "כפר חרוב",
      "קשת",
      "אליעד",
      "אל-רום",
      "יונתן",
      "מצוק עורבים",
      "נטור",
      "ראש הנקרה",
      "חצור הגלילית",
      "כפר סאלד",
      "דפנה",
      "דן",
      "שניר",
      "הגושרים",
      "כפר בלום",
      "מנרה",
      "מרגליות",
      "יראון",
      "אביבים",
      "זרעית",
      "שתולה",
      "בצת",
      "אילון",
      "גשר הזיו",
      "לוחמי הגטאות",
      "עברון",
      "בן עמי",
      "אדמית",
      "מצובה",
      "חניתה",
      "כברי",
      "שבי ציון",
      "נתיב השיירה",
      "סער",
      "בוסתן הגליל",
      "כפר מנדא",
      "כמון",
      "מנוף",
      "מכמנים",
      "חרשים",
      "יובלים",
      "אשבל",
      "ארבל",
      "כורזים",
      "לביא",
      "מגדל",
      "חנתון",
      "יודפת",
      "צורית",
      "שורשים",
      "מורשת",
      "לבון",
      "עצמון שגב",
      "בר יוחאי",
      "מירון",
      "משגב",
      "כפר ורדים",
    ],
  },
  {
    key: "south",
    label: "דרום / באר שבע",
    short: "דרום / באר שבע",
    price: 270,
    cities: [
      "באר שבע",
      "אשקלון",
      "קריית גת",
      "קריית מלאכי",
      "דימונה",
      "אילת",
      "נתיבות",
      "אופקים",
      "שדרות",
      "ערד",
      "ירוחם",
      "מצפה רמון",
      "רהט",
      "להבים",
      "עומר",
      "מיתר",
      "כסייפה",
      "ערערה בנגב",
      "שגב שלום",
      "תל שבע",
      "לקיה",
      "חורה",
      "ביר הדאג'",
      "אבו קרינאת",
      "סעד",
      "נחל עוז",
      "בארי",
      "רעים",
      "אור הנר",
      "יד מרדכי",
      "זיקים",
      "כרמיה",
      "ניר עם",
      "ניר עוז",
      "כפר עזה",
      "נתיב העשרה",
      "חולית",
      "עלומים",
      "שדה אברהם",
      "אורים",
      "מבטחים",
      "תקומה",
      "פטיש",
      "דורות",
      "שוקדה",
      "אבשלום",
      "בית קמה",
      "גבים",
      "ניר יצחק",
      "מגן",
      "צאלים",
      "ספיר",
      "חצבה",
      "עין יהב",
      "פארן",
      "צופר",
      "עין גדי",
      "נאות הכיכר",
      "מצפה שלם",
      "חצרים",
      "להב",
      "כרמית",
      "גבעות בר",
      "משמר הנגב",
      "שדה בוקר",
      "רביבים",
      "מבועים",
      "שובל",
      "גבעות",
      "ניצנה",
      "ניר משה",
      "עזר",
      "שפיר",
      "בית הגדי",
      "יד נתן",
      "כוכב מיכאל",
      "ניר ח\"ן",
      "תלמי יפה",
      "תלמי יוסף",
      "באר גנים",
      "בת הדר",
      "מבקיעים",
      "ניצן",
      "כפר סילבר",
      "הודיה",
      "אלומה",
      "נועם",
      "שחר",
      "ניצנים",
      "בית הערבה",
      "מדרשת בן גוריון",
      "יטבתה",
      "אילות",
      "גרופית",
      "לוטן",
      "קטורה",
      "אליפז",
      "שיטים",
      "ארז",
    ],
  },
];

// Flat city list for dropdowns (grouped by zone in the order form).
const CITIES = PRICING_ZONES.flatMap((z) => z.cities);

// Unknown / legacy cities fall back to the Center zone so an order is never
// left without a price.
// City lookup index (built once) — O(1) instead of scanning ~500 names.
const CITY_ZONE_INDEX = (() => {
  const m = new window.Map();
  PRICING_ZONES.forEach((z) => z.cities.forEach((c) => { if (!m.has(c)) m.set(c, z); }));
  return m;
})();

// Normalises free-typed city input (trim, unify quotes/dashes/spaces) and
// resolves it to the canonical spelling used in PRICING_ZONES, or "".
const CITY_NORMAL_INDEX = (() => {
  const m = new window.Map();
  const norm = (t) => String(t || "").replace(/[\u05F3\u2019\u2018`]/g, "'").replace(/[\u2010-\u2015\u05BE]/g, "-").replace(/\s+/g, " ").trim();
  CITIES.forEach((c) => m.set(norm(c), c));
  return { m, norm };
})();
function normalizeCity(input) {
  return CITY_NORMAL_INDEX.m.get(CITY_NORMAL_INDEX.norm(input)) || "";
}

function zoneForCity(city) {
  return CITY_ZONE_INDEX.get(city) || PRICING_ZONES.find((z) => z.key === "center");
}

// Upgrade 1 — true geographic region label per city. Prices stay attached to
// PRICING_ZONES (unchanged); only the *name shown to the user* is derived here,
// so "צפון / ירושלים / שפלה — ₪210" is shown as exactly one real region.
const GEO_REGION_LABEL = {
  north: "אזור הצפון",
  haifa: "אזור חיפה והקריות",
  sharon: "אזור השרון וחדרה",
  center: "אזור המרכז וגוש דן",
  shfela: "אזור השפלה",
  jerusalem: "אזור ירושלים והסביבה",
  south: "אזור הדרום",
};
const GEO_JERUSALEM = new window.Set(["ירושלים", "מבשרת ציון", "אבו גוש", "מעלה החמישה", "צור הדסה", "בית שמש", "הראל", "קריית ענבים", "צובה", "נטף", "עין נקובא", "אורה", "עמינדב", "בית זית", "תרום", "מוצא עילית", "עין כרם", "נחם", "צרעה", "אשתאול", "קריית יערים", "נווה אילן", "מודיעין עילית"]);
const GEO_SHFELA = new window.Set(["רחובות", "נס ציונה", "לוד", "רמלה", "מודיעין-מכבים-רעות", "אשדוד", "יבנה", "גדרה", "קריית עקרון", "מזכרת בתיה", "גן יבנה", "באר יעקב", "נצר סרני", "בית דגן", "צריפין", "יד בנימין", "גזר", "שילת", "חדיד", "בן שמן", "שדה עוזיהו", "נתיב הל\"ה", "בית חנן", "כפר ביל\"ו", "כפר אביב", "עשרת", "בני ראם", "גני יוחנן", "בית עזרא", "בני דרום", "גבעת ברנר", "כפר מנחם", "כפר הנגיד", "כפר אוריה", "נען", "גבעתי", "חפץ חיים", "בית אלעזרי", "פלמחים", "ינון", "יסודות", "גן שורק", "סתריה", "נס הרים", "מסלול", "בית נחמיה", "ברקת", "גנות", "מצליח", "מתתיהו", "לפיד", "חשמונאים", "מבוא מודיעין", "נחשונים", "בית עריף", "בית חילקיה", "חולדה", "כפר בן נון", "נוף איילון", "שעלבים", "זרחיה", "אשקלון", "קריית גת", "קריית מלאכי"].concat(["אשקלון", "קריית גת", "קריית מלאכי"]));
const GEO_SHARON_FROM_CENTER = new window.Set(["הרצליה", "הרצליה פיתוח", "כפר שמריהו", "גליל ים", "רמת השרון"]);
function geoRegionOf(city) {
  const c = normalizeCity(city) || city;
  const z = CITY_ZONE_INDEX.get(c);
  if (!z) return null;
  if (GEO_JERUSALEM.has(c)) return "jerusalem";
  if (GEO_SHFELA.has(c)) return "shfela";
  if (z.key === "local" || z.key === "sharon") return "sharon";
  if (z.key === "haifa") return "haifa";
  if (z.key === "center") return GEO_SHARON_FROM_CENTER.has(c) ? "sharon" : "center";
  if (z.key === "south") return "south";
  return "north";
}
// Display label for a city; unknown/legacy cities fall back to the same zone
// that prices them (Center), so an old order never shows an empty region.
function zoneLabelFor(city) {
  const k = geoRegionOf(city);
  return k ? GEO_REGION_LABEL[k] : GEO_REGION_LABEL.center;
}

// Service speed — mutually exclusive (one delivery has exactly one speed).
const SPEED_OPTIONS = [
  { key: "standard", label: "מסירה רגילה", hint: "3-5 ימי עסקים", fee: 0 },
  { key: "urgent", label: "מסירה דחופה", hint: "24-48 שעות", fee: 50 },
  { key: "express", label: "מסירת אקספרס", hint: "באותו יום", fee: 100 },
];

// Advanced services — independent add-ons.
const ADDON_OPTIONS = [
  { key: "tracing", label: "איתור כתובת בשטח", hint: "במקרה שהנמען עזב את הכתובת", fee: 60 },
  { key: "printing", label: "שירות הדפסת מסמכים", hint: "העלאת PDF על ידי משרד עורכי הדין", fee: 20 },
];

function speedOf(order) {
  return order.speed || (order.urgent ? "urgent" : "standard");
}

// "חבר מביא חבר": ₪50 credit on a later order. The order total never drops
// below REFERRAL_MIN_ORDER because of the credit (courier payout is ₪60).
const REFERRAL_CREDIT = 50;
const REFERRAL_MIN_ORDER = 110;

// Client-facing price breakdown for one order.
function calcClientPrice(order) {
  const zone = zoneForCity(order.city);
  const speed = SPEED_OPTIONS.find((s) => s.key === speedOf(order)) || SPEED_OPTIONS[0];
  const addons = order.addons || {};
  const tracingFee = addons.tracing ? ADDON_OPTIONS[0].fee : 0;
  const printingFee = addons.printing ? ADDON_OPTIONS[1].fee : 0;
  const lines = [
    { key: "base", label: `מחיר בסיס — ${zoneLabelFor(order.city)}`, amount: zone.price },
    ...(speed.fee ? [{ key: "speed", label: `תוספת ${speed.label} (${speed.hint})`, amount: speed.fee }] : []),
    ...(tracingFee ? [{ key: "tracing", label: ADDON_OPTIONS[0].label, amount: tracingFee }] : []),
    ...(printingFee ? [{ key: "printing", label: ADDON_OPTIONS[1].label, amount: printingFee }] : []),
  ];
  // Applied referral credit (set only by the admin): fixed ₪50, floored at the minimum price.
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const referralCredit = order.referralCredit ? Math.max(0, Math.min(REFERRAL_CREDIT, subtotal - REFERRAL_MIN_ORDER)) : 0;
  if (referralCredit) lines.push({ key: "referralCredit", label: "זיכוי חבר מביא חבר", amount: -referralCredit });
  return {
    zone,
    speed,
    base: zone.price,
    speedFee: speed.fee,
    tracingFee,
    printingFee,
    referralCredit,
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

// The five work regions couriers are onboarded into, and the region each
// order's city belongs to — this is what lets dispatch filter candidate
// couriers down to the ones actually local to the delivery instead of
// showing the Admin the entire roster every time.
const REGIONS = ["צפון", "שרון", "מרכז", "שפלה", "דרום"];

// Region is derived from the pricing zone (so every one of the ~500 cities
// is covered) with explicit overrides for the Jerusalem area and the Shfela.
const ZONE_DEFAULT_REGION = { local: "שרון", sharon: "שרון", haifa: "צפון", center: "מרכז", north_jlm: "צפון", south: "דרום" };
const REGION_OVERRIDES = (() => {
  const m = {};
  ["ירושלים", "מבשרת ציון", "אבו גוש", "מעלה החמישה", "צור הדסה", "בית שמש", "הראל", "קריית ענבים", "צובה", "נטף", "עין נקובא", "אורה", "עמינדב", "בית זית", "תרום", "מוצא עילית", "עין כרם", "נחם", "צרעה", "אשתאול", "קריית יערים", "נווה אילן"].forEach((c) => { m[c] = "מרכז"; });
  ["רחובות", "נס ציונה", "לוד", "רמלה", "מודיעין-מכבים-רעות", "מודיעין עילית", "אשדוד", "יבנה", "גדרה", "קריית עקרון", "מזכרת בתיה", "גן יבנה", "באר יעקב", "נצר סרני", "בית דגן", "צריפין", "יד בנימין", "גזר", "שילת", "חדיד", "בן שמן", "שדה עוזיהו", "נתיב הל\"ה", "בית חנן", "כפר ביל\"ו", "כפר אביב", "עשרת", "בני ראם", "גני יוחנן", "בית עזרא", "בני דרום", "גבעת ברנר", "כפר מנחם", "כפר הנגיד", "כפר אוריה", "נען", "גבעתי", "חפץ חיים", "בית אלעזרי", "פלמחים", "ינון", "יסודות", "גן שורק", "סתריה", "נס הרים", "מסלול", "בית נחמיה", "ברקת", "גנות", "מצליח", "מתתיהו", "לפיד", "חשמונאים", "מבוא מודיעין", "נחשונים", "בית עריף", "בית חילקיה", "חולדה", "כפר בן נון", "נוף איילון", "שעלבים", "זרחיה", "מודיעין", "ראשון לציון"].forEach((c) => { m[c] = "שפלה"; });
  return m;
})();
const CITY_REGION = (() => {
  const m = {};
  PRICING_ZONES.forEach((z) => z.cities.forEach((c) => { m[c] = REGION_OVERRIDES[c] || ZONE_DEFAULT_REGION[z.key]; }));
  return m;
})();

// Case-file reference data for the order form and the affidavit.
const COURTS = [
  "בית משפט השלום — חדרה",
  "בית משפט השלום — תל אביב-יפו",
  "בית משפט השלום — חיפה",
  "בית משפט השלום — ירושלים",
  "בית המשפט המחוזי — חיפה",
  "בית המשפט המחוזי — תל אביב-יפו",
  "בית המשפט המחוזי — מרכז",
  "בית משפט לענייני משפחה — חדרה",
  "בית הדין האזורי לעבודה — תל אביב-יפו",
  "לשכת ההוצאה לפועל — חדרה",
];
const RECIPIENT_ROLES = ["נתבע/ת", "משיב/ה", "עד", "צד שלישי", "אחר"];

// Legal references printed on the affidavit. Kept in ONE place so counsel can
// correct the wording/rule numbers without touching the generator.
const LEGAL_REFS = {
  regulations: 'תקנות סדר הדין האזרחי, התשע"ט-2018',
  serviceRule: "תקנה 161",
};

const BUSINESS_TYPES = ["עוסק פטור", "עוסק מורשה", "חברה"];

// Full courier roster — each courier is now a complete onboarding record
// (contact details, home address/city, work region, license, business
// type), not just a bare name. Two extra דרום couriers are seeded even
// though no current CITIES fall in that region, so the directory and the
// region filter both have real דרום coverage to demonstrate.
const COURIERS = [
  { id: "CR-01", name: "דני כהן", phone: "050-1234567", email: "dani.cohen@example.com", residenceCity: "תל אביב", address: "אבן גבירול 45, תל אביב", region: "מרכז", licenseNumber: "029481726", businessType: "עוסק פטור" },
  { id: "CR-02", name: "מאיה לוי", phone: "052-2345678", email: "maya.levi@example.com", residenceCity: "תל אביב", address: "דיזנגוף 112, תל אביב", region: "מרכז", licenseNumber: "038471625", businessType: "עוסק מורשה" },
  { id: "CR-03", name: "אורי ברק", phone: "053-3456789", email: "uri.barak@example.com", residenceCity: "חדרה", address: "הנשיא 8, חדרה", region: "שרון", licenseNumber: "047392816", businessType: "עוסק פטור" },
  { id: "CR-04", name: "שירה אלון", phone: "054-4567890", email: "shira.alon@example.com", residenceCity: "חדרה", address: "רוטשילד 21, חדרה", region: "שרון", licenseNumber: "056283947", businessType: "עוסק פטור" },
  { id: "CR-05", name: "רון שמעוני", phone: "050-5678901", email: "ron.shimoni@example.com", residenceCity: "נתניה", address: "הרצל 3, נתניה", region: "שרון", licenseNumber: "065194738", businessType: "חברה" },
  { id: "CR-06", name: "טל פרץ", phone: "052-6789012", email: "tal.peretz@example.com", residenceCity: "נתניה", address: "ויצמן 17, נתניה", region: "שרון", licenseNumber: "074285649", businessType: "עוסק פטור" },
  { id: "CR-07", name: "יוסי מזרחי", phone: "053-7890123", email: "yossi.mizrahi@example.com", residenceCity: "ירושלים", address: "יפו 56, ירושלים", region: "מרכז", licenseNumber: "083176528", businessType: "עוסק מורשה" },
  { id: "CR-08", name: "נועה גל", phone: "054-8901234", email: "noa.gal@example.com", residenceCity: "ירושלים", address: "עמק רפאים 9, ירושלים", region: "מרכז", licenseNumber: "092067419", businessType: "עוסק פטור" },
  { id: "CR-09", name: "איתי דגן", phone: "050-9012345", email: "itai.dagan@example.com", residenceCity: "חיפה", address: "הנביאים 14, חיפה", region: "צפון", licenseNumber: "001958327", businessType: "עוסק פטור" },
  { id: "CR-10", name: "רותם שני", phone: "052-0123456", email: "rotem.shani@example.com", residenceCity: "חיפה", address: "הרצל 60, חיפה", region: "צפון", licenseNumber: "010849238", businessType: "חברה" },
  { id: "CR-11", name: "גיל אברהם", phone: "053-1123456", email: "gil.avraham@example.com", residenceCity: "ראשון לציון", address: "רוטשילד 5, ראשון לציון", region: "שפלה", licenseNumber: "029731456", businessType: "עוסק מורשה" },
  { id: "CR-12", name: "הדר נוי", phone: "054-2123456", email: "hadar.noy@example.com", residenceCity: "ראשון לציון", address: "ז'בוטינסקי 40, ראשון לציון", region: "שפלה", licenseNumber: "038622367", businessType: "עוסק פטור" },
  { id: "CR-13", name: "ליאור שדה", phone: "050-3123456", email: "lior.sade@example.com", residenceCity: "פתח תקווה", address: "רוטשילד 22, פתח תקווה", region: "מרכז", licenseNumber: "047513278", businessType: "עוסק פטור" },
  { id: "CR-14", name: "עדי כרמי", phone: "052-4123456", email: "adi.carmi@example.com", residenceCity: "פתח תקווה", address: "העצמאות 31, פתח תקווה", region: "מרכז", licenseNumber: "056404189", businessType: "חברה" },
  { id: "CR-15", name: "משה אזולאי", phone: "053-5123456", email: "moshe.azulay@example.com", residenceCity: "באר שבע", address: "רגר 18, באר שבע", region: "דרום", licenseNumber: "065395090", businessType: "עוסק פטור" },
  { id: "CR-16", name: "קרן ביטון", phone: "054-6123456", email: "keren.biton@example.com", residenceCity: "אשדוד", address: "הראשונים 7, אשדוד", region: "דרום", licenseNumber: "074286901", businessType: "עוסק מורשה" },
];

const ALL_COURIERS = Array.from(new window.Set(COURIERS.map((c) => c.name)));

// All couriers whose work region matches the order's city — falls back to
// the full roster if a city/region ever has no local courier, so dispatch
// never comes up empty.
function couriersForCity(city, roster = COURIERS) {
  roster = roster.filter((c) => c.approvalStatus !== "pending" && !c.blocked);
  const region = CITY_REGION[city];
  const local = roster.filter((c) => c.region === region).map((c) => c.name);
  return local.length ? local : roster.map((c) => c.name);
}

// Splits the roster into "same region as this order's city" vs. everyone
// else, so a dispatch dropdown can show the local, relevant couriers first
// (prioritized) while still letting the Admin reach any courier if needed —
// filtering down to a dead end would be worse than just sorting well.
function groupCouriersByRegion(city, roster = COURIERS) {
  // Couriers still waiting for approval, or blocked by the admin, can't be dispatched to.
  roster = roster.filter((c) => c.approvalStatus !== "pending" && !c.blocked);
  const region = CITY_REGION[city];
  const local = roster.filter((c) => c.region === region).map((c) => c.name);
  const other = roster.filter((c) => c.region !== region).map((c) => c.name);
  return { region, local, other };
}

/* -------------------------------------------------------------------------
   WOLT-STYLE PICKUP & DISPATCH — pure helpers shared by demo mode, the UI and
   (mirrored in SQL) the database. A courier never gets an order automatically:
   they "take" or "decline" it, the manager sees every taker and picks one.
   A response row is { orderId, courierId, action, outcome, acknowledged, at }.
   ------------------------------------------------------------------------- */
const RESPONSE = { TAKE: "take", DECLINE: "decline" };
const TAKEN_MESSAGE = "המסירה נלקחה, אל דאגה יהיו עוד הרבה בהמשך (:";

function orderRegion(o) {
  return (o && (o.region || CITY_REGION[o.city])) || "";
}

// Still waiting for a courier (and not cancelled / already dispatched).
function isOpenForPickup(o) {
  return !!o && o.status === STATUS.PENDING && !o.assignedCourier;
}

// Geo-targeting: the courier's work region must match the order's region and,
// if the courier limited themselves to specific cities, the city must be one.
function courierCoversOrder(c, o) {
  if (!c || c.approvalStatus === "pending" || c.blocked) return false;
  const region = orderRegion(o);
  if (!region || c.region !== region) return false;
  return !(c.workCities && c.workCities.length) || c.workCities.includes(o.city);
}

function findResponse(responses, orderId, courierId) {
  return responses.find((r) => r.orderId === orderId && r.courierId === courierId) || null;
}

function upsertResponse(responses, orderId, courierId, action) {
  const rest = responses.filter((r) => !(r.orderId === orderId && r.courierId === courierId));
  return [...rest, { orderId, courierId, action, outcome: "pending", acknowledged: false, at: nowStamp(0) }];
}

// When the manager assigns a courier, every taker is resolved: the chosen one
// is "selected", everyone else "not_selected" (and sees the friendly message).
function applyAssignmentToResponses(responses, orderId, courierId) {
  return responses.map((r) =>
    r.orderId === orderId && r.action === RESPONSE.TAKE
      ? { ...r, outcome: r.courierId === courierId ? "selected" : "not_selected", acknowledged: r.courierId === courierId ? true : r.acknowledged }
      : r
  );
}

// Simulated lawyer/firm identities. Every order is stamped with submittedBy
// on creation, and the Lawyer Portal filters everything it shows — the new
// order form, the tracking table, live search — to the signed-in lawyer's
// own submissions only, the same way the Courier Portal already scopes
// tasks and earnings to the signed-in courier.
const LAWYERS = [
  'עו"ד ישראל ישראלי',
  'עו"ד מיכל אברהמי',
  'עו"ד יוסי בן חיים',
  'עו"ד רונית שגיא',
];

// Demo-mode client list for the Admin "לקוחות" section (cloud mode loads real profiles).
const DEMO_LAWYERS = LAWYERS.map((name, i) => ({
  id: `LW-${i + 1}`,
  name,
  email: `client${i + 1}@example.com`,
  phone: "",
  firm: "",
  blocked: false,
}));

// Attorney details auto-filled into the affidavit's verification block.
const LAWYER_PROFILES = {
  'עו"ד ישראל ישראלי': { licenseNo: "45821", firm: "ישראלי ושות' — משרד עורכי דין", address: "שדרות רוטשילד 45, תל אביב", phone: "03-5551234" },
  'עו"ד מיכל אברהמי': { licenseNo: "52390", firm: "אברהמי ושות' — משרד עורכי דין", address: "הנשיא 12, חדרה", phone: "04-6221100" },
  'עו"ד יוסי בן חיים': { licenseNo: "38117", firm: "בן חיים — משרד עורכי דין", address: "דרך חיפה 8, חיפה", phone: "04-8551200" },
  'עו"ד רונית שגיא': { licenseNo: "61452", firm: "שגיא ושות' — עורכי דין ונוטריון", address: "יפו 97, ירושלים", phone: "02-6254400" },
};

// Courier lookup used by the affidavit generator. The root App keeps this in
// sync with the live roster (including couriers registered at runtime), so
// the printable document can resolve a courier's details from just the name.
let courierRegistry = COURIERS;
function setCourierRegistry(list) {
  courierRegistry = list && list.length ? list : COURIERS;
}
function lookupCourier(name) {
  return courierRegistry.find((c) => c.name === name) || null;
}

const STATUS = {
  PENDING: "ממתין לשיוך",
  IN_PROGRESS: "בטיפול",
  // A no-answer visit was logged today — under Israeli Civil Procedure
  // Regulations, a second attempt on the same calendar day is not legally
  // valid, so the task locks here until the next calendar day.
  PENDING_NEXT_VISIT: "ממתינה לביקור הבא",
  DELIVERED: "נמסר",
  REFUSED: "סירוב",
  POSTED: "הדבקה",
  // Cancelled by the law firm before any courier was assigned.
  CANCELED: "בוטל",
};

// Maps the internal action taken by a courier to the Hebrew label stored on
// each attempt record — keeping a single source of truth for status text.
const ATTEMPT_TYPE_LABEL = {
  delivered: STATUS.DELIVERED,
  refused: STATUS.REFUSED,
  posted: STATUS.POSTED,
  noanswer: "אין מענה",
};

const STATUS_STYLES = {
  [STATUS.PENDING]: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", dot: "bg-amber-500" },
  [STATUS.IN_PROGRESS]: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", dot: "bg-blue-500" },
  [STATUS.PENDING_NEXT_VISIT]: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", dot: "bg-orange-500" },
  [STATUS.DELIVERED]: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  [STATUS.REFUSED]: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", dot: "bg-rose-500" },
  [STATUS.POSTED]: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200", dot: "bg-violet-500" },
  [STATUS.CANCELED]: { bg: "bg-slate-100", text: "text-slate-500", ring: "ring-slate-300", dot: "bg-slate-400" },
};

const NAMES = [
  "יעקב פרידמן",
  "רחל אביטן",
  "משה טננבאום",
  "שרה בן דוד",
  "אליהו וקנין",
  "מרים חדד",
  "דוד סופר",
  "אסתר גולן",
  "יצחק מלכה",
  "לאה בוזגלו",
  "אברהם רוזן",
  "חנה עמרם",
];

const STREETS = ["הרצל", "ויצמן", "בן גוריון", "רוטשילד", "ז'בוטינסקי", "אלנבי", "סוקולוב", "הנשיא"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function nowStamp(offsetMinutes = 0) {
  const d = new window.Date(window.Date.now() - offsetMinutes * 60000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
// High-accuracy device GPS — and NOTHING else. There is deliberately no
// fallback to made-up coordinates: if the fix can't be obtained, the caller
// gets { ok: false, reason } and must tell the courier. `maximumAge: 0`
// forces a fresh reading (never a cached one) and the generous timeout gives
// the GPS chip time to lock on, which is what makes the fix precise.
function getGps({ timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve({ ok: false, reason: "unsupported" });
    }
    // Browsers only expose geolocation on HTTPS (or localhost).
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return resolve({ ok: false, reason: "insecure" });
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        resolve({
          ok: true,
          lat,
          lng,
          coords: `${lat}, ${lng}`,
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      (err) => resolve({ ok: false, reason: err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

const GPS_REASON_TEXT = {
  denied: "הגישה למיקום נחסמה בדפדפן. יש לאפשר הרשאת מיקום לאתר (הגדרות הדפדפן ← הרשאות ← מיקום) ולנסות שוב.",
  timeout: "לא הצלחנו לקבל קליטת GPS בזמן. צאו למקום פתוח, ודאו ש-GPS דולק ונסו שוב.",
  unavailable: "שירותי המיקום במכשיר כבויים או לא זמינים. הפעילו GPS ונסו שוב.",
  unsupported: "הדפדפן או המכשיר אינם תומכים בקליטת מיקום.",
  insecure: "קליטת מיקום זמינה רק באתר מאובטח (HTTPS).",
};

// Google Maps link at the exact pinned coordinates: https://www.google.com/maps?q=lat,lng
// Prefers the numeric lat/lng saved on the visit; older records only have the
// "lat, lng" string, which is parsed instead. Returns null when no real
// coordinates exist (e.g. a visit recorded without GPS).
function mapUrlFor(visit) {
  let lat = safeCoord(visit.lat);
  let lng = safeCoord(visit.lng);
  if (lat == null || lng == null) {
    const m = String(visit.location || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    lat = safeCoord(m[1]);
    lng = safeCoord(m[2]);
    if (lat == null || lng == null) return null;
  }
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Two DIFFERENT kinds of map link are used in the app, on purpose:
//  • Address navigation ("ניווט לכתובת") — where the recipient LIVES. Built from
//    the address text only: street + house number + city (no floor / apartment).
//  • GPS audit ("מיקום דיווח בשטח (GPS)") — where the courier actually WAS when
//    the visit was reported; exact lat/lng for legal verification (mapUrlFor).
function orderAddress(order) {
  return `${order.street} ${order.houseNumber}, ${order.city}`;
}
function addressNavUrl(order) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderAddress(order))}`;
}
function AddressNavLink({ order, className = "" }) {
  return (
    <a
      href={addressNavUrl(order)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200 hover:bg-sky-100 print:hidden ${className}`}
    >
      <Navigation className="h-3 w-3" /> ניווט לכתובת
    </a>
  );
}

// Approximate city centres, used so demo data lands in the right city on a map.
const CITY_COORDS = {
  "תל אביב": [32.0853, 34.7818],
  חדרה: [32.434, 34.9196],
  נתניה: [32.3215, 34.8532],
  ירושלים: [31.7683, 35.2137],
  חיפה: [32.794, 34.9896],
  "ראשון לציון": [31.973, 34.7925],
  "פתח תקווה": [32.084, 34.8878],
  "באר שבע": [31.253, 34.7915],
  "קריית אתא": [32.8097, 35.1131],
  "פרדס חנה-כרכור": [32.4725, 34.9742],
  חריש: [32.4607, 35.0463],
  "כפר יונה": [32.3164, 34.9361],
  "רמת גן": [32.0684, 34.8248],
  אשדוד: [31.8044, 34.6553],
  הרצליה: [32.1624, 34.8447],
};
// A realistic point within roughly 1 km of the given city's centre.
function coordNearCity(city) {
  const [lat0, lng0] = CITY_COORDS[city] || [32.0853, 34.7818];
  const lat = Number((lat0 + (Math.random() - 0.5) * 0.024).toFixed(6));
  const lng = Number((lng0 + (Math.random() - 0.5) * 0.028).toFixed(6));
  return { lat, lng, location: `${lat}, ${lng}` };
}

// Reads a camera/gallery file into a downscaled base64 JPEG data URL. A
// base64 string (unlike URL.createObjectURL, which dies with the tab and
// can't be shared) can live on the order record itself, so Admin and the
// ordering lawyer can open the evidence later. Downscaling keeps the
// in-memory order list light even with many phone-camera photos.
// Canvas compression shared by photos and signatures: scales the longest side
// down to `maxDim` (never up) and re-encodes as JPEG (white background, so a
// transparent signature PNG stays readable). Any failure returns the original.
// A ~8 MB camera photo becomes roughly 150 KB — fast to upload on weak signal.
// Burns "date time | lat, lng" and "order id · מסירות משפטיות — תיעוד מבוקר" onto
// the bottom of the image (dark translucent bar, white text). Never throws: if
// anything fails the picture is simply left as it is. No GPS -> time only.
function drawEvidenceStamp(ctx, w, h, stamp) {
  try {
    const d = stamp.at instanceof window.Date ? stamp.at : new window.Date();
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const hasGps = stamp.lat != null && stamp.lng != null;
    const line1 = hasGps ? `${date}  |  ${stamp.lat}, ${stamp.lng}` : date;
    const line2 = `${stamp.orderId ? formatOrderNum(stamp.orderId, true) + " · " : ""}מסירות משפטיות — תיעוד מבוקר`;
    const fs = Math.max(11, Math.round(w / 42));
    const barH = Math.round(fs * 3.1);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, h - barH, w, barH);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${fs}px Heebo, Arial, sans-serif`;
    try { ctx.direction = "ltr"; } catch (e) { /* older browsers */ }
    ctx.fillText(line1, w / 2, h - barH + barH * 0.3, w - 16);
    try { ctx.direction = "rtl"; } catch (e) { /* older browsers */ }
    ctx.fillText(line2, w / 2, h - barH + barH * 0.72, w - 16);
    ctx.restore();
  } catch (e) {
    /* the stamp is best-effort */
  }
}

function compressDataUrl(src, maxDim = 1280, quality = 0.75, stamp = null) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onerror = () => resolve(src);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (stamp) drawEvidenceStamp(ctx, canvas.width, canvas.height, stamp);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        resolve(src);
      }
    };
    img.src = src;
  });
}

function fileToDataUrl(file, maxDim = 1280, quality = 0.75, stamp = null) {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(compressDataUrl(reader.result, maxDim, quality, stamp));
    reader.readAsDataURL(file);
  });
}

// Legal audit stamp for a completed delivery: exact ISO time plus a GPS fix.
// Never blocks: a denied / missing / slow (>4 s) GPS just yields gps: null.
async function captureAuditStamp() {
  const capturedAt = new window.Date().toISOString();
  const g = await getGps({ timeout: 4000 });
  return g.ok
    ? { capturedAt, gps: { lat: g.lat, lng: g.lng, accuracy: g.accuracy }, gpsStatus: "ok" }
    : { capturedAt, gps: null, gpsStatus: g.reason || "unavailable" };
}

function randomIsraelCoord() {
  // Rough bounding box for Israel
  const lat = (31.2 + Math.random() * 1.9).toFixed(6);
  const lng = (34.5 + Math.random() * 1.0).toFixed(6);
  return `${lat}, ${lng}`;
}

/* =========================================================================
   PAYROLL & PRICING HELPERS
   ========================================================================= */
// Global fallback rates — the Admin can change these at any time from the
// Courier Payroll tab, and every order without its own custom price will
// immediately follow the new default.
// perAttempt  (aka DEFAULT_VISIT_FEE)      — ₪20 paid for every visit made.
// perCompleted (aka DEFAULT_DELIVERED_FEE) — the MAXIMUM payout for one whole
//                                            order (₪60). It is both the hard
//                                            cap, and the flat amount paid at
//                                            once when the order is completed
//                                            on the very first visit (the
//                                            "first-visit success incentive").
//                                            See calcOrderEarnings.
const DEFAULT_PRICING = { perAttempt: 20, perCompleted: 60 };

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function monthKeyOf(timestamp) {
  return (timestamp || "").slice(0, 7); // "YYYY-MM"
}

// The calendar-day part of a "YYYY-MM-DD HH:MM" timestamp — used to enforce
// the one-visit-per-calendar-day legal limit on delivery attempts.
function dayKeyOf(timestamp) {
  return (timestamp || "").slice(0, 10); // "YYYY-MM-DD"
}

// Morning / Afternoon / Evening bucket for a timestamp's hour — attempts on
// different days are also nudged toward different times of day, which is
// what Israeli courts look for as evidence of genuinely separate visits
// rather than the same window logged twice.
function timeOfDay(timestamp) {
  const hour = Number((timestamp || "").slice(11, 13));
  if (!Number.isFinite(hour)) return "בוקר";
  if (hour < 12) return "בוקר";
  if (hour < 17) return "אחר הצהריים";
  return "ערב";
}

// Legal visit windows (Regulation 161 practice): every "no answer" visit must
// fall in a DIFFERENT window on a DIFFERENT calendar day.
const VISIT_WINDOWS = [
  { key: "בוקר", from: 8, to: 13, label: "בוקר (08:00–13:00)" },
  { key: "צהריים", from: 13, to: 17, label: "צהריים (13:00–17:00)" },
  { key: "ערב", from: 17, to: 21, label: "ערב (17:00–21:00)" },
];

function parseStamp(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(ts || "");
  return m ? new window.Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

// "בוקר" | "צהריים" | "ערב", or null for a time outside 08:00–21:00.
function visitWindowOf(ts) {
  const d = parseStamp(ts);
  if (!d) return null;
  const h = d.getHours();
  const w = VISIT_WINDOWS.find((x) => h >= x.from && h < x.to);
  if (w) return w.key;
  return h === 21 && d.getMinutes() === 0 ? "ערב" : null;
}

// When may the next visit happen? Next calendar day or later, inside a window
// that has not been used yet. Returns null when the last visit can't be parsed
// (the caller then keeps the old "next calendar day" rule).
function nextVisitGate(order, nowMs) {
  const attempts = order.attempts || [];
  const last = attempts[attempts.length - 1];
  const lastDate = last && parseStamp(last.timestamp);
  if (!lastDate) return null;
  const done = attempts.filter((a) => a.type === "אין מענה").map((a) => ({ ts: a.timestamp, win: visitWindowOf(a.timestamp) }));
  const used = done.map((d) => d.win).filter(Boolean);
  let allowed = VISIT_WINDOWS.filter((w) => !used.includes(w.key));
  if (!allowed.length) allowed = VISIT_WINDOWS;
  for (let off = 1; off <= 14; off += 1) {
    const y = lastDate.getFullYear();
    const mo = lastDate.getMonth();
    const d0 = lastDate.getDate() + off;
    for (const w of allowed) {
      const start = new window.Date(y, mo, d0, w.from, 0, 0).getTime();
      const end = new window.Date(y, mo, d0, w.to, 0, 0).getTime();
      if (end > nowMs) {
        return { open: start <= nowMs, opensAt: Math.max(start, nowMs), windowStart: start, window: w, allowed, done };
      }
    }
  }
  return null;
}

// "מחר" / "היום" / dd/mm for the day a window opens.
function gateDayWord(startMs, nowMs) {
  const a = new window.Date(startMs);
  const b = new window.Date(nowMs);
  const diff = Math.round(
    (new window.Date(a.getFullYear(), a.getMonth(), a.getDate()) - new window.Date(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000
  );
  if (diff <= 0) return "היום";
  if (diff === 1) return "מחר";
  return `ב-${pad(a.getDate())}/${pad(a.getMonth() + 1)}`;
}

function monthLabel(monthKey) {
  const [y, m] = (monthKey || "").split("-").map(Number);
  if (!y || !m) return monthKey;
  return `${HEBREW_MONTHS[m - 1]} ${y}`;
}

function formatILS(n) {
  return `₪${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;
}

// Resolves the effective per-attempt / per-completed rates for one order:
// a per-order override always wins over the current global default, and can
// be set, changed, or cleared by the Admin at any point in the order's life.
function getOrderRates(order, pricing) {
  return {
    perAttempt: order.priceOverride?.perAttempt ?? pricing.perAttempt,
    perCompleted: order.priceOverride?.perCompleted ?? pricing.perCompleted,
  };
}

// Computes visits / completions / payout for one order, optionally scoped to
// a single "YYYY-MM" month. Pass monthKey = null for the order's all-time total.
//
// Payout model (defaults: ₪20 per visit, ₪60 full-completion amount):
//   • A visit that does NOT complete the order (no answer) pays the visit rate (₪20).
//   • ANY completion — signed delivery, documented refusal, or the visit-3
//     door posting — brings the order's cumulative total up to the full ₪60:
//       visit 1 completion  → ₪60                     (first-visit incentive)
//       visit 2 completion  → ₪20 + ₪40 = ₪60         (visit 2 pays ₪40)
//       visit 3 completion  → ₪20 + ₪20 + ₪20 = ₪60   (visit 3 pays ₪20)
//   • No order can ever exceed the cap (a per-order custom amount is honoured
//     in place of ₪60).
//
// The order's TOTAL is worked out over its whole life, then split visit by
// visit; a month-scoped call only returns the part earned by visits inside
// that month (so an order spanning a month boundary is never paid twice).
// `perVisit` is the visit-by-visit breakdown shown in the Courier and Admin
// payout lists. `completionBonus` is true when the order reached its full
// completion payout inside the requested scope; `firstVisitBonus` is the
// special case where that happened on visit 1.
// Who performed a visit: the courier stamped on the visit itself; older visits fall back to the order's courier.
function visitCourierName(order, attempt) {
  return (attempt && attempt.courier) || (order && order.assignedCourier) || "";
}
// Optional 4th argument `courierName`: only that courier's own visits are paid to him. The ₪ cap is still
// computed over the whole order (one shared cap), so a reassignment never changes the order's total cost
// and never takes away what an earlier courier already earned.
function calcOrderEarnings(order, pricing, monthKey = null, courierName = null) {
  const rates = getOrderRates(order, pricing);
  const cap = rates.perCompleted;
  // A documented refusal legally ends the delivery process just like a signed
  // delivery or a door posting, so all three count as completing the order.
  const isCompletion = (a) =>
    a.type === STATUS.DELIVERED || a.type === STATUS.POSTED || a.type === STATUS.REFUSED;

  let paidSoFar = 0;
  let stopped = false;
  const allVisits = [];
  effectiveAttempts(order).forEach((a, i) => {
    // Nothing is paid after the order has been completed.
    if (stopped) {
      allVisits.push({ attempt: a, visitNo: i + 1, pay: 0, kind: "visit" });
      return;
    }
    let pay;
    let kind = "visit";
    if (isCompletion(a)) {
      // Completion always lands the cumulative total on the full amount.
      pay = Math.max(0, cap - paidSoFar);
      kind = i === 0 ? "firstVisitBonus" : "completion";
      stopped = true;
    } else {
      pay = Math.max(0, Math.min(rates.perAttempt, cap - paidSoFar));
    }
    paidSoFar += pay;
    allVisits.push({ attempt: a, visitNo: i + 1, pay, kind });
  });

  const ownVisits = courierName ? allVisits.filter((v) => visitCourierName(order, v.attempt) === courierName) : allVisits;
  const perVisit = monthKey
    ? ownVisits.filter((v) => monthKeyOf(v.attempt.timestamp) === monthKey)
    : ownVisits;
  const total = perVisit.reduce((sum, v) => sum + v.pay, 0);
  return {
    visits: perVisit.length,
    completed: perVisit.filter((v) => isCompletion(v.attempt)).length,
    total: Math.min(total, cap),
    rates,
    perVisit,
    firstVisitBonus: perVisit.some((v) => v.kind === "firstVisitBonus"),
    completionBonus: perVisit.some((v) => v.kind === "firstVisitBonus" || v.kind === "completion"),
    // How much more than a plain ₪20 visit the first-visit incentive paid.
    bonusAmount: Math.max(0, cap - rates.perAttempt),
  };
}

// Admin-only profitability of one order:
//   Net Margin = Client Total Price - Courier Cost.
// The courier cost is capped at the completed-task rate (₪60 by default). For
// a finished order it is what the courier actually earned; for an order still
// in the field the full cap is reserved (worst case), so the margin shown is
// conservative until the task closes.
function calcOrderMargin(order, pricing) {
  const price = calcClientPrice(order);
  const earnings = calcOrderEarnings(order, pricing);
  const cap = earnings.rates.perCompleted;
  const finished = isOrderCompleted(order);
  const courierCost = finished ? Math.min(earnings.total, cap) : Math.max(earnings.total, cap);
  const margin = price.total - courierCost;
  return {
    price,
    courierCost,
    cap,
    finished,
    margin,
    marginPct: price.total > 0 ? Math.round((margin / price.total) * 100) : 0,
  };
}

// Text of the Lawyer/Client notification for a completed, signed order.
function completionNotificationText(o) {
  return o.status === STATUS.DELIVERED
    ? `הודעה: בוצעה מסירה בהצלחה עבור מס' משימה ${formatOrderNum(o.id, true)}`
    : o.status === STATUS.POSTED
    ? `הודעה: בוצעה הדבקה על הדלת (ביקור 3) עבור מס' משימה ${formatOrderNum(o.id, true)}`
    : `הודעה: תועד סירוב קבלה עבור מס' משימה ${formatOrderNum(o.id, true)}`;
}

// Green chip shown wherever an order's payout is listed once the order has
// reached its full completion payout (₪60 by default).
function FirstVisitBonusChip({ calc }) {
  if (!calc || !calc.completionBonus) return null;
  return (
    <span className={`${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>
      {calc.firstVisitBonus ? "🎉 בונוס ביקור ראשון" : "✅ בונוס השלמה"} {formatILS(calc.rates.perCompleted)}
    </span>
  );
}

// "מסירה" / "סירוב מתועד" / "הדבקה" — what the completing visit was.
function completionLabel(type) {
  return type === STATUS.REFUSED ? "סירוב מתועד" : type === STATUS.POSTED ? "הדבקה" : "מסירה";
}

// Collects every distinct "YYYY-MM" present in the data (plus the current
// month, so the selector always has somewhere useful to land), newest first.
function getAllMonthKeys(orders) {
  const set = new window.Set([monthKeyOf(nowStamp(0))]);
  orders.forEach((o) => {
    set.add(monthKeyOf(o.createdDate));
    o.attempts.forEach((a) => set.add(monthKeyOf(a.timestamp)));
  });
  return Array.from(set).sort().reverse();
}

// A courier's payment status is tracked per (courier, month) pair — this key
// is shared by the Admin payroll table, the toggle handler, and the courier's
// own "My Earnings" view so all three always agree on the same record.
function paymentKey(courier, monthKey) {
  return `${courier}__${monthKey}`;
}

// Upgrade 4 — display form of an order number. The internal id (what the
// database stores and every lookup uses) is never changed: "ORD-1003" and
// "1003" both display as "#1003". `plain` drops the "#" (file names, URLs).
function orderNumberOf(id) {
  return String(id == null ? "" : id).replace(/^\s*ORD[-_\s]*/i, "").trim();
}
function formatOrderNum(id, plain) {
  const n = orderNumberOf(id);
  if (!n) return "";
  return plain || !/^\d+$/.test(n) ? n : `#${n}`;
}
// Cleans free text (notification messages written by the database triggers
// still contain the raw id): "ORD-1003" -> "#1003".
function cleanOrderText(text) {
  return String(text == null ? "" : text).replace(/#?\bORD-(\d+)/gi, "#$1");
}

// Demo mode: next number = highest existing numeric order number (with or
// without the legacy "ORD-" prefix) + 1 — "1001", "1002", "1003" …
function nextDemoOrderId(orders) {
  const max = orders.reduce((m, o) => {
    const n = /^\d+$/.test(orderNumberOf(o.id)) ? Number(orderNumberOf(o.id)) : 0;
    return Math.max(m, n);
  }, 1000);
  return String(max + 1);
}

function genId(prefix) {
  return `${prefix}-${window.Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// An order is "terminal" once the service is legally complete — delivered,
// posted on the door, or a documented refusal. Only terminal orders have an
// affidavit for the courier to sign.
function isTerminalOrder(o) {
  return o.status === STATUS.DELIVERED || o.status === STATUS.POSTED || o.status === STATUS.REFUSED;
}

// ONE definition of "this delivery is finished" used by every screen: a final
// status (Hebrew or English), a signed affidavit, a courier signature or the
// explicit completed / closed flags.
const COMPLETED_STATUS_WORDS = new window.Set([
  "delivered", "נמסר", "completed", "הושלם", "pasted", "posted", "הודבק", "הדבקה", "refused", "סורב", "סירוב",
]);
function isOrderCompleted(o) {
  if (!o) return false;
  if (isTerminalOrder(o) || COMPLETED_STATUS_WORDS.has(o.status)) return true;
  return !!(o.completed === true || o.taskClosed || o.affidavitSigned || o.courierSignature || isAffidavitSigned(o));
}

// The visits used for pay / counts. A finished order always counts at least
// one completing visit, even if its visit rows were never saved.
function effectiveAttempts(order) {
  const real = (order && order.attempts) || [];
  const isCompletion = (a) => a.type === STATUS.DELIVERED || a.type === STATUS.POSTED || a.type === STATUS.REFUSED;
  if (!isOrderCompleted(order) || real.some(isCompletion)) return real;
  const ts =
    order.completedAt || (order.affidavit && order.affidavit.signedAt) || order.lastVisitAt || order.createdAt || "";
  return [...real, { type: isTerminalOrder(order) ? order.status : STATUS.DELIVERED, timestamp: ts, synthetic: true }];
}

// A law firm may cancel an order only while NO courier has been assigned
// (the admin has not dispatched it yet). Once `assignedCourier` is set the
// button disappears — the courier may already be on the way.
function canCancelOrder(o) {
  return !!o && !o.assignedCourier && o.status === STATUS.PENDING;
}

// Upgrade 2 — a cancelled order (Hebrew or English status). Cancelled orders
// never appear in an "active" list; they live only in the Admin "בוטלו" view
// and the lawyer's collapsible "מסירות שבוטלו" section, where they can be
// permanently deleted.
function isOrderCancelled(o) {
  return !!o && (o.status === "cancelled" || o.status === "canceled" || o.status === STATUS.CANCELED || o.status === "בוטל");
}

// Hidden-order memory (browser only). Used when the database refuses a delete
// the user is not allowed to make (a lawyer, before lawyer-actions.sql is
// installed): the order disappears for that user for good instead of coming
// back on the next refresh.
const HIDDEN_ORDERS_KEY = "mesirot.hiddenOrders";
// Same idea for the lawyer's verification when the database RPC is missing.
const LAWYER_VERIFY_KEY = "mesirot.lawyerVerifications";
function readLocalVerifications() {
  try {
    return JSON.parse(window.localStorage.getItem(LAWYER_VERIFY_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}
function rememberLawyerVerification(id, fields) {
  try {
    const all = readLocalVerifications();
    all[id] = fields;
    window.localStorage.setItem(LAWYER_VERIFY_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage full / unavailable — the verification stays in memory only */
  }
}
function readHiddenOrderIds() {
  try {
    return new window.Set(JSON.parse(window.localStorage.getItem(HIDDEN_ORDERS_KEY) || "[]"));
  } catch (e) {
    return new window.Set();
  }
}
function rememberHiddenOrderId(id) {
  try {
    const set = readHiddenOrderIds();
    set.add(id);
    window.localStorage.setItem(HIDDEN_ORDERS_KEY, JSON.stringify([...set]));
  } catch (e) {
    /* storage unavailable — the order is still removed for this session */
  }
}

// The courier's signed affidavit lives on the order itself as
// `order.affidavit = { signature: <base64 PNG data URL>, signedAt, signedBy }`
// — so the Admin dashboard, the Lawyer portal and the downloadable HTML all
// read the exact same record.
function isAffidavitSigned(o) {
  return !!(o && o.affidavit && o.affidavit.signature);
}

// Courier assignment may only be edited while the task is waiting for a courier
// or still active. Finished tasks (completed / terminal status / signed
// affidavit / closed) are locked to preserve legal data integrity.
function isAssignmentLocked(o) {
  if (!o) return true;
  if (o.completed === true || o.taskClosed || o.affidavitStatus === "signed") return true;
  if (isTerminalOrder(o) || isAffidavitSigned(o)) return true;
  return !(o.status === STATUS.PENDING || o.status === STATUS.IN_PROGRESS || o.status === STATUS.PENDING_NEXT_VISIT);
}

// Escapes user-supplied text before it is placed into the affidavit HTML.
function escHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Phase-1 hardening: safe media sources, signed-URL guard, coordinates ----
// Anything that ends up in an <img>/<audio>/<video> src or in generated HTML
// must pass isSafeMediaSrc(): either a base64 image/audio/video data URL (never
// SVG), a local blob: URL of the current session (only where allowBlob is set),
// or an https URL of THIS project's public "evidence" bucket. Temporary signed
// URLs (/object/sign/ or ?token=) are display-only and are never trusted from
// stored data.
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;
const SAFE_DATA_MEDIA = /^data:(?:audio|video)\/[a-z0-9.+-]+(?:;codecs=[a-z0-9.,-]+)?;base64,[A-Za-z0-9+/]+={0,2}$/i;
function supabaseHostOf() {
  try {
    return SUPABASE_URL ? new window.URL(SUPABASE_URL).host : "";
  } catch (e) {
    return "";
  }
}
function isSafeMediaSrc(v, opts) {
  const o = opts || {};
  if (typeof v !== "string" || !v || v.length > 16000000) return false;
  // Permanent private-storage reference ("evidence/<orderId>/…"): display only, resolved to a signed URL first.
  if (o.allowRef && /^evidence\/[A-Za-z0-9._~%\/-]+$/.test(v) && !v.includes("..")) return true;
  if (v.startsWith("data:")) return SAFE_DATA_IMAGE.test(v) || (o.kind === "media" && SAFE_DATA_MEDIA.test(v));
  if (v.startsWith("blob:")) return !!o.allowBlob && /^blob:https?:\/\/[^\s"'<>]+$/i.test(v);
  let u;
  try {
    u = new window.URL(v);
  } catch (e) {
    return false;
  }
  if (/[\s"'<>`\\]/.test(v)) return false;
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (/\/object\/sign\//.test(u.pathname) || u.searchParams.has("token")) return false;
  const host = supabaseHostOf();
  if (host ? u.host !== host : !/\.supabase\.co$/i.test(u.hostname)) return false;
  return /^\/storage\/v1\/object\/public\/evidence\/[^?#]+$/.test(u.pathname);
}
// A signed (temporary) URL must never be written to orders / visits. Turn it
// back into the permanent public-style URL of the same object (the path is
// what identifies the file); any query string is dropped.
function stripSignedUrl(v) {
  if (typeof v !== "string" || !/^https:\/\//i.test(v)) return v;
  try {
    const u = new window.URL(v);
    const m = /^\/storage\/v1\/object\/(?:sign|public)\/evidence\/(.+)$/.exec(u.pathname);
    if (!m) return v;
    if (u.pathname.includes("/object/sign/") || u.search) return `${u.origin}/storage/v1/object/public/evidence/${m[1]}`;
    return v;
  } catch (e) {
    return v;
  }
}
function safeCoord(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 180 ? n : null;
}
// <img> for generated documents: only a validated source, always escaped.
function safeImgTag(src, alt, style) {
  if (!isSafeMediaSrc(src)) return '<span class="meta">(תמונה לא זמינה)</span>';
  return `<img src="${escHtml(src)}" alt="${escHtml(alt || "")}"${style ? ` style="${escHtml(style)}"` : ""} />`;
}
// Generated documents (affidavit, certificate, label) run no script at all and
// may load images only as data: URLs or from this project's evidence host.
function docCspMeta() {
  const host = supabaseHostOf();
  const img = host ? `data: https://${host}` : "data:";
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${escHtml(img)}; style-src 'unsafe-inline'; font-src data:; form-action 'none'" />`;
}

// Builds a full, self-contained, print-ready Hebrew/RTL "תצהיר מוסר" (affidavit
// of service) for one order, laid out for A4 in the style of an Israeli court
// filing under LEGAL_REFS.regulations:
//   caption (court / case / parties) → title → declarant details → numbered
//   statements → visits table (timestamps + GPS) → attached media → result →
//   declaration + courier signature → attorney verification block.
// Shared by the in-app preview, the print button and the .html download, so
// all of them always produce the exact same record.
//
// NOTE: the attorney block is pre-filled with the ordering attorney's details
// but is intentionally left UNSIGNED — only a licensed attorney may verify.
// "המסמך נמסר ל…: שם (קרבה / תפקיד)" — escaped, for the affidavit and certificate.
function receiverStatement(a) {
  if (!a || !a.deliveredToType) return "";
  return `המסמך נמסר ל${escHtml(a.deliveredToType)}${
    a.receiverName ? `: <strong>${escHtml(a.receiverName)}</strong>${a.receiverRelation ? ` (${escHtml(a.receiverRelation)})` : ""}` : ""
  }.${a.verifiedIdType ? ` זהות הנמען אומתה בתעודה מזהה — ${escHtml(idVerificationText(a))}.` : ""}`;
}

// ---- Chain of custody (שרשרת משמורת) ---------------------------------------
// Registered / legal / bank deliveries keep a documented timeline. Stored in
// orders.data: pickedUpAt, pickedUpBy, custodyLog[]. Step 2 falls back to the
// assignment time (or first visit) if nobody pressed the pick-up button.
function needsCustody(o) {
  return !!o && trackOf(o) !== "standard";
}
function markPickedUp(o, by, role) {
  if (!o || o.pickedUpAt) return o;
  const at = nowStamp(0);
  return {
    ...o,
    pickedUpAt: at,
    pickedUpBy: by || "",
    custodyLog: [...(o.custodyLog || []), { event: "picked_up", at, by: by || "", role: role || "" }],
  };
}
function buildCustodyChain(o) {
  const att = (o.attempts || []).filter((a) => !a.synthetic);
  const gpsOf = (a) => (a.lat != null && a.lng != null ? `${a.lat}, ${a.lng}` : a.gpsMissing ? "ללא GPS" : a.location || "ללא GPS");
  const steps = [];
  steps.push({ n: 1, label: "פתיחת הזמנה במערכת", at: o.createdDate || o.createdAt || "", detail: o.submittedBy || "" });
  let pickAt = o.pickedUpAt || "";
  let detail = o.pickedUpBy ? `נקלט על ידי ${o.pickedUpBy}` : "";
  if (!pickAt) {
    if (o.assignedAt) {
      pickAt = o.assignedAt;
      detail = "מולא אוטומטית לפי שיבוץ השליח";
    } else if (att[0]) {
      pickAt = att[0].timestamp || "";
      detail = "מולא אוטומטית לפי הביקור הראשון";
    }
  }
  steps.push({ n: 2, label: "קליטת מעטפה / איסוף לשליח", at: pickAt, detail, pending: !pickAt });
  steps.push({
    n: 3,
    label: "ניסיונות מסירה בשטח",
    at: "",
    detail: att.length ? "" : "טרם בוצעו ביקורים",
    pending: !att.length,
    items: att.map((a, i) => ({ at: a.timestamp || "", text: `ביקור ${i + 1} — ${a.type}`, gps: gpsOf(a) })),
  });
  const last = att[att.length - 1];
  const finished = last && (last.type === STATUS.DELIVERED || last.type === STATUS.REFUSED || last.type === STATUS.POSTED);
  const signedAt = o.affidavit && o.affidavit.signedAt;
  steps.push({
    n: 4,
    label: "סיום מסירה וחתימה",
    at: finished ? last.timestamp || o.completedAt || "" : "",
    detail: finished ? `${last.type}${signedAt ? ` · חתימת השליח על המסמך ב-${signedAt}` : ""}` : "טרם הסתיימה",
    pending: !finished,
  });
  return steps;
}
function custodyHtml(o) {
  if (!needsCustody(o)) return "";
  const li = (st) =>
    `<li><strong>${st.n}. ${escHtml(st.label)}:</strong> ${
      st.pending && !st.at ? `<span style="color:#9ca3af">${escHtml(st.detail || "טרם התבצע")}</span>` : `${escHtml(st.at)}${st.detail ? ` — ${escHtml(st.detail)}` : ""}`
    }${
      st.items && st.items.length
        ? `<ul style="margin:2px 0 0;padding-right:18px">${st.items
            .map((it) => `<li>${escHtml(it.text)} · ${escHtml(it.at)} · GPS: <span dir="ltr">${escHtml(it.gps)}</span></li>`)
            .join("")}</ul>`
        : ""
    }</li>`;
  return `<div style="margin-top:18px;border:1px solid #9ca3af;padding:10px 14px;page-break-inside:avoid;font-size:12.5px">
    <h3 style="margin:0 0 6px;font-size:14px">שרשרת משמורת (Chain of Custody)</h3>
    <ol style="margin:0;padding-right:20px;list-style:none">${buildCustodyChain(o).map(li).join("")}</ol>
  </div>`;
}

// Upgrade 3 — lawyer verification helpers.
// "עו"ד ישראל ישראלי" / "עו״ד ישראל ישראלי" -> "ישראל ישראלי"
function bareLawyerName(name) {
  return String(name || "").replace(/^עו["״]ד\s*/, "").trim();
}
function todayDdMmYyyy() {
  const d = new window.Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
// Clean rectangular blue stamp: "עו״ד <name> | מ.ר. <license>". Returns a PNG
// data URL (transparent background), or "" if canvas is unavailable.
function makeLawyerStampDataUrl(name, license) {
  try {
    const W = 520;
    const H = 170;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const blue = "#1d4ed8";
    ctx.strokeStyle = blue;
    ctx.fillStyle = blue;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W - 32, H - 32);
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 40px Heebo, Arial, sans-serif";
    ctx.fillText(`עו״ד ${bareLawyerName(name)}`, W / 2, 62, W - 70);
    ctx.font = "600 30px Heebo, Arial, sans-serif";
    ctx.fillText(`מ.ר. ${license || "________"}`, W / 2, 114, W - 70);
    return c.toDataURL("image/png");
  } catch (e) {
    return "";
  }
}

function buildAffidavitHtml(order, kind) {
  // Standard / municipal tracks get the official delivery certificate instead
  // of the court affidavit. Legal orders continue below, unchanged.
  if (kind === "certificate" || !usesAffidavit(order)) return buildDeliveryCertificateHtml(order);
  const attempts = order.attempts || [];
  const last = attempts[attempts.length - 1];
  const courier = order.courierInfo || lookupCourier(order.assignedCourier);
  const lawyer = order.lawyerInfo || LAWYER_PROFILES[order.submittedBy] || { licenseNo: "________", firm: "", address: "", phone: "" };
  const lawyerVerified = !!(order.lawyerVerifiedAt || order.lawyerSignature);
  const lawyerBare = bareLawyerName(order.submittedBy);
  const docLabel = order.docType === "אחר" ? order.customDocType || "אחר" : order.docType;
  const fullAddress = `${order.street} ${order.houseNumber}${order.apartment ? `, דירה ${order.apartment}` : ""}${
    order.floor ? `, קומה ${order.floor}` : ""
  }, ${order.city}`;
  const defendant = order.defendant || order.recipientName;
  const signed = !!(order.affidavit && order.affidavit.signature);
  const dayKeys = attempts.map((a) => dayKeyOf(a.timestamp));
  const distinctDays = attempts.length > 1 && new window.Set(dayKeys).size === attempts.length;

  const visitRows = attempts.length
    ? attempts
        .map((a, i) => {
          const map = mapUrlFor(a);
          const media = [
            a.photo ? (a.photo.kind === "video" ? "וידאו" : "תמונה") : null,
            a.audio || a.audioRecorded ? "הקלטת שמע" : null,
            a.signatureDataUrl ? "חתימת נמען" : null,
          ].filter(Boolean);
          return `<tr>
            <td>${i + 1}</td>
            <td>${escHtml(a.timestamp)}</td>
            <td>${escHtml(a.type)}</td>
            <td dir="ltr" style="text-align:right">${escHtml(a.location)}${
              map ? ` <a href="${map}">מפה</a>` : ""
            }${a.gpsAccuracy != null ? ` (±${escHtml(a.gpsAccuracy)} מ')` : ""}${a.gpsMissing ? " ללא GPS" : ""}</td>
            <td>${media.length ? media.join(", ") : "—"}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5">טרם בוצעו ביקורים</td></tr>`;

  const mediaHtml = attempts
    .map((a, i) => {
      const parts = [];
      if (a.photo && a.photo.dataUrl) {
        parts.push(
          a.photo.kind === "video"
            ? `<p class="meta">ביקור ${i + 1}: קובץ וידאו מצורף בתיק הדיגיטלי (${escHtml(a.photo.timestamp)}${
                a.photo.gps ? ` · ${escHtml(a.photo.gps)}` : ""
              })</p>`
            : `<figure>${safeImgTag(a.photo.dataUrl, `תיעוד ביקור ${i + 1}`)}<figcaption>ביקור ${i + 1} — ${escHtml(
                a.photo.timestamp
              )}${a.photo.gps ? ` · ${escHtml(a.photo.gps)}` : ""}</figcaption></figure>`
        );
      }
      if (a.signatureDataUrl) {
        parts.push(
          `<figure>${safeImgTag(a.signatureDataUrl, "חתימת הנמען", "background:#fff")}<figcaption>חתימת הנמען — ביקור ${
            i + 1
          }</figcaption></figure>`
        );
      }
      if (a.audio) {
        parts.push(`<p class="meta">ביקור ${i + 1}: הקלטת שמע נשמרה ומצורפת בתיק הדיגיטלי.</p>`);
      } else if (a.audioRecorded || a.audioSaveFailed) {
        parts.push(`<p class="meta">ביקור ${i + 1}: בוצעה הקלטת שמע במהלך הביקור, אך קובץ ההקלטה אינו שמור בתיק הדיגיטלי.</p>`);
      }
      return parts.join("");
    })
    .join("");

  let outcome = "טרם הושלמה מסירת המסמך.";
  if (order.status === STATUS.DELIVERED && last) {
    outcome = `בביקור מס' ${attempts.length} נמסר המסמך${last.deliveredToType ? "" : " לידי הנמען"}${
      last.signatureDataUrl ? ", והמקבל אישר את קבלתו בחתימה דיגיטלית (מצורפת להלן)" : ""
    }.${last.deliveredToType ? ` ${receiverStatement(last)}` : ""}`;
  } else if (order.status === STATUS.REFUSED && last) {
    outcome = `בביקור מס' ${attempts.length} סירב הנמען לקבל את המסמך. ${
      last.audio ? "הסירוב תועד בצילום ובהקלטת שמע שנשמרה בתיק הדיגיטלי." : "הסירוב תועד בצילום; קובץ הקלטת שמע אינו שמור בתיק הדיגיטלי."
    } ${escHtml(
      last.notes || ""
    )}`;
  } else if (order.status === STATUS.POSTED && last) {
    outcome = `לאחר ${Math.max(0, attempts.length - 1)} ביקורים קודמים בהם לא נמצא מי שיקבל את המסמך, בביקור מס' ${
      attempts.length
    } הודבק המסמך על דלת הנמען. ההדבקה תועדה בצילום.${
      last.residenceVerification
        ? ` לפני ההדבקה אימתתי כי הנמען מתגורר / פועל בכתובת, באמצעות: ${escHtml(last.residenceVerification)}${
            last.verificationNote ? ` (${escHtml(last.verificationNote)})` : ""
          }.`
        : ""
    }`;
  }

  const reportDate = (last && last.timestamp) || order.createdDate;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8" />
${docCspMeta()}
<base target="_blank" />
<title>תצהיר מוסר — ${escHtml(formatOrderNum(order.id))}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Heebo', 'David', Arial, sans-serif; color: #111827; font-size: 13.5px; line-height: 1.85; margin: 0; padding: 24px 28px; background: #fff; }
  .court { text-align: center; font-weight: 700; font-size: 16px; }
  .caption { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; font-size: 13px; }
  .parties { margin: 14px 0 6px; border-top: 1px solid #111827; border-bottom: 1px solid #111827; padding: 8px 0; }
  .parties .row { display: flex; gap: 12px; }
  .parties .role { width: 90px; font-weight: 700; }
  .vs { text-align: center; font-weight: 700; margin: 2px 0; }
  h1 { text-align: center; font-size: 21px; margin: 18px 0 2px; text-decoration: underline; }
  .sub { text-align: center; font-size: 12px; color: #4b5563; margin-bottom: 16px; }
  ol { padding-right: 22px; margin: 8px 0; }
  ol li { margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 12px; }
  th, td { border: 1px solid #9ca3af; padding: 5px 7px; text-align: right; vertical-align: top; }
  th { background: #f3f4f6; }
  figure { display: inline-block; margin: 6px 0 6px 10px; text-align: center; page-break-inside: avoid; }
  figure img { height: 120px; max-width: 220px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 4px; }
  figcaption, .meta { font-size: 11px; color: #6b7280; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 22px; page-break-inside: avoid; }
  .sig-line { width: 210px; height: 56px; border-bottom: 1px solid #111827; }
  .verify { margin-top: 26px; border: 1.5px solid #111827; padding: 12px 16px; page-break-inside: avoid; }
  .verify h2 { font-size: 15px; margin: 0 0 6px; text-align: center; }
  .foot { margin-top: 14px; font-size: 10.5px; color: #6b7280; text-align: center; }
  a { color: #1d4ed8; }
  @media print { a { color: #111827; text-decoration: none; } }
</style>
</head>
<body>
  <div class="court">${escHtml(order.court || "בית המשפט")}</div>
  <div class="caption">
    <div>תיק מס': <strong>${escHtml(order.caseNumber || "—")}</strong></div>
    <div>מס' מסירה: ${escHtml(formatOrderNum(order.id))}</div>
  </div>
  <div class="parties">
    <div class="row"><span class="role">התובע / המבקש:</span><span>${escHtml(order.plaintiff || "—")}</span></div>
    <div class="vs">— נגד —</div>
    <div class="row"><span class="role">הנתבע / המשיב:</span><span>${escHtml(defendant)}</span></div>
  </div>

  <h1>תצהיר מוסר</h1>
  <p class="sub">המצאת מסמך בהתאם ל${escHtml(LEGAL_REFS.regulations)} (${escHtml(LEGAL_REFS.serviceRule)})</p>

  <p>
    אני הח"מ, <strong>${escHtml(order.assignedCourier || "השליח המשובץ")}</strong>${
      courier
        ? `, נושא/ת ת.ז. / רישיון שליח מס' <strong>${escHtml(courier.licenseNumber)}</strong>, טלפון ${escHtml(courier.phone)}`
        : ""
    }, לאחר שהוזהרתי כי עליי לומר את האמת וכי אהיה צפוי/ה לעונשים הקבועים בחוק אם לא אעשה כן, מצהיר/ה בזאת בכתב כדלקמן:
  </p>

  <ol>
    <li>
      שימשתי כשליח מוסר מטעם ${escHtml(lawyer.firm || order.submittedBy || "משרד עורכי הדין")} והופניתי להמציא את המסמך
      "<strong>${escHtml(docLabel)}</strong>" בתיק שבכותרת, לידי <strong>${escHtml(order.recipientName)}</strong>,
      ת.ז. <strong>${escHtml(order.idNumber)}</strong>${order.recipientRole ? ` (${escHtml(order.recipientRole)} בהליך)` : ""},
      בכתובת <strong>${escHtml(fullAddress)}</strong> (<a href="${addressNavUrl(order)}">ניווט לכתובת</a>).
    </li>
    <li>
      לצורך ההמצאה ביצעתי ${attempts.length} ${attempts.length === 1 ? "ביקור" : "ביקורים"} בכתובת
      ${distinctDays ? "(כל ביקור בתאריך שונה)" : ""}. בכל ביקור נרשמו תאריך ושעה מדויקים, מיקום GPS
      ותיעוד בצילום/וידאו ובהקלטת שמע, כמפורט בטבלה:
      <table>
        <thead><tr><th>#</th><th>תאריך ושעה</th><th>תוצאת הביקור</th><th>מיקום GPS</th><th>תיעוד מצורף</th></tr></thead>
        <tbody>${visitRows}</tbody>
      </table>
    </li>
    <li>${outcome}</li>
    <li>
      החומרים המצורפים (תמונות, וידאו, הקלטות וחתימות) נשמרו במערכת ובזיקה לכל ביקור, והם זמינים להצגה לבית המשפט
      על פי דרישה.
      <div>${mediaHtml || '<p class="meta">לא צורף תיעוד מדיה.</p>'}</div>
    </li>
    <li>זהו שמי, זו חתימתי, ותוכן תצהירי לעיל אמת.</li>
  </ol>

  <div class="sig-row">
    <div>
      <div class="meta">חתימת המצהיר/ה (השליח)</div>
      ${
        signed
          ? `${safeImgTag(order.affidavit.signature, "חתימת השליח", "height:60px;max-width:220px;")}<div class="meta">נחתם ב-${escHtml(
              order.affidavit.signedAt
            )}${order.affidavit.capturedBy ? ` (נקלט על ידי ${escHtml(order.affidavit.capturedBy)})` : ""}</div>`
          : '<div class="sig-line"></div><div class="meta">טרם נחתם</div>'
      }
    </div>
    <div style="text-align:left">
      <div class="meta">תאריך הפקת התצהיר</div>
      <div>${nowStamp(0)}</div>
    </div>
  </div>

  ${custodyHtml(order)}

  <div class="verify">
    <h2>אימות עורך דין</h2>
    <p>
      אני הח"מ, עו"ד <strong>${escHtml(String(order.submittedBy || "").replace(/^עו"ד\s*/, "") || "________")}</strong>,
      רישיון מס' <strong>${escHtml((lawyerVerified && order.lawyerLicenseNumber) || lawyer.licenseNo)}</strong>${lawyer.firm ? `, ${escHtml(lawyer.firm)}` : ""}${
        lawyer.address ? `, ${escHtml(lawyer.address)}` : ""
      }, מאשר/ת בזאת כי ביום ${lawyerVerified && order.lawyerVerificationDate ? `<strong>${escHtml(order.lawyerVerificationDate)}</strong>` : "______________"} הופיע/ה בפניי <strong>${escHtml(order.assignedCourier || "________")}</strong>,
      שזיהיתי באמצעות ת.ז. / רישיון שליח מס' ${escHtml(courier ? courier.licenseNumber : "____________")}, ולאחר שהזהרתיו/ה כי עליו/ה
      להצהיר את האמת וכי יהיה/תהיה צפוי/ה לעונשים הקבועים בחוק אם לא יעשה/תעשה כן, אישר/ה את נכונות הצהרתו/ה וחתם/ה עליה בפניי.
    </p>
    <div class="sig-row" style="margin-top:12px">
      <div>${lawyerVerified && order.lawyerSignature ? `${safeImgTag(order.lawyerSignature, "חתימת עורך הדין", "display:block;height:56px;max-width:230px;margin:0 auto -6px")}` : ""}<div class="sig-line"></div><div class="meta">חתימת עורך הדין</div></div>
      <div>${lawyerVerified && order.lawyerStamp ? `${safeImgTag(order.lawyerStamp, "חותמת עורך הדין", "display:block;height:64px;max-width:230px;margin:0 auto -6px")}` : ""}<div class="sig-line"></div><div class="meta">חותמת</div></div>
    </div>
    <p class="meta" style="margin:8px 0 0">${
      lawyerVerified
        ? `נחתם ואומת דיגיטלית בידי עו״ד ${escHtml(lawyerBare || "________")} בתאריך ${escHtml(order.lawyerVerificationDate || "________")}`
        : "האימות ייחתם בידי עורך הדין בלבד — המערכת ממלאת את פרטיו מראש אך אינה חותמת במקומו."
    }</p>
  </div>

  <p class="foot">הופק אוטומטית ממערכת מסירות משפטיות · ${escHtml(reportDate)} · כולל תיעוד GPS, מדיה ושמע לכל ביקור</p>
</body>
</html>`;
}

// "אישור מסירה רשמי — מסירות אקספרס": printable proof of delivery for the
// standard and municipal tracks (no court perjury text).
function buildDeliveryCertificateHtml(order) {
  const attempts = effectiveAttempts(order);
  const real = (order.attempts || []).filter((a) => !a.synthetic);
  const last = real[real.length - 1] || attempts[attempts.length - 1] || {};
  const t = DELIVERY_TRACKS[trackOf(order)];
  const fullAddress = `${order.street || ""} ${order.houseNumber || ""}${order.apartment ? `, דירה ${order.apartment}` : ""}, ${order.city || ""}`;
  const isAuthority = trackOf(order) === "municipal" || trackOf(order) === "bank";
  const clientName = order.submittedBy || "—";
  const sig = real.map((a) => a.signatureDataUrl).filter(Boolean).pop() || (typeof order.signature === "string" && order.signature !== "SIGNED" ? order.signature : "");
  const courierSig = order.affidavit && order.affidavit.signature;
  const gps = last.lat != null ? `${last.lat}, ${last.lng}` : last.location || "—";
  const exact = (last.audit && last.audit.capturedAt) || last.timestamp || order.completedAt || "—";
  const photos = real
    .filter((a) => a.photo && a.photo.dataUrl && a.photo.kind !== "video")
    .map((a, i) => `<figure>${safeImgTag(a.photo.dataUrl, "תמונת ביקור")}<figcaption>ביקור ${i + 1} · ${escHtml(a.type)} · ${escHtml(a.timestamp)}</figcaption></figure>`)
    .join("");
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8" />${docCspMeta()}<title>אישור מסירה ${escHtml(formatOrderNum(order.id))}</title>
<style>
  body { font-family: Heebo, Arial, sans-serif; color:#111827; padding: 28px; max-width: 760px; margin: 0 auto; }
  h1 { text-align:center; font-size: 22px; margin: 0 0 4px; }
  .sub { text-align:center; color:#6b7280; margin:0 0 18px; font-size: 13px; }
  table { width:100%; border-collapse: collapse; }
  th, td { border:1px solid #d1d5db; padding: 7px 10px; text-align:right; font-size: 13px; vertical-align: top; }
  th { background:#f3f4f6; width: 30%; }
  figure { display:inline-block; margin: 8px; text-align:center; }
  figure img { max-height: 150px; max-width: 220px; border:1px solid #d1d5db; }
  figcaption { font-size: 11px; color:#6b7280; }
  .sigs { display:flex; justify-content:space-between; margin-top: 22px; }
  .sigs img { height: 60px; max-width: 220px; }
  .foot { margin-top: 18px; font-size: 10.5px; color:#6b7280; text-align:center; }
</style></head>
<body>
  <h1>אישור מסירה רשמי — מסירות אקספרס</h1>
  <p class="sub">${escHtml(t.badge)} · מס' מסירה ${escHtml(formatOrderNum(order.id))}</p>
  <table>
    ${row("מס' הזמנה", escHtml(formatOrderNum(order.id)))}
    ${row("סוג מסירה", escHtml(t.badge))}
    ${row(trackOf(order) === "bank" ? "הבנק / המוסד הפיננסי / סניף" : isAuthority ? "הרשות / הלקוח" : "לקוח", escHtml(isAuthority && order.court ? `${order.court} (${clientName})` : clientName))}
    ${row("מספר אסמכתא", escHtml(order.caseNumber || "—"))}
    ${row("נמען", escHtml(order.recipientName || "—"))}
    ${row("כתובת", escHtml(fullAddress))}
    ${row("סוג המסמך", escHtml(order.docType === "אחר" ? order.customDocType || "אחר" : order.docType || "—"))}
    ${row("סטטוס מסירה", escHtml(order.status || "—"))}
    ${row("אופן המסירה", escHtml(last.notes || "—"))}
    ${last.verifiedIdType ? row("אימות זהות הנמען", escHtml(idVerificationText(last))) : ""}
    ${last.deliveredToType ? row("נמסר ל", `${escHtml(last.deliveredToType)}${last.receiverName ? ` — ${escHtml(last.receiverName)}${last.receiverRelation ? ` (${escHtml(last.receiverRelation)})` : ""}` : ""}`) : ""}
    ${row("תאריך ושעה מדויקים", escHtml(exact))}
    ${row("קואורדינטות GPS", `<span dir="ltr">${escHtml(gps)}</span>`)}
    ${row("שליח", escHtml(order.assignedCourier || last.courier || "—"))}
  </table>
  ${custodyHtml(order)}
  <h3>תמונות מהביקור</h3>
  <div>${photos || '<p class="meta">לא צורפו תמונות.</p>'}</div>
  <div class="sigs">
    <div><div>חתימת הנמען / מקבל</div>${sig ? safeImgTag(sig, "חתימת הנמען") : "<div>—</div>"}</div>
    <div><div>חתימת השליח</div>${courierSig ? safeImgTag(courierSig, "חתימת השליח") : "<div>טרם נחתם</div>"}${
      order.affidavit && order.affidavit.signedAt ? `<div style="font-size:11px">נחתם ב-${escHtml(order.affidavit.signedAt)}</div>` : ""
    }</div>
  </div>
  <p class="foot">הופק אוטומטית ממערכת מסירות אקספרס · ${escHtml(nowStamp(0))}</p>
</body></html>`;
}

// Triggers a real browser download of the affidavit as a standalone .html
// file the lawyer/admin can open, print or attach to a court filing —
// a functional fallback since there's no server generating a signed PDF here.
async function downloadAffidavit(order, kind) {
  // Storage references become inline images first, so the file never depends on an expiring link.
  const html = buildAffidavitHtml(await inlineOrderEvidence(order), kind);
  const blob = new window.Blob([html], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${usesAffidavit(order) && kind !== "certificate" ? "תצהיר-מסירה" : "אישור-מסירה"}-${formatOrderNum(order.id, true)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Printable envelope label ("🏷️ מדבקת ברקוד") — registered-mail style waybill.
// Code-128 (subset B) stripes are generated here as plain SVG: no library, no
// network. The pattern table is the standard Code-128 table (widths of
// bar/space/bar/space/bar/space; the stop code has 7 elements).
// ---------------------------------------------------------------------------
const CODE128_PATTERNS = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112"];
// Returns the run-length string (digits) for Code-128B of `text`, including
// start, checksum and stop. Characters outside printable ASCII become "-".
function code128Runs(text) {
  const chars = Array.from(String(text == null ? "" : text)).map((ch) => {
    const c = ch.charCodeAt(0);
    return c >= 32 && c <= 126 ? ch : "-";
  });
  const codes = [104];
  let sum = 104;
  chars.forEach((ch, i) => {
    const v = ch.charCodeAt(0) - 32;
    codes.push(v);
    sum += v * (i + 1);
  });
  codes.push(sum % 103);
  codes.push(106);
  return codes.map((c) => CODE128_PATTERNS[c]).join("");
}
function code128Svg(text, { height = 70, module = 2 } = {}) {
  const runs = code128Runs(text);
  const quiet = 10 * module;
  let x = quiet;
  let bars = "";
  for (let i = 0; i < runs.length; i += 1) {
    const w = Number(runs[i]) * module;
    if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${height}" />`;
    x += w;
  }
  const total = x + quiet;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" width="100%" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="ברקוד ${escHtml(text)}"><rect width="${total}" height="${height}" fill="#fff"/><g fill="#000">${bars}</g></svg>`;
}
// Short human-checkable code printed under the barcode (FNV-1a hash of the
// order id + recipient + creation time) — lets a clerk confirm the sticker
// belongs to the order. It is a verification code, not a security token.
function verificationCodeFor(order) {
  const src = `${order.id}|${order.recipientName || ""}|${order.createdDate || ""}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `VC-${h.toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}
const WAYBILL_TRACK_LABEL = {
  legal: "⚖️ מסירה משפטית",
  bank: "🏦 מסירה בנקאית — לנמען בלבד",
  municipal: "🏛️ דואר רשום מוסדי",
  standard: "✉️ מסירת מסמכים רשמית",
};
function buildWaybillHtml(order) {
  const track = trackOf(order);
  const prof = order.lawyerInfo || LAWYER_PROFILES[order.submittedBy] || {};
  const num = formatOrderNum(order.id, true);
  const visits = maxVisitsOf(order);
  const address = `${order.street || ""} ${order.houseNumber || ""}${order.apartment ? `/${order.apartment}` : ""}${order.floor ? `, קומה ${order.floor}` : ""}`.trim();
  const senderLines = [order.submittedBy, track === "municipal" || track === "bank" ? order.court : prof.firm, prof.address, prof.phone].filter(Boolean);
  const visitRow = (i) =>
    `<tr><td>☐ ביקור ${i}</td><td>תאריך ושעה: ____ / ____ / ______ &nbsp; ____ : ____</td><td>☐ נמסר &nbsp;☐ אין מענה${track === "bank" ? "" : visits === 3 && i === 3 ? " &nbsp;☐ הדבקה" : ""}</td></tr>`;
  const rows = Array.from({ length: visits }, (_, i) => visitRow(i + 1)).join("");
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8" />${docCspMeta()}<title>מדבקת ברקוד ${escHtml(num)}</title>
<style>
  @page { size: 105mm 148mm; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: Heebo, Arial, sans-serif; color:#000; margin:0; padding:0; font-size: 10.5px; }
  .label { border: 2px solid #000; padding: 6px 8px; }
  .top { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:5px; }
  .brand { font-weight:800; font-size: 12px; }
  .badge { border:1.5px solid #000; border-radius:4px; padding:2px 6px; font-weight:700; font-size: 11px; }
  .num { text-align:center; font-size: 30px; font-weight:800; letter-spacing: 1px; margin: 2px 0 0; }
  .vc { text-align:center; font-size: 11px; letter-spacing: 2px; margin-bottom: 4px; }
  .box { border:1px solid #000; padding:4px 6px; margin-top:5px; }
  .box h4 { margin:0 0 2px; font-size:9.5px; text-transform:none; color:#444; }
  .big { font-size: 15px; font-weight: 700; }
  table { width:100%; border-collapse:collapse; margin-top:5px; }
  td { border:1px solid #000; padding:3px 4px; font-size:9.5px; }
  .meta { font-size: 9px; color:#444; margin-top:4px; display:flex; justify-content:space-between; }
</style></head>
<body>
  <div class="label">
    <div class="top"><span class="brand">מסירות משפטיות · דואר רשום</span><span class="badge">${escHtml(WAYBILL_TRACK_LABEL[track] || "")}</span></div>
    ${code128Svg(num, { height: 70, module: 2 })}
    <div class="num" dir="ltr">${escHtml(num)}</div>
    <div class="vc" dir="ltr">${escHtml(verificationCodeFor(order))}</div>
    <div class="box"><h4>שולח</h4>${senderLines.map((l) => escHtml(l)).join("<br />") || "—"}</div>
    <div class="box"><h4>נמען</h4>
      <div class="big">${escHtml(order.recipientName || "—")}</div>
      ${escHtml(address)}<br />${escHtml(order.city || "")}<br />טלפון: <span dir="ltr">${escHtml(order.phone || "—")}</span>
    </div>
    <table>${rows}</table>
    <div class="meta"><span>נוצר: ${escHtml(order.createdDate || "—")}</span><span>${visits === 1 ? "ביקור יחיד" : "עד 3 ביקורים בימים ובשעות שונים"}</span></div>
  </div>
</body></html>`;
}
// Opens the print-ready sticker in a popup; if popups are blocked the same
// page is downloaded as an .html file instead.
function printWaybillLabel(order) {
  if (!order) return false;
  const html = buildWaybillHtml(order);
  const w = window.open("", "_blank", "width=520,height=760");
  if (w && w.document) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (e) {
        /* printing is best-effort — the page stays open for manual printing */
      }
    }, 400);
    return true;
  }
  const blob = new window.Blob([html], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `מדבקה-${formatOrderNum(order.id, true)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return true;
}

// ---------------------------------------------------------------------------
// Bulk CSV import ("📤 ייבוא מסירות מאקסל (CSV)") — banks, municipalities,
// law firms. Parsing and validation are pure functions; orders are created one
// by one through the same handleCreate used by the order form.
// ---------------------------------------------------------------------------
const BULK_HEADERS = ["נמען", "ת.ז.", "עיר", "כתובת", "טלפון", "מסלול", "בית משפט/רשות/בנק", "מספר תיק/אסמכתא", "סוג מסמך", "הערות"];
const BULK_MAX_ROWS = 300;
const bulkNorm = (h) => String(h == null ? "" : h).replace(/[\s"'״׳`.\-_/\()]/g, "").toLowerCase();
const BULK_FIELD_ALIASES = {
  recipientName: ["נמען", "שםהנמען", "שם"],
  idNumber: ["תז", "תעודתזהות", "מספרזהות", "זהות"],
  city: ["עיר", "יישוב", "ישוב"],
  address: ["כתובת", "רחוב", "כתובתמלאה"],
  phone: ["טלפון", "נייד", "טל", "פלאפון"],
  track: ["מסלול", "סוגמסירה"],
  court: ["ביתמשפטרשותבנק", "ביתמשפט", "רשות", "בנק", "מוסד"],
  caseNumber: ["מספרתיקאסמכתא", "מספרתיק", "אסמכתא", "מספראסמכתא"],
  docType: ["סוגמסמך", "מסמך", "סוגהמסמך"],
  notes: ["הערות", "הערה"],
};
// Bytes -> text. UTF-8 first (strict); if that fails the file is treated as
// Windows-1255 (what Hebrew Excel writes for "CSV").
function decodeCsvBuffer(buf) {
  let text;
  try {
    text = new window.TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    text = new window.TextDecoder("windows-1255").decode(buf);
  }
  return text.replace(/^\uFEFF/, "");
}
// RFC-4180 style parser: quotes, doubled quotes, CR/LF, and a delimiter
// (comma / semicolon / tab) detected from the first line.
function parseCsvText(text) {
  const firstLine = String(text).split(/\r?\n/, 1)[0] || "";
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = count("\t") > Math.max(count(","), count(";")) ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const src = String(text);
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}
// City from a free-typed cell: exact match first, then a forgiving match that
// ignores spaces / dashes / quotes ("באר-שבע", "תל אביב-יפו" -> "תל אביב").
let bulkCityIndex = null;
function bulkCityOf(raw) {
  const direct = normalizeCity(raw);
  if (direct) return direct;
  if (!bulkCityIndex) {
    bulkCityIndex = new window.Map();
    CITIES.forEach((c) => {
      const k = bulkNorm(c);
      if (!bulkCityIndex.has(k)) bulkCityIndex.set(k, c);
    });
    bulkCityIndex.set("תלאביביפו", "תל אביב");
  }
  return bulkCityIndex.get(bulkNorm(raw)) || "";
}
// "הרצל 15/3" | "הרצל 15, דירה 3" | "דרך חיפה 8א" -> { street, houseNumber, apartment }
function splitBulkAddress(raw) {
  let a = String(raw || "").trim();
  let apartment = "";
  const apt = /[,\s]*דירה\s*(\d+\S*)\s*$/.exec(a);
  if (apt) {
    apartment = apt[1];
    a = a.slice(0, apt.index).trim();
  }
  const m = /^(.*?\D)\s*(\d+[א-תa-zA-Z]?)(?:\s*[/\-]\s*(\d+))?\s*$/.exec(a.replace(/,\s*$/, ""));
  if (!m) return { street: a, houseNumber: "", apartment };
  return { street: m[1].replace(/[,\s]+$/, "").trim(), houseNumber: m[2], apartment: m[3] || apartment };
}
function bulkTrackOf(raw) {
  const t = bulkNorm(raw);
  if (!t) return "legal";
  if (t.includes("בנק") || t.includes("bank")) return "bank";
  if (t.includes("עיריי") || t.includes("רשות") || t.includes("מוסד") || t.includes("דואררשום") || t.includes("municipal")) return "municipal";
  if (t.includes("רגיל") || t.includes("עסקי") || t.includes("רשמית") || t.includes("standard")) return "standard";
  return "legal";
}
// rows (first = header) -> [{ line, errors:[], form|null, price, track }]
function bulkRowsToOrders(rows) {
  if (!rows.length) return { items: [], missingColumns: ["נמען"] };
  const head = rows[0].map(bulkNorm);
  const col = {};
  Object.keys(BULK_FIELD_ALIASES).forEach((k) => {
    const i = head.findIndex((h) => BULK_FIELD_ALIASES[k].includes(h));
    if (i >= 0) col[k] = i;
  });
  const missingColumns = ["recipientName", "city", "address", "phone"].filter((k) => col[k] == null).map((k) => BULK_FIELD_ALIASES[k][0]);
  const get = (r, k) => (col[k] == null ? "" : String(r[col[k]] == null ? "" : r[col[k]]).trim());
  const items = rows.slice(1, BULK_MAX_ROWS + 1).map((r, idx) => {
    const errors = [];
    const track = bulkTrackOf(get(r, "track"));
    const city = bulkCityOf(get(r, "city"));
    const addr = splitBulkAddress(get(r, "address"));
    const recipientName = get(r, "recipientName");
    const phone = get(r, "phone");
    const idNumber = get(r, "idNumber");
    if (!recipientName) errors.push("חסר שם נמען");
    if (!city) errors.push(get(r, "city") ? "עיר לא מוכרת" : "חסרה עיר");
    if (!addr.street || !addr.houseNumber) errors.push("כתובת: נדרשים רחוב ומספר בית");
    if (!phone) errors.push("חסר טלפון");
    if ((track === "legal" || track === "bank") && !idNumber) errors.push("חסרה ת.ז. (חובה במסלול זה)");
    const list = track === "municipal" ? MUNICIPAL_DOC_TYPES : track === "bank" ? BANK_DOC_TYPES : track === "standard" ? STANDARD_DOC_TYPES : DOC_TYPES;
    const docRaw = get(r, "docType");
    const known = list.find((d) => bulkNorm(d) === bulkNorm(docRaw));
    let docType = known || (docRaw ? "אחר" : list[0]);
    let customDocType = !known && docRaw ? docRaw : "";
    const packageDescription = "";
    const form = {
      recipientName,
      idNumber,
      phone,
      city: city || get(r, "city"),
      street: addr.street,
      houseNumber: addr.houseNumber,
      apartment: addr.apartment,
      floor: "",
      entranceCode: "",
      notes: get(r, "notes"),
      docType,
      customDocType,
      fileName: "",
      caseNumber: track === "standard" ? "" : get(r, "caseNumber"),
      court: track === "standard" ? "" : get(r, "court"),
      plaintiff: "",
      defendant: "",
      recipientRole: RECIPIENT_ROLES[0],
      deliveryTrack: track,
      maxVisits: track === "legal" ? 3 : 1,
      bankConfidential: true,
      packageDescription,
      speed: "standard",
      addons: { tracing: false, printing: false },
      urgent: false,
    };
    return { line: idx + 2, errors, form: errors.length ? null : form, track, recipientName, city: city || get(r, "city"), price: city ? calcClientPrice({ ...form, city }).total : 0 };
  });
  return { items, missingColumns, truncated: rows.length - 1 > BULK_MAX_ROWS };
}
function bulkTemplateCsv() {
  const example = [
    ["יעקב פרידמן", "012345678", "חדרה", "הרצל 15/3", "050-1234567", "משפטי", "בית משפט השלום חדרה", 'ת"א 12345-06-25', "כתב תביעה", "להתקשר לפני"],
    ["דנה לוי", "023456789", "נתניה", "ויצמן 7", "052-2345678", "בנק", "בנק לאומי — סניף נתניה", "A-5521", "מסמכי אשראי / משכנתא לחתימה", ""],
    ["משה כהן", "", "תל אביב", "דיזנגוף 112", "054-3456789", "עירייה", "עיריית תל אביב — גבייה", "9988", "התראת ארנונה / גבייה", ""],
  ];
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return "\uFEFF" + [BULK_HEADERS, ...example].map((r) => r.map(cell).join(",")).join("\r\n");
}
function downloadBulkTemplate() {
  const blob = new window.Blob([bulkTemplateCsv()], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "תבנית-ייבוא-מסירות.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// The import panel: choose a CSV -> preview (count, price per city, errors) ->
// create all valid orders in one click. `owners` (admin only) lets the admin
// pick which client the orders belong to.
function BulkImportPanel({ onCreate, owners = null }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [readError, setReadError] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const validItems = parsed ? parsed.items.filter((it) => it.form) : [];
  const total = validItems.reduce((sum, it) => sum + it.price, 0);
  const needsOwner = !!owners;
  const ownerObj = needsOwner ? owners.find((o) => o.name === ownerName) || null : null;

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    setDone(null);
    setReadError("");
    setParsed(null);
    if (!f) return;
    setFileName(f.name);
    if (/\.xlsx?$/i.test(f.name)) {
      setReadError('קובץ Excel (xlsx) אינו נתמך — ב-Excel בחרו "שמירה בשם" ← CSV ואז העלו שוב.');
      return;
    }
    try {
      const text = decodeCsvBuffer(await f.arrayBuffer());
      setParsed(bulkRowsToOrders(parseCsvText(text)));
    } catch (err) {
      setReadError("לא ניתן לקרוא את הקובץ.");
    }
  };

  const createAll = async () => {
    if (busy || !validItems.length || (needsOwner && !ownerObj)) return;
    setBusy(true);
    let ok = 0;
    for (const it of validItems) {
      try {
        // Sequential on purpose: each order takes the next consecutive number.
        await onCreate(needsOwner ? { ...it.form, submittedBy: ownerObj.name, ownerLawyer: ownerObj } : it.form);
        ok += 1;
      } catch (err) {
        /* keep going — the summary reports how many were created */
      }
    }
    setBusy(false);
    setDone({ ok, failed: validItems.length - ok });
    setParsed(null);
    setFileName("");
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold text-slate-700">
        <span>📤 ייבוא מרוכז מאקסל (CSV) — בנקים, רשויות ומשרדי עורכי דין</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
              📤 ייבוא מסירות מאקסל (CSV)
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
            <button type="button" onClick={downloadBulkTemplate} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              📄 הורד קובץ תבנית לדוגמה
            </button>
            {needsOwner && (
              <select className={inputCls + " !w-auto"} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} aria-label="עבור לקוח">
                <option value="">עבור איזה לקוח / עורך דין?</option>
                {owners.map((o) => (
                  <option key={o.id || o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            עמודות: {BULK_HEADERS.join(" · ")}. מסלול: משפטי / בנק / עירייה / רגיל (ברירת מחדל: משפטי). נתמכים UTF-8 ו-Windows-1255, עד {BULK_MAX_ROWS} שורות.
          </p>
          {readError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{readError}</p>}
          {done && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              נוצרו {done.ok} הזמנות{done.failed ? ` · ${done.failed} נכשלו` : ""}.
            </p>
          )}
          {parsed && (
            <div className="space-y-2">
              {parsed.missingColumns.length > 0 && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">חסרות עמודות חובה: {parsed.missingColumns.join(", ")}</p>
              )}
              <p className="text-xs font-semibold text-slate-600">
                {fileName}: {parsed.items.length} שורות · {validItems.length} תקינות · {parsed.items.length - validItems.length} עם שגיאות · סה"כ {formatILS(total)}
                {parsed.truncated ? ` (נקראו רק ${BULK_MAX_ROWS} הראשונות)` : ""}
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-right text-slate-400">
                      <th className="px-2 py-1.5 font-medium">שורה</th>
                      <th className="px-2 py-1.5 font-medium">נמען</th>
                      <th className="px-2 py-1.5 font-medium">עיר ואזור</th>
                      <th className="px-2 py-1.5 font-medium">מסלול</th>
                      <th className="px-2 py-1.5 font-medium">מחיר</th>
                      <th className="px-2 py-1.5 font-medium">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.items.map((it) => (
                      <tr key={it.line} className={`border-t border-slate-100 ${it.form ? "" : "bg-rose-50/50"}`}>
                        <td className="px-2 py-1">{it.line}</td>
                        <td className="px-2 py-1">{it.recipientName || "—"}</td>
                        <td className="px-2 py-1">{it.city ? `${it.city}${it.form ? ` · ${zoneLabelFor(it.city)}` : ""}` : "—"}</td>
                        <td className="px-2 py-1">{DELIVERY_TRACKS[it.track].badge}</td>
                        <td className="px-2 py-1">{it.form ? formatILS(it.price) : "—"}</td>
                        <td className={`px-2 py-1 font-medium ${it.form ? "text-emerald-700" : "text-rose-700"}`}>{it.form ? "תקין" : it.errors.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={createAll}
                disabled={busy || !validItems.length || parsed.missingColumns.length > 0 || (needsOwner && !ownerObj)}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "יוצר הזמנות…" : `צור ${validItems.length} הזמנות בלחיצה אחת`}
              </button>
              {needsOwner && !ownerObj && <p className="text-[11px] font-semibold text-rose-600">יש לבחור לקוח / עורך דין שאליו ישויכו ההזמנות.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// One-click Excel-friendly CSV (UTF-8 BOM so Hebrew opens cleanly in Excel).
function exportOrdersCsv(orders, filename = "דוח-מסירות.csv") {
  const head = ["מס' הזמנה", "תאריך", "מסלול", "לקוח / רשות", "אסמכתא / מס' תיק", "נמען", "כתובת", "עיר", "סטטוס", "מספר ביקורים", "שליח", "מחיר"];
  const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = orders.map((o) => [
    formatOrderNum(o.id),
    o.createdDate || "",
    DELIVERY_TRACKS[trackOf(o)].badge.replace(/^\S+\s/, ""),
    (trackOf(o) === "municipal" || trackOf(o) === "bank") && o.court ? `${o.court} (${o.submittedBy || ""})` : o.submittedBy || "",
    o.caseNumber || "",
    o.recipientName || "",
    `${o.street || ""} ${o.houseNumber || ""}`.trim(),
    o.city || "",
    o.status || "",
    effectiveAttempts(o).length,
    o.assignedCourier || "",
    calcClientPrice(o).total,
  ]);
  const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = window.URL.createObjectURL(new window.Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function CsvExportButton({ orders, filename }) {
  return (
    <button
      type="button"
      onClick={() => exportOrdersCsv(orders, filename)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
    >
      📥 ייצוא דוח לאקסל (CSV)
    </button>
  );
}

// Cities the demo data is seeded in (all have map coordinates).
const MOCK_CITIES = ["תל אביב", "חדרה", "נתניה", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "באר שבע", "קריית אתא", "פרדס חנה-כרכור"];
const MOCK_PLAINTIFFS = ["בנק הפועלים בע\"מ", "חברת נדל\"ן אורבן בע\"מ", "משה כהן", "קופת חולים כללית", "רונית לוי", "חברת ביטוח הראל בע\"מ"];

function buildMockOrders() {
  const statuses = [
    STATUS.PENDING,
    STATUS.IN_PROGRESS,
    STATUS.DELIVERED,
    STATUS.REFUSED,
    STATUS.POSTED,
    STATUS.IN_PROGRESS,
    STATUS.PENDING,
    STATUS.DELIVERED,
    STATUS.IN_PROGRESS,
    STATUS.PENDING,
  ];
  return statuses.map((status, i) => {
    const city = randomFrom(MOCK_CITIES);
    const hasAttempts = status !== STATUS.PENDING;
    const attempts = [];
    if (hasAttempts) {
      const n = status === STATUS.DELIVERED || status === STATUS.REFUSED || status === STATUS.POSTED
        ? Math.min(3, 1 + Math.floor(Math.random() * 3))
        : 1;
      for (let a = 0; a < n; a++) {
        const gps = coordNearCity(city);
        attempts.push({
          type: a === n - 1 ? status : "אין מענה",
          timestamp: nowStamp((n - a) * 240 + i * 13),
          // Realistic coordinates near the order's actual city.
          location: gps.location,
          lat: gps.lat,
          lng: gps.lng,
          notes:
            a === n - 1 && status === STATUS.REFUSED
              ? "הנמען סירב לקבל את המסמך, זוהה על ידי השליח"
              : a === n - 1 && status === STATUS.POSTED
              ? "לא נענתה הדלת בשלוש הזדמנויות — המעטפה הודבקה על הדלת"
              : "לא נענתה הדלת",
        });
      }
    }
    // A mock "IN_PROGRESS" order with just one no-answer attempt logged is,
    // under the new one-visit-per-day rule, actually waiting for tomorrow's
    // visit — match that in the seeded status so the badge and the locked
    // action buttons agree with each other from the very first load.
    const effectiveStatus =
      status === STATUS.IN_PROGRESS && attempts.length === 1 ? STATUS.PENDING_NEXT_VISIT : status;
    return {
      id: `ORD-${1000 + i}`,
      recipientName: randomFrom(NAMES),
      idNumber: `${200000000 + Math.floor(Math.random() * 90000000)}`,
      phone: `05${Math.floor(Math.random() * 9)}-${Math.floor(1000000 + Math.random() * 8999999)}`,
      city,
      street: randomFrom(STREETS),
      houseNumber: `${1 + Math.floor(Math.random() * 60)}`,
      apartment: Math.random() > 0.5 ? `${1 + Math.floor(Math.random() * 12)}` : "",
      floor: Math.random() > 0.4 ? `${1 + Math.floor(Math.random() * 10)}` : "",
      entranceCode: Math.random() > 0.6 ? `#${1000 + Math.floor(Math.random() * 8999)}` : "",
      notes: Math.random() > 0.6 ? "יש כלב בחצר, יש להתקשר לפני ההגעה" : "",
      docType: randomFrom(DOC_TYPES.slice(0, 8)),
      customDocType: "",
      fileName: `מסמך_${1000 + i}.pdf`,
      speed: ["standard", "standard", "urgent", "standard", "express"][i % 5],
      urgent: ["standard", "standard", "urgent", "standard", "express"][i % 5] !== "standard",
      addons: { tracing: i % 4 === 1, printing: i % 3 === 0 },
      // Case-file details printed on the affidavit.
      caseNumber: `ת"א ${12000 + i * 137}-0${(i % 9) + 1}-25`,
      court: COURTS[i % COURTS.length],
      plaintiff: MOCK_PLAINTIFFS[i % MOCK_PLAINTIFFS.length],
      defendant: "",
      recipientRole: "נתבע/ת",
      status: effectiveStatus,
      assignedCourier: status === STATUS.PENDING ? "" : randomFrom(couriersForCity(city)),
      createdDate: nowStamp(600 + i * 90),
      attempts,
      signature: status === STATUS.DELIVERED ? "SIGNED" : null,
      priceOverride: { perAttempt: null, perCompleted: null },
      priceRequests: [],
      // Deterministic round-robin (not random) so the default lawyer persona
      // reliably has a few orders to see on first load, instead of an empty
      // table depending on the random seed.
      submittedBy: LAWYERS[i % LAWYERS.length],
    };
  });
}

// Seeds one realistic pending price request onto an in-progress order so the
// approval workflow has something to demo without the courier submitting one
// first.
function seedDemoPriceRequest(orders) {
  const target = orders.find((o) => o.status === STATUS.IN_PROGRESS && o.assignedCourier);
  if (!target) return orders;
  return orders.map((o) =>
    o.id === target.id
      ? {
          ...o,
          priceRequests: [
            {
              id: genId("REQ"),
              courier: target.assignedCourier,
              proposedPerAttempt: null,
              proposedPerCompleted: DEFAULT_PRICING.perCompleted + 25,
              reason: "הכתובת נמצאת בקומה 5 ללא מעלית וללא חניה סמוכה — נדרש זמן נסיעה והליכה נוסף",
              status: "pending",
              requestedAt: nowStamp(45),
              reviewedAt: null,
            },
          ],
        }
      : o
  );
}

/* =========================================================================
   SMALL UI PRIMITIVES
   ========================================================================= */
// Compact pill used by every status badge and feature chip: tiny padding,
// 10px type, a soft rounded-md border — keeps tables readable on phones and
// lets several chips wrap on one line instead of stacking vertically.
const PILL =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-px text-[10px] font-medium leading-4 ring-1 ring-inset";

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES[STATUS.PENDING];
  return (
    <span className={`${PILL} ${s.bg} ${s.text} ${s.ring}`}>
      <span className={`h-1 w-1 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function SectionHeading({ title, subtitle, icon: Icon }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-indigo-700">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="mr-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

// Password field with a permanent show/hide button. The button is always rendered (never conditional),
// is type="button" (never submits the form) and only changes the input's type, not its value.
function PasswordInput({ className = "", ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${className} pl-11`} />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "הסתר סיסמה" : "הצג סיסמה"}
        aria-pressed={shown}
        title={shown ? "הסתר סיסמה" : "הצג סיסמה"}
        className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-3xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 transition-all duration-300 ease-in-out";

function Modal({ open, onClose, title, children, wide }) {
  // Escape closes the dialog (accessibility). Hook sits before the early return.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.document.addEventListener("keydown", onKey);
    return () => window.document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full ${
          wide ? "max-w-2xl" : "max-w-md"
        } overflow-y-auto rounded-3xl border border-slate-200/60 bg-white shadow-2xl`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="text-base font-bold text-indigo-700">{title}</h3>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* =========================================================================
   TOP NAVIGATION
   ========================================================================= */
// Role definitions shared by the top role-switcher and the bottom nav — one
// source of truth for each role's label, icon and simulated identity.
const ROLES = {
  lawyer: { key: "lawyer", label: "עו\"ד / חברה", fullLabel: "פורטל לקוחות — עורכי דין, חברות ורשויות", icon: Briefcase, personaName: 'עו"ד ישראל ישראלי' },
  courier: { key: "courier", label: "שליח", fullLabel: "ממשק שליח", icon: Truck, personaName: "דני כהן" },
  admin: { key: "admin", label: "מנהל", fullLabel: "דשבורד מנהל", icon: BarChart3, personaName: "מנהל המערכת" },
};

// The top bar doubles as a role switcher / login simulator: it never shows
// data belonging to another role (rates, other clients' orders, admin
// controls), it just lets you jump between the three separate experiences.
// Demo/testing mode: the role switcher (and the ability to jump straight
// back to the Admin dashboard) stays available from every portal, including
// Courier — this is a login simulator for trying out all three experiences,
// not a real authenticated session, so nothing here is actually locked.
// ---------------------------------------------------------------------------
// QR Code generator — ISO/IEC 18004 (Model 2), byte mode, versions 1–10, ECC L/M/Q/H.
// Pure JS (no dependency), works offline. qrEncode() returns the module matrix;
// qrSvgString() / qrDrawToCanvas() turn it into a vector / raster picture.
// ---------------------------------------------------------------------------
const QR_ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const QR_ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
// Index = version (1..10); one table per ECC level in the order L, M, Q, H.
const QR_ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
];
const QR_NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
];
function qrRawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
function qrDataCodewords(ver, ecc) {
  const i = QR_ECC_INDEX[ecc];
  return Math.floor(qrRawDataModules(ver) / 8) - QR_ECC_CODEWORDS_PER_BLOCK[i][ver] * QR_NUM_ERROR_CORRECTION_BLOCKS[i][ver];
}
function qrGfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function qrRsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = qrGfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = qrGfMul(root, 0x02);
  }
  return result;
}
function qrRsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  data.forEach((b) => {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= qrGfMul(coef, factor);
    });
  });
  return result;
}
function qrUtf8Bytes(text) {
  const out = [];
  const s = unescape(encodeURIComponent(String(text)));
  for (let i = 0; i < s.length; i += 1) out.push(s.charCodeAt(i));
  return out;
}
// Returns { version, mask, ecc, size, modules } — modules[y][x] === true is a dark module.
// `forceMask` (0–7) exists for testing; normally the best mask is chosen automatically.
function qrEncode(text, ecc = "Q", forceMask = -1) {
  const bytes = qrUtf8Bytes(text);
  let version = 0;
  for (let v = 1; v <= 10; v += 1) {
    const capBits = qrDataCodewords(v, ecc) * 8;
    const need = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
    if (need <= capBits) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error("QR: text too long");
  const size = version * 4 + 17;
  // ---- data bits ----
  const bits = [];
  const put = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };
  put(0x4, 4);
  put(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capBits = qrDataCodewords(version, ecc) * 8;
  put(0, Math.min(4, capBits - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  // ---- error correction + interleave ----
  const ei = QR_ECC_INDEX[ecc];
  const numBlocks = QR_NUM_ERROR_CORRECTION_BLOCKS[ei][version];
  const blockEccLen = QR_ECC_CODEWORDS_PER_BLOCK[ei][version];
  const rawCodewords = Math.floor(qrRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks = [];
  const rsDiv = qrRsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const e = qrRsRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(e));
  }
  const all = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) all.push(block[i]);
    });
  }
  // ---- matrix with function patterns ----
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => {
    modules[y][x] = dark;
    isFn[y][x] = true;
  };
  for (let i = 0; i < size; i += 1) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align = [];
  if (version > 1) {
    const n = Math.floor(version / 7) + 2;
    const step = Math.floor((version * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    align.push(6);
    for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
  }
  for (let i = 0; i < align.length; i += 1) {
    for (let j = 0; j < align.length; j += 1) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) setFn(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  const drawFormat = (mask) => {
    const d = (QR_ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) setFn(8, i, bit(fb, i));
    setFn(8, 7, bit(fb, 6));
    setFn(8, 8, bit(fb, 7));
    setFn(7, 8, bit(fb, 8));
    for (let i = 9; i < 15; i += 1) setFn(14 - i, 8, bit(fb, i));
    for (let i = 0; i < 8; i += 1) setFn(size - 1 - i, 8, bit(fb, i));
    for (let i = 8; i < 15; i += 1) setFn(8, size - 15 + i, bit(fb, i));
    setFn(8, size - 8, true);
  };
  drawFormat(0); // reserves the format area; rewritten once the mask is known
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vb = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit(vb, i));
      setFn(b, a, bit(vb, i));
    }
  }
  // ---- codewords in zig-zag order ----
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && bi < all.length * 8) {
          modules[y][x] = bit(all[bi >>> 3], 7 - (bi & 7));
          bi += 1;
        }
      }
    }
  }
  // ---- masking ----
  const applyMask = (m) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
        }
        if (!isFn[y][x] && inv) modules[y][x] = !modules[y][x];
      }
    }
  };
  const penalty = () => {
    let p = 0;
    const runs = (get) => {
      for (let a = 0; a < size; a += 1) {
        let run = 1;
        const hist = [];
        for (let b = 1; b <= size; b += 1) {
          if (b < size && get(a, b) === get(a, b - 1)) run += 1;
          else {
            if (run >= 5) p += 3 + (run - 5);
            hist.push(run);
            run = 1;
          }
        }
        // finder-like 1:1:3:1:1 patterns
        for (let k = 0; k + 4 < hist.length; k += 1) {
          const n = hist[k + 1];
          if (n > 0 && hist[k + 2] === n * 3 && hist[k + 3] === n && hist[k + 4] === n) p += 40;
        }
      }
    };
    runs((y, x) => modules[y][x]);
    runs((x, y) => modules[y][x]);
    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) p += 3;
      }
    }
    let dark = 0;
    modules.forEach((row) => row.forEach((c) => { if (c) dark += 1; }));
    p += Math.floor(Math.abs((dark * 20) - (size * size * 10)) / (size * size)) * 10;
    return p;
  };
  let mask = forceMask;
  if (mask < 0 || mask > 7) {
    let best = Infinity;
    for (let m = 0; m < 8; m += 1) {
      applyMask(m);
      drawFormat(m);
      const pen = penalty();
      if (pen < best) {
        best = pen;
        mask = m;
      }
      applyMask(m); // undo
    }
  }
  applyMask(mask);
  drawFormat(mask);
  return { version, mask, ecc, size, modules };
}
// Standalone vector picture: white background, 4-module quiet zone, one merged path.
function qrSvgString(qr, opts) {
  const o = { quiet: 4, dark: "#000000", light: "#ffffff", ...(opts || {}) };
  const n = qr.size + o.quiet * 2;
  let d = "";
  for (let y = 0; y < qr.size; y += 1) {
    let x = 0;
    while (x < qr.size) {
      if (qr.modules[y][x]) {
        let w = 1;
        while (x + w < qr.size && qr.modules[y][x + w]) w += 1;
        d += `M${x + o.quiet} ${y + o.quiet}h${w}v1h-${w}z`;
        x += w;
      } else x += 1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 10}" height="${n * 10}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${n}" height="${n}" fill="${o.light}"/><path d="${d}" fill="${o.dark}"/></svg>`;
}
// Draws the matrix onto a square canvas with whole-pixel modules (crisp at print size).
function qrDrawToCanvas(qr, canvas, px, caption) {
  const quiet = 4;
  const ctx = canvas.getContext("2d");
  canvas.width = px;
  canvas.height = px;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  const captionH = caption ? Math.round(px * 0.09) : 0;
  const mod = Math.max(1, Math.floor((px - captionH) / (qr.size + quiet * 2)));
  const side = mod * (qr.size + quiet * 2);
  const left = Math.floor((px - side) / 2);
  const top = Math.floor((px - captionH - side) / 2);
  ctx.fillStyle = "#000000";
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.modules[y][x]) ctx.fillRect(left + (x + quiet) * mod, top + (y + quiet) * mod, mod, mod);
    }
  }
  if (caption) {
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(captionH * 0.6)}px Heebo, Arial, sans-serif`;
    ctx.fillText(caption, px / 2, px - captionH / 2 - Math.round(px * 0.01));
  }
}

// ---------------------------------------------------------------------------
// Mobile-app installer (PWA) + marketing source tracking
// ---------------------------------------------------------------------------
const SITE_URL_MAIN = "https://mesirot.express";
const SRC_STORE_KEY = "mx_src";
const SRC_MAX_AGE_MS = 90 * 24 * 3600 * 1000;
function sanitizeSource(v) {
  const t = String(v || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,23}$/.test(t) ? t : "";
}
// ?src=tiktok|facebook|card… : remembered for 90 days (first touch wins until it expires).
function captureSignupSource() {
  try {
    const src = sanitizeSource(new window.URLSearchParams(window.location.search).get("src"));
    if (!src) return;
    let keep = false;
    try {
      const old = JSON.parse(window.localStorage.getItem(SRC_STORE_KEY) || "null");
      keep = !!(old && sanitizeSource(old.src) && window.Date.now() - Number(old.t) < SRC_MAX_AGE_MS);
    } catch (e) {
      keep = false;
    }
    if (!keep) window.localStorage.setItem(SRC_STORE_KEY, JSON.stringify({ src, t: window.Date.now() }));
    window.sessionStorage.setItem(SRC_STORE_KEY, src);
  } catch (e) {
    /* storage blocked: attribution is simply skipped */
  }
}
function readSignupSource() {
  try {
    const old = JSON.parse(window.localStorage.getItem(SRC_STORE_KEY) || "null");
    if (old && sanitizeSource(old.src) && window.Date.now() - Number(old.t) < SRC_MAX_AGE_MS) return sanitizeSource(old.src);
  } catch (e) {
    /* ignore */
  }
  try {
    return sanitizeSource(window.sessionStorage.getItem(SRC_STORE_KEY));
  } catch (e) {
    return "";
  }
}
captureSignupSource();
const SOURCE_LABELS = { tiktok: "טיקטוק", facebook: "פייסבוק", card: "כרטיס ביקור", whatsapp: "וואטסאפ", instagram: "אינסטגרם" };
const sourceLabel = (k) => (k ? SOURCE_LABELS[k] || k : "");

// The browser may fire beforeinstallprompt before any component exists, so it is caught here.
let deferredInstallPrompt = null;
const installListeners = new window.Set();
const notifyInstall = () => installListeners.forEach((f) => f());
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  notifyInstall();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  notifyInstall();
});
// Installability on Android needs a registered service worker (the same /sw.js the notifications use; it has no fetch handler).
window.addEventListener("load", () => {
  try {
    if ("serviceWorker" in window.navigator) window.navigator.serviceWorker.register("/sw.js").catch(() => {});
  } catch (e) {
    /* ignore */
  }
});
function isStandaloneApp() {
  try {
    return !!((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone);
  } catch (e) {
    return false;
  }
}
function isIosDevice() {
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}
function InstallGuideModal({ open, onClose }) {
  const ios = isIosDevice();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.document.addEventListener("keydown", onKey);
    return () => window.document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Rendered into <body>: the sticky, blurred header is a containing block for "fixed" children,
  // which is what clipped this dialog at the top of the screen.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="התקנת אפליקציה"
      dir="rtl"
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.6)" }} onClick={onClose} />
      <div
        style={{ position: "relative", width: "100%", maxWidth: 448, maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
        className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-indigo-700">📲 התקנת אפליקציה</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {ios ? (
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">1</span>
              <span>
                לחצו על כפתור השיתוף <strong>Share</strong> <span className="text-lg">⬆️</span> בתחתית המסך (ב-Safari).
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">2</span>
              <span>
                בחרו <strong>"הוסף למסך הבית"</strong> (<span dir="ltr">Add to Home Screen</span>) <span className="text-lg">➕</span> ולחצו על <strong>הוסף</strong>.
              </span>
            </li>
            <li className="text-[12px] text-slate-400">האפליקציה תופיע כאייקון במסך הבית. בדפדפנים אחרים באייפון יש לפתוח את האתר ב-Safari.</li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">1</span>
              <span>פתחו את תפריט הדפדפן (⋮ או ⋯) בפינה העליונה.</span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">2</span>
              <span>
                בחרו <strong>"התקן אפליקציה"</strong> או <strong>"הוסף למסך הבית"</strong> (<span dir="ltr">Install app / Add to Home screen</span>) ➕ ואשרו.
              </span>
            </li>
          </ol>
        )}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
          הבנתי
        </button>
      </div>
    </div>,
    window.document.body
  );
}
function InstallAppButton({ compact = false, className = "" }) {
  const [, setTick] = useState(0);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    installListeners.add(f);
    return () => installListeners.delete(f);
  }, []);
  if (isStandaloneApp()) return null;
  const onClick = async () => {
    const ev = deferredInstallPrompt;
    if (ev && typeof ev.prompt === "function") {
      try {
        ev.prompt();
        await ev.userChoice;
      } catch (e) {
        /* fall through to the guide below */
        setGuide(true);
      }
      deferredInstallPrompt = null; // a prompt can be used once
      notifyInstall();
      return;
    }
    setGuide(true);
  };
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="התקן אפליקציה לנייד"
        className={`flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 ${className}`}
      >
        {compact ? (
          <>
            <Smartphone className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">📲 התקן אפליקציה לנייד</span>
            <span className="sr-only sm:hidden">התקן אפליקציה לנייד</span>
          </>
        ) : (
          <span>📲 התקן אפליקציה לנייד</span>
        )}
      </button>
      <InstallGuideModal open={guide} onClose={() => setGuide(false)} />
    </>
  );
}

// ---- Admin: QR for the business card + campaign links ----
function downloadBlobFile(blob, name) {
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = name;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}
const WHATSAPP_TEXT = `שלום! מצאתי שירות מסירות משפטיות מהיר ומאובטח — מסירה עם תיעוד, מעקב ותצהיר מוסר דיגיטלי: ${SITE_URL_MAIN}/?src=whatsapp`;
const MARKETING_LINKS = [
  { key: "main", label: "קישור ראשי (כרטיס ביקור / ביו)", url: SITE_URL_MAIN },
  { key: "tiktok", label: "טיקטוק", url: `${SITE_URL_MAIN}/?src=tiktok` },
  { key: "facebook", label: "פייסבוק", url: `${SITE_URL_MAIN}/?src=facebook` },
  { key: "whatsapp", label: "שיתוף בוואטסאפ (עם טקסט מוכן)", url: `https://wa.me/?text=${encodeURIComponent(WHATSAPP_TEXT)}` },
];
function MarketingHubModal({ open, onClose }) {
  const [toast, copy] = useCopyToast();
  const [caption, setCaption] = useState(false);
  const qr = useMemo(() => qrEncode(SITE_URL_MAIN, "Q"), []);
  const svg = useMemo(() => qrSvgString(qr, { quiet: 4 }), [qr]);
  const downloadPng = () => {
    const canvas = window.document.createElement("canvas");
    qrDrawToCanvas(qr, canvas, 1200, caption ? "mesirot.express" : "");
    canvas.toBlob((blob) => {
      if (blob) downloadBlobFile(blob, "mesirot-express-qr-1200.png");
    }, "image/png");
  };
  const downloadSvg = () => downloadBlobFile(new window.Blob([svg], { type: "image/svg+xml" }), "mesirot-express-qr.svg");
  return (
    <Modal open={open} onClose={onClose} title="📇 קוד QR לכרטיס ביקור וקישורי פרסום" wide>
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 text-center">
          <div
            dir="ltr"
            className="mx-auto w-full max-w-[240px] rounded-xl bg-white p-1 ring-1 ring-slate-200 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p dir="ltr" className="mt-2 text-xs font-semibold text-slate-600">{SITE_URL_MAIN}</p>
          <p className="text-[11px] text-slate-400">QR תקני (ISO/IEC 18004) · גרסה {qr.version} · תיקון שגיאות Q · שוליים לבנים 4 מודולים · נוצר מקומית, ללא שירות חיצוני</p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={caption} onChange={(e) => setCaption(e.target.checked)} />
            הוסף כיתוב mesirot.express מתחת ל-QR (ב-PNG)
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={downloadPng} className="rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              📥 הורד קוד QR לדפוס (PNG 1200x1200)
            </button>
            <button type="button" onClick={downloadSvg} className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50">
              📥 הורד קוד QR וקטורי לבית דפוס (SVG)
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-700">קישורי פרסום ומעקב</p>
          {MARKETING_LINKS.map((l) => (
            <div key={l.key} className="rounded-2xl border border-slate-200/60 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">{l.label}</p>
                <button
                  type="button"
                  onClick={() => copy(l.url, "הקישור הועתק ✓")}
                  className="shrink-0 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600"
                >
                  📋 העתק
                </button>
              </div>
              <p dir="ltr" className="mt-1 select-all break-all text-left text-[11px] text-slate-500">{l.url}</p>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-slate-400">
            לקוח שנכנס דרך קישור עם <span dir="ltr">?src=…</span> נרשם עם מקור ההגעה, והוא מופיע בלשונית "שיווק" ובטבלת הלקוחות לאחר ההזמנה הראשונה. המקור מסתמך על הקישור שבו הלקוח השתמש ולכן הוא אינדיקציה בלבד.
          </p>
        </div>
      </div>
      <CopyToast toast={toast} />
    </Modal>
  );
}
// Which channel brought each client: taken from the first order that carries a signupSource.
function clientSourceMap(orders) {
  const m = {};
  (orders || []).forEach((o) => {
    const id = o.lawyerId || o.submittedBy;
    if (id && o.signupSource && !m[id]) m[id] = o.signupSource;
  });
  return m;
}
function MarketingTab({ lawyers, orders }) {
  const [open, setOpen] = useState(false);
  const bySrc = useMemo(() => {
    const m = clientSourceMap(orders);
    const rows = {};
    (lawyers || []).forEach((l) => {
      const k = m[l.id] || m[l.name];
      if (!k) return;
      rows[k] = rows[k] || { src: k, clients: 0, orders: 0 };
      rows[k].clients += 1;
      rows[k].orders += (orders || []).filter((o) => o.lawyerId === l.id || (!o.lawyerId && o.submittedBy === l.name)).length;
    });
    return Object.values(rows).sort((a, b) => b.clients - a.clients);
  }, [lawyers, orders]);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200/60 bg-white p-5">
        <h3 className="text-base font-bold text-indigo-700">שיווק והפצה</h3>
        <p className="mt-1 text-xs text-slate-500">קוד QR לכרטיס ביקור, קישורי פרסום לרשתות חברתיות ומעקב אחר מקור ההגעה של לקוחות חדשים.</p>
        <button type="button" onClick={() => setOpen(true)} className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
          <QrCode className="h-4 w-4" /> 📇 קוד QR לכרטיס ביקור וקישורי פרסום
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-right text-xs text-slate-400">
              <th className="px-3 py-2 font-medium">מקור הגעה</th>
              <th className="px-3 py-2 font-medium">לקוחות</th>
              <th className="px-3 py-2 font-medium">הזמנות</th>
            </tr>
          </thead>
          <tbody>
            {bySrc.map((r) => (
              <tr key={r.src} className="border-t border-slate-100">
                <td className="px-3 py-2.5 font-medium text-slate-700">{sourceLabel(r.src)} <span dir="ltr" className="text-[11px] text-slate-400">({r.src})</span></td>
                <td className="px-3 py-2.5 text-slate-600">{r.clients}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.orders}</td>
              </tr>
            ))}
            {bySrc.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-sm text-slate-400">
                  עדיין אין לקוחות עם מקור הגעה. המקור מופיע לאחר ההזמנה הראשונה של לקוח שנכנס דרך קישור עם ?src=
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <MarketingHubModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function TopNav({ view, setView }) {
  const session = React.useContext(SessionContext);
  const signedIn = !!(session && session.profile);
  // Signed-in users see only their own role; the demo shows all three.
  const roleList = signedIn ? [ROLES[view]] : [ROLES.lawyer, ROLES.courier, ROLES.admin];
  const current = ROLES[view];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
              <Gavel className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-extrabold text-indigo-700">מסירות משפטיות</p>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                {signedIn ? `מחובר כ: ${session.profile.full_name} · סנכרון בזמן אמת` : "מצב הדגמה · החלפת תצוגה בין תפקידים"}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
            {roleList.map((r) => {
              const Icon = r.icon;
              const active = view === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setView(r.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3.5 sm:text-sm ${
                    active ? "bg-white text-indigo-700 shadow-sm transition-all duration-300 ease-in-out" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-indigo-500" : ""}`} />
                  <span className="hidden sm:inline">{r.fullLabel}</span>
                  <span className="sm:hidden">{r.label}</span>
                </button>
              );
            })}
          </nav>
          <InstallAppButton compact />
          {signedIn && (
            <button
              type="button"
              onClick={session.signOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">התנתקות</span>
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 sm:hidden">
          <UserCheck className="h-3 w-3" />{" "}
          {signedIn
            ? `מחובר כ: ${session.profile.full_name}`
            : `מחובר כ${current.label === "מנהל" ? "" : "־"}${current.label}: ${current.personaName}`}
        </div>
      </div>
    </header>
  );
}

// Fixed bottom tab bar for mobile screens — each role gets its own short set
// of primary actions (mirrors the desktop in-page tabs one-to-one so nothing
// is mobile-only or desktop-only). Hidden at sm+ where the page's own tab
// pills / sidebar-style controls are already visible.
function BottomNav({ items, active, onChange }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-md items-stretch justify-around rounded-full border border-slate-200/60 bg-white/80 px-2 shadow-lg shadow-slate-900/5 backdrop-blur-md">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition"
            >
              {item.badge > 0 && (
                <span className="absolute right-1/2 top-1 flex h-4 min-w-[1rem] translate-x-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              )}
              <Icon className={`h-5 w-5 ${isActive ? "text-indigo-700" : "text-slate-400"}`} />
              <span className={isActive ? "text-indigo-700" : "text-slate-400"}>{item.label}</span>
              {isActive && <span className="absolute top-1 h-1 w-1 rounded-full bg-indigo-500" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// "חבר מביא חבר" — signed referral code, barcode, welcome modal, anti-fraud.
// No SQL. Where things live:
//   • the invited user's code: auth user_metadata.referred_by (set at sign-up only)
//     and order.referral = { code, deviceMatch } on that client's orders;
//   • the admin-only reward ledger: settings row "referrals" (admin read/write);
//   • an applied credit: order.referralCredit (see calcClientPrice, ₪110 floor).
// The checksum only catches typos / garbled codes — it is computed with a public
// algorithm, so it is NOT cryptographic proof. Real protection = the referrer
// must exist, the identity checks below, completion gate and the admin lock.
// ---------------------------------------------------------------------------
const REFERRAL_BASE = "https://mesirot.express";
const REFERRAL_RE = /^REF-[0-9A-F]{8}-[0-9A-Z]{4}$/;
const REFERRAL_SALT = "mesirot-ref-v1";
const REFERRAL_STORE_KEY = "mx_ref";
const DEVICE_OWNERS_KEY = "mx_dev_owners";
function normalizeReferralId(v) {
  const hex = String(v == null ? "" : v).replace(/[^0-9a-fA-F]/g, "").slice(0, 8).toUpperCase();
  return hex.length === 8 ? hex : "";
}
// FNV-1a over salt+id → 4 base-36 characters.
function referralHash(id8) {
  let h = 0x811c9dc5;
  const t = REFERRAL_SALT + id8;
  for (let i = 0; i < t.length; i += 1) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 1679616).toString(36).toUpperCase().padStart(4, "0");
}
// generateReferralCode(user) → "REF-<ID>-<HASH>" ("" when the user has no usable id).
function generateReferralCode(user) {
  const id = normalizeReferralId(user && typeof user === "object" ? user.id : user);
  return id ? `REF-${id}-${referralHash(id)}` : "";
}
// verifyReferralCode(code) → { ok, code, id } | { ok:false, reason }. Format + checksum only.
function verifyReferralCode(code) {
  const c = String(code == null ? "" : code).trim().toUpperCase();
  if (!REFERRAL_RE.test(c)) return { ok: false, reason: "format" };
  const id = c.slice(4, 12);
  if (referralHash(id) !== c.slice(13)) return { ok: false, reason: "checksum" };
  return { ok: true, code: c, id };
}
function referralLinkFor(code) {
  return verifyReferralCode(code).ok ? `${REFERRAL_BASE}/?ref=${verifyReferralCode(code).code}` : "";
}
// ?ref=REF-… from the URL (validated) is remembered on this device; returns the code ("" = none).
function captureReferralFromUrl() {
  let code = "";
  try {
    const q = new window.URLSearchParams(window.location.search).get("ref");
    const v = verifyReferralCode(q);
    if (v.ok) code = v.code;
  } catch (e) {
    /* ignore */
  }
  try {
    if (code) window.localStorage.setItem(REFERRAL_STORE_KEY, code);
    else {
      const v = verifyReferralCode(window.localStorage.getItem(REFERRAL_STORE_KEY));
      if (v.ok) code = v.code;
    }
  } catch (e) {
    /* storage unavailable */
  }
  return code;
}
// Device check (Layer B-5): profile ids that have signed in on this browser.
function readDeviceOwners() {
  try {
    const a = JSON.parse(window.localStorage.getItem(DEVICE_OWNERS_KEY) || "[]");
    return Array.isArray(a) ? a.filter((x) => /^[0-9A-F]{8}$/.test(x)) : [];
  } catch (e) {
    return [];
  }
}
function rememberDeviceOwner(profileId) {
  const id = normalizeReferralId(profileId);
  if (!id) return;
  const a = readDeviceOwners();
  if (a.includes(id)) return;
  try {
    window.localStorage.setItem(DEVICE_OWNERS_KEY, JSON.stringify([...a, id].slice(-20)));
  } catch (e) {
    /* ignore */
  }
}
// True when the referrer behind this code has signed in on THIS browser.
function deviceHasReferrer(code) {
  const v = verifyReferralCode(code);
  return v.ok && readDeviceOwners().includes(v.id);
}

// ---- identity comparison (Layer B) ----
const PUBLIC_EMAIL_DOMAINS = new window.Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.il", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "walla.co.il", "walla.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com",
  "yandex.com", "bezeqint.net", "netvision.net.il", "012.net.il", "013.net", "zahav.net.il", "inter.net.il", "tapuz.co.il",
]);
function emailParts(e) {
  const m = String(e || "").trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  return m ? { local: m[1], domain: m[2] } : null;
}
function normalizeEmail(e) {
  const p = emailParts(e);
  if (!p) return "";
  let local = p.local.split("+")[0];
  if (p.domain === "gmail.com" || p.domain === "googlemail.com") local = local.replace(/\./g, "");
  return `${local}@${p.domain === "googlemail.com" ? "gmail.com" : p.domain}`;
}
function phoneLast9(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-9) : "";
}
function normalizeIdentityText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/["'׳״`.,\-–—()\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^עו ?ד /, "");
}
function normalizeLicense(v) {
  const t = String(v || "").toLowerCase().replace(/[^0-9a-z֐-׿]/g, "");
  return t.length >= 3 && !/^_+$/.test(t) ? t : "";
}
// Why two accounts look like the same person / organisation (array of Hebrew reasons).
function identityOverlapReasons(a, b) {
  const out = [];
  const ea = normalizeEmail(a.email);
  const eb = normalizeEmail(b.email);
  const da = emailParts(a.email);
  const db = emailParts(b.email);
  if (ea && ea === eb) out.push("אותה כתובת אימייל (לאחר נרמול)");
  else if (da && db && da.domain === db.domain && !PUBLIC_EMAIL_DOMAINS.has(da.domain)) out.push(`אותו דומיין אימייל ארגוני (${da.domain})`);
  const pa = phoneLast9(a.phone);
  if (pa && pa === phoneLast9(b.phone)) out.push("אותו מספר טלפון (9 ספרות אחרונות)");
  const la = normalizeLicense(a.licenseNo);
  if (la && la === normalizeLicense(b.licenseNo)) out.push("אותו מספר רישיון עו\"ד / ח.פ.");
  const names = (x) => [normalizeIdentityText(x.firm), normalizeIdentityText(x.name)].filter(Boolean);
  const nb = names(b);
  if (names(a).some((n) => nb.includes(n))) out.push("אותו שם משרד / חברה");
  return out;
}
function orderBelongsTo(o, l) {
  return o.lawyerId === l.id || (!o.lawyerId && o.submittedBy === l.name);
}
// One row per referred client (a client with at least one order carrying a referral stamp).
// Layer A: checksum + referrer exists and is active. Layer B: identity overlap,
// duplicate identity among referred accounts, same device. Layer C: completion gate.
function buildReferralRows({ lawyers, orders, ledger }) {
  const led = ledger || {};
  const rows = [];
  (lawyers || []).forEach((l) => {
    const stamped = (orders || [])
      .filter((o) => o.referral && o.referral.code && orderBelongsTo(o, l))
      .sort((x, y) => String(x.createdDate || "").localeCompare(String(y.createdDate || "")));
    if (!stamped.length) return;
    const mine = (orders || []).filter((o) => orderBelongsTo(o, l));
    const v = verifyReferralCode(stamped[0].referral.code);
    const referrer = v.ok ? (lawyers || []).find((x) => generateReferralCode(x) === v.code) || null : null;
    const reasons = [];
    if (!v.ok) reasons.push("קוד הפניה לא תקין (checksum)");
    else if (!referrer) reasons.push("הממליץ אינו קיים במערכת");
    else if (referrer.blocked) reasons.push("הממליץ חסום / אינו פעיל");
    else if (referrer.id === l.id) reasons.push("הפניה עצמית — הקוד שייך לאותו חשבון");
    else identityOverlapReasons(referrer, l).forEach((r) => reasons.push(r));
    if (mine.some((o) => o.referral && o.referral.deviceMatch === true)) reasons.push("אותו מכשיר של הממליץ (אימות מכשיר)");
    rows.push({
      referredId: l.id,
      referred: l,
      referrer,
      code: v.ok ? v.code : String(stamped[0].referral.code),
      joinedAt: l.createdAt || "",
      firstCompleted: mine.some((o) => isOrderCompleted(o) && !isOrderCancelled(o)),
      reasons,
      ledger: led[l.id] || null,
    });
  });
  // Duplicate identity among referred accounts: later accounts are compared to earlier ones.
  rows.sort((x, y) => String(x.joinedAt).localeCompare(String(y.joinedAt)));
  rows.forEach((r, i) => {
    for (let j = 0; j < i; j += 1) {
      identityOverlapReasons(rows[j].referred, r.referred).forEach((x) => r.reasons.push(`זהה לחשבון אחר שהופנה (${rows[j].referred.name}): ${x}`));
    }
  });
  rows.forEach((r) => {
    r.fraudFlag = r.reasons.length > 0;
    r.fraudReason = r.reasons.join(" · ");
  });
  return rows;
}
// The holder's earliest unassigned order where the full ₪50 fits above the ₪110 floor.
function eligibleCreditOrder(holder, orders) {
  return (
    (orders || [])
      .filter(
        (o) =>
          orderBelongsTo(o, holder) &&
          o.status === STATUS.PENDING &&
          !isOrderCancelled(o) &&
          !o.referralCredit &&
          calcClientPrice({ ...o, referralCredit: null }).total - REFERRAL_CREDIT >= REFERRAL_MIN_ORDER
      )
      .sort((x, y) => String(x.createdDate || "").localeCompare(String(y.createdDate || "")))[0] || null
  );
}

function copyText(text) {
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  }
  return Promise.resolve(fallback());
}
// Small self-contained toast (the app had none).
function CopyToast({ toast }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg sm:bottom-8 ${
        toast.ok ? "bg-emerald-600" : "bg-rose-600"
      }`}
    >
      {toast.text}
    </div>
  );
}
function useCopyToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = (text, okText) => {
    copyText(text).then((ok) => {
      setToast({ ok, text: ok ? okText : "לא ניתן להעתיק אוטומטית — סמנו והעתיקו ידנית" });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 2600);
    });
  };
  return [toast, copy];
}
// Personal link + copy button + Code 128 barcode of the signed code.
function ReferralShare({ code }) {
  const [toast, copy] = useCopyToast();
  const link = referralLinkFor(code);
  if (!link) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">הקישור האישי שלכם</p>
      <p dir="ltr" className="mt-1 select-all break-all rounded-xl bg-white px-3 py-2 text-left text-xs text-slate-700 ring-1 ring-slate-200">
        {link}
      </p>
      <button
        type="button"
        onClick={() => copy(link, "הקישור הועתק ✓")}
        className="mt-2 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
      >
        📋 העתק קישור אישי
      </button>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200">
        <div dir="ltr" className="mx-auto max-w-[280px]" dangerouslySetInnerHTML={{ __html: code128Svg(code, { height: 56, module: 2 }) }} />
        <p dir="ltr" className="mt-1 font-mono text-xs tracking-widest text-slate-600">{code}</p>
        <p className="mt-1 text-[10px] text-slate-400">ברקוד (Code 128) של קוד ההפניה האישי</p>
      </div>
      <CopyToast toast={toast} />
    </div>
  );
}
const REFERRAL_TERMS_NOTE = "ההטבה ניתנת לאחר השלמת מסירה ראשונה של הלקוח החדש ואישור הנהלה, וחלה על מסירה הבאה בשווי כולל של לפחות ₪110 לאחר הזיכוי. הפניה עצמית או כפולה אינה זכאית.";
function ReferralCard({ code }) {
  if (!referralLinkFor(code)) return null;
  return (
    <div className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
      <p className="text-sm font-bold text-amber-800">🎁 חבר מביא חבר</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        על כל לקוח חדש שמצטרף דרככם ומשלים מסירה ראשונה — גם אתם וגם החבר מקבלים ₪{REFERRAL_CREDIT} זיכוי למסירה הבאה.
      </p>
      <div className="mt-3">
        <ReferralShare code={code} />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">{REFERRAL_TERMS_NOTE}</p>
    </div>
  );
}
// Profile tab: the card plus the button that re-opens the welcome / program window.
function ReferralSection({ profile }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ReferralCard code={generateReferralCode(profile)} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
      >
        🎁 תוכנית חבר מביא חבר והברקוד האישי
      </button>
      {open && <WelcomeModal profile={profile} onClose={() => setOpen(false)} />}
    </>
  );
}
function welcomeSeenKey(profileId) {
  return `welcomeSeen_${profileId}`;
}
// Shown once per client account (law firm / company / institution) on each device.
function shouldShowWelcome(profile) {
  if (!profile || profile.role !== "lawyer" || !profile.id) return false;
  try {
    return window.localStorage.getItem(welcomeSeenKey(profile.id)) !== "1";
  } catch (e) {
    return false;
  }
}
function WelcomeModal({ profile, onClose }) {
  const code = generateReferralCode(profile);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="rounded-t-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 px-6 py-6 text-center text-white">
          <div className="text-4xl" aria-hidden="true">🎉</div>
          <h2 id="welcome-title" className="mt-2 text-lg font-extrabold leading-snug">
            ברוכים הבאים ל-mesirot.express — הבית של המסירות המשפטיות והמוסדיות בישראל! ⚖️
          </h2>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">
            אנו שמחים וגאים לצרף אתכם לפלטפורמת המסירות המתקדמת בישראל. אנו מתחייבים להעניק לכם את השירות הטוב, המהיר והאמין ביותר — עם תיעוד GPS מלא, עמידה קפדנית בדרישות החוק ושקיפות מלאה בכל שלב.
          </p>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold leading-relaxed text-amber-900">
              🎁 הטבת חבר מביא חבר: שתפו את הברקוד או הקישור האישי שלכם עם עמיתים, משרדי עורכי דין וחברות. על כל לקוח חדש שמצטרף דרככם ומשלים מסירה ראשונה — גם אתם וגם החבר מקבלים ₪50 זיכוי למסירה הבאה!
            </p>
            <div className="mt-3">
              <ReferralShare code={code} />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-amber-900/70">{REFERRAL_TERMS_NOTE}</p>
          </div>
          <button type="button" onClick={onClose} className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-base font-bold text-white hover:bg-indigo-700">
            התחל לשלוח מסירות 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
// Admin: "🎁 מעקב חבר מביא חבר ובקרת זיכויים".
function ReferralControlPanel({ lawyers, orders, ledger, onApprove, onApplyCredit }) {
  const rows = useMemo(() => buildReferralRows({ lawyers, orders, ledger }), [lawyers, orders, ledger]);
  const led = ledger || {};
  // Credits on orders that the ledger does not account for (possible tampering).
  const stray = (orders || []).filter((o) => {
    if (!o.referralCredit) return false;
    return !Object.values(led).some((e) => ["friend", "referrer"].some((k) => e.credits && e.credits[k] && e.credits[k].appliedOrderId === o.id));
  });
  const when = (iso) => (iso ? new window.Date(iso).toLocaleDateString("he-IL") : "—");
  const approve = (r) => {
    if (r.ledger || r.fraudFlag || !r.firstCompleted || !r.referrer) return;
    const ok = window.confirm(
      `לאשר זיכוי ₪${REFERRAL_CREDIT} לממליץ (${r.referrer.name}) ולחבר (${r.referred.name})?\\n\\nהאישור סופי ולא ניתן לביטול, ולא ניתן לאשר פעמיים עבור אותו לקוח.`
    );
    if (ok) onApprove(r);
  };
  const creditCell = (r, side, holder, label) => {
    const c = r.ledger && r.ledger.credits && r.ledger.credits[side];
    if (!c) return null;
    const eligible = !c.appliedOrderId && eligibleCreditOrder(holder, orders);
    return (
      <div key={side} className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-600">{label}:</span>
        {c.appliedOrderId ? (
          <span className={`${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>הוחל על {c.appliedOrderId}</span>
        ) : (
          <button
            type="button"
            disabled={!eligible}
            onClick={() => onApplyCredit(r.referredId, side)}
            title={eligible ? `יוחל על ${eligible.id}` : `אין הזמנה ממתינה לשיוך שמאפשרת ₪${REFERRAL_CREDIT} מלא (מינימום ₪${REFERRAL_MIN_ORDER})`}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 enabled:hover:bg-indigo-100 disabled:opacity-50"
          >
            {eligible ? `החל על ${eligible.id}` : "ממתין להזמנה מתאימה"}
          </button>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-amber-700">🎁 מעקב חבר מביא חבר ובקרת זיכויים</h3>
        <p className="text-xs text-slate-500">
          זיכוי ₪{REFERRAL_CREDIT} לכל צד, רק לאחר מסירה ראשונה שהושלמה ואישור מנהל. מחיר הזמנה לא יורד מתחת ל-₪{REFERRAL_MIN_ORDER}. לקוח מופיע כאן מהזמנתו הראשונה.
        </p>
      </div>
      {stray.length > 0 && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
          ⚠️ זיכוי הפניה על הזמנות ללא אישור ביומן הזיכויים: {stray.map((o) => o.id).join(", ")}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-right text-xs text-slate-400">
              <th className="px-3 py-2 font-medium">הממליץ</th>
              <th className="px-3 py-2 font-medium">הלקוח שהצטרף</th>
              <th className="px-3 py-2 font-medium">תאריך הצטרפות</th>
              <th className="px-3 py-2 font-medium">סטטוס מסירה ראשונה</th>
              <th className="px-3 py-2 font-medium">אישור מנהל</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.referredId} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2.5 text-slate-700">
                  <p className="font-medium">{r.referrer ? r.referrer.name : "—"}</p>
                  <p dir="ltr" className="text-left font-mono text-[10px] text-slate-400">{r.code}</p>
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-700">{r.referred.name}</td>
                <td className="px-3 py-2.5 text-slate-500">{when(r.joinedAt)}</td>
                <td className="px-3 py-2.5 text-xs">
                  {r.fraudFlag ? (
                    <div>
                      <span className={`${PILL} bg-rose-50 text-rose-700 ring-rose-200`}>⚠️ חשד להפניה עצמית</span>
                      <p className="mt-1 text-[11px] leading-snug text-rose-700">{r.fraudReason}</p>
                    </div>
                  ) : r.firstCompleted ? (
                    <span className={`${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>הושלמה מסירה ראשונה</span>
                  ) : (
                    <span className={`${PILL} bg-amber-50 text-amber-700 ring-amber-200`}>⏳ ממתין להשלמת מסירה ראשונה</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.ledger ? (
                    <div className="space-y-1">
                      <span className={`${PILL} bg-slate-100 text-slate-700 ring-slate-300`}>🔒 זיכוי אושר ומומש</span>
                      {creditCell(r, "friend", r.referred, "החבר")}
                      {r.referrer && creditCell(r, "referrer", r.referrer, "הממליץ")}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={r.fraudFlag || !r.firstCompleted || !r.referrer}
                      onClick={() => approve(r)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ✅ אשר זיכוי ₪{REFERRAL_CREDIT}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                  עדיין אין לקוחות שהצטרפו דרך הפניה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple role-aware "profile" screen shown as the last bottom-nav tab on
// every role — reflects the simulated identity and offers the role switch
// as an explicit, discoverable action (like a real login/account screen).
function ProfileTab({ role, subtitle, onSwitchRole }) {
  const session = React.useContext(SessionContext);
  const r = ROLES[role];
  const Icon = r.icon;
  // Signed-in session: real account card + sign-out instead of the demo role switcher.
  if (session && session.profile) {
    const pf = session.profile;
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-6 pb-24 sm:pb-6">
        <div className="rounded-3xl border border-slate-200/60 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
            <Icon className="h-7 w-7" />
          </div>
          <p className="mt-3 text-base font-bold text-slate-800">{pf.full_name}</p>
          <p className="text-sm text-slate-400">{r.fullLabel}</p>
          <p dir="ltr" className="mt-1 text-xs text-slate-400">{pf.email}</p>
          <span className={`${PILL} mt-3 bg-emerald-50 text-emerald-700 ring-emerald-200`}>
            <Check className="h-2.5 w-2.5" /> מחובר · סנכרון בזמן אמת
          </span>
        </div>
        {pf.role === "lawyer" && <ReferralSection profile={pf} />}
        <button
          type="button"
          onClick={session.signOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" /> התנתקות
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6 pb-24 sm:pb-6">
      <div className="rounded-3xl border border-slate-200/60 bg-white p-5 text-center shadow-sm transition-all duration-300 ease-in-out">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
          <Icon className="h-7 w-7" />
        </div>
        <p className="mt-3 text-base font-bold text-slate-800">{r.personaName}</p>
        <p className="text-sm text-slate-400">{subtitle || r.fullLabel}</p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          מצב הדגמה
        </span>
      </div>

      {/* Demo/testing mode: every role can switch portals freely from here,
          including Courier — this is a login simulator, not a real
          authenticated session, so nothing here is actually locked. */}
      <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-300 ease-in-out">
        <p className="mb-2 text-xs font-semibold text-slate-400">החלפת תפקיד</p>
        <div className="space-y-2">
          {Object.values(ROLES).map((opt) => {
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.key}
                onClick={() => onSwitchRole(opt.key)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                  opt.key === role
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200/60 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <OptIcon className="h-4 w-4" />
                {opt.fullLabel}
                {opt.key === role && <Check className="mr-auto h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>

      <p className="px-2 text-center text-[11px] text-slate-400">
        גרסת הדגמה של מערכת ניהול מסירות משפטיות · הנתונים בעמוד זה אינם אמיתיים
      </p>
    </div>
  );
}

/* =========================================================================
   LAWYER PORTAL
   ========================================================================= */
// Styled checkbox row used for the service-speed and advanced-service choices.
function OptionCheckbox({ checked, onChange, label, hint, fee, disabled }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
        checked ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200/60 bg-white hover:bg-slate-50"
      } ${disabled ? "cursor-default" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-indigo-600"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-700">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <span className={`shrink-0 text-xs font-bold ${fee > 0 ? "text-indigo-700" : "text-emerald-600"}`}>
        {fee > 0 ? `+${formatILS(fee)}` : "כלול"}
      </span>
    </label>
  );
}

// "Full media & GPS audit trail included" — the standard protocol of EVERY
// delivery, shown as a key highlight on the lawyer's order form.
function AuditTrailHighlight() {
  const items = [
    { icon: Camera, label: "תיעוד צילום / וידאו" },
    { icon: Mic, label: "הקלטת שמע" },
    { icon: MapPin, label: "מיקום GPS בזמן אמת" },
  ];
  return (
    <div className="mb-5 rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-teal-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-emerald-800">מסלול ביקורת מלא — תיעוד מדיה ו-GPS כלול בכל מסירה</p>
          <p className="mt-0.5 text-xs text-emerald-700/80">
            כל מסירה כוללת אוטומטית צילום/וידאו, הקלטת שמע ורישום מיקום GPS בזמן אמת בכל ביקור — ללא תוספת תשלום.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const EMPTY_ORDER_FORM = {
  recipientName: "",
  idNumber: "",
  phone: "",
  city: CITIES[0],
  street: "",
  houseNumber: "",
  apartment: "",
  floor: "",
  entranceCode: "",
  notes: "",
  docType: DOC_TYPES[0],
  customDocType: "",
  fileName: "",
  // Case file (printed on the affidavit)
  caseNumber: "",
  court: "",
  plaintiff: "",
  defendant: "",
  recipientRole: RECIPIENT_ROLES[0],
  // Delivery track (legal | municipal | standard)
  deliveryTrack: "legal",
  maxVisits: 1,
  bankConfidential: true,
  packageDescription: "",
  // Pricing options
  speed: "standard",
  addons: { tracing: false, printing: false },
};

function NewOrderForm({ onCreate }) {
  const [form, setForm] = useState(EMPTY_ORDER_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [printingFileError, setPrintingFileError] = useState(false);
  const [cityError, setCityError] = useState(false);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target && "value" in e.target ? e.target.value : e }));

  const track = form.deliveryTrack || "legal";
  const setTrack = (t) =>
    setForm((f) => ({
      ...f,
      deliveryTrack: t,
      maxVisits: t === "legal" ? 3 : 1,
      docType: t === "municipal" ? MUNICIPAL_DOC_TYPES[0] : t === "bank" ? BANK_DOC_TYPES[0] : t === "standard" ? STANDARD_DOC_TYPES[0] : DOC_TYPES[0],
      customDocType: "",
    }));
  const docTypeList = track === "municipal" ? MUNICIPAL_DOC_TYPES : track === "bank" ? BANK_DOC_TYPES : track === "standard" ? STANDARD_DOC_TYPES : DOC_TYPES;

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setForm((f2) => ({ ...f2, fileName: f.name }));
      setPrintingFileError(false);
    }
  };

  // Live quote — same calculator the Admin dashboard uses for its margin.
  const quote = calcClientPrice({ ...form, city: normalizeCity(form.city) || form.city });

  const submit = (e) => {
    e.preventDefault();
    if (!form.recipientName || ((track === "legal" || track === "bank") && !form.idNumber) || !form.phone || !form.street) return;
    // City must resolve to a known settlement (drives the pricing zone).
    const canonicalCity = normalizeCity(form.city);
    if (!canonicalCity) {
      setCityError(true);
      return;
    }
    // The printing service prints the PDF the law firm uploads, so a file is required.
    if (form.addons.printing && !form.fileName) {
      setPrintingFileError(true);
      return;
    }
    const trackFields =
      track === "standard"
        ? {
            // Business delivery: no court / case fields at all.
            caseNumber: "", court: "", plaintiff: "", defendant: "",
            maxVisits: 1,
          }
        : track === "municipal"
        ? { plaintiff: "", defendant: "", maxVisits: Number(form.maxVisits) === 3 ? 3 : 1 }
        : track === "bank"
        ? { plaintiff: "", defendant: "", maxVisits: Number(form.maxVisits) === 3 ? 3 : 1, bankConfidential: form.bankConfidential !== false }
        : { maxVisits: 3 };
    onCreate({ ...form, ...trackFields, city: canonicalCity, urgent: form.speed !== "standard" });
    setForm(EMPTY_ORDER_FORM);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
      <SectionHeading
        title="פתיחת מסירה חדשה"
        subtitle="מלאו את פרטי התיק, הנמען והמסמך לצורך שיבוץ שליח"
        icon={ScrollText}
      />

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">סוג המסירה</p>
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="סוג המסירה">
        {Object.values(DELIVERY_TRACKS).map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={track === t.key}
            onClick={() => setTrack(t.key)}
            className={`rounded-xl border-2 px-3 py-2.5 text-right text-sm font-semibold transition ${
              track === t.key ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
            }`}
          >
            {t.label}
            {t.sub && <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-500">{t.sub}</span>}
          </button>
        ))}
      </div>

      {track === "legal" && <AuditTrailHighlight />}

      {track === "municipal" && (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">פרטי הרשות</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="רשות / עירייה / מחלקה">
              <input className={inputCls} placeholder="לדוגמה: עיריית חדרה — מחלקת גבייה" value={form.court} onChange={update("court")} />
            </Field>
            <Field label="מספר אסמכתא / נכס / התראה">
              <input className={inputCls} placeholder="מספר אסמכתא" value={form.caseNumber} onChange={update("caseNumber")} />
            </Field>
            <Field label="מספר ביקורים נדרש">
              <select className={inputCls} value={form.maxVisits} onChange={(e) => setForm((f) => ({ ...f, maxVisits: Number(e.target.value) }))}>
                <option value={1}>ביקור אחד</option>
                <option value={3}>עד 3 ביקורים</option>
              </select>
            </Field>
          </div>
        </>
      )}

      {track === "bank" && (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">פרטי המוסד הפיננסי</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="שם הבנק / המוסד הפיננסי / סניף">
              <input className={inputCls} placeholder="לדוגמה: בנק לאומי — סניף חדרה" value={form.court} onChange={update("court")} />
            </Field>
            <Field label="מספר אסמכתא / מעטפה מאובטחת">
              <input className={inputCls} placeholder="מספר אסמכתא" value={form.caseNumber} onChange={update("caseNumber")} />
            </Field>
            <Field label="מספר ביקורים נדרש">
              <select className={inputCls} value={form.maxVisits} onChange={(e) => setForm((f) => ({ ...f, maxVisits: Number(e.target.value) }))}>
                <option value={1}>ביקור אחד</option>
                <option value={3}>עד 3 ביקורים</option>
              </select>
            </Field>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.bankConfidential !== false}
                onChange={(e) => setForm((f) => ({ ...f, bankConfidential: e.target.checked }))}
              />
              <span>
                <strong>חיסיון בנקאי</strong> (הסתר פרטי תיק/מסמך מהשליח)
                <span className="block text-xs text-sky-700">השליח יראה "{BANK_MASK_TEXT}" במקום סוג המסמך ומספר האסמכתא.</span>
              </span>
            </label>
          </div>
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
            מסירה לנמען בלבד: השליח יידרש לזהות את הנמען בתעודה מזהה (סוג תעודה + 4 ספרות אחרונות). אין מסירה לבן משפחה, אין הנחה בכתובת ואין הדבקה על הדלת.
          </p>
        </>
      )}

      {track === "standard" && (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">פרטי המסמך</p>
          <div className="grid grid-cols-1 gap-4">
            <Field label="תיאור המסמך / המעטפה (אופציונלי)">
              <input className={inputCls} placeholder="לדוגמה: חוזה שכירות לחתימה" value={form.packageDescription} onChange={update("packageDescription")} />
            </Field>
          </div>
        </>
      )}

      {track === "legal" && (
      <>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">פרטי התיק</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="מספר תיק">
          <input
            className={inputCls}
            placeholder='לדוגמה: ת"א 12345-06-25'
            value={form.caseNumber}
            onChange={update("caseNumber")}
          />
        </Field>
        <Field label="בית משפט / ערכאה">
          <input
            className={inputCls}
            list="courts-list"
            placeholder="בחרו או הקלידו שם בית משפט"
            value={form.court}
            onChange={update("court")}
          />
          <datalist id="courts-list">
            {COURTS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="תובע / מבקש">
          <input className={inputCls} placeholder="שם הצד המגיש" value={form.plaintiff} onChange={update("plaintiff")} />
        </Field>
        <Field label="נתבע / משיב">
          <input className={inputCls} placeholder="שם הצד שכנגד" value={form.defendant} onChange={update("defendant")} />
        </Field>
        <Field label="תפקיד הנמען בהליך">
          <div className="relative">
            <select className={inputCls + " appearance-none"} value={form.recipientRole} onChange={update("recipientRole")}>
              {RECIPIENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </Field>
      </div>
      </>
      )}

      <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">פרטי הנמען וכתובת המסירה</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="שם הנמען" required>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={inputCls + " pr-9"}
              placeholder="לדוגמה: יעקב פרידמן"
              value={form.recipientName}
              onChange={update("recipientName")}
              required
            />
          </div>
        </Field>
        <Field label={track === "legal" || track === "bank" ? "מספר תעודת זהות" : "ת.ז. / ח.פ. (לא חובה)"} required={track === "legal" || track === "bank"}>
          <input
            className={inputCls}
            placeholder={track === "legal" || track === "bank" ? "9 ספרות" : "אופציונלי"}
            value={form.idNumber}
            onChange={update("idNumber")}
            required={track === "legal" || track === "bank"}
          />
        </Field>
        <Field label="טלפון" required>
          <div className="relative">
            <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={inputCls + " pr-9"}
              placeholder="050-1234567"
              value={form.phone}
              onChange={update("phone")}
              required
            />
          </div>
        </Field>
        <Field label="עיר (קובעת את אזור התמחור)" required>
          <div className="relative">
            <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={inputCls + " pr-9" + (cityError ? " border-rose-400" : "")}
              list="cities-list"
              placeholder="התחילו להקליד שם יישוב…"
              value={form.city}
              onChange={(e) => { setCityError(false); update("city")(e); }}
              autoComplete="off"
              required
            />
            <datalist id="cities-list">
              {PRICING_ZONES.flatMap((z) => z.cities.map((c) => (
                <option key={c} value={c} label={`${zoneLabelFor(c)} — ${formatILS(z.price)}`} />
              )))}
            </datalist>
            {cityError && <p className="mt-1 text-xs text-rose-600">יש לבחור יישוב מהרשימה</p>}
            {!cityError && normalizeCity(form.city) && (
              <p className="mt-1 text-xs text-slate-500">{zoneLabelFor(normalizeCity(form.city))} — {formatILS(zoneForCity(normalizeCity(form.city)).price)}</p>
            )}
          </div>
        </Field>
        <Field label="רחוב" required>
          <div className="relative">
            <Home className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={inputCls + " pr-9"}
              placeholder="שם הרחוב"
              value={form.street}
              onChange={update("street")}
              required
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="מספר בית" required>
            <input className={inputCls} value={form.houseNumber} onChange={update("houseNumber")} required />
          </Field>
          <Field label="דירה">
            <input className={inputCls} value={form.apartment} onChange={update("apartment")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="קומה">
            <input
              className={inputCls}
              placeholder="לדוגמה: 3"
              value={form.floor}
              onChange={update("floor")}
            />
          </Field>
          <Field label="קוד כניסה / אינטרקום">
            <input
              className={inputCls}
              placeholder="לדוגמה: #1234"
              value={form.entranceCode}
              onChange={update("entranceCode")}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <Field label="הערות מיוחדות למסירה">
          <textarea
            className={inputCls}
            rows={2}
            placeholder="לדוגמה: יש להתקשר לפני ההגעה, קומה 3 ללא מעלית..."
            value={form.notes}
            onChange={update("notes")}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="סוג מסמך" required>
          <div className="relative">
            <select
              className={inputCls + " appearance-none pr-3"}
              value={form.docType}
              onChange={update("docType")}
            >
              {docTypeList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          {form.docType === "אחר" && (
            <input
              className={inputCls + " mt-2"}
              placeholder="פרטו את סוג המסמך"
              value={form.customDocType}
              onChange={update("customDocType")}
            />
          )}
        </Field>

        <Field label={form.addons.printing ? "קובץ המסמך להדפסה (PDF) — חובה" : "קובץ המסמך (PDF)"}>
          <label
            className={`flex cursor-pointer items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm hover:bg-slate-100 ${
              printingFileError
                ? "border-rose-400 bg-rose-50 text-rose-600"
                : "border-slate-300 bg-slate-50 text-slate-500 hover:border-indigo-300"
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Upload className="h-4 w-4 shrink-0 text-slate-400" />
              {form.fileName || "בחרו קובץ PDF להעלאה"}
            </span>
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
          </label>
          {printingFileError && (
            <p className="mt-1 text-xs font-semibold text-rose-600">לשירות ההדפסה יש להעלות קובץ PDF</p>
          )}
        </Field>
      </div>

      {/* Service speed — one choice, always exactly one selected. */}
      <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">מהירות שירות</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SPEED_OPTIONS.map((opt) => (
          <OptionCheckbox
            key={opt.key}
            checked={form.speed === opt.key}
            onChange={() =>
              setForm((f) => ({ ...f, speed: f.speed === opt.key ? "standard" : opt.key }))
            }
            label={opt.label}
            hint={opt.hint}
            fee={opt.fee}
          />
        ))}
      </div>

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">שירותים מתקדמים</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADDON_OPTIONS.map((opt) => (
          <OptionCheckbox
            key={opt.key}
            checked={!!form.addons[opt.key]}
            onChange={() =>
              setForm((f) => ({ ...f, addons: { ...f.addons, [opt.key]: !f.addons[opt.key] } }))
            }
            label={opt.label}
            hint={opt.hint}
            fee={opt.fee}
          />
        ))}
      </div>

      {/* Live price quote */}
      <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-indigo-800">
          <Calculator className="h-4 w-4" /> הצעת מחיר
        </p>
        <ul className="space-y-1 text-sm text-slate-600">
          {quote.lines.map((l) => (
            <li key={l.key} className="flex items-center justify-between">
              <span>{l.label}</span>
              <span className="font-semibold">{formatILS(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-indigo-200 pt-2">
          <span className="text-sm font-bold text-slate-700">סה"כ לתשלום (לפני מע"מ)</span>
          <span className="text-lg font-extrabold text-indigo-700">{formatILS(quote.total)}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          פתיחת מסירה
        </button>
        {submitted && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> המסירה נוצרה בהצלחה
          </span>
        )}
      </div>
    </form>
  );
}

// Photo thumbnail that expands in place on tap (data: URLs can't be opened
// in a new tab by most browsers, so the lightbox is inline).
function EvidencePhoto({ photo, label = "צילום" }) {
  const [open, setOpen] = useState(false);
  const shown = useEvidenceSrc(photo && photo.dataUrl);
  if (!photo || !photo.dataUrl) return null;
  if (!isSafeMediaSrc(photo.dataUrl, { kind: "media", allowBlob: true, allowRef: true }) || shown === null) {
    return <p className="mt-2 text-[11px] text-slate-400">{label}: המדיה אינה זמינה או לא אומתה</p>;
  }
  if (shown === undefined) return <p className="mt-2 text-[11px] text-slate-400">{label}: טוען…</p>;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
      <button type="button" onClick={() => setOpen((v) => !v)} className="block text-right" title="לחצו להגדלה / צמצום">
        {photo.kind === "video" ? (
          <video
            src={shown}
            controls={open}
            muted
            playsInline
            className={`rounded-lg border border-slate-200/60 bg-black object-cover transition-all ${
              open ? "max-h-96 w-full object-contain" : "h-20 w-20"
            }`}
          />
        ) : (
          <img
            src={shown}
            alt="תיעוד צילום"
            className={`rounded-lg border border-slate-200/60 object-cover transition-all ${
              open ? "max-h-96 w-full object-contain bg-slate-50" : "h-20 w-20"
            }`}
          />
        )}
      </button>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Camera className="h-3 w-3" /> {photo.kind === "video" ? "הוסרט" : "צולם"} {photo.timestamp}
        </span>
        {photo.gps && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {photo.gps}
          </span>
        )}
        <span className="text-indigo-500">{open ? "לחצו לצמצום" : "לחצו להגדלה"}</span>
      </p>
    </div>
  );
}

// One visit's full evidence: status, timestamp, courier, GPS (with a map
// link), notes, photo, recording and — for deliveries — the recipient's
// signature. Rendered identically for Admin and for the ordering lawyer.
function photoLabelFor(type) {
  return type === STATUS.POSTED
    ? "תמונת הדבקה"
    : type === STATUS.REFUSED
    ? "צילום הנמען / הדלת (סירוב)"
    : type === STATUS.DELIVERED
    ? "צילום מסירה"
    : "צילום הדלת (אין מענה)";
}

function AttemptEvidence({ attempt: a, courier }) {
  const mapUrl = mapUrlFor(a);
  const audioShown = useEvidenceSrc(a.audio);
  const sigShown = useEvidenceSrc(a.signatureDataUrl);
  return (
    <li className="rounded-lg border border-slate-100 bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">{a.type}</span>
        <span className="text-xs text-slate-400">{a.timestamp}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {a.location}
          {a.gpsAccuracy != null && <span>(דיוק ±{a.gpsAccuracy} מ')</span>}
          {a.gpsMissing && <span className="font-semibold text-rose-500">⚠️ הביקור נשמר ללא GPS</span>}
          {a.gpsSimulated && <span className="text-amber-500">(מיקום מדומה)</span>}
        </span>
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            מיקום דיווח בשטח (GPS)
          </a>
        )}
        {(a.courier || courier) && <span>· שליח: {a.courier || courier}</span>}
      </p>
      {a.notes && <p className="mt-1 text-xs text-slate-500">{a.notes}</p>}
      {a.deliveredToType && (
        <p className="mt-1 text-xs font-medium text-slate-600">
          נמסר ל: {a.deliveredToType}
          {a.receiverName ? ` — ${a.receiverName}${a.receiverRelation ? ` (${a.receiverRelation})` : ""}` : ""}
        </p>
      )}
      {a.verifiedIdType && (
        <p className="mt-1 text-xs font-medium text-sky-800">🏦 אימות זהות — {idVerificationText(a)}</p>
      )}
      {a.residenceVerification && (
        <p className="mt-1 text-xs font-medium text-slate-600">
          אימות מגורים: {a.residenceVerification}
          {a.verificationNote ? ` (${a.verificationNote})` : ""}
        </p>
      )}
      <EvidencePhoto photo={a.photo} label={photoLabelFor(a.type)} />
      {a.audio && isSafeMediaSrc(a.audio, { kind: "media", allowBlob: true, allowRef: true }) && audioShown && (
        <audio controls src={audioShown} className="mt-2 h-8 w-full">
          <track kind="captions" />
        </audio>
      )}
      {!(a.audio && isSafeMediaSrc(a.audio, { kind: "media", allowBlob: true, allowRef: true })) && (a.audioRecorded || a.audioSaveFailed) && (
        <p className="mt-1 text-[11px] font-medium text-amber-700">🎙️ בוצעה הקלטה — הקובץ אינו שמור בשרת</p>
      )}
      {a.signatureDataUrl && isSafeMediaSrc(a.signatureDataUrl, { allowBlob: true, allowRef: true }) && sigShown && (
        <div className="mt-2">
          <p className="text-[11px] text-slate-400">חתימת הנמען</p>
          <img src={sigShown} alt="חתימת הנמען" className="h-14 rounded border border-slate-200/60 bg-white p-1" />
        </div>
      )}
    </li>
  );
}

// Small chips for the order's service speed and advanced services.
function TrackBadge({ order }) {
  const t = DELIVERY_TRACKS[trackOf(order)];
  return <span className={`${PILL} ${t.tone}`}>{t.badge}</span>;
}

function ServiceChips({ order }) {
  const speed = speedOf(order);
  const addons = order.addons || {};
  return (
    <>
      <TrackBadge order={order} />
      {speed === "urgent" && (
        <span title="מסירה דחופה — 24-48 שעות" className={`${PILL} bg-amber-50 text-amber-700 ring-amber-200`}>
          <Zap className="h-2.5 w-2.5" /> דחוף
        </span>
      )}
      {speed === "express" && (
        <span title="מסירת אקספרס — באותו יום" className={`${PILL} bg-rose-50 text-rose-700 ring-rose-200`}>
          <Zap className="h-2.5 w-2.5" /> אקספרס
        </span>
      )}
      {addons.tracing && (
        <span title="שירות איתור כתובת בשטח" className={`${PILL} bg-sky-50 text-sky-700 ring-sky-200`}>
          <Search className="h-2.5 w-2.5" /> איתור
        </span>
      )}
      {addons.printing && (
        <span title="שירות הדפסת מסמכים" className={`${PILL} bg-violet-50 text-violet-700 ring-violet-200`}>
          <Printer className="h-2.5 w-2.5" /> הדפסה
        </span>
      )}
    </>
  );
}

// "שרשרת משמורת": the four-step custody timeline shown in the audit file.
function CustodyTimeline({ order }) {
  const steps = buildCustodyChain(order);
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-700">שרשרת משמורת (Chain of Custody)</p>
      <ol className="space-y-1.5 text-xs text-slate-600">
        {steps.map((st) => (
          <li key={st.n}>
            <span className="font-semibold text-slate-700">
              {st.n}. {st.label}:
            </span>{" "}
            {st.pending && !st.at ? (
              <span className="text-slate-400">{st.detail || "טרם התבצע"}</span>
            ) : (
              <span>
                {st.at}
                {st.detail ? ` — ${st.detail}` : ""}
              </span>
            )}
            {st.items && st.items.length > 0 && (
              <ul className="mr-4 mt-0.5 list-disc space-y-0.5">
                {st.items.map((it, i) => (
                  <li key={i}>
                    {it.text} · {it.at} · GPS: <span dir="ltr">{it.gps}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OrderDetailsModal({ order, onClose, onOpenAffidavit, onCancel, showPrice = true }) {
  const affSigShown = useEvidenceSrc(order && order.affidavit && order.affidavit.signature);
  if (!order) return null;
  return (
    <Modal open={!!order} onClose={onClose} title={`תיק ביקורת מסירה — ${formatOrderNum(order.id)}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <AffidavitBadge order={order} />
          <ServiceChips order={order} />
          {canCancelOrder(order) && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(order)}
              className="mr-auto flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              <X className="h-3.5 w-3.5" /> ביטול מסירה
            </button>
          )}
        </div>
        {order.status === STATUS.CANCELED && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">ההזמנה בוטלה{order.cancelledAt ? ` ב-${order.cancelledAt}` : ""} ולא תשוגר לשליח.</p>
        )}
        {trackOf(order) === "bank" && (
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-sky-50 p-3 sm:grid-cols-2">
            <InfoRow label="מספר אסמכתא / מעטפה מאובטחת" value={order.caseNumber || "—"} />
            <InfoRow label="בנק / מוסד פיננסי / סניף" value={order.court || "—"} />
            <InfoRow label="חיסיון בנקאי" value={isBankConfidential(order) ? "מופעל — פרטי המסמך מוסתרים מהשליח" : "כבוי"} />
            <InfoRow label="מסלול" value={DELIVERY_TRACKS.bank.badge} />
          </div>
        )}
        {trackOf(order) !== "bank" && (order.caseNumber || order.court || order.plaintiff) && (
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <InfoRow label="מספר תיק" value={order.caseNumber || "—"} />
            <InfoRow label="בית משפט" value={order.court || "—"} />
            <InfoRow label="תובע / מבקש" value={order.plaintiff || "—"} />
            <InfoRow label="נתבע / משיב" value={order.defendant || order.recipientName} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="נמען" value={order.recipientName} />
          <InfoRow label="ת.ז" value={order.idNumber} />
          <InfoRow label="טלפון" value={order.phone} />
          <InfoRow
            action={<AddressNavLink order={order} />}
            label="כתובת"
            value={`${order.street} ${order.houseNumber}${order.apartment ? "/" + order.apartment : ""}${
              order.floor ? `, קומה ${order.floor}` : ""
            }, ${order.city}`}
          />
          {order.entranceCode && <InfoRow label="קוד כניסה / אינטרקום" value={order.entranceCode} />}
          <InfoRow label="סוג מסמך" value={order.docType === "אחר" ? order.customDocType || "אחר" : order.docType} />
          <InfoRow label="שליח משובץ" value={order.assignedCourier || "טרם שובץ"} />
          {showPrice && <InfoRow label="מחיר ללקוח" value={formatILS(calcClientPrice(order).total)} />}
          {showPrice && calcClientPrice(order).referralCredit > 0 && (
            <InfoRow label="זיכוי חבר מביא חבר" value={`−${formatILS(calcClientPrice(order).referralCredit)}`} />
          )}
        </div>
        {order.notes && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">הערות: </span>
            {order.notes}
          </div>
        )}
        {order.postingPhoto && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
            <EvidencePhoto photo={order.postingPhoto} label="תמונת הדבקה" />
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">היסטוריית ביקורים</p>
          {order.attempts.length === 0 ? (
            <p className="text-sm text-slate-400">טרם בוצעו ביקורים</p>
          ) : (
            <ul className="space-y-2">
              {order.attempts.map((a, i) => (
                <AttemptEvidence key={i} attempt={a} courier={order.assignedCourier} />
              ))}
            </ul>
          )}
        </div>
        {needsCustody(order) && <CustodyTimeline order={order} />}
        <div className="rounded-lg border border-slate-200/60 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">{usesAffidavit(order) ? "חתימת שליח ותצהיר מוסר" : "חתימת שליח ואישור מסירה"}</p>
          {isAffidavitSigned(order) ? (
            <div className="space-y-2">
              <img
                src={isSafeMediaSrc(order.affidavit.signature, { allowBlob: true, allowRef: true }) ? affSigShown || undefined : undefined}
                alt="חתימת השליח"
                className="h-20 max-w-full rounded border border-slate-200/60 bg-white object-contain p-1"
              />
              <p className="text-xs text-slate-500">
                נחתם על ידי {order.affidavit.signedBy || order.assignedCourier} ב-{order.affidavit.signedAt}
                {order.affidavit.capturedBy ? ` (נקלט על ידי ${order.affidavit.capturedBy})` : ""}
              </p>
              <div className="flex gap-2">
                {onOpenAffidavit && (
                  <button
                    type="button"
                    onClick={() => onOpenAffidavit(order)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                  >
                    <Printer className="h-4 w-4" /> צפייה והדפסה
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadAffidavit(order)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Download className="h-4 w-4" /> {usesAffidavit(order) ? "הורדת תצהיר חתום" : "הורדת אישור מסירה"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">התצהיר טרם נחתם על ידי השליח. הוא יופיע כאן מיד עם החתימה.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value, action }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-700">
        {value}
        {action}
      </p>
    </div>
  );
}

// The Lawyer Portal is intentionally the simplest of the three: it only ever
// shows what a lawyer submitting deliveries needs — their own new-order form
// and a live status table. No courier rates, payroll or admin controls exist
// anywhere in this component or the data it's handed.
// One thumbnail that opens full size in a new tab, with a download link.
function EvidenceThumb({ src, label, name }) {
  const shown = useEvidenceSrc(src && src !== "SIGNED" ? src : undefined);
  if (!src || src === "SIGNED") return null;
  if (!isSafeMediaSrc(src, { allowBlob: true, allowRef: true }) || shown === null || shown === undefined) {
    return (
      <figure className="w-24 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">לא זמין</div>
        <figcaption className="mt-1 text-[11px] leading-tight text-slate-500">{label}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="w-24 text-center">
      <a href={shown} target="_blank" rel="noopener noreferrer" title="לחצו לצפייה בגודל מלא">
        <img src={shown} alt={label} className="h-24 w-24 rounded-lg border border-slate-200 bg-white object-cover" />
      </a>
      <figcaption className="mt-1 text-[11px] leading-tight text-slate-500">{label}</figcaption>
      <a href={shown} download={name} className="text-[11px] font-semibold text-indigo-600 hover:underline">
        הורדה
      </a>
    </figure>
  );
}

// One finished delivery: every saved photo, the recipient's signature, the
// courier's signed affidavit and the affidavit / certificate button.
function HistoryOrderCard({ o, onOpenAffidavit, onDeletePermanently }) {
  const visits = o.attempts || [];
    const sig = visits.map((a) => a.signatureDataUrl).filter(Boolean).pop() || (typeof o.signature === "string" && o.signature !== "SIGNED" ? o.signature : null);
    return (
      <section key={o.id} className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-800">{o.recipientName}</p>
            <p className="text-xs text-slate-400">
              {formatOrderNum(o.id)} · {o.docType} · {o.street} {o.houseNumber}, {o.city}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TrackBadge order={o} />
            <StatusBadge status={o.status} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {visits.map((a, i) => (
            <EvidenceThumb
              key={`p${i}`}
              src={a.photo && a.photo.dataUrl && a.photo.kind !== "video" ? a.photo.dataUrl : null}
              label={`ביקור ${i + 1}: ${a.type}`}
              name={`${o.id}-visit-${i + 1}.jpg`}
            />
          ))}
          <EvidenceThumb src={sig} label="חתימת הנמען" name={`${o.id}-recipient-signature.jpg`} />
          <EvidenceThumb
            src={o.affidavit && o.affidavit.signature}
            label="חתימת תצהיר (שליח)"
            name={`${o.id}-affidavit-signature.jpg`}
          />
        </div>
        {visits.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-xs text-slate-500">
            {visits.map((a, i) => (
              <li key={`t${i}`}>
                ביקור {i + 1} · {a.type} · {a.timestamp}
                {a.location ? ` · ${a.location}` : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 empty:hidden">
          {isAffidavitSigned(o) && onOpenAffidavit && (
            <button
              type="button"
              onClick={() => onOpenAffidavit(o.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
            >
              <FileText className="h-3.5 w-3.5" /> {usesAffidavit(o) ? "צפייה בתצהיר החתום" : "צפייה באישור המסירה"}
            </button>
          )}
          {onDeletePermanently && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`למחוק לצמיתות את ההזמנה ${formatOrderNum(o.id)} (${o.recipientName}) מההיסטוריה? ההזמנה, התמונות והתצהיר יימחקו ולא ניתן לשחזר.`)) onDeletePermanently(o.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              🗑️ מחק לצמיתות
            </button>
          )}
        </div>
      </section>
    );
}

// Upgrade 5 — the month a finished delivery belongs to: the month it was
// completed (last visit / signature), falling back to the month it was created.
function orderMonthKey(o) {
  const att = effectiveAttempts(o);
  const last = att[att.length - 1];
  const ts = (last && last.timestamp) || o.completedAt || (o.affidavit && o.affidavit.signedAt) || o.createdAt || o.createdDate || "";
  const k = monthKeyOf(ts);
  return /^\d{4}-\d{2}$/.test(k) ? k : "";
}

// "היסטוריה": "ריכוז חודשים — כל חודש בנפרד". One card per calendar month
// (always including the current one) with its delivery count, total cost and
// its own CSV export; opening a month shows that month's delivery cards.
function OrderHistoryList({ orders, onOpenAffidavit, onDeletePermanently }) {
  const currentMonthKey = nowStamp(0).slice(0, 7);
  const [selected, setSelected] = useState(currentMonthKey);
  const finished = useMemo(() => orders.filter((o) => isOrderCompleted(o)), [orders]);
  const byMonth = useMemo(() => {
    const m = {};
    finished.forEach((o) => {
      const k = orderMonthKey(o) || currentMonthKey;
      (m[k] = m[k] || []).push(o);
    });
    Object.values(m).forEach((list) =>
      list.sort((a, b) => String(b.id).localeCompare(String(a.id), "he", { numeric: true }))
    );
    return m;
  }, [finished, currentMonthKey]);
  const monthKeys = useMemo(() => {
    const keys = new window.Set([currentMonthKey, ...Object.keys(byMonth)]);
    return Array.from(keys).sort().reverse();
  }, [byMonth, currentMonthKey]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-slate-700">ריכוז חודשים — כל חודש בנפרד</p>
      {monthKeys.map((key) => {
        const list = byMonth[key] || [];
        const total = list.reduce((sum, o) => sum + calcClientPrice(o).total, 0);
        const open = selected === key;
        return (
          <div key={key} className={`rounded-2xl border bg-white shadow-sm ${open ? "border-indigo-300" : "border-slate-200/60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <button
                type="button"
                onClick={() => setSelected(open ? null : key)}
                aria-expanded={open}
                className="flex flex-1 items-center gap-3 text-right"
              >
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                <span>
                  <span className="block font-semibold text-slate-800">{monthLabel(key)}</span>
                  <span className="block text-xs text-slate-500">
                    {list.length} מסירות · סה"כ עלות {formatILS(total)}
                  </span>
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!list.length}
                  onClick={() => exportOrdersCsv(list, `מסירות-${key}.csv`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  📥 ייצוא חודש לאקסל (CSV)
                </button>
                {onDeletePermanently && open && list.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`למחוק לצמיתות את כל ${list.length} ההזמנות של ${monthLabel(key)} מההיסטוריה? ההזמנות, התמונות והתצהירים יימחקו ולא ניתן לשחזר.`)) {
                        list.forEach((o) => onDeletePermanently(o.id));
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    🗑️ מחק היסטוריית חודש לצמיתות
                  </button>
                )}
              </div>
            </div>
            {open && (
              <div className="space-y-4 border-t border-slate-100 p-4">
                {list.length ? (
                  list.map((o) => <HistoryOrderCard key={o.id} o={o} onOpenAffidavit={onOpenAffidavit} onDeletePermanently={onDeletePermanently} />)
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">אין מסירות שהושלמו בחודש זה</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// "ריכוז חודשים": every month of the courier's work as its own card; opening
// one shows its totals and the itemised pay per task.
function CourierMonthlyEarnings({ orders, pricing, currentMonthKey, courier = null }) {
  const [selected, setSelected] = useState(currentMonthKey);
  const months = useMemo(() => {
    const keys = new window.Set([currentMonthKey]);
    orders.forEach((o) => effectiveAttempts(o).forEach((a) => monthKeyOf(a.timestamp) && keys.add(monthKeyOf(a.timestamp))));
    return Array.from(keys)
      .sort()
      .reverse()
      .map((mk) => {
        const rows = orders
          .map((o) => ({ o, calc: calcOrderEarnings(o, pricing, mk, courier) }))
          .filter((r) => r.calc.visits > 0)
          .sort((x, y) => String(y.o.id).localeCompare(String(x.o.id), "he", { numeric: true }));
        return {
          mk,
          rows,
          tasks: rows.length,
          completed: rows.reduce((n, r) => n + r.calc.completed, 0),
          visits: rows.reduce((n, r) => n + r.calc.visits, 0),
          pay: rows.reduce((n, r) => n + r.calc.total, 0),
        };
      });
  }, [orders, pricing, currentMonthKey]);
  const fmtDate = (ts) => {
    const d = (ts || "").slice(0, 10).split("-");
    return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : "";
  };
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
      <SectionHeading title="ריכוז חודשים — כל חודש בנפרד" subtitle="לחצו על חודש לפירוט המשימות והשכר" icon={Wallet} />
      <div className="mt-3 space-y-2">
        {months.map((m) => {
          const open = selected === m.mk;
          return (
            <div key={m.mk} className={`rounded-xl border ${open ? "border-indigo-300 bg-indigo-50/40" : "border-slate-100"}`}>
              <button
                type="button"
                onClick={() => setSelected(open ? null : m.mk)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-right"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-800">{monthLabel(m.mk)}</span>
                  <span className="block text-[11px] text-slate-500">
                    {m.tasks} משימות · {m.visits} ביקורים
                  </span>
                </span>
                <span className="text-base font-extrabold text-indigo-700">{formatILS(m.pay)}</span>
              </button>
              {open && (
                <div className="space-y-3 border-t border-indigo-100 px-3 py-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { v: formatILS(m.pay), l: 'סה"כ שכר לחודש' },
                      { v: m.completed, l: "משימות שהושלמו" },
                      { v: m.visits, l: 'סה"כ ביקורים' },
                    ].map((b) => (
                      <div key={b.l} className="rounded-lg bg-white p-2 ring-1 ring-inset ring-slate-100">
                        <p className="text-lg font-extrabold text-indigo-700">{b.v}</p>
                        <p className="text-[10px] text-slate-400">{b.l}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-slate-600">פירוט שכר לפי משימה בחודש זה</p>
                  {m.rows.length === 0 && <p className="py-2 text-center text-xs text-slate-400">אין פעילות בחודש זה</p>}
                  {m.rows.map(({ o, calc }) => {
                    const last = calc.perVisit[calc.perVisit.length - 1];
                    return (
                      <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2.5 text-sm ring-1 ring-inset ring-slate-100">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700">{formatOrderNum(o.id)}</p>
                          <p className="truncate text-xs text-slate-500">
                            {o.recipientName} · {o.street} {o.houseNumber}, {o.city}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {calc.visits} ביקורים · {isOrderCompleted(o) ? o.status : "בטיפול"}
                            {last ? ` · ${fmtDate(last.attempt.timestamp)}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold text-indigo-700">{formatILS(calc.total)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LawyerPortal({ orders, onCreate, onCancelOrder, onDeleteOrder, onLawyerVerify, onSwitchRole, notifications = [], onReadNotification, lockedLawyer = null }) {
  const [tab, setTab] = useState("status");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [affidavitId, setAffidavitId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [currentLawyer, setCurrentLawyer] = useState(lockedLawyer || LAWYERS[0]);
  const [bellOpen, setBellOpen] = useState(false);

  // Notifications are scoped like everything else here: only the ones for
  // THIS lawyer's own orders.
  const myNotifications = notifications.filter((n) => n.lawyer === currentLawyer);
  const unreadNotifications = myNotifications.filter((n) => !n.read);

  // Every screen in this portal is scoped to the signed-in lawyer's own
  // submissions — a lawyer never sees another firm's orders here.
  // (When signed in, the database already returns only this lawyer's orders.)
  const myOrders = useMemo(
    () => (lockedLawyer ? orders : orders.filter((o) => o.submittedBy === currentLawyer)),
    [orders, currentLawyer, lockedLawyer]
  );

  // "סטטוס" shows only active orders; finished ones move to "היסטוריה".
  // Cancelled orders leave this list the instant they are cancelled.
  const activeMyOrders = useMemo(() => myOrders.filter((o) => !isOrderCompleted(o) && !isOrderCancelled(o)), [myOrders]);
  const cancelledMyOrders = useMemo(() => myOrders.filter(isOrderCancelled), [myOrders]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeMyOrders;
    return activeMyOrders.filter(
      (o) =>
        o.recipientName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        orderNumberOf(o.id).includes(q.replace(/^#/, "").replace(/^ord-?/, ""))
    );
  }, [activeMyOrders, query]);

  // Details / affidavit are always resolved from THIS lawyer's own orders
  // (and live, so they refresh the moment a courier submits) — an id that
  // belongs to another client simply resolves to nothing.
  const selected = myOrders.find((o) => o.id === selectedId) || null;
  const affidavitOrder = myOrders.find((o) => o.id === affidavitId) || null;
  const cancelTarget = myOrders.find((o) => o.id === cancelId) || null;
  const deleteTarget = myOrders.find((o) => o.id === deleteId && isOrderCancelled(o)) || null;

  // Clicking a notification opens the full audit file of that order (only if
  // it really is one of this lawyer's own) and marks the notification read.
  const openNotification = (n) => {
    onReadNotification && onReadNotification(n.id);
    setBellOpen(false);
    if (myOrders.some((o) => o.id === n.orderId)) setSelectedId(n.orderId);
  };

  const handleCreateForLawyer = (form) => {
    return onCreate({ ...form, submittedBy: currentLawyer });
  };

  const navItems = [
    { key: "status", label: "סטטוס", icon: FileText },
    { key: "new", label: "הזמנה חדשה", icon: Plus },
    { key: "history", label: "היסטוריה", icon: ScrollText },
    { key: "profile", label: "פרופיל", icon: User },
  ];

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden w-fit gap-1 rounded-2xl bg-slate-100 p-1 sm:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const activeTab = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                    activeTab ? "bg-white text-indigo-700 shadow-sm transition-all duration-300 ease-in-out" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${activeTab ? "text-indigo-500" : ""}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="hidden text-xs text-slate-400 sm:inline">מחובר כ:</span>
            {lockedLawyer ? (
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" /> {currentLawyer}
              </span>
            ) : (
            <div className="relative flex-1 sm:flex-none">
              <Briefcase className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={currentLawyer}
                onChange={(e) => {
                  setCurrentLawyer(e.target.value);
                  setSelectedId(null);
                  setAffidavitId(null);
                  setBellOpen(false);
                }}
                className="w-full appearance-none rounded-lg border border-slate-200/60 bg-white py-1.5 pl-7 pr-8 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none sm:w-48"
              >
                {LAWYERS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((v) => !v)}
                aria-label="התראות"
                className="relative rounded-lg border border-slate-200/60 p-2 text-slate-500 hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[85vw] rounded-2xl border border-slate-200/60 bg-white p-2 shadow-xl">
                  <p className="px-2 py-1 text-xs font-semibold text-slate-400">התראות</p>
                  {myNotifications.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-slate-400">אין התראות חדשות</p>
                  )}
                  {myNotifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`block w-full rounded-lg px-2 py-2 text-right text-xs hover:bg-slate-50 ${
                        n.read ? "text-slate-500" : "bg-emerald-50/60 font-semibold text-slate-700"
                      }`}
                    >
                      {cleanOrderText(n.message)}
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{n.createdAt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real-time banners: one per unread completion, click opens the full audit file. */}
        {unreadNotifications.slice(0, 3).map((n) => (
          <div
            key={n.id}
            role="status"
            className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200"
          >
            <button type="button" onClick={() => openNotification(n)} className="flex-1 text-right">
              <span className="font-bold">🔔 {cleanOrderText(n.message)}</span>
              <span className="mt-0.5 block text-xs font-normal text-emerald-600">לחצו לפתיחת תיק הביקורת המלא</span>
            </button>
            <button
              type="button"
              onClick={() => onReadNotification && onReadNotification(n.id)}
              aria-label="סגירת ההודעה"
              className="rounded-full p-1 text-emerald-500 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {unreadNotifications.length > 3 && (
          <p className="text-center text-xs text-slate-400">ועוד {unreadNotifications.length - 3} הודעות חדשות — בפעמון</p>
        )}

        {tab === "new" && (
          <div className="space-y-4">
            <BulkImportPanel onCreate={handleCreateForLawyer} />
            <NewOrderForm onCreate={handleCreateForLawyer} />
          </div>
        )}

        {tab === "status" && (
          <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeading
                title="מעקב מסירות"
                subtitle={`${filtered.length} מסירות שהגשת · ${currentLawyer}`}
                icon={FileText}
              />
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputCls + " pr-9"}
                  placeholder="חיפוש לפי שם נמען או מספר הזמנה..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/60 text-right text-xs text-slate-400">
                    <th className="pb-2 font-medium">מס' הזמנה</th>
                    <th className="pb-2 font-medium">נמען</th>
                    <th className="pb-2 font-medium">כתובת</th>
                    <th className="pb-2 font-medium">סוג מסמך</th>
                    <th className="pb-2 font-medium">מחיר</th>
                    <th className="pb-2 font-medium">סטטוס</th>
                    <th className="pb-2 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="py-3 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {o.id}
                          {speedOf(o) !== "standard" && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                        {o.caseNumber && <p className="text-[11px] font-normal text-slate-400">{o.caseNumber}</p>}
                      </td>
                      <td className="py-3 text-slate-600">{o.recipientName}</td>
                      <td className="py-3 text-slate-500">
                        {o.street} {o.houseNumber}, {o.city}
                      </td>
                      <td className="py-3 text-slate-500">{o.docType}</td>
                      <td className="py-3">
                        <p className="font-semibold text-slate-700">{formatILS(calcClientPrice(o).total)}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <ServiceChips order={o} />
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={o.status} />
                          <AffidavitBadge order={o} />
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedId(o.id)}
                            className="rounded-md border border-slate-200/60 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            פרטים
                          </button>
                          {!isOrderCancelled(o) && (
                            <button
                              onClick={() => printWaybillLabel(o)}
                              title="הדפסת מדבקת ברקוד למעטפה"
                              className="rounded-md border border-slate-200/60 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                              🏷️ מדבקת ברקוד
                            </button>
                          )}
                          {canCancelOrder(o) && onCancelOrder && (
                            <button
                              onClick={() => setCancelId(o.id)}
                              className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                            >
                              <X className="h-3.5 w-3.5" /> ביטול מסירה
                            </button>
                          )}
                          {isAffidavitSigned(o) && (
                            <button
                              onClick={() => setAffidavitId(o.id)}
                              className="flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:brightness-110"
                            >
                              <Download className="h-3.5 w-3.5" /> {usesAffidavit(o) ? "תצהיר" : "אישור מסירה"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        לא נמצאו מסירות תואמות
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "status" && cancelledMyOrders.length > 0 && onDeleteOrder && (
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold text-slate-600"
            >
              <span>🚫 מסירות שבוטלו ({cancelledMyOrders.length})</span>
              <ChevronDown className={`h-4 w-4 transition ${showCancelled ? "rotate-180" : ""}`} />
            </button>
            {showCancelled && (
              <ul className="mt-3 space-y-2">
                {cancelledMyOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-600">
                      <strong>{formatOrderNum(o.id)}</strong> · {o.recipientName} · {o.city}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteId(o.id)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      🗑️ מחק לצמיתות
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            <CsvExportButton orders={myOrders.filter(isOrderCompleted)} filename="היסטוריית-מסירות.csv" />
            <OrderHistoryList orders={myOrders} onOpenAffidavit={setAffidavitId} onDeletePermanently={onDeleteOrder ? (id) => { onDeleteOrder(id); setSelectedId(null); } : undefined} />
          </div>
        )}

        {tab === "profile" && (
          <ProfileTab role="lawyer" subtitle={`מחובר כ: ${currentLawyer}`} onSwitchRole={onSwitchRole} />
        )}

        <OrderDetailsModal
          order={selected}
          onClose={() => setSelectedId(null)}
          onOpenAffidavit={(o) => setAffidavitId(o.id)}
          onCancel={onCancelOrder ? (o) => setCancelId(o.id) : undefined}
        />
        <Modal open={!!cancelTarget && canCancelOrder(cancelTarget)} onClose={() => setCancelId(null)} title="ביטול מסירה">
          {cancelTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                לבטל את ההזמנה <strong>{formatOrderNum(cancelTarget.id)}</strong> עבור <strong>{cancelTarget.recipientName}</strong>? ניתן לבטל רק לפני ששליח שובץ למסירה. הפעולה אינה הפיכה.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onCancelOrder(cancelTarget.id);
                    setCancelId(null);
                    setSelectedId(null);
                  }}
                  className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  כן, בטל מסירה
                </button>
                <button
                  type="button"
                  onClick={() => setCancelId(null)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  חזרה
                </button>
              </div>
            </div>
          )}
        </Modal>
        <Modal open={!!deleteTarget} onClose={() => setDeleteId(null)} title="מחיקה לצמיתות">
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                למחוק לצמיתות את ההזמנה המבוטלת <strong>{formatOrderNum(deleteTarget.id)}</strong> עבור <strong>{deleteTarget.recipientName}</strong>? ההזמנה תימחק מהמערכת ולא ניתן לשחזר אותה.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteOrder(deleteTarget.id);
                    setDeleteId(null);
                    setSelectedId(null);
                  }}
                  className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  🗑️ מחק לצמיתות
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  חזרה
                </button>
              </div>
            </div>
          )}
        </Modal>
        {/* Read-only for the lawyer: shows the courier's signature, with print / download. */}
        <AffidavitModal order={affidavitOrder} onClose={() => setAffidavitId(null)} onLawyerVerify={onLawyerVerify} />
      </div>

      <BottomNav items={navItems} active={tab} onChange={setTab} />
    </>
  );
}

/* =========================================================================
   COURIER VIEW — Signature Pad
   ========================================================================= */
// Reusable finger/mouse signature canvas, used both for the recipient's
// delivery signature and for the courier's affidavit signature.
//
// Why this is built the way it is (the old pad drew in the wrong place on
// phones): the canvas' internal bitmap size and its on-screen CSS size are
// different, so every pointer position must be scaled by
// (canvas.width / rect.width). The bitmap is also sized for the device pixel
// ratio so strokes stay crisp. Touch listeners are attached natively with
// { passive: false } because React's synthetic onTouchMove is passive, which
// makes preventDefault() a no-op and lets the page scroll under the finger
// mid-signature; `touch-action: none` on the canvas backs that up.
//
// Exposes { clear(), toDataURL(), isValid() } through the ref, and reports
// validity through onChange(boolean). "Valid" means a real stroke (a minimum
// total ink length), so a single stray tap/dot cannot pass as a signature.
const MIN_SIGNATURE_INK_PX = 40;

const SignatureCanvas = React.forwardRef(function SignatureCanvas({ onChange, height = 180, hideControls = false }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const inkLength = useRef(0);
  const validRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const reportValid = (valid) => {
    if (validRef.current === valid) return;
    validRef.current = valid;
    setHasInk(valid);
    onChangeRef.current && onChangeRef.current(valid);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    inkLength.current = 0;
    lastPoint.current = null;
    reportValid(false);
  };

  React.useImperativeHandle(ref, () => ({
    clear,
    toDataURL: () => canvasRef.current.toDataURL("image/png"),
    isValid: () => validRef.current,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    // Size the bitmap to the on-screen size × device pixel ratio.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round((rect.width || 480) * dpr);
    canvas.height = Math.round((rect.height || height) * dpr);
    const ctx = canvas.getContext("2d");

    const toCanvasPoint = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      const scaleX = canvas.width / (r.width || canvas.width);
      const scaleY = canvas.height / (r.height || canvas.height);
      return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY, scale: scaleX };
    };

    const begin = (clientX, clientY) => {
      drawing.current = true;
      const p = toCanvasPoint(clientX, clientY);
      lastPoint.current = p;
      // A dot on touch-down so even the start of a stroke shows instantly.
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1.4 * dpr), 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = (clientX, clientY) => {
      if (!drawing.current || !lastPoint.current) return;
      const p = toCanvasPoint(clientX, clientY);
      ctx.strokeStyle = "#1e1b4b";
      ctx.lineWidth = 2.6 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      inkLength.current += Math.hypot(p.x - lastPoint.current.x, p.y - lastPoint.current.y) / (p.scale || 1);
      lastPoint.current = p;
      if (inkLength.current >= MIN_SIGNATURE_INK_PX) reportValid(true);
    };

    const finish = () => {
      drawing.current = false;
      lastPoint.current = null;
    };

    // --- Touch (mobile) ---
    const onTouchStart = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) begin(t.clientX, t.clientY);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) draw(t.clientX, t.clientY);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      finish();
    };

    // --- Mouse (desktop) ---
    const onMouseDown = (e) => begin(e.clientX, e.clientY);
    const onMouseMove = (e) => draw(e.clientX, e.clientY);
    const onMouseUp = () => finish();

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: "none" }}
          className="block w-full cursor-crosshair touch-none select-none rounded-lg border-2 border-dashed border-indigo-300 bg-white"
          aria-label="אזור חתימה"
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-300">
            <PenTool className="h-6 w-6" />
            <span className="text-sm font-medium">חתמו כאן באצבע</span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-7 left-6 right-6 border-b border-slate-200" />
      </div>
      {!hideControls && (
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">החתימה נשמרת כתמונה ונצמדת לתצהיר</span>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> ניקוי
        </button>
      </div>
      )}
    </div>
  );
});

// Dedicated full-screen signing overlay — a big canvas that is comfortable to
// sign on with a finger, with "ניקוי" and "אישור" directly below it. Sits above
// every other modal (z-[70]) and locks the page behind it from scrolling.
function FullScreenSignatureModal({ open, title, subtitle, onCancel, onConfirm }) {
  const sigRef = useRef(null);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    setValid(false);
    setError("");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const approve = () => {
    if (!sigRef.current || !sigRef.current.isValid()) {
      setError("יש לחתום בתוך מסגרת החתימה לפני האישור");
      return;
    }
    onConfirm(sigRef.current.toDataURL());
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" role="dialog" aria-modal="true" dir="rtl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-base font-bold text-indigo-700">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="סגירה"
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 overflow-auto p-4">
        <SignatureCanvas
          ref={sigRef}
          hideControls
          height="min(58vh, 480px)"
          onChange={(v) => {
            setValid(v);
            if (v) setError("");
          }}
        />
        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600" role="alert">
            <CircleAlert className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => sigRef.current && sigRef.current.clear()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3.5 text-base font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-5 w-5" /> ניקוי
          </button>
          <button
            type="button"
            onClick={approve}
            className={`flex flex-[2] items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold text-white shadow-sm transition ${
              valid ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110" : "bg-slate-400 hover:bg-slate-500"
            }`}
          >
            <Check className="h-5 w-5" /> אישור
          </button>
        </div>
        <p className="text-center text-[11px] text-slate-400">אחרי האישור החתימה נשמרת על התצהיר והמשימה נסגרת</p>
      </div>
    </div>
  );
}

function SignaturePad({ onSave, onCancel }) {
  const sigRef = useRef(null);
  const [valid, setValid] = useState(false);

  return (
    <div>
      <p className="mb-2 text-sm text-slate-500">בקשו מהנמען לחתום באצבע על המסך למטה</p>
      <SignatureCanvas ref={sigRef} onChange={setValid} height={200} />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => valid && onSave(sigRef.current.toDataURL())}
          disabled={!valid}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> אישור חתימה
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-600">
          ביטול
        </button>
      </div>
    </div>
  );
}

/* Audio Recorder */
function AudioRecorder({ onRecorded, label = "הקלטת שמע", invalid }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecorded(true);
        // Keep the actual recording (base64) so it can be attached to the
        // refusal record; fall back to a plain "recorded" flag on failure.
        const blob = new window.Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new window.FileReader();
        reader.onloadend = () => onRecorded && onRecorded(typeof reader.result === "string" ? reader.result : true);
        reader.onerror = () => onRecorded && onRecorded(true);
        reader.readAsDataURL(blob);
      };
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      // Fallback when mic is unavailable in this environment
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      setRecorded(true);
      onRecorded && onRecorded(true);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        invalid ? "border-rose-400 bg-rose-50" : "border-slate-200/60 bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
          recording ? "bg-rose-600 text-white" : "bg-indigo-600 text-white"
        }`}
      >
        {recording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">
          {recording ? "מקליט..." : recorded ? "הקלטה נשמרה" : label}
        </p>
        <p className="font-mono text-xs text-slate-400">
          {recording ? `${mm}:${ss}` : recorded ? `${mm}:${ss} נשמר` : "00:00"}
        </p>
      </div>
      {recorded && !recording && <Check className="h-5 w-5 text-emerald-500" />}
    </div>
  );
}

/* Photo upload with simulated GPS timestamp */
function PhotoUpload({ label, onCaptured, invalid, getStamp }) {
  const [photo, setPhoto] = useState(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Evidence stamp (time + GPS + order id) burned onto the image itself.
    let stamp = null;
    try {
      stamp = getStamp ? await getStamp() : null;
    } catch (err) {
      stamp = null;
    }
    // `url` is a base64 data URL so the photo can be stored on the order.
    // (The visit's GPS fix is attached to the photo when the visit is saved.)
    // Photos become base64 data URLs; videos are too large to inline, so
    // they are kept as an in-session object URL and flagged kind: "video".
    const isVideo = (file.type || "").startsWith("video/");
    const url = isVideo ? window.URL.createObjectURL(file) : await fileToDataUrl(file, 1280, 0.75, stamp);
    const meta = { url, kind: isVideo ? "video" : "image", timestamp: nowStamp(0) };
    setPhoto(meta);
    onCaptured && onCaptured(meta);
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      {!photo ? (
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-sm hover:bg-slate-100 ${
            invalid
              ? "border-rose-400 bg-rose-50 text-rose-600"
              : "border-slate-300 bg-slate-50 text-slate-500 hover:border-indigo-300"
          }`}
        >
          <Camera className="h-5 w-5" />
          לחצו לצילום תמונה
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleChange}
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200/60 p-2">
          {photo.kind === "video" ? (
            <video src={isSafeMediaSrc(photo.url, { kind: "media", allowBlob: true }) ? photo.url : undefined} muted playsInline className="h-16 w-16 rounded-md bg-black object-cover" />
          ) : (
            <img src={isSafeMediaSrc(photo.url, { allowBlob: true }) ? photo.url : undefined} alt="תיעוד" className="h-16 w-16 rounded-md object-cover" />
          )}
          <div className="flex-1 text-xs text-slate-500">
            <p className="flex items-center gap-1 font-medium text-slate-600">
              <Clock className="h-3 w-3" /> {photo.timestamp}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-emerald-600">
              <Check className="h-3 w-3" /> {photo.kind === "video" ? "הווידאו מוכן לשמירה" : "התמונה מוכנה לשמירה"}
            </p>
          </div>
          <button
            onClick={() => {
              setPhoto(null);
              onCaptured && onCaptured(null);
            }}
            className="text-slate-300 hover:text-rose-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function CourierActionModal({ order, actionType, onClose, onComplete }) {
  const [signed, setSigned] = useState(false);
  // Single-visit tracks: who received it ("recipient" | "secretariat" | "left").
  const [deliveryMode, setDeliveryMode] = useState("recipient");
  // Regulation 163(b): who actually received the document (legal / 3-visit).
  const [deliveredToType, setDeliveredToType] = useState("self");
  const [receiverName, setReceiverName] = useState("");
  const [receiverRelation, setReceiverRelation] = useState("");
  // Regulation 161(4)(b)(2): how residence was verified before door posting.
  const [residenceVerification, setResidenceVerification] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  // Bank track: mandatory ID verification (document type + last 4 digits).
  const [verifiedIdType, setVerifiedIdType] = useState("");
  const [verifiedIdLast4, setVerifiedIdLast4] = useState("");
  const gpsRef = useRef(null);
  const [recipientSig, setRecipientSig] = useState(null);
  const [audioOk, setAudioOk] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Live GPS status for this visit: idle | loading | ok | error. The fix is
  // requested the moment an action opens (so the browser's permission prompt
  // and the GPS lock happen while the courier is still filling the form) and
  // is requested AGAIN, fresh, at the moment of saving.
  const [gps, setGps] = useState({ status: "idle" });
  // The courier's explicit choice to save a visit with NO location (recorded
  // and flagged as such — never replaced by invented coordinates).
  const [allowNoGps, setAllowNoGps] = useState(false);
  // Set when the courier tries to save a visit without a photo.
  const [photoError, setPhotoError] = useState(false);
  // Set when the courier tries to save a visit without the audio recording.
  const [audioError, setAudioError] = useState(false);

  const fetchGps = async () => {
    setGps({ status: "loading" });
    const r = await getGps();
    setGps(r.ok ? { status: "ok", ...r } : { status: "error", reason: r.reason });
    return r;
  };

  // This component stays mounted between uses, so wipe the previous
  // task's signature / audio / photo whenever a new action is opened —
  // otherwise one delivery's signature would unlock the next one.
  useEffect(() => {
    setSigned(false);
    setDeliveryMode("recipient");
    setDeliveredToType("self");
    setReceiverName("");
    setReceiverRelation("");
    setResidenceVerification("");
    setVerificationNote("");
    setRecipientSig(null);
    setAudioOk(false);
    setPhoto(null);
    setDescription("");
    setSubmitting(false);
    setAllowNoGps(false);
    setPhotoError(false);
    setAudioError(false);
    if (order && actionType) {
      fetchGps();
    } else {
      setGps({ status: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, actionType]);

  if (!order || !actionType) return null;

  gpsRef.current = gps;
  // Stamp for photos: capture time now + the latest GPS fix (a quick extra
  // read if none yet; time only if GPS is unavailable).
  const getStamp = async () => {
    let g = gpsRef.current;
    if (!(g && g.lat != null)) g = await getGps({ timeout: 2500 });
    return { orderId: order && order.id, lat: g && g.lat != null ? g.lat : null, lng: g && g.lng != null ? g.lng : null, at: new window.Date() };
  };
  const singleVisit = isSingleVisit(order);
  // Bank track: personal delivery only + ID verification; no posting / leaving.
  const isBank = trackOf(order) === "bank";
  // Legal / 3-visit deliveries (and every bank delivery) must record WHO received the document.
  const needsReceiver = actionType === "delivered" && (!singleVisit || isBank);
  const receiverLabels = isBank ? DELIVERED_TO_BANK : DELIVERED_TO;
  const idOk = !isBank || actionType !== "delivered" || (ID_DOC_TYPES.includes(verifiedIdType) && /^\d{4}$/.test(verifiedIdLast4));
  const receiverOk = !needsReceiver || deliveredToType === "self" || (receiverName.trim() !== "" && receiverRelation.trim() !== "");
  const noSigNeeded = actionType === "delivered" && singleVisit && deliveryMode === "left";
  const titles = {
    delivered: "אישור מסירה — חתימת נמען",
    refused: "תיעוד סירוב קבלה",
    noanswer: "אין מענה בדלת",
    posted: "הדבקה על הדלת — ביקור 3",
  };

  // A visit can only be saved once the location is known — or the courier
  // has explicitly chosen to save it without one.
  const gpsReady = gps.status === "ok" || allowNoGps;
  const handlePhoto = (meta) => {
    setPhoto(meta);
    if (meta) setPhotoError(false);
  };
  // Standard protocol — EVERY report needs: GPS + photo/video + audio, and a
  // delivery additionally needs the recipient's digital signature. (Photo is
  // checked on save so the courier gets the explicit "חובה לצלם" message.)
  const canComplete =
    !gpsReady
      ? false
      : actionType === "delivered"
      ? (signed || noSigNeeded) && !!audioOk && receiverOk && idOk
      : actionType === "refused"
      ? !!audioOk && !!description.trim()
      : actionType === "posted"
      ? !!audioOk && !!residenceVerification
      : !!audioOk;

  const complete = async () => {
    if (submitting) return;
    // Bank deliveries: never post on the door, never without ID verification.
    if (isBank && actionType === "posted") return;
    if (actionType === "delivered" && !idOk) return;
    // A photo is mandatory for EVERY visit action (no answer, posting,
    // delivery, refusal) — nothing is saved without one.
    if (!photo) {
      setPhotoError(true);
      return;
    }
    if (!audioOk) {
      setAudioError(true);
      return;
    }
    setSubmitting(true);
    // Fresh, high-accuracy fix at the exact moment of saving. If that reading
    // fails but a good one was already taken when the form opened, use that;
    // otherwise warn the courier — never insert invented coordinates.
    // The reading taken when the form opened is used immediately, so saving
    // never waits on the GPS chip; a fresh read (4 s max) only happens if
    // there is no usable reading yet.
    let g = gps.status === "ok" ? gps : await getGps({ timeout: 4000 });
    if (!g.ok && gps.status === "ok") g = gps;
    if (!g.ok && !allowNoGps) {
      setGps({ status: "error", reason: g.reason });
      setSubmitting(false);
      return;
    }
    onComplete({
      type: ATTEMPT_TYPE_LABEL[actionType],
      timestamp: nowStamp(0),
      location: g.ok ? g.coords : "לא נקלט GPS",
      lat: g.ok ? g.lat : null,
      lng: g.ok ? g.lng : null,
      gpsAccuracy: g.ok ? g.accuracy : null,
      gpsMissing: !g.ok,
      // Photo evidence (base64) + the audio recording are mapped onto the
      // attempt itself, so they travel with the order to Admin and Lawyer.
      photo: photo ? { dataUrl: photo.url, kind: photo.kind || "image", timestamp: photo.timestamp, gps: g.ok ? g.coords : null } : null,
      audio: typeof audioOk === "string" ? audioOk : null,
      audioRecorded: !!audioOk,
      courier: order.assignedCourier,
      // Legal audit stamp: exact ISO time + GPS of the moment of reporting.
      audit: {
        capturedAt: new window.Date().toISOString(),
        gps: g.ok ? { lat: g.lat, lng: g.lng, accuracy: g.accuracy } : null,
        gpsStatus: g.ok ? "ok" : g.reason || "unavailable",
      },
      notes:
        actionType === "refused"
          ? `סירוב מתועד. תיאור: ${description}`
          : actionType === "posted"
          ? "המעטפה הודבקה על דלת הנמען לאחר 3 ביקורים ללא מענה"
          : actionType === "noanswer"
          ? "לא נענתה הדלת, הביקור הבא יתוזמן"
          : singleVisit && deliveryMode === "secretariat"
          ? "נמסר למזכירות / קבלה וחתום"
          : singleVisit && deliveryMode === "left"
          ? "הונח בכתובת / בתיבה (ללא חתימה) — מתועד בתמונה, GPS וזמן"
          : needsReceiver && deliveredToType !== "self"
          ? `נמסר ל${receiverLabels[deliveredToType]}: ${receiverName.trim()} (${receiverRelation.trim()}) וחתום${isBank ? ` — ${idVerificationText({ verifiedIdType, verifiedIdLast4 })}` : ""}`
          : isBank
          ? `נמסר לנמען בעצמו וחתום — ${idVerificationText({ verifiedIdType, verifiedIdLast4 })}`
          : "נמסר וחתום על ידי הנמען",
      ...(actionType === "delivered" && singleVisit ? { deliveryMode } : {}),
      ...(needsReceiver
        ? {
            deliveredToType: receiverLabels[deliveredToType],
            receiverName: deliveredToType === "self" ? "" : receiverName.trim(),
            receiverRelation: deliveredToType === "self" ? "" : receiverRelation.trim(),
          }
        : {}),
      ...(isBank && actionType === "delivered" ? { verifiedIdType, verifiedIdLast4 } : {}),
      ...(actionType === "posted"
        ? { residenceVerification: RESIDENCE_VERIFY[residenceVerification], verificationNote: verificationNote.trim() }
        : {}),
      ...(actionType === "delivered" && recipientSig ? { signatureDataUrl: await compressDataUrl(recipientSig) } : {}),
    });
    onClose();
  };

  return (
    <Modal open={!!actionType} onClose={onClose} title={titles[actionType]}>
      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-700">{order.recipientName}</p>
        <p className="text-xs text-slate-400">
          {order.street} {order.houseNumber}
          {order.apartment ? `/${order.apartment}` : ""}
          {order.floor ? ` · קומה ${order.floor}` : ""}, {order.city}
        </p>
        {order.entranceCode && (
          <p className="mt-0.5 text-xs font-medium text-indigo-600">🔑 קוד כניסה: {order.entranceCode}</p>
        )}
      </div>

      {/* Live GPS status — the visit can't be saved until a real fix exists
          (or the courier explicitly chooses to save without a location). */}
      <div
        className={`mb-4 rounded-lg p-3 text-xs ring-1 ring-inset ${
          gps.status === "ok"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : gps.status === "error"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : "bg-slate-50 text-slate-500 ring-slate-200"
        }`}
        role={gps.status === "error" ? "alert" : undefined}
      >
        {gps.status === "loading" && (
          <p className="flex items-center gap-1.5 font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> מאתר מיקום GPS מדויק...
          </p>
        )}
        {gps.status === "ok" && (
          <p className="flex flex-wrap items-center gap-x-2 font-medium">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> מיקום נקלט: {gps.coords}
            </span>
            <span className="text-emerald-600/80">דיוק ±{gps.accuracy} מ'</span>
            <button type="button" onClick={fetchGps} className="mr-auto underline">
              רענון
            </button>
          </p>
        )}
        {gps.status === "error" && (
          <div className="space-y-2">
            <p className="flex items-start gap-1.5 font-semibold">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>לא נקלט מיקום GPS. {GPS_REASON_TEXT[gps.reason] || ""}</span>
            </p>
            {allowNoGps ? (
              <p className="font-medium">הביקור יישמר ללא מיקום ויסומן בדוח כ"ללא GPS".</p>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchGps}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700"
                >
                  נסה שוב
                </button>
                <button
                  type="button"
                  onClick={() => setAllowNoGps(true)}
                  className="rounded-lg border border-rose-300 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
                >
                  המשך ללא מיקום
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mandatory-evidence checklist: nothing is saved until all of it is in. */}
      <div className="mb-4 rounded-lg border border-slate-200/60 p-3">
        <p className="mb-2 text-xs font-bold text-slate-500">חובה לכל דיווח ({LEGAL_REFS.serviceRule})</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {[
            { ok: gps.status === "ok" || allowNoGps, label: "מיקום GPS" },
            { ok: !!photo, label: "תמונה / וידאו" },
            { ok: !!audioOk, label: "הקלטת שמע" },
            ...(actionType === "delivered" && !noSigNeeded ? [{ ok: signed, label: "חתימת הנמען" }] : []),
            ...(actionType === "delivered" && isBank ? [{ ok: idOk, label: "זיהוי בתעודה מזהה" }] : []),
          ].map((it) => (
            <li key={it.label} className={`flex items-center gap-1.5 font-medium ${it.ok ? "text-emerald-600" : "text-slate-400"}`}>
              {it.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />} {it.label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">
          הדיווח יישלח מיידית למשרד עורכי הדין ולמנהל המערכת ברגע השמירה.
        </p>
      </div>

      <div className="mb-4">
        <AudioRecorder
          label="הקלטת שמע (חובה)"
          onRecorded={(v) => {
            setAudioOk(v);
            if (v) setAudioError(false);
          }}
          invalid={audioError && !audioOk}
        />
      </div>

      {actionType === "delivered" && (
        <div className="space-y-4">
          {needsReceiver && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-600">{isBank ? "למי נמסר המסמך? (מסירה בנקאית — לנמען בלבד)" : "למי נמסר המסמך? (תקנה 163(ב))"}</p>
              <div className="space-y-1.5" role="radiogroup" aria-label="מקבל המסמך">
                {Object.entries(receiverLabels).map(([k, l]) => (
                  <label key={k} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input type="radio" name="deliveredTo" className="mt-1" checked={deliveredToType === k} onChange={() => setDeliveredToType(k)} />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
              {deliveredToType !== "self" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={inputCls}
                    placeholder={deliveredToType === "authorized" ? "שם המקבל ותפקידו (שם)" : "שם המקבל"}
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder={deliveredToType === "authorized" ? "תפקיד" : "קרבה לנמען (בן/בת זוג, הורה, בן/בת בגיר/ה)"}
                    value={receiverRelation}
                    onChange={(e) => setReceiverRelation(e.target.value)}
                  />
                </div>
              )}
              {!receiverOk && <p className="text-[11px] font-semibold text-rose-600">יש למלא שם המקבל וקרבה / תפקיד.</p>}
            </div>
          )}
          {isBank && (
            <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-bold text-sky-900">🏦 אימות זהות — חובה לפני אישור המסירה</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select className={inputCls} value={verifiedIdType} onChange={(e) => setVerifiedIdType(e.target.value)} aria-label="סוג תעודה מזהה">
                  <option value="">סוג תעודה מזהה…</option>
                  {ID_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4 ספרות אחרונות של מספר התעודה"
                  value={verifiedIdLast4}
                  onChange={(e) => setVerifiedIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              {!idOk && <p className="text-[11px] font-semibold text-rose-600">יש לבחור סוג תעודה ולהזין בדיוק 4 ספרות.</p>}
              <p className="text-[11px] text-sky-800">מסירה בנקאית: לנמען בלבד (או מורשה חתימה מזוהה). אסור להניח בכתובת, למסור לבן משפחה או להדביק על הדלת.</p>
            </div>
          )}
          {singleVisit && !isBank && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="אופן המסירה">
              {[
                ["recipient", "נמסר לנמען"],
                ["secretariat", "נמסר למזכירות / קבלה"],
                ["left", "הונח בכתובת / תיבה"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={deliveryMode === k}
                  onClick={() => setDeliveryMode(k)}
                  className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold ${
                    deliveryMode === k ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          <PhotoUpload label="צילום מסירה (חובה)" getStamp={getStamp} onCaptured={handlePhoto} invalid={photoError && !photo} />
          {!noSigNeeded && (
            <SignaturePad onSave={(dataUrl) => { setRecipientSig(dataUrl); setSigned(true); }} onCancel={onClose} />
          )}
        </div>
      )}

      {actionType === "refused" && (
        <div className="space-y-4">
          <PhotoUpload label="צילום / וידאו דיסקרטי של הנמען או הדלת (חובה)" getStamp={getStamp} onCaptured={handlePhoto} invalid={photoError && !photo} />
          <Field label="תיאור פיזי / נסיבות הסירוב" required>
            <textarea
              className={inputCls}
              rows={3}
              placeholder="לדוגמה: גבר כבן 50, חולצה כחולה, סירב לפתוח את הדלת..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      )}

      {actionType === "noanswer" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200/60 bg-slate-50 p-4 text-sm text-slate-600">
            <MapPin className="h-5 w-5 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">מיקום ושעה יישמרו אוטומטית</p>
              <p className="text-xs text-slate-400">הנקודה והשעה המדויקות יתועדו ברגע השמירה</p>
            </div>
          </div>
          <PhotoUpload label="צילום / וידאו של הדלת או הכניסה (חובה)" getStamp={getStamp} onCaptured={handlePhoto} invalid={photoError && !photo} />
        </div>
      )}

      {actionType === "posted" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
            זהו ביקור שלישי ואחרון — יש לצלם את המעטפה כשהיא מודבקת על הדלת בהתאם לתקנות.
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-600">אימות מגורים לפני הדבקה (תקנה 161(4)(ב)(2)) — חובה</p>
            <div className="space-y-1.5" role="radiogroup" aria-label="אימות מגורים">
              {Object.entries(RESIDENCE_VERIFY).map(([k, l]) => (
                <label key={k} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input type="radio" name="residence" className="mt-1" checked={residenceVerification === k} onChange={() => setResidenceVerification(k)} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
            {residenceVerification === "neighbor" && (
              <input className={inputCls} placeholder="שם השכן / דירה (לא חובה)" value={verificationNote} onChange={(e) => setVerificationNote(e.target.value)} />
            )}
            {!residenceVerification && <p className="text-[11px] font-semibold text-rose-600">יש לבחור כיצד אומת שהנמען מתגורר בכתובת.</p>}
          </div>
          <PhotoUpload label="צילום / וידאו של המעטפה מודבקת על הדלת (חובה)" getStamp={getStamp} onCaptured={handlePhoto} invalid={photoError && !photo} />
        </div>
      )}

      {photoError && !photo && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200" role="alert">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" /> חובה לצלם תמונה כדי לדווח על הביקור
        </p>
      )}
      {audioError && !audioOk && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200" role="alert">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" /> חובה להקליט שמע כדי לדווח על הביקור
        </p>
      )}

      {actionType !== "delivered" && (
        <button
          onClick={complete}
          disabled={!canComplete || submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {submitting ? "מאתר מיקום ושומר..." : "שמירת עדכון"}
        </button>
      )}

      {actionType === "delivered" && (signed || noSigNeeded) && (
        <button
          onClick={complete}
          disabled={submitting || !gpsReady || !audioOk || !receiverOk}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          {submitting ? "מאתר מיקום ושומר..." : "סיום ואישור מסירה"}
        </button>
      )}
    </Modal>
  );
}

/* Courier-submitted custom price request — proposes new per-attempt and/or
   per-completed rates for one order, with a required reason. The proposal
   stays "pending" until the Admin approves or rejects it; the courier cannot
   change the order's actual price themselves. */
function PriceRequestModal({ order, courier, onClose, onSubmit }) {
  const [perAttempt, setPerAttempt] = useState("");
  const [perCompleted, setPerCompleted] = useState("");
  const [reason, setReason] = useState("");

  if (!order) return null;

  const canSubmit = (perAttempt !== "" || perCompleted !== "") && reason.trim().length > 0;

  // Converts a text field to a proposed value: "" (or anything that doesn't
  // parse to a real number) is sent as null, so a stray character never
  // becomes NaN inside the stored request.
  const toProposedValue = (raw) => {
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(order.id, {
      courier,
      proposedPerAttempt: toProposedValue(perAttempt),
      proposedPerCompleted: toProposedValue(perCompleted),
      reason: reason.trim(),
    });
    setPerAttempt("");
    setPerCompleted("");
    setReason("");
    onClose();
  };

  return (
    <Modal open={!!order} onClose={onClose} title="בקשת התאמת מחיר">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-700">{order.recipientName}</p>
          <p className="text-xs text-slate-400">
            {order.street} {order.houseNumber}, {order.city} · {formatOrderNum(order.id)}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          מלאו לפחות שדה מחיר אחד וציינו סיבה קצרה. הבקשה תישלח למנהל לאישור ולא תיכנס לתוקף עד שתאושר.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="מחיר מוצע לביקור (₪)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="השאירו ריק אם ללא שינוי"
              value={perAttempt}
              onChange={(e) => setPerAttempt(e.target.value)}
            />
          </Field>
          <Field label="סכום השלמה מלא מוצע (₪)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="השאירו ריק אם ללא שינוי"
              value={perCompleted}
              onChange={(e) => setPerCompleted(e.target.value)}
            />
          </Field>
        </div>
        <Field label="סיבה" required>
          <textarea
            className={inputCls}
            rows={3}
            placeholder="לדוגמה: קומה 5 ללא מעלית, נדרשה נסיעה נוספת עקב כתובת שגויה..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {!canSubmit && (
          <p className="text-xs text-amber-600">יש למלא לפחות שדה מחיר אחד ולציין סיבה לפני שליחה.</p>
        )}
      </div>

      {/* Sticky action bar — stays pinned to the bottom of the modal's own
          scroll area (not the page), so the Submit button is always visible
          and reachable on small phone screens, even with the keyboard open. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-slate-100 bg-white px-5 py-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Coins className="h-4 w-4" /> שלח לבדיקה
        </button>
      </div>
    </Modal>
  );
}

// Builds the https fallback URL for a clean destination string — the caller
// is expected to pass ONLY street + house number + city (no floor, apartment
// or intercom code: Waze can't drive to a floor, and the extra detail is
// exactly what turns a direct navigation link into an ambiguous search
// prompt). This is what the rendered <a>'s href is set to, so the link
// always works even where the onClick handler below can't run (JS disabled,
// a crawler, a right-click "open in new tab").
// Official Waze Universal Deep Link. Rendered as a plain native <a> tag
// (no onClick/JS redirect) so mobile OSs can intercept it directly and open
// the installed Waze app — JS-based redirects and custom waze:// schemes
// get blocked inside in-app browsers/WebViews, which is what this avoids.
function buildWazeUrl(cleanAddress) {
  return `https://waze.com/ul?q=${encodeURIComponent(cleanAddress)}&navigate=yes`;
}

function CourierTaskCard({ order, onAction, onRequestPrice, onPickup }) {
  // Display address includes the apartment number for clarity on the card...
  const address = `${order.street} ${order.houseNumber}${order.apartment ? "/" + order.apartment : ""}, ${order.city}`;
  // ...but Waze/navigation only ever gets Street + House Number + City.
  // Floor, apartment and intercom codes aren't driving directions — sending
  // them to Waze is exactly what turns a direct navigation link into an
  // ambiguous search prompt, so they're stripped out before building the URL.
  const cleanAddress = `${order.street} ${order.houseNumber}, ${order.city}`;
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const attemptsCount = order.attempts.filter((a) => a.type === "אין מענה").length;
  const pendingRequest = (order.priceRequests || []).find((r) => r.status === "pending");

  // One legally-valid visit per calendar day: once ANY attempt has been
  // logged today, every action locks until the next calendar day — a second
  // attempt on the same day would not hold up in court.
  const lastAttempt = order.attempts[order.attempts.length - 1];

  // A ticking clock (re-rendered every second) is what keeps the countdown
  // below live, and it's also what naturally flips `lockedToday` back to
  // false the instant midnight passes — both `today` and the countdown are
  // recomputed fresh from the real clock on every tick, so no separate
  // "force unlock" state is needed.
  const [clockTick, setClockTick] = useState(() => window.Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockTick(window.Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = dayKeyOf(nowStamp(0));
  // Legal windows: next visit = a later calendar day AND an unused window.
  const gate = useMemo(
    () => (lastAttempt ? nextVisitGate(order, clockTick) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order.attempts, clockTick]
  );
  // Single-visit tracks (standard / municipal with 1 visit): no 3-visit rule,
  // no morning / noon / evening lock.
  const singleVisit = isSingleVisit(order);
  const lockedToday = singleVisit ? false : gate ? !gate.open : !!lastAttempt && dayKeyOf(lastAttempt.timestamp) === today;

  // Right after a "no answer" visit is logged, jump to this card and flash
  // the next-visit banner (with its countdown + explanation) for a few seconds.
  const cardRef = useRef(null);
  const prevAttemptsRef = useRef(order.attempts.length);
  const [spotlight, setSpotlight] = useState(false);
  useEffect(() => {
    const grew = order.attempts.length > prevAttemptsRef.current;
    prevAttemptsRef.current = order.attempts.length;
    if (!grew || order.status !== STATUS.PENDING_NEXT_VISIT) return undefined;
    setSpotlight(true);
    const t1 = setTimeout(() => {
      if (cardRef.current) cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const t2 = setTimeout(() => setSpotlight(false), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [order.attempts.length, order.status]);

  // Time remaining until local midnight (00:00:00 of the next calendar
  // day), formatted as HH:MM:SS for the locked banner.
  const countdownLabel = useMemo(() => {
    const now = new window.Date(clockTick);
    const nextMidnight = new window.Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    // Counts down to the real start of the next legal window (falls back to midnight).
    const target = gate && !gate.open ? gate.windowStart : nextMidnight.getTime();
    const totalSeconds = Math.max(0, Math.floor((target - now.getTime()) / 1000));
    const h = pad(Math.floor(totalSeconds / 3600));
    const m = pad(Math.floor((totalSeconds % 3600) / 60));
    const s = pad(totalSeconds % 60);
    return `${h}:${m}:${s}`;
  }, [clockTick, gate]);

  // Browser push notification: prompt once (per card) for permission while
  // the task is locked, then fire a single system notification — with a
  // vibration pattern where supported — the moment the lock lifts for the
  // next calendar day, so the courier doesn't have to sit and watch the
  // countdown.
  const notifiedRef = useRef(false);
  const askedPermissionRef = useRef(false);
  const wasLockedRef = useRef(lockedToday);
  useEffect(() => {
    const wasLocked = wasLockedRef.current;
    wasLockedRef.current = lockedToday;

    if (lockedToday) {
      notifiedRef.current = false;
      if (!askedPermissionRef.current && typeof window.Notification !== "undefined") {
        askedPermissionRef.current = true;
        if (window.Notification.permission === "default") {
          window.Notification.requestPermission();
        }
      }
      return;
    }

    if (wasLocked && !notifiedRef.current) {
      notifiedRef.current = true;
      if (typeof window.Notification !== "undefined" && window.Notification.permission === "granted") {
        try {
          new window.Notification("הגיע הזמן לביקור הבא! 🚀", {
            body: `המשימה עבור ${order.recipientName} פתוחה כעת לדיווח ביקור נוסף.`,
          });
        } catch (e) {
          // Notification construction can throw in some mobile WebViews —
          // the vibration alert below still fires either way.
        }
      }
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  }, [lockedToday, order.recipientName]);

  // Strict sequence: only 2 "no answer" visits are ever allowed before the
  // 3rd visit must end in a posting or a successful delivery — this is what
  // stops repeated taps from inflating the visit count (and the payout)
  // past what the legal process allows.
  // Bank deliveries cannot be posted on the door, so a 3rd no-answer stays a plain visit.
  const bankTrack = trackOf(order) === "bank";
  const noAnswerLocked = !singleVisit && attemptsCount >= 2 && !bankTrack;
  const canPost = attemptsCount >= 2;

  // Phone lookup is tolerant of whichever field name the order came in
  // with, and falls back to a demo number only so the button never breaks
  // in mock data — real orders are expected to carry `order.phone`.
  const rawPhone =
    order.phone || order.recipientPhone || order.recipient_phone || "050-0000000";
  // tel: links need a clean, dialable string — strip everything except
  // digits and a leading "+" so formatting like spaces/dashes/parentheses
  // in the source data can't break the native dialer handoff.
  const cleanPhoneNumber = rawPhone.replace(/[^\d+]/g, "");

  return (
    <div
      ref={cardRef}
      id={`task-card-${order.id}`}
      className={`rounded-3xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        spotlight ? "border-orange-400 ring-4 ring-orange-200" : "border-slate-200/60"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-slate-800">
            {order.recipientName}
            {speedOf(order) !== "standard" && <Zap className="h-4 w-4 text-amber-500" />}
          </p>
          <p className="text-xs text-slate-400">{formatOrderNum(order.id)} · {courierDocLabel(order)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 text-sm text-slate-600">
        <MapPin className="h-4 w-4 text-slate-400" /> {address}
        {order.floor && ` · קומה ${order.floor}`}
      </p>
      {order.entranceCode && (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600">
          🔑 קוד כניסה: {order.entranceCode}
        </p>
      )}
      {order.notes && <p className="mt-1 text-xs text-slate-400">📝 {order.notes}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ServiceChips order={order} />
      </div>
      {order.addons && order.addons.tracing && (
        <p className="mt-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700">
          🔎 שירות איתור כתובת: אם הנמען עזב, יש לברר את כתובתו החדשה בשטח ולתעד בהערות הדיווח.
        </p>
      )}
      {order.addons && order.addons.printing && (
        <p className="mt-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700">
          🖨️ המסמך הודפס על ידי המשרד — יש לוודא שהעותק שבידך תואם ל-{order.fileName || "הקובץ שהועלה"}.
        </p>
      )}
      {bankTrack && (
        <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
          🏦 מסירה בנקאית — לנמען בלבד (או מורשה חתימה מזוהה). חובה זיהוי בתעודה מזהה. אסור להדביק על הדלת או להניח בכתובת.
        </p>
      )}
      {needsCustody(order) &&
        (order.pickedUpAt ? (
          <p className="mt-2 text-[11px] font-medium text-emerald-700">✉️ המסמכים נקלטו למשמורת ב-{order.pickedUpAt}</p>
        ) : (
          onPickup && (
            <button
              type="button"
              onClick={() => onPickup(order)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              ✉️ סמן קליטת מסמכים למשמורת
            </button>
          )
        ))}
      {/* {LEGAL_REFS.serviceRule}: up to three attempts, each on a different day. */}
      {!singleVisit && (
      <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <Gavel className="h-3.5 w-3.5" /> {LEGAL_REFS.serviceRule} — עד 3 ניסיונות מסירה, בימים ובשעות שונים
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => {
            const a = order.attempts[i];
            const isNext = !a && i === order.attempts.length && !isTerminalOrder(order);
            const done = !!a;
            const finishedOk = done && a.type !== "אין מענה";
            return (
              <div
                key={i}
                className={`rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold ring-1 ring-inset ${
                  finishedOk
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : done
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : isNext
                    ? "bg-indigo-50 text-indigo-700 ring-indigo-300"
                    : "bg-white text-slate-300 ring-slate-200/60"
                }`}
              >
                <p>ביקור {i + 1}</p>
                <p className="mt-0.5 font-normal">
                  {done ? `${a.type} · ${timeOfDay(a.timestamp)}` : isNext ? (lockedToday ? "מחר" : "הבא") : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      )}
      {lockedToday && (
        <div
          className={`mt-2.5 space-y-1.5 rounded-lg bg-orange-50 px-2.5 py-2 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200 ${
            spotlight ? "animate-pulse ring-2 ring-orange-400" : ""
          }`}
        >
          <p className="text-sm font-bold text-orange-800">
            ⏳ ביקור {attemptsCount + 1} — {gate ? gateDayWord(gate.windowStart, clockTick) : "יתאפשר מחר"}
          </p>
          <div className="flex items-start gap-1.5">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {gate && gate.done.length
                ? gate.done.map((d, i) => `בוצע ביקור ${i + 1} (${d.win || "מחוץ לחלונות"})`).join(" · ")
                : `בוצע ביקור היום (${timeOfDay(lastAttempt?.timestamp)})`}
              {" — "}לפי תקנות סדר הדין האזרחי, ביקור נוסף ייעשה ביום קלנדרי אחר ובחלון זמן שטרם נוצל.
            </span>
          </div>
          {gate && (
            <p>
              חלונות מותרים לביקור {attemptsCount + 1} {gateDayWord(gate.windowStart, clockTick)}:{" "}
              {gate.allowed.map((w) => w.label).join(" או ")}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-base font-bold text-orange-700">
            <Clock className="h-4 w-4 shrink-0" />
            <span>הביקור הבא יתאפשר בעוד: {countdownLabel} שעות</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <a
          href={buildWazeUrl(cleanAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-50 px-2 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
        >
          <Navigation className="h-3.5 w-3.5" /> Waze
        </a>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          <MapPin className="h-3.5 w-3.5" /> Google Maps
        </a>
        {cleanPhoneNumber ? (
          <a
            href={`tel:${cleanPhoneNumber}`}
            title={`התקשרות ל${order.recipientName} (${rawPhone})`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Phone className="h-3.5 w-3.5" /> התקשר
          </a>
        ) : (
          <span
            title="לא הוזן מספר טלפון עבור הנמען"
            className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-400"
          >
            <Phone className="h-3.5 w-3.5" /> אין טלפון
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onAction(order, "delivered")}
          disabled={lockedToday}
          title={lockedToday ? "בוצע ביקור היום — ניתן לבצע ביקור נוסף רק מחר" : undefined}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <PenTool className="h-3.5 w-3.5" /> נמסר
        </button>
        <button
          onClick={() => onAction(order, "refused")}
          disabled={lockedToday}
          title={lockedToday ? "בוצע ביקור היום — ניתן לבצע ביקור נוסף רק מחר" : undefined}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-2 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <CircleAlert className="h-3.5 w-3.5" /> סירוב
        </button>
        {!noAnswerLocked && (
          <button
            onClick={() => onAction(order, "noanswer")}
            disabled={lockedToday}
            title={lockedToday ? "בוצע ביקור היום — ניתן לבצע ביקור נוסף רק מחר" : undefined}
            className={`flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/60 px-2 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 ${singleVisit || bankTrack ? "col-span-2" : ""}`}
          >
            <Timer className="h-3.5 w-3.5" /> {singleVisit ? "אין מענה" : `אין מענה — ביקור ${attemptsCount + 1}`}
          </button>
        )}
        {!singleVisit && !bankTrack && (
        <button
          onClick={() => onAction(order, "posted")}
          disabled={lockedToday || !canPost}
          title={
            lockedToday
              ? "בוצע ביקור היום — ניתן לבצע ביקור נוסף רק מחר"
              : !canPost
              ? "הדבקה אפשרית רק לאחר 2 ביקורים ללא מענה"
              : undefined
          }
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:border-slate-200/60 disabled:bg-slate-50 disabled:text-slate-300 ${
            noAnswerLocked ? "col-span-2" : ""
          } border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`}
        >
          <DoorClosed className="h-3.5 w-3.5" /> הדבקה — ביקור 3
        </button>
        )}
      </div>

      {pendingRequest ? (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          <Hourglass className="h-3.5 w-3.5" /> בקשת מחיר ממתינה לאישור המנהל
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onRequestPrice(order)}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-700"
        >
          <Coins className="h-3.5 w-3.5" /> בקשת התאמת מחיר
        </button>
      )}
    </div>
  );
}

// helper: names of couriers who declined an order (admin dispatch).
function declinedNamesFor(orderId, responses, roster) {
  const names = responses
    .filter((r) => r.orderId === orderId && r.action === RESPONSE.DECLINE)
    .map((r) => (roster.find((c) => c.id === r.courierId) || {}).name)
    .filter(Boolean);
  return new window.Set(names);
}

// Manager view under each order: who asked for it (with a one-click assign)
// and who declined it (red "דחה" tag, so they are not assigned by mistake).
function DispatchResponses({ order, responses, couriers, onAssign }) {
  const mine = responses.filter((r) => r.orderId === order.id);
  if (!mine.length || order.status === STATUS.CANCELED) return null;
  const nameOf = (id) => (couriers.find((c) => c.id === id) || {}).name || "שליח";
  const takers = mine.filter((r) => r.action === RESPONSE.TAKE);
  const decliners = mine.filter((r) => r.action === RESPONSE.DECLINE);
  const canAssign = !isAssignmentLocked(order);
  return (
    <div className="mt-1.5 w-44 space-y-1 text-[11px]">
      {takers.length > 0 && (
        <div className="rounded-md bg-emerald-50 p-1.5 ring-1 ring-inset ring-emerald-200">
          <p className="mb-1 font-semibold text-emerald-700">ביקשו את המשימה ({takers.length})</p>
          {takers.map((r) => {
            const name = nameOf(r.courierId);
            const chosen = order.assignedCourier === name;
            const isBlocked = !!(couriers.find((c) => c.id === r.courierId) || {}).blocked;
            return (
              <div key={r.courierId} className="flex items-center justify-between gap-1 py-0.5">
                <span className="truncate font-medium text-slate-700">{name}</span>
                {chosen ? (
                  <span className="flex items-center gap-0.5 text-emerald-700"><Check className="h-3 w-3" /> שובץ</span>
                ) : isBlocked ? (
                  <span className="text-rose-600">מושבת</span>
                ) : (
                  canAssign && (
                    <button
                      type="button"
                      onClick={() => onAssign(order.id, name)}
                      className="rounded bg-emerald-600 px-1.5 py-0.5 font-semibold text-white hover:bg-emerald-700"
                    >
                      שבץ
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
      {decliners.map((r) => (
        <div key={r.courierId} className="flex items-center justify-between gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 ring-1 ring-inset ring-rose-200">
          <span className="truncate font-medium text-slate-700">{nameOf(r.courierId)}</span>
          <span className="font-semibold text-rose-600">דחה</span>
        </div>
      ))}
    </div>
  );
}

// Courier "available orders" tab: open orders of the courier's region, with
// Take / Decline, plus the friendly message when someone else was chosen.
function OpenOrdersTab({ openOrders, takenMessages, myResponses, courierId, onRespond, onAcknowledge, notifyState, onEnableNotify }) {
  return (
    <div className="space-y-3">
      {notifyState === "default" && (
        <button
          type="button"
          onClick={onEnableNotify}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"
        >
          <Bell className="h-4 w-4" /> הפעלת התראות על הזמנות חדשות באזור שלי
        </button>
      )}
      {takenMessages.map((r) => (
        <div key={r.orderId} className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          <span className="flex-1 font-medium">
            {TAKEN_MESSAGE}
            <span className="mt-0.5 block text-[11px] font-normal text-amber-600">{r.orderId}</span>
          </span>
          <button type="button" onClick={() => onAcknowledge(r.orderId, courierId)} aria-label="סגירה" className="text-amber-500 hover:text-amber-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {openOrders.map((o) => {
        const answered = myResponses.find((r) => r.orderId === o.id);
        const taken = answered && answered.action === RESPONSE.TAKE;
        const speed = SPEED_OPTIONS.find((x) => x.key === speedOf(o)) || SPEED_OPTIONS[0];
        return (
          <div key={o.id} className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-800">{o.city}</p>
                <p className="text-xs text-slate-500">{courierDocLabel(o)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] font-medium text-slate-400">{formatOrderNum(o.id)}</span>
                {speedOf(o) !== "standard" && (
                  <span className="flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    <Zap className="h-2.5 w-2.5" /> {speed.label}
                  </span>
                )}
              </div>
            </div>
            {taken ? (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <Hourglass className="h-3.5 w-3.5" /> ביקשת את המשימה — ממתין לאישור המנהל
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              {!taken && (
                <button
                  type="button"
                  onClick={() => onRespond(o.id, courierId, RESPONSE.TAKE)}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  קח הזמנה
                </button>
              )}
              <button
                type="button"
                onClick={() => onRespond(o.id, courierId, RESPONSE.DECLINE)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                דחה
              </button>
            </div>
          </div>
        );
      })}
      {openOrders.length === 0 && takenMessages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200/60 py-10 text-center text-sm text-slate-400">
          אין כרגע הזמנות פתוחות באזור שלך
        </div>
      )}
    </div>
  );
}

function CourierView({ orders, onUpdateOrder, pricing, adjustments, payments, onSubmitPriceRequest, onSwitchRole, couriers, lockedCourier = null, responses = [], onRespond, onAcknowledge, myCourier = null, ready = true }) {
  const courierNames = (couriers || COURIERS).map((c) => c.name);
  const [tab, setTab] = useState("tasks");
  const [currentCourier, setCurrentCourier] = useState(lockedCourier || courierNames[0]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [priceRequestOrder, setPriceRequestOrder] = useState(null);
  // Which order's affidavit is open for signing (looked up live from `orders`
  // so the modal flips to the signed view the instant the signature is saved).
  const [affidavitId, setAffidavitId] = useState(null);
  // Earnings tab filter: "visits" | "completed" | "all"
  const [earningsFilter, setEarningsFilter] = useState("all");
  // Tasks screen has two views: "active" (to do) and "completed" (משימות שבוצעו).
  const [tasksView, setTasksView] = useState("active");
  // The order the courier just finished signing — highlighted in the completed list.
  const [justSignedId, setJustSignedId] = useState(null);

  // --- Wolt-style pickup: open orders of THIS courier's region/cities --------
  const me = myCourier || (couriers || COURIERS).find((c) => c.name === currentCourier) || null;
  const myId = me ? me.id : null;
  const myResponses = responses.filter((r) => r.courierId === myId);
  const pickupOrders = orders.filter((o) => {
    if (!isOpenForPickup(o) || !courierCoversOrder(me, o)) return false;
    const answered = myResponses.find((r) => r.orderId === o.id);
    return !(answered && answered.action === RESPONSE.DECLINE);
  });
  // Friendly "task taken" messages: I asked for it, the manager chose someone else.
  const takenMessages = myResponses.filter(
    (r) => r.action === RESPONSE.TAKE && r.outcome === "not_selected" && !r.acknowledged
  );
  const [notifyState, setNotifyState] = useState(() =>
    typeof window.Notification === "undefined" ? "unsupported" : window.Notification.permission
  );
  const [newOrderAlert, setNewOrderAlert] = useState(0);
  const seenPickupRef = useRef({ courier: null, ids: null });
  const pickupKey = pickupOrders.map((o) => o.id).join("|");
  // New-order alert: in-app banner + (if allowed) a system notification, fired
  // only for orders that appear AFTER the first load for this courier.
  useEffect(() => {
    if (!ready) return;
    const ids = pickupOrders.map((o) => o.id);
    const seen = seenPickupRef.current;
    if (seen.courier !== currentCourier || seen.ids === null) {
      seenPickupRef.current = { courier: currentCourier, ids: new window.Set(ids) };
      setNewOrderAlert(0);
      return;
    }
    const fresh = ids.filter((id) => !seen.ids.has(id));
    ids.forEach((id) => seen.ids.add(id));
    if (!fresh.length) return;
    setNewOrderAlert((n) => n + fresh.length);
    if (typeof window.Notification !== "undefined" && window.Notification.permission === "granted") {
      const first = pickupOrders.find((o) => o.id === fresh[0]);
      new window.Notification("משלוחים משפטיים — הזמנה חדשה באזור שלך", {
        body: `${first ? first.city : ""} · ${fresh.length > 1 ? fresh.length + " הזמנות חדשות" : first ? courierDocLabel(first) : ""}`,
      });
    }
  }, [pickupKey, ready, currentCourier]); // eslint-disable-line react-hooks/exhaustive-deps
  const enableNotify = async () => {
    try {
      setNotifyState(await window.Notification.requestPermission());
    } catch (e) {
      setNotifyState("denied");
    }
  };

  // Only this courier's own assignments, and only ones still awaiting action —
  // once an order reaches a terminal state (delivered, posted on the door, or
  // a documented refusal), the service is legally complete and it drops off
  // the active task list, whichever courier is currently selected.
  const activeOrders = orders.filter((o) => o.assignedCourier === currentCourier && !isOrderCompleted(o));

  const handleAction = (order, type) => {
    setActiveOrder(order);
    setActionType(type);
  };

  const currentMonthKey = monthKeyOf(nowStamp(0));
  const myOrders = orders.filter((o) => o.assignedCourier === currentCourier);
  // Orders this courier earned money on: his current tasks plus tasks he visited and that were reassigned later.
  const earnedOrders = orders.filter(
    (o) => o.assignedCourier === currentCourier || effectiveAttempts(o).some((a) => visitCourierName(o, a) === currentCourier)
  );
  const myOrdersThisMonth = earnedOrders.filter((o) =>
    effectiveAttempts(o).some((a) => visitCourierName(o, a) === currentCourier && monthKeyOf(a.timestamp) === currentMonthKey)
  );
  const myEarnings = earnedOrders.reduce(
    (acc, o) => {
      const { visits, completed, total } = calcOrderEarnings(o, pricing, currentMonthKey, currentCourier);
      return { visits: acc.visits + visits, completed: acc.completed + completed, total: acc.total + total };
    },
    { visits: 0, completed: 0, total: 0 }
  );
  const myAdjustments = adjustments.filter(
    (a) => a.courier === currentCourier && a.monthKey === currentMonthKey
  );
  const myAdjTotal = myAdjustments.reduce((sum, a) => sum + a.amount, 0);
  const myFinalTotal = myEarnings.total + myAdjTotal;
  const myPaymentStatus = payments[paymentKey(currentCourier, currentMonthKey)] || "unpaid";

  const handleComplete = (attempt) => {
    // Only the assigned courier can write to an order.
    if (!activeOrder || activeOrder.assignedCourier !== currentCourier) return;
    // Bank deliveries can never end in a door posting.
    if (trackOf(activeOrder) === "bank" && attempt.type === STATUS.POSTED) return;
    onUpdateOrder(activeOrder.id, (o) => {
      const newAttempts = [...o.attempts, attempt];
      let newStatus = o.status;
      if (attempt.type === STATUS.DELIVERED) newStatus = STATUS.DELIVERED;
      else if (attempt.type === STATUS.REFUSED) newStatus = STATUS.REFUSED;
      else if (attempt.type === STATUS.POSTED) newStatus = STATUS.POSTED;
      // A no-answer visit immediately locks the task until the next calendar
      // day — logging a second attempt the same day would not hold up as a
      // legally valid affidavit under Israeli Civil Procedure Regulations.
      else newStatus = STATUS.PENDING_NEXT_VISIT;
      return {
        ...o,
        attempts: newAttempts,
        status: newStatus,
        signature: attempt.type === STATUS.DELIVERED ? attempt.signatureDataUrl || "SIGNED" : o.signature,
        // Mirrored on the main order record as well, so lists and detail
        // views never have to dig through the visit log for the latest
        // evidence. (The per-visit entry in `attempts` keeps the original.)
        lastVisitAt: attempt.timestamp,
        lastVisitGps: attempt.location,
        lastVisitLat: attempt.lat ?? null,
        lastVisitLng: attempt.lng ?? null,
        lastVisitPhoto: attempt.photo || o.lastVisitPhoto || null,
        postingPhoto: attempt.type === STATUS.POSTED ? attempt.photo || null : o.postingPhoto || null,
      };
    });
    // A delivery / posting / refusal ends the service, so the courier goes
    // straight on to signing that order's affidavit (can also be done later
    // from the Earnings tab).
    if (attempt.type === "אין מענה") {
      // Stay on (or return to) the active list so the "ביקור 2" banner is seen.
      setTab("tasks");
      setTasksView("active");
    }
    if (attempt.type !== "אין מענה") {
      setAffidavitId(activeOrder.id);
      // The order has left the active list — make it findable under "בוצעו".
      setTasksView("completed");
    }
  };

  // Saves the courier's signature (base64 PNG) onto the order's affidavit
  // record — the Admin dashboard and Lawyer portal read the same record.
  const handleSignAffidavit = async (orderId, rawSignatureDataUrl) => {
    // Compression is best-effort and capped at 700 ms: the completion is saved
    // right away, never held back by it.
    const signatureDataUrl = await Promise.race([
      compressDataUrl(rawSignatureDataUrl),
      new Promise((resolve) => setTimeout(() => resolve(rawSignatureDataUrl), 700)),
    ]);
    onUpdateOrder(orderId, (o) => ({
      ...o,
      ...(o.assignedCourier !== currentCourier
        ? {}
        : {
            affidavit: { signature: signatureDataUrl, signedAt: nowStamp(0), signedBy: currentCourier },
            // Audit trail: ISO time now; the GPS fix is added right after (never blocks).
            completionAudit: { capturedAt: new window.Date().toISOString(), gps: null, gpsStatus: "pending" },
            // Signing the affidavit completes and closes the task.
            completed: true,
            completedAt: nowStamp(0),
            affidavitStatus: "signed",
            taskClosed: true,
            closedAt: nowStamp(0),
          }),
    }));
    // GPS arrives later (4 s max) and is merged in only if it was obtained.
    captureAuditStamp().then((audit) => {
      if (!audit.gps) return;
      onUpdateOrder(orderId, (o) =>
        o.assignedCourier === currentCourier
          ? { ...o, completionAudit: { ...(o.completionAudit || {}), gps: audit.gps, gpsStatus: "ok", gpsCapturedAt: audit.capturedAt } }
          : o
      );
    });
    // Back to the main tasks screen, on the completed tab, with every
    // affidavit / signature modal closed (the modal closes itself too).
    const own = myOrders.some((o) => o.id === orderId);
    if (own) {
      setAffidavitId(null);
      setTab("tasks");
      setTasksView("completed");
      setJustSignedId(orderId);
    }
  };

  // Earnings tab data: every order the courier touched this month with its
  // already-computed payout (which honours any per-order custom price), split
  // into the buckets the three summary cards filter by.
  const earningRows = myOrdersThisMonth.map((o) => ({
    order: o,
    calc: calcOrderEarnings(o, pricing, currentMonthKey, currentCourier),
  }));
  // "משימות שבוצעו": every finished order of this courier, newest first.
  const completedOrders = myOrders
    .filter(isOrderCompleted)
    .sort((a, b) => {
      const ta = (a.attempts[a.attempts.length - 1] || {}).timestamp || "";
      const tb = (b.attempts[b.attempts.length - 1] || {}).timestamp || "";
      return tb.localeCompare(ta);
    });
  const completedRows = earningRows.filter((r) => isOrderCompleted(r.order));
  const inProgressRows = earningRows.filter((r) => !isOrderCompleted(r.order) && r.calc.visits > 0);
  const visibleRows =
    earningsFilter === "visits" ? inProgressRows : earningsFilter === "completed" ? completedRows : earningRows;
  const visibleTotal = visibleRows.reduce((sum, r) => sum + r.calc.total, 0);

  const navItems = [
    { key: "tasks", label: "משימות", icon: Truck },
    { key: "open", label: "פתוחות", icon: Bell, badge: pickupOrders.length + takenMessages.length },
    { key: "earnings", label: "הכנסות", icon: Wallet },
    { key: "profile", label: "פרופיל", icon: User },
  ];

  return (
    <>
    <div className="mx-auto max-w-md space-y-4 px-4 py-5 pb-24 sm:pb-5">
      {newOrderAlert > 0 && (
        <button
          type="button"
          onClick={() => {
            setTab("open");
            setNewOrderAlert(0);
          }}
          className="flex w-full items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
        >
          <Bell className="h-4 w-4" /> {newOrderAlert > 1 ? `${newOrderAlert} הזמנות חדשות באזור שלך` : "הזמנה חדשה באזור שלך"} — לחצו לצפייה
        </button>
      )}
      <div className="rounded-3xl bg-gradient-to-l from-indigo-600 to-blue-600 p-4 text-white shadow-sm transition-all duration-300 ease-in-out">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-white/70">שלום, {currentCourier}</p>
            <p className="text-lg font-bold">{activeOrders.length} מסירות פעילות היום</p>
          </div>
          {!lockedCourier && (
          <div className="relative">
            <select
              value={currentCourier}
              onChange={(e) => {
                setCurrentCourier(e.target.value);
                // Never carry one courier's open task / affidavit into another's session.
                setActiveOrder(null);
                setActionType(null);
                setAffidavitId(null);
                setPriceRequestOrder(null);
                setTasksView("active");
                setJustSignedId(null);
              }}
              className="appearance-none rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 pr-6 text-xs font-medium text-white focus:outline-none"
            >
              {courierNames.map((c) => (
                <option key={c} value={c} className="text-slate-800">
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/70" />
          </div>
          )}
        </div>
      </div>

      <div className="hidden gap-1 rounded-2xl bg-slate-100 p-1 sm:flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const activeTab = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                activeTab ? "bg-white text-indigo-700 shadow-sm transition-all duration-300 ease-in-out" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className={`h-4 w-4 ${activeTab ? "text-indigo-500" : ""}`} />
              {item.label}
              {item.badge > 0 && <span className="rounded-full bg-emerald-500 px-1.5 text-[11px] text-white">{item.badge}</span>}
            </button>
          );
        })}
      </div>

      {tab === "tasks" && (
        <div className="space-y-3">
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
            {[
              { key: "active", label: "משימות פעילות", count: activeOrders.length },
              { key: "completed", label: "משימות שבוצעו", count: completedOrders.length },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTasksView(t.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tasksView === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                <span className="rounded-full bg-indigo-50 px-1.5 text-[11px] text-indigo-600">{t.count}</span>
              </button>
            ))}
          </div>

          {tasksView === "active" && (
            <>
              {activeOrders.map((o) => (
                <CourierTaskCard
                  key={o.id}
                  order={o}
                  onAction={handleAction}
                  onRequestPrice={setPriceRequestOrder}
                  onPickup={(ord) => onUpdateOrder(ord.id, (x) => markPickedUp(x, currentCourier, "courier"))}
                />
              ))}
              {activeOrders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200/60 py-10 text-center text-sm text-slate-400">
                  כל המסירות הושלמו 🎉
                </div>
              )}
            </>
          )}

          {tasksView === "completed" && (
            <>
              {justSignedId && myOrders.some((o) => o.id === justSignedId) && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <BadgeCheck className="h-4 w-4 shrink-0" />
                  המשימה {justSignedId} נחתמה והושלמה — היא נשלחה למנהל ולעורך הדין.
                </div>
              )}
              {completedOrders.map((o) => {
                const calc = calcOrderEarnings(o, pricing);
                const last = o.attempts[o.attempts.length - 1];
                const signed = isAffidavitSigned(o);
                return (
                  <div
                    key={o.id}
                    className={`rounded-3xl border bg-white p-4 shadow-sm transition ${
                      o.id === justSignedId ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{o.recipientName}</p>
                        <p className="text-xs text-slate-400">
                          {formatOrderNum(o.id)} · {courierDocLabel(o)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        <AffidavitBadge order={o} />
                      </div>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-400" /> {orderAddress(o)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      {last && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> הושלם {last.timestamp}
                        </span>
                      )}
                      <span>{o.attempts.length} ביקורים</span>
                      <span className="font-semibold text-indigo-700">{formatILS(calc.total)}</span>
                      <FirstVisitBonusChip calc={calc} />
                    </p>
                    <button
                      type="button"
                      onClick={() => setAffidavitId(o.id)}
                      className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                        signed
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      {signed ? (
                        <>
                          <BadgeCheck className="h-3.5 w-3.5" /> צפייה בתצהיר החתום
                        </>
                      ) : (
                        <>
                          <PenTool className="h-3.5 w-3.5" /> {usesAffidavit(o) ? "הפקת תצהיר וחתימה" : "אישור מסירה רשמי"}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
              {completedOrders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200/60 py-10 text-center text-sm text-slate-400">
                  עדיין אין משימות שבוצעו
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "open" && (
        <OpenOrdersTab
          openOrders={pickupOrders}
          takenMessages={takenMessages}
          myResponses={myResponses}
          courierId={myId}
          onRespond={onRespond}
          onAcknowledge={onAcknowledge}
          notifyState={notifyState}
          onEnableNotify={enableNotify}
        />
      )}

      {tab === "earnings" && (
        <div className="space-y-4">
          <CourierMonthlyEarnings orders={earnedOrders} pricing={pricing} currentMonthKey={currentMonthKey} courier={currentCourier} />
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
            <div className="mb-1 flex items-start justify-between">
              <SectionHeading title="ההכנסות שלי" subtitle={monthLabel(currentMonthKey)} icon={Wallet} />
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset ${
                  myPaymentStatus === "paid"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}
              >
                {myPaymentStatus === "paid" ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                {myPaymentStatus === "paid" ? "שולם" : "לא שולם עדיין"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { key: "visits", value: myEarnings.visits, label: "ביקורים" },
                { key: "completed", value: completedRows.length, label: "הושלמו" },
                { key: "all", value: formatILS(myFinalTotal), label: "שכר משוער · הכל" },
              ].map((c) => {
                const active = earningsFilter === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setEarningsFilter(c.key)}
                    aria-pressed={active}
                    className={`rounded-lg border-2 p-3 text-center transition-all duration-300 ease-in-out ${
                      active
                        ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                        : "border-transparent bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <p className="text-xl font-extrabold text-indigo-700">{c.value}</p>
                    <p className={`text-[11px] ${active ? "font-semibold text-indigo-600" : "text-slate-400"}`}>{c.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {myAdjustments.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">התאמות ותוספות</p>
              <div className="space-y-2">
                {myAdjustments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      {a.amount >= 0 ? (
                        <PlusCircle className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <MinusCircle className="h-3.5 w-3.5 text-rose-500" />
                      )}
                      <span className="text-slate-600">{a.label}</span>
                    </div>
                    <span className={`font-semibold ${a.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {a.amount >= 0 ? "+" : ""}
                      {formatILS(a.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">פירוט לפי הזמנה</p>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                {earningsFilter === "visits"
                  ? "ביקורים פעילים"
                  : earningsFilter === "completed"
                  ? "משימות שהושלמו"
                  : "כל ההזמנות"}{" "}
                · {visibleRows.length}
              </span>
            </div>
            <div className="space-y-2">
              {visibleRows.map(({ order: o, calc }) => {
                const done = isOrderCompleted(o);
                const last = effectiveAttempts(o)[effectiveAttempts(o).length - 1];
                const custom = o.priceOverride?.perAttempt != null || o.priceOverride?.perCompleted != null;
                return (
                  <div key={o.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700">
                          {formatOrderNum(o.id)} - {o.recipientName}
                        </p>
                        <p className={`mt-0.5 text-xs font-semibold ${done ? "text-emerald-600" : "text-amber-600"}`}>
                          {done ? `הושלם - ${o.status}` : `ביקור ${o.attempts.length} מתוך 3`}
                        </p>
                        {calc.completionBonus && (
                          <div className="mt-1">
                            <FirstVisitBonusChip calc={calc} />
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="font-bold text-indigo-700">{formatILS(calc.total)}</p>
                        {custom && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-px text-[10px] font-medium leading-4 text-amber-600 ring-1 ring-inset ring-amber-200">
                            מחיר מותאם
                          </span>
                        )}
                      </div>
                    </div>

                    {earningsFilter === "visits" && !done ? (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                        {o.attempts.map((a, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-300" /> ביקור {i + 1}: {a.timestamp}
                            {calc.perVisit[i] && (
                              <span className="mr-auto text-slate-400">{formatILS(calc.perVisit[i].pay)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      last && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3 text-slate-300" />
                          {done ? "הושלם" : "ביקור אחרון"}: {last.timestamp}
                          {done && <span className="mr-1 text-slate-400">· {o.attempts.length} ביקורים</span>}
                        </p>
                      )
                    )}
                    {earningsFilter !== "visits" && calc.perVisit.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        פירוט תשלום:{" "}
                        {calc.perVisit
                          .map((v) =>
                            v.kind === "firstVisitBonus"
                              ? `ביקור ${v.visitNo} (${completionLabel(v.attempt.type)} — השלמה מיידית) ${formatILS(v.pay)}`
                              : v.kind === "completion"
                              ? `ביקור ${v.visitNo} (${completionLabel(v.attempt.type)} — השלמה לסכום המלא) ${formatILS(v.pay)}`
                              : `ביקור ${v.visitNo} (אין מענה) ${formatILS(v.pay)}`
                          )
                          .join(" · ")}
                      </p>
                    )}

                    {done && (
                      <button
                        type="button"
                        onClick={() => setAffidavitId(o.id)}
                        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                          isAffidavitSigned(o)
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {isAffidavitSigned(o) ? (
                          <>
                            <BadgeCheck className="h-3.5 w-3.5" /> תצהיר נחתם — צפייה / חתימה מחדש
                          </>
                        ) : (
                          <>
                            <PenTool className="h-3.5 w-3.5" /> {usesAffidavit(o) ? "הפקת תצהיר וחתימה" : "אישור מסירה רשמי"}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
              {visibleRows.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">
                  {earningsFilter === "visits"
                    ? "אין כרגע משימות פעילות עם ביקורים"
                    : earningsFilter === "completed"
                    ? "אין עדיין משימות שהושלמו החודש"
                    : "אין עדיין פעילות רשומה החודש"}
                </p>
              )}
            </div>
            {visibleRows.length > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">סה"כ שכר הזמנות בתצוגה</span>
                <span className="font-bold text-indigo-700">{formatILS(visibleTotal)}</span>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-400">
            הסכומים משוערים לפי התעריפים הנוכחיים, כולל התאמות, ועשויים להתעדכן על ידי המנהל
          </p>
        </div>
      )}

      {tab === "profile" && (
        <ProfileTab role="courier" subtitle={`מחובר כ: ${currentCourier}`} onSwitchRole={onSwitchRole} />
      )}

      <CourierActionModal
        order={activeOrder}
        actionType={actionType}
        onClose={() => setActionType(null)}
        onComplete={handleComplete}
      />
      <AffidavitModal
        order={maskOrderForCourier(myOrders.find((o) => o.id === affidavitId) || null)}
        onClose={() => setAffidavitId(null)}
        onSign={handleSignAffidavit}
      />
      <PriceRequestModal
        order={priceRequestOrder}
        courier={currentCourier}
        onClose={() => setPriceRequestOrder(null)}
        onSubmit={onSubmitPriceRequest}
      />
    </div>
    <BottomNav items={navItems} active={tab} onChange={setTab} />
    </>
  );
}

/* =========================================================================
   ADMIN DASHBOARD
   ========================================================================= */
function StatCard({ label, value, icon: Icon, active, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-right shadow-sm transition ${
        active
          ? "border-transparent bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md"
          : "border-slate-200/60 bg-white text-slate-700 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
          active ? "bg-white/20 text-white" : `${accent} text-white`
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className={`text-2xl font-extrabold ${active ? "text-white" : "text-indigo-700"}`}>{value}</p>
      <p className={`text-xs font-medium ${active ? "text-white/70" : "text-slate-400"}`}>{label}</p>
    </button>
  );
}

// Small status chip for the affidavit itself — shown next to the order
// status in the Admin and Lawyer tables so everyone can see at a glance
// whether the courier has signed yet.
function AffidavitBadge({ order }) {
  if (!isTerminalOrder(order)) return null;
  return isAffidavitSigned(order) ? (
    <span className={`${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>
      <BadgeCheck className="h-2.5 w-2.5" /> {usesAffidavit(order) ? "תצהיר נחתם" : "אישור נחתם"}
    </span>
  ) : (
    <span className={`${PILL} bg-amber-50 text-amber-700 ring-amber-200`}>
      <PenTool className="h-2.5 w-2.5" /> ממתין לחתימה
    </span>
  );
}

// One affidavit modal for all three roles.
//  - Courier and Admin (onSign provided): "הפקת תצהיר וחתימה" — the signature
//    box is a live SignatureCanvas with a "ניקוי" button, and the button right
//    under it, "אישור, חתימה וסגירת משימה", validates the drawing, saves it
//    (base64 PNG) onto the order, marks the task closed/signed and closes the
//    modal. An already-signed affidavit shows the saved signature with a
//    "חתימה מחדש" option.
//  - Lawyer (no onSign): read-only — the courier's signature once it exists,
//    with print + download.
function AffidavitModal({ order, onClose, onSign, onLawyerVerify }) {
  const [signing, setSigning] = useState(false);
  // Upgrade 3 — lawyer verification panel state (only ever used when the
  // portal that opened the modal passed onLawyerVerify, i.e. the OWNING lawyer).
  const [vOpen, setVOpen] = useState(false);
  const [vLicense, setVLicense] = useState("");
  const [vDate, setVDate] = useState("");
  const [vSig, setVSig] = useState("");
  const [vStamp, setVStamp] = useState("");
  const [vStampMode, setVStampMode] = useState("auto");
  const [vSigning, setVSigning] = useState(false);
  const [vSaving, setVSaving] = useState(false);
  // Municipal 3-visit orders get BOTH documents: the legal affidavit (default) and the certificate.
  const [docKind, setDocKind] = useState("affidavit");
  const frameRef = useRef(null);
  // The document is built from a copy whose storage references are inline images
  // (self-contained for print / download); the saved order is never changed.
  const [docOrderState, setDocOrderState] = useState(null);
  useEffect(() => {
    let live = true;
    setDocOrderState(null);
    if (order) {
      inlineOrderEvidence(order).then((o) => {
        if (live) setDocOrderState(o);
      });
    }
    return () => {
      live = false;
    };
  }, [order]);
  const docOrder = docOrderState && order && docOrderState.id === order.id ? docOrderState : order;

  // The modal component stays mounted between orders, so start clean each time.
  useEffect(() => {
    setSigning(false);
    setDocKind("affidavit");
    setVOpen(false);
    setVSigning(false);
    setVSaving(false);
    if (order) {
      const prof = order.lawyerInfo || LAWYER_PROFILES[order.submittedBy] || {};
      setVLicense(order.lawyerLicenseNumber || prof.licenseNo || "");
      setVDate(order.lawyerVerificationDate || todayDdMmYyyy());
      setVSig(order.lawyerSignature || "");
      setVStamp(order.lawyerStamp || "");
      setVStampMode(order.lawyerStamp ? "upload" : "auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  // The automatic stamp follows the license number / name as they are edited.
  const autoStamp = useMemo(
    () => (order && vStampMode === "auto" ? makeLawyerStampDataUrl(order.submittedBy, vLicense) : ""),
    [order, vStampMode, vLicense]
  );

  const vSigShown = useEvidenceSrc(vSig);
  const stampShown = useEvidenceSrc(vStampMode === "auto" ? autoStamp : vStamp);
  if (!order) return null;
  const signed = isAffidavitSigned(order);
  const canEdit = !!onSign;
  const asAffidavit = usesAffidavit(order) && docKind === "affidavit";
  const canToggle = (trackOf(order) === "municipal" || trackOf(order) === "bank") && usesAffidavit(order);
  const docWord = asAffidavit ? "תצהיר" : "אישור מסירה";
  // Only the owning lawyer's portal passes onLawyerVerify; the courier and the
  // admin screens never do, so they can neither see nor use the panel.
  const canVerify = !!onLawyerVerify && asAffidavit && signed;
  const lawyerVerified = !!(order.lawyerVerifiedAt || order.lawyerSignature);
  const finalStamp = vStampMode === "auto" ? autoStamp : vStamp;
  const canSaveVerify = !!(vLicense.trim() && vDate.trim() && vSig && finalStamp) && !vSaving;
  const handleStampUpload = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const raw = await fileToDataUrl(f);
      setVStamp((await compressDataUrl(raw, 600, 0.85).catch(() => raw)) || raw);
      setVStampMode("upload");
    } catch (err) {
      /* unreadable file — keep the previous stamp */
    }
  };
  const handleSaveVerify = async () => {
    if (!canSaveVerify) return;
    setVSaving(true);
    try {
      await onLawyerVerify(order.id, {
        lawyerLicenseNumber: vLicense.trim(),
        lawyerVerificationDate: vDate.trim(),
        lawyerSignature: vSig,
        lawyerStamp: finalStamp,
        lawyerVerifiedAt: nowStamp(0),
      });
      setVOpen(false);
    } finally {
      setVSaving(false);
    }
  };

  // Approving in the full-screen signing overlay saves the signature onto the
  // order (the parent updates the shared orders list, so every list, badge and
  // portal refreshes) and closes the whole affidavit flow.
  const handleConfirmSignature = (dataUrl) => {
    onSign(order.id, dataUrl);
    setSigning(false);
    onClose();
  };

  // Prints only the affidavit document (rendered in its own frame), not the
  // app around it.
  const printAffidavit = () => {
    const w = frameRef.current && frameRef.current.contentWindow;
    try {
      if (!w) throw new Error("no frame");
      w.focus();
      w.print();
    } catch (e) {
      // Some mobile browsers refuse print() inside a sandboxed frame: print the same
      // (script-free, escaped) document from its own window instead.
      const win = window.open("", "_blank");
      if (win && win.document) {
        win.document.open();
        win.document.write(buildAffidavitHtml(docOrder, docKind));
        win.document.close();
        setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch (e2) {
            /* the page stays open for manual printing */
          }
        }, 400);
      }
    }
  };

  return (
    <Modal open={!!order} onClose={onClose} title={asAffidavit ? (canEdit ? "הפקת תצהיר וחתימה" : "תצהיר מוסר — תצוגה מקדימה") : (canEdit ? "אישור מסירה רשמי" : "אישור מסירה רשמי — תצוגה מקדימה")} wide>
      {canToggle && (
        <div className="mb-3 flex gap-2" role="radiogroup" aria-label="סוג מסמך">
          {[["affidavit", "תצהיר מוסר משפטי"], ["certificate", "אישור מסירה רשמי"]].map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={docKind === k}
              onClick={() => setDocKind(k)}
              className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold ${
                docKind === k ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {signed && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <BadgeCheck className="h-4 w-4 shrink-0" />
          ה{docWord} נחתם על ידי {order.affidavit.signedBy || order.assignedCourier}
          {order.affidavit.capturedBy ? ` (נקלט על ידי ${order.affidavit.capturedBy})` : ""} ב-{order.affidavit.signedAt} וזמין
          לצפייה והורדה אצל המנהל ואצל עורך הדין.
        </div>
      )}

      {/* The exact same HTML that is printed / downloaded. */}
      <iframe
        ref={frameRef}
        title={`תצהיר מוסר ${formatOrderNum(order.id)}`}
        srcDoc={buildAffidavitHtml(docOrder, docKind)}
        sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"
        className="h-[60vh] w-full rounded-lg border border-slate-200/60 bg-white"
      />

      {canVerify && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
          <button
            type="button"
            onClick={() => setVOpen((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-bold text-indigo-700"
          >
            <span>
              ✍️ מילוי וחתימת אימות עורך דין
              {lawyerVerified && <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">נחתם {order.lawyerVerifiedAt || ""}</span>}
            </span>
            <ChevronDown className={`h-4 w-4 transition ${vOpen ? "rotate-180" : ""}`} />
          </button>
          {vOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600">
                  מספר רישיון עורך דין
                  <input
                    value={vLicense}
                    onChange={(e) => setVLicense(e.target.value)}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  תאריך האימות (DD/MM/YYYY)
                  <input
                    value={vDate}
                    onChange={(e) => setVDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">חתימת עורך הדין</p>
                <button
                  type="button"
                  onClick={() => setVSigning(true)}
                  className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-indigo-300 bg-white text-indigo-600 hover:bg-indigo-50"
                >
                  {vSig ? <img src={isSafeMediaSrc(vSig, { allowRef: true }) ? vSigShown || undefined : undefined} alt="חתימת עורך הדין" className="h-16 object-contain" /> : (<><PenTool className="h-5 w-5" /> חתמו כאן</>)}
                </button>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">חותמת עורך הדין</p>
                <div className="mb-2 flex gap-2">
                  {[["auto", "חותמת אוטומטית"], ["upload", "העלאת תמונת חותמת"]].map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setVStampMode(k)}
                      className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold ${
                        vStampMode === k ? "border-indigo-600 bg-white text-indigo-700" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {vStampMode === "upload" && (
                  <input type="file" accept="image/*" onChange={handleStampUpload} className="mb-2 block w-full text-xs text-slate-600" />
                )}
                {finalStamp ? (
                  <img src={isSafeMediaSrc(finalStamp, { allowRef: true }) ? stampShown || undefined : undefined} alt="חותמת" className="h-16 rounded border border-slate-200 bg-white object-contain p-1" />
                ) : (
                  <p className="text-[11px] text-slate-400">{vStampMode === "upload" ? "בחרו תמונת חותמת" : "החותמת תיווצר לאחר הזנת מספר רישיון"}</p>
                )}
              </div>
              <button
                type="button"
                disabled={!canSaveVerify}
                onClick={handleSaveVerify}
                className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                אשר וחתום אימות עורך דין
              </button>
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-slate-500">חתימת השליח על ה{docWord}</p>
          {!signed ? (
            <button
              type="button"
              onClick={() => setSigning(true)}
              className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/40 text-indigo-600 transition hover:bg-indigo-50"
            >
              <PenTool className="h-7 w-7" />
              <span className="text-base font-bold">חתמו כאן באצבע</span>
              <span className="text-[11px] text-indigo-400">לחצו לפתיחת מסך חתימה מלא</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSigning(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> חתימה מחדש
            </button>
          )}
        </div>
      )}

      {/* Sticky print / download bar — hidden while signing, where the
          approve button sits directly under the canvas instead. */}
      {(!canEdit || signed) && (
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-slate-100 bg-white px-5 py-3">
          <div className="flex gap-2">
            <button
              onClick={printAffidavit}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Printer className="h-4 w-4" /> הדפסה / שמירה כ-PDF
            </button>
            <button
              type="button"
              onClick={() => downloadAffidavit(docOrder, docKind)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <Download className="h-4 w-4" /> הורדת קובץ
            </button>
          </div>
        </div>
      )}

      <FullScreenSignatureModal
        open={vSigning}
        title="חתימת עורך הדין — אימות"
        subtitle={`${formatOrderNum(order.id)} · ${order.recipientName}`}
        onCancel={() => setVSigning(false)}
        onConfirm={(dataUrl) => {
          setVSig(dataUrl);
          setVSigning(false);
        }}
      />
      <FullScreenSignatureModal
        open={signing}
        title={`חתימת השליח על ה${docWord}`}
        subtitle={`${formatOrderNum(order.id)} · ${order.recipientName}`}
        onCancel={() => setSigning(false)}
        onConfirm={handleConfirmSignature}
      />
    </Modal>
  );
}

function PricingModal({ order, pricing, onClose, onSave }) {
  const [perAttempt, setPerAttempt] = useState("");
  const [perCompleted, setPerCompleted] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (order) {
      setPerAttempt(order.priceOverride?.perAttempt ?? "");
      setPerCompleted(order.priceOverride?.perCompleted ?? "");
      setJustSaved(false);
    }
  }, [order]);

  if (!order) return null;

  const effectiveAttempt = perAttempt === "" ? pricing.perAttempt : Number(perAttempt);
  const effectiveCompleted = perCompleted === "" ? pricing.perCompleted : Number(perCompleted);
  const safeAttemptRate = Number.isFinite(effectiveAttempt) ? effectiveAttempt : 0;
  const safeCompletedRate = Number.isFinite(effectiveCompleted) ? effectiveCompleted : 0;
  // Live preview using the SAME payout rules as everywhere else (₪ per visit,
  // full cap on a first-visit completion, cap on the total) but with the
  // rates currently typed into the form.
  const previewCalc = calcOrderEarnings(
    { ...order, priceOverride: { perAttempt: safeAttemptRate, perCompleted: safeCompletedRate } },
    pricing
  );
  const { visits, completed } = previewCalc;
  const previewTotal = previewCalc.total;

  // Converts a text field to a stored override value: "" (or anything that
  // doesn't parse to a real number) clears the override back to the global
  // default, instead of ever writing NaN into priceOverride.
  const toOverrideValue = (raw) => {
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const save = () => {
    onSave(order.id, {
      perAttempt: toOverrideValue(perAttempt),
      perCompleted: toOverrideValue(perCompleted),
    });
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      onClose();
    }, 900);
  };

  return (
    <Modal open={!!order} onClose={onClose} title={`תמחור מותאם אישית — ${formatOrderNum(order.id)}`}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-700">{order.recipientName}</p>
          <p className="text-xs text-slate-400">
            {order.street} {order.houseNumber}, {order.city} · {order.status}
          </p>
        </div>

        <p className="text-xs text-slate-400">
          ניתן לקבוע מחיר מותאם למסירה זו בכל שלב — לפני שיבוץ, במהלך הטיפול, או אחרי שהושלמה. שדה ריק ישתמש בתעריף
          ברירת המחדל הנוכחי.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="מחיר לביקור (מותאם)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder={`ברירת מחדל: ${formatILS(pricing.perAttempt)}`}
              value={perAttempt}
              onChange={(e) => setPerAttempt(e.target.value)}
            />
          </Field>
          <Field label="סכום השלמה מלא / תקרת תשלום (מותאם)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder={`ברירת מחדל: ${formatILS(pricing.perCompleted)}`}
              value={perCompleted}
              onChange={(e) => setPerCompleted(e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">תעריף לביקור (לפי הטבלה)</span>
            <span className="font-medium text-slate-700">{formatILS(safeAttemptRate)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">סכום השלמה מלא להזמנה (תקרת תשלום)</span>
            <span className="font-medium text-slate-700">{formatILS(safeCompletedRate)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-indigo-100 pt-1.5">
            <span className="text-slate-500">ביקורים שנרשמו עד כה</span>
            <span className="font-medium text-slate-700">{visits}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">מסירות/הדבקות שהושלמו עד כה</span>
            <span className="font-medium text-slate-700">{completed}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-indigo-100 pt-1.5 text-base font-bold text-indigo-700">
            <span>סה"כ תשלום לשליח עד כה</span>
            <span>{formatILS(previewTotal)}</span>
          </div>
          {visits === 0 && (
            <p className="mt-1.5 text-xs text-indigo-500">
              התעריף נשמר ויחול אוטומטית ברגע שיירשם ביקור ראשון — הסכום מוצג כ-0 ₪ כי עדיין אין ביקורים בפועל.
            </p>
          )}
          {previewCalc.firstVisitBonus && (
            <p className="mt-1.5 text-xs font-semibold text-emerald-600">
              🎉 הושלמה בביקור הראשון — משולם הסכום המלא ({formatILS(safeCompletedRate)}) מיידית.
            </p>
          )}
          {previewCalc.completionBonus && !previewCalc.firstVisitBonus && (
            <p className="mt-1.5 text-xs font-semibold text-emerald-600">
              ✅ הושלמה — סך התשלום להזמנה מגיע לסכום המלא ({formatILS(safeCompletedRate)}), כולל תשלום ההשלמה בביקור
              האחרון.
            </p>
          )}
          {previewCalc.completionBonus === false && (
            <p className="mt-1.5 text-xs text-indigo-500">
              ביקור ללא מענה משלם {formatILS(safeAttemptRate)}; כל השלמה (מסירה / סירוב / הדבקה) משלימה את סך ההזמנה
              ל-{formatILS(safeCompletedRate)}.
            </p>
          )}
        </div>

        {justSaved && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <Check className="h-4 w-4" /> המחיר נשמר בהצלחה
          </div>
        )}
      </div>

      {/* Sticky action bar — stays pinned to the bottom of the modal's own
          scroll area, so the Save button never scrolls out of view even if
          the modal content above it grows taller than the viewport. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex items-center gap-2 border-t border-slate-100 bg-white px-5 py-3">
        <button
          type="button"
          onClick={() => {
            setPerAttempt("");
            setPerCompleted("");
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> איפוס לברירת מחדל
        </button>
        <button
          type="button"
          onClick={save}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
        >
          <Check className="h-4 w-4" /> שמירת שינויים
        </button>
      </div>
    </Modal>
  );
}

// Lets the Admin add a one-off bonus/expense-reimbursement (addition) or a
// deduction to one courier's monthly total, with a short label explaining why.
function AdjustmentModal({ courier, monthKey, onClose, onSave }) {
  const [type, setType] = useState("bonus");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  if (!courier) return null;

  const numericAmount = Number(amount);
  const canSave = label.trim().length > 0 && Number.isFinite(numericAmount) && numericAmount > 0;

  const save = () => {
    if (!canSave) return;
    onSave({
      courier,
      monthKey,
      label: label.trim(),
      amount: type === "deduction" ? -Math.abs(numericAmount) : Math.abs(numericAmount),
    });
    setLabel("");
    setAmount("");
    setType("bonus");
    onClose();
  };

  return (
    <Modal open={!!courier} onClose={onClose} title={`התאמה ידנית — ${courier}`}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          {monthLabel(monthKey)} · ההתאמה תתווסף לסך התשלום החודשי או תנוכה ממנו
        </p>
        <Field label="סוג ההתאמה">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("bonus")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === "bonus"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-slate-200/60 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <PlusCircle className="h-4 w-4" /> תוספת (בונוס / החזר)
            </button>
            <button
              type="button"
              onClick={() => setType("deduction")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === "deduction"
                  ? "border-rose-400 bg-rose-50 text-rose-700"
                  : "border-slate-200/60 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <MinusCircle className="h-4 w-4" /> ניכוי
            </button>
          </div>
        </Field>
        <Field label="תיאור / סיבה" required>
          <input
            className={inputCls}
            placeholder="לדוגמה: החזר דלק, כביש אגרה, בונוס דחיפות..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="סכום (₪)" required>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <button
          onClick={save}
          disabled={!canSave}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> הוספת התאמה
        </button>
      </div>
    </Modal>
  );
}

function CourierPayroll({
  orders,
  pricing,
  onUpdatePricing,
  onEditOrderPrice,
  adjustments,
  payments,
  onTogglePayment,
  onAddAdjustment,
  onRemoveAdjustment,
}) {
  const months = useMemo(() => getAllMonthKeys(orders), [orders]);
  const [month, setMonth] = useState(months[0]);
  const [expandedCourier, setExpandedCourier] = useState(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState(null);
  const [globalDraft, setGlobalDraft] = useState({
    perAttempt: pricing.perAttempt,
    perCompleted: pricing.perCompleted,
  });

  useEffect(() => {
    setGlobalDraft({ perAttempt: pricing.perAttempt, perCompleted: pricing.perCompleted });
  }, [pricing]);

  const rows = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      // Every courier who performed visits is paid for them — even if the order was later
      // reassigned to someone else (or to nobody) or finished by another courier.
      const names = new window.Set(effectiveAttempts(o).map((a) => visitCourierName(o, a)).filter(Boolean));
      names.forEach((name) => {
        const calc = calcOrderEarnings(o, pricing, month, name);
        const { visits, completed, total } = calc;
        if (visits === 0) return;
        if (!map[name]) {
          map[name] = { courier: name, visits: 0, completed: 0, ordersTotal: 0, orders: [] };
        }
        map[name].visits += visits;
        map[name].completed += completed;
        map[name].ordersTotal += total;
        map[name].orders.push({ order: o, visits, completed, total, calc });
      });
    });
    return Object.values(map)
      .map((r) => {
        const courierAdjustments = adjustments.filter((a) => a.courier === r.courier && a.monthKey === month);
        const adjTotal = courierAdjustments.reduce((sum, a) => sum + a.amount, 0);
        const status = payments[paymentKey(r.courier, month)] || "unpaid";
        return { ...r, adjustments: courierAdjustments, adjTotal, total: r.ordersTotal + adjTotal, status };
      })
      .sort((a, b) => b.total - a.total);
  }, [orders, pricing, month, adjustments, payments]);

  const grandTotals = rows.reduce(
    (acc, r) => ({
      visits: acc.visits + r.visits,
      completed: acc.completed + r.completed,
      adjTotal: acc.adjTotal + r.adjTotal,
      total: acc.total + r.total,
    }),
    { visits: 0, completed: 0, adjTotal: 0, total: 0 }
  );

  const exportCsv = () => {
    const header = ['שליח', "ביקורים", "הושלמו", "התאמות (₪)", 'סה"כ תשלום (₪)', "סטטוס תשלום"];
    const lines = rows.map((r) =>
      [
        r.courier,
        r.visits,
        r.completed,
        Math.round(r.adjTotal),
        Math.round(r.total),
        r.status === "paid" ? "שולם" : "לא שולם",
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const bom = String.fromCharCode(0xfeff);
    const blob = new window.Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `שכר-שליחים-${month}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };


  const saveGlobalPricing = () => {
    onUpdatePricing({
      perAttempt: Number(globalDraft.perAttempt) || 0,
      perCompleted: Number(globalDraft.perCompleted) || 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-400">תעריפי ברירת מחדל · ניתנים לעדכון בכל עת</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="מחיר לביקור (₪)">
              <input
                type="number"
                min="0"
                className={inputCls + " w-32"}
                value={globalDraft.perAttempt}
                onChange={(e) => setGlobalDraft((d) => ({ ...d, perAttempt: e.target.value }))}
              />
            </Field>
            <Field label="סכום השלמה מלא להזמנה / תקרת תשלום (₪)">
              <input
                type="number"
                min="0"
                className={inputCls + " w-44"}
                value={globalDraft.perCompleted}
                onChange={(e) => setGlobalDraft((d) => ({ ...d, perCompleted: e.target.value }))}
              />
            </Field>
            <button
              onClick={saveGlobalPricing}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              <Check className="h-4 w-4" /> עדכון תעריפים
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={inputCls + " w-40 appearance-none pr-8"}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> ייצוא CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> הדפסה
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
        <SectionHeading
          title={`שכר שליחים — ${monthLabel(month)}`}
          subtitle={`${rows.length} שליחים עם פעילות בחודש זה`}
          icon={Wallet}
        />

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xl font-extrabold text-indigo-700">{grandTotals.visits}</p>
            <p className="text-xs text-slate-400">סה"כ ביקורים</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xl font-extrabold text-indigo-700">{grandTotals.completed}</p>
            <p className="text-xs text-slate-400">סה"כ הושלמו</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p
              className={`text-xl font-extrabold ${
                grandTotals.adjTotal < 0 ? "text-rose-600" : "text-indigo-700"
              }`}
            >
              {grandTotals.adjTotal >= 0 ? "+" : ""}
              {formatILS(grandTotals.adjTotal)}
            </p>
            <p className="text-xs text-slate-400">סה"כ התאמות</p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-3 text-center">
            <p className="text-xl font-extrabold text-indigo-700">{formatILS(grandTotals.total)}</p>
            <p className="text-xs text-slate-400">סה"כ לתשלום</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-right text-xs text-slate-400">
                <th className="px-3 py-2 font-medium">שליח</th>
                <th className="px-3 py-2 font-medium">ביקורים</th>
                <th className="px-3 py-2 font-medium">הושלמו</th>
                <th className="px-3 py-2 font-medium">התאמות</th>
                <th className="px-3 py-2 font-medium">סה"כ תשלום</th>
                <th className="px-3 py-2 font-medium">סטטוס תשלום</th>
                <th className="px-3 py-2 font-medium print:hidden">פירוט</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.courier}>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-700">{r.courier}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.visits}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.completed}</td>
                    <td className={`px-3 py-2.5 ${r.adjTotal < 0 ? "text-rose-600" : "text-slate-600"}`}>
                      {r.adjTotal !== 0 ? `${r.adjTotal >= 0 ? "+" : ""}${formatILS(r.adjTotal)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-indigo-700">{formatILS(r.total)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        disabled={r.status === "paid"}
                        title={r.status === "paid" ? "התשלום ננעל כ'שולם' ולא ניתן לשינוי" : ""}
                        onClick={() => {
                          // One-way: a paid month can never go back to unpaid.
                          if (r.status === "paid") return;
                          if (
                            window.confirm(
                              "האם שילמת לשליח בוודאות את השכר בסך " + formatILS(r.total) + "?\nשים לב: לאחר לחיצה על אישור, סטטוס התשלום יינעל כ'שולם' לצמיתות ולא יהיה ניתן לשינוי."
                            )
                          ) {
                            onTogglePayment(r.courier, month);
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset transition ${
                          r.status === "paid"
                            ? "cursor-not-allowed bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {r.status === "paid" ? "🔒 שולם" : "🔓 לא שולם"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 print:hidden">
                      <button
                        onClick={() => setExpandedCourier(expandedCourier === r.courier ? null : r.courier)}
                        className="text-xs font-medium text-slate-400 hover:text-slate-600"
                      >
                        {expandedCourier === r.courier ? "הסתר" : "הצג פירוט"}
                      </button>
                    </td>
                  </tr>
                  {expandedCourier === r.courier && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50/60 px-3 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400">
                              <th className="py-1 text-right font-medium">הזמנה</th>
                              <th className="py-1 text-right font-medium">נמען</th>
                              <th className="py-1 text-right font-medium">ביקורים</th>
                              <th className="py-1 text-right font-medium">הושלם</th>
                              <th className="py-1 text-right font-medium">תשלום</th>
                              <th className="py-1 text-right font-medium print:hidden">עריכה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.orders.map(({ order, visits, completed, total, calc }) => (
                              <tr key={order.id} className="border-t border-slate-200/60">
                                <td className="py-1.5">
                                  {order.id}
                                  {calc.completionBonus && (
                                    <div className="mt-0.5">
                                      <FirstVisitBonusChip calc={calc} />
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5">{order.recipientName}</td>
                                <td className="py-1.5">{visits}</td>
                                <td className="py-1.5">{completed}</td>
                                <td className="py-1.5 font-medium text-slate-700">{formatILS(total)}</td>
                                <td className="py-1.5 print:hidden">
                                  <button
                                    onClick={() => onEditOrderPrice(order)}
                                    className="flex items-center gap-1 text-indigo-700 hover:underline"
                                  >
                                    <Pencil className="h-3 w-3" /> תמחור
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="mt-3 flex items-center justify-between print:hidden">
                          <p className="text-xs font-semibold text-slate-500">התאמות ידניות</p>
                          <button
                            onClick={() => setAdjustmentTarget(r.courier)}
                            disabled={r.status === "paid"}
                            className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                            title={r.status === "paid" ? "החודש שולם ונעול — לא ניתן לערוך התאמות" : ""}
                          >
                            <PlusCircle className="h-3.5 w-3.5" /> הוספת התאמה
                          </button>
                        </div>
                        {r.adjustments.length === 0 ? (
                          <p className="mt-1.5 text-xs text-slate-400">אין התאמות ידניות לחודש זה</p>
                        ) : (
                          <div className="mt-1.5 space-y-1.5">
                            {r.adjustments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs ring-1 ring-slate-100"
                              >
                                <div className="flex items-center gap-1.5">
                                  {a.amount >= 0 ? (
                                    <PlusCircle className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <MinusCircle className="h-3 w-3 text-rose-500" />
                                  )}
                                  <span className="text-slate-600">{a.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${a.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {a.amount >= 0 ? "+" : ""}
                                    {formatILS(a.amount)}
                                  </span>
                                  <button
                                    onClick={() => onRemoveAdjustment(a.id)}
                                    disabled={r.status === "paid"}
                                    className="text-slate-300 hover:text-rose-500 disabled:cursor-not-allowed disabled:hover:text-slate-300 print:hidden"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    אין נתוני שכר לחודש זה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdjustmentModal
        courier={adjustmentTarget}
        monthKey={month}
        onClose={() => setAdjustmentTarget(null)}
        onSave={onAddAdjustment}
      />
    </div>
  );
}

// Admin-facing list of courier-submitted price proposals: pending requests up
// top with Approve/Reject actions, resolved ones below for a paper trail.
// Only this panel's Approve action can change an order's actual price.
function PriceRequestsPanel({ orders, onApprove, onReject }) {
  const pending = [];
  const resolved = [];
  orders.forEach((o) => {
    (o.priceRequests || []).forEach((r) => {
      const entry = { order: o, request: r };
      if (r.status === "pending") pending.push(entry);
      else resolved.push(entry);
    });
  });
  pending.sort((a, b) => (a.request.requestedAt < b.request.requestedAt ? 1 : -1));
  resolved.sort((a, b) => (a.request.reviewedAt || "") < (b.request.reviewedAt || "") ? 1 : -1);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
        <SectionHeading
          title="בקשות תמחור ממתינות"
          subtitle={`${pending.length} בקשות ממתינות לאישור`}
          icon={Coins}
        />
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">אין בקשות תמחור ממתינות כרגע</p>
        ) : (
          <div className="space-y-3">
            {pending.map(({ order, request }) => (
              <div key={request.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {order.recipientName} · {formatOrderNum(order.id)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.street} {order.houseNumber}, {order.city} · שליח: {request.courier}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    <Hourglass className="h-3 w-3" /> ממתין לאישור
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {request.proposedPerAttempt != null && (
                    <div className="rounded-md bg-white p-2 ring-1 ring-slate-100">
                      <p className="text-[11px] text-slate-400">מחיר מוצע לביקור</p>
                      <p className="font-semibold text-slate-700">{formatILS(request.proposedPerAttempt)}</p>
                    </div>
                  )}
                  {request.proposedPerCompleted != null && (
                    <div className="rounded-md bg-white p-2 ring-1 ring-slate-100">
                      <p className="text-[11px] text-slate-400">מחיר מוצע להשלמה</p>
                      <p className="font-semibold text-slate-700">{formatILS(request.proposedPerCompleted)}</p>
                    </div>
                  )}
                  <div className="col-span-2 rounded-md bg-white p-2 ring-1 ring-slate-100 sm:col-span-1">
                    <p className="text-[11px] text-slate-400">הוגשה</p>
                    <p className="font-medium text-slate-600">{request.requestedAt}</p>
                  </div>
                </div>
                <p className="mt-2 rounded-md bg-white p-2 text-xs text-slate-600 ring-1 ring-slate-100">
                  <span className="font-medium text-slate-700">סיבה: </span>
                  {request.reason}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onApprove(order.id, request.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> אישור
                  </button>
                  <button
                    onClick={() => onReject(order.id, request.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    <XCircle className="h-3.5 w-3.5" /> דחייה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
        <SectionHeading title="היסטוריית בקשות" subtitle={`${resolved.length} בקשות טופלו`} icon={ScrollText} />
        {resolved.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">טרם טופלו בקשות</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-right text-xs text-slate-400">
                  <th className="px-3 py-2 font-medium">הזמנה</th>
                  <th className="px-3 py-2 font-medium">שליח</th>
                  <th className="px-3 py-2 font-medium">הצעה</th>
                  <th className="px-3 py-2 font-medium">סטטוס</th>
                  <th className="px-3 py-2 font-medium">עודכן</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map(({ order, request }) => (
                  <tr key={request.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 text-slate-700">
                      {formatOrderNum(order.id)} · {order.recipientName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{request.courier}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {request.proposedPerAttempt != null && <>ביקור: {formatILS(request.proposedPerAttempt)} </>}
                      {request.proposedPerCompleted != null && <>השלמה: {formatILS(request.proposedPerCompleted)}</>}
                    </td>
                    <td className="px-3 py-2.5">
                      {request.status === "approved" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> אושר
                        </span>
                      )}
                      {request.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                          <XCircle className="h-3 w-3" /> נדחה
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{request.reviewedAt || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Courier onboarding form — collects everything needed to register a new
// courier (contact details, home address/city, work region, license and
// business type) and hands the finished record up to the Admin, where it's
// appended to the live roster and immediately usable in dispatch dropdowns
// and the courier identity switcher.
function CourierRegistrationModal({ open, onClose, onSubmit }) {
  const blank = {
    name: "",
    phone: "",
    email: "",
    address: "",
    residenceCity: "",
    region: REGIONS[0],
    licenseNumber: "",
    licenseFileName: "",
    businessType: BUSINESS_TYPES[0],
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) setForm(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const handleLicenseFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setForm((f2) => ({ ...f2, licenseFileName: f.name }));
  };
  const canSubmit =
    form.name.trim() && form.phone.trim() && form.email.trim() && form.address.trim() && form.licenseNumber.trim();

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(form);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="הרשמת שליח חדש" wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="שם מלא" required>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pr-9"} value={form.name} onChange={update("name")} required />
          </div>
        </Field>
        <Field label="מספר טלפון" required>
          <div className="relative">
            <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pr-9"} value={form.phone} onChange={update("phone")} required />
          </div>
        </Field>
        <Field label="דואר אלקטרוני" required>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="email" className={inputCls + " pr-9"} value={form.email} onChange={update("email")} required />
          </div>
        </Field>
        <Field label="עיר מגורים" required>
          <div className="relative">
            <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pr-9"} value={form.residenceCity} onChange={update("residenceCity")} required />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="כתובת מגורים" required>
            <div className="relative">
              <Home className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={inputCls + " pr-9"} value={form.address} onChange={update("address")} required />
            </div>
          </Field>
        </div>
        <Field label="אזור עבודה" required>
          <div className="relative">
            <MapIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select className={inputCls + " pr-9 appearance-none"} value={form.region} onChange={update("region")}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </Field>
        <Field label="מספר רישיון נהיגה" required>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pr-9"} value={form.licenseNumber} onChange={update("licenseNumber")} required />
          </div>
        </Field>
        <Field label="צילום רישיון נהיגה (אופציונלי)">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 transition-all duration-300 ease-in-out hover:border-indigo-300 hover:bg-slate-100">
            <span className="flex items-center gap-2 truncate">
              <Upload className="h-4 w-4 shrink-0 text-slate-400" />
              {form.licenseFileName || "בחרו קובץ לצילום הרישיון"}
            </span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleLicenseFile} />
          </label>
        </Field>
        <Field label="סוג עוסק" required>
          <div className="relative">
            <FileText className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select className={inputCls + " pr-9 appearance-none"} value={form.businessType} onChange={update("businessType")}>
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 border-t border-slate-100 bg-white px-5 py-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus className="h-4 w-4" /> הוספת שליח לצי
        </button>
        {!canSubmit && (
          <p className="mt-2 text-center text-xs text-amber-600">יש למלא שם, טלפון, אימייל, כתובת ורישיון נהיגה.</p>
        )}
      </div>
    </Modal>
  );
}

// Admin's full courier directory — every onboarded courier with contact
// details, region, license, business type, and live stats (how many orders
// are currently assigned to them vs. how many they've completed), pulled
// straight from the current `orders` list so the numbers are always fresh.
// Admin: registered law firms / clients with the same block / restore switch as couriers.
function LawyerDirectory({ lawyers, orders, onSetBlocked }) {
  // Badge "הצטרף דרך" per referred client (approvals live in ReferralControlPanel).
  const referralByClient = useMemo(() => {
    const m = {};
    buildReferralRows({ lawyers, orders, ledger: {} }).forEach((r) => {
      m[r.referredId] = r;
    });
    return m;
  }, [lawyers, orders]);
  const countFor = (l) => orders.filter((o) => o.lawyerId === l.id || (!o.lawyerId && o.submittedBy === l.name)).length;
  const sourceByClient = useMemo(() => clientSourceMap(orders), [orders]);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-indigo-700">עורכי דין ולקוחות</h3>
        <p className="text-xs text-slate-500">{lawyers.length} חשבונות רשומים</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-right text-xs text-slate-400">
              <th className="px-3 py-2 font-medium">שם / משרד</th>
              <th className="px-3 py-2 font-medium">אימייל</th>
              <th className="px-3 py-2 font-medium">הזמנות</th>
              <th className="px-3 py-2 font-medium">הצטרף דרך</th>
              <th className="px-3 py-2 font-medium">מקור הגעה</th>
              <th className="px-3 py-2 font-medium">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {lawyers.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2.5 font-medium text-slate-700">{l.name}</td>
                <td className="px-3 py-2.5 text-slate-500" dir="ltr">{l.email}</td>
                <td className="px-3 py-2.5 text-slate-600">{countFor(l)}</td>
                <td className="px-3 py-2.5 text-xs">
                  {referralByClient[l.id] ? (
                    <span className={`${PILL} ${referralByClient[l.id].fraudFlag ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`} title={referralByClient[l.id].fraudReason || ""}>
                      🔗 הצטרף דרך: {referralByClient[l.id].referrer ? referralByClient[l.id].referrer.name : "ממליץ לא מזוהה"} (קוד: {referralByClient[l.id].code})
                      {referralByClient[l.id].fraudFlag ? " ⚠️" : ""}
                    </span>
                  ) : (
                    <span className="text-slate-300" title="מופיע לאחר ההזמנה הראשונה של הלקוח">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {sourceByClient[l.id] || sourceByClient[l.name] ? (
                    <span className={`${PILL} bg-indigo-50 text-indigo-700 ring-indigo-200`}>{sourceLabel(sourceByClient[l.id] || sourceByClient[l.name])}</span>
                  ) : (
                    <span className="text-slate-300" title="מופיע לאחר ההזמנה הראשונה של הלקוח">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {l.blocked ? (
                      <span className={`${PILL} bg-rose-50 text-rose-700 ring-rose-200`}>
                        <Lock className="h-2.5 w-2.5" /> מושבת
                      </span>
                    ) : (
                      <span className={`${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>
                        <BadgeCheck className="h-2.5 w-2.5" /> פעיל
                      </span>
                    )}
                    {onSetBlocked && (
                      <button
                        type="button"
                        onClick={() => onSetBlocked(l, !l.blocked)}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          l.blocked
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                      >
                        {l.blocked ? "החזר לפעילות" : "חסום מפעילות"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {lawyers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                  אין עדיין עורכי דין או לקוחות רשומים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CourierDirectory({ couriers, orders, onRegisterCourier, onApproveCourier, onSetBlocked }) {
  const [showForm, setShowForm] = useState(false);

  const statsByName = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (!o.assignedCourier) return;
      if (!map[o.assignedCourier]) map[o.assignedCourier] = { assigned: 0, completed: 0 };
      map[o.assignedCourier].assigned += 1;
      if (o.status === STATUS.DELIVERED || o.status === STATUS.POSTED) {
        map[o.assignedCourier].completed += 1;
      }
    });
    return map;
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <SectionHeading title="ניהול שליחים" subtitle={`${couriers.length} שליחים רשומים במערכת${
            couriers.some((c) => c.approvalStatus === "pending")
              ? ` · ${couriers.filter((c) => c.approvalStatus === "pending").length} ממתינים לאישור`
              : ""
          }`} icon={Users} />
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <UserPlus className="h-4 w-4" /> הרשמת שליח חדש
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full min-w-[1040px] text-right text-sm">
          <thead>
            <tr className="bg-slate-50 text-right text-xs text-slate-400">
              <th className="px-3 py-2 font-medium">שם</th>
              <th className="px-3 py-2 font-medium">טלפון</th>
              <th className="px-3 py-2 font-medium">אימייל</th>
              <th className="px-3 py-2 font-medium">עיר מגורים</th>
              <th className="px-3 py-2 font-medium">אזור עבודה</th>
              <th className="px-3 py-2 font-medium">רישיון נהיגה</th>
              <th className="px-3 py-2 font-medium">סוג עוסק</th>
              <th className="px-3 py-2 font-medium">הזמנות משובצות</th>
              <th className="px-3 py-2 font-medium">הושלמו</th>
              <th className="px-3 py-2 font-medium">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {couriers.map((c) => {
              const stats = statsByName[c.name] || { assigned: 0, completed: 0 };
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-medium text-slate-700">{c.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{c.phone}</td>
                  <td className="px-3 py-2.5 text-slate-500">{c.email}</td>
                  <td className="px-3 py-2.5 text-slate-500">{c.residenceCity}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      <MapIcon className="h-3 w-3" /> {c.region}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {c.licenseNumber}
                    {c.licenseFileName && (
                      <span className="mr-1.5 inline-flex items-center gap-0.5 text-[10px] text-indigo-500">
                        <FileText className="h-3 w-3" /> קובץ מצורף
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{c.businessType}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{stats.assigned}</td>
                  <td className="px-3 py-2.5 font-medium text-emerald-600">{stats.completed}</td>
                  <td className="px-3 py-2.5">
                    {c.approvalStatus === "pending" ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`${PILL} bg-amber-50 text-amber-700 ring-amber-200`}>
                          <Hourglass className="h-2.5 w-2.5" /> ממתין לאישור
                        </span>
                        {onApproveCourier && (
                          <button
                            type="button"
                            onClick={() => onApproveCourier(c.id)}
                            className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            אישור
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.blocked ? (
                          <span className={`${PILL} bg-rose-50 text-rose-700 ring-rose-200`}>
                            <Lock className="h-2.5 w-2.5" /> מושבת
                          </span>
                        ) : (
                          <span className={`${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>
                            <BadgeCheck className="h-2.5 w-2.5" /> פעיל
                          </span>
                        )}
                        {onSetBlocked && (
                          <button
                            type="button"
                            onClick={() => onSetBlocked(c, !c.blocked)}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              c.blocked
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            }`}
                          >
                            {c.blocked ? "החזר לפעילות" : "חסום מפעילות"}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CourierRegistrationModal open={showForm} onClose={() => setShowForm(false)} onSubmit={onRegisterCourier} />
    </div>
  );
}

// Admin-only profitability panel: totals across whatever orders are currently
// shown (so it follows the stat-card filter), plus a per-zone breakdown.
function MarginSummary({ orders, pricing }) {
  // Cancelled orders earn nothing and cost nothing — exclude them.
  const rows = orders.filter((o) => o.status !== STATUS.CANCELED).map((o) => ({ o, m: calcOrderMargin(o, pricing) }));
  const revenue = rows.reduce((sum, r) => sum + r.m.price.total, 0);
  const cost = rows.reduce((sum, r) => sum + r.m.courierCost, 0);
  const margin = revenue - cost;
  const pct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
  const tiles = [
    { label: "סה\"כ הכנסות מלקוחות", value: formatILS(revenue), tone: "text-slate-800" },
    { label: "עלות שליחים (עד ₪60 למשימה)", value: formatILS(cost), tone: "text-slate-800" },
    { label: "רווח נקי", value: formatILS(margin), tone: margin >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: "שיעור רווח", value: `${pct}%`, tone: margin >= 0 ? "text-emerald-600" : "text-rose-600" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
      <SectionHeading
        title="מחשבון רווחיות"
        subtitle={`${orders.length} מסירות · מחיר לקוח פחות עלות שליח (משימה שהושלמה — לפי השכר בפועל; משימה פתוחה — לפי התקרה)`}
        icon={TrendingUp}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-400">{t.label}</p>
            <p className={`mt-1 text-xl font-extrabold ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// One order's price/margin breakdown: client price lines, courier cost, net.
function MarginModal({ order, pricing, onClose }) {
  if (!order) return null;
  const m = calcOrderMargin(order, pricing);
  return (
    <Modal open={!!order} onClose={onClose} title={`תמחור ורווחיות — ${formatOrderNum(order.id)}`}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <MapPin className="h-3 w-3" /> {order.city} · {zoneLabelFor(order.city)}
          </span>
          <ServiceChips order={order} />
        </div>
        <div className="rounded-xl border border-slate-200/60 p-3">
          <p className="mb-2 text-xs font-bold text-slate-400">מחיר ללקוח</p>
          <ul className="space-y-1.5">
            {m.price.lines.map((l) => (
              <li key={l.key} className="flex items-center justify-between text-slate-600">
                <span>{l.label}</span>
                <span className="font-semibold">{formatILS(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 font-bold text-slate-800">
            <span>סה"כ מחיר ללקוח</span>
            <span>{formatILS(m.price.total)}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/60 p-3">
          <div className="flex items-center justify-between text-slate-600">
            <span>
              עלות שליח {m.finished ? "(בפועל)" : "(תקרה שמורה)"}
              <span className="block text-[11px] text-slate-400">₪20 לביקור, עד {formatILS(m.cap)} למשימה שהושלמה</span>
            </span>
            <span className="font-semibold text-rose-600">- {formatILS(m.courierCost)}</span>
          </div>
        </div>
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 ${
            m.margin >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          <span className="font-bold">רווח נקי להזמנה</span>
          <span className="text-lg font-extrabold">
            {formatILS(m.margin)} <span className="text-xs font-semibold">({m.marginPct}%)</span>
          </span>
        </div>
        {!m.finished && (
          <p className="text-[11px] text-slate-400">המשימה עדיין פתוחה — הרווח יתעדכן לפי השכר בפועל עם סגירתה.</p>
        )}
      </div>
    </Modal>
  );
}

function AdminDashboard({
  orders,
  responses = [],
  onAssignCourier,
  pricing,
  onUpdatePricing,
  onSetOrderPrice,
  adjustments,
  payments,
  onTogglePayment,
  onAddAdjustment,
  onRemoveAdjustment,
  onApprovePriceRequest,
  onRejectPriceRequest,
  onSwitchRole,
  couriers,
  onRegisterCourier,
  onApproveCourier,
  onSetBlocked,
  referralLedger,
  onApproveReferral,
  onApplyReferralCredit,
  lawyers = [],
  assignOrderId = "",
  onCloseAssign,
  notifyPermission = "unsupported",
  onEnableNotify,
  onTestNotify,
  onSignAffidavit,
  onDeleteOrder,
  onMarkPickedUp,
  onCreateOrder,
}) {
  const [dashTab, setDashTab] = useState(() => (window.location.hash === "#couriers" ? "couriers" : "overview"));
  const [activeFilter, setActiveFilter] = useState(null);
  const [affidavitOrder, setAffidavitOrder] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [pricingOrder, setPricingOrder] = useState(null);
  const [marginOrderId, setMarginOrderId] = useState(null);

  // Deep link from the notification: show the overview, then scroll to the order.
  useEffect(() => {
    if (!assignOrderId) return undefined;
    setDashTab("overview");
    // Tap on the phone banner -> the "ממתינות לשיבוץ" view, order highlighted.
    const target = orders.find((x) => x.id === assignOrderId);
    setActiveFilter(!target || target.status === STATUS.PENDING ? STATUS.PENDING : null);
    const t = setTimeout(() => {
      const el = window.document.getElementById(`order-row-${assignOrderId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(t);
  }, [assignOrderId, orders.length]);

  const pendingRequestsCount = useMemo(
    () => orders.reduce((sum, o) => sum + (o.priceRequests || []).filter((r) => r.status === "pending").length, 0),
    [orders]
  );

  const counts = useMemo(() => {
    return {
      // Active only: a finished delivery leaves this count at once and shows
      // up under "הושלמו בהצלחה".
      active: orders.filter((o) => !isOrderCompleted(o) && o.status !== STATUS.CANCELED && o.status !== "בוטל").length,
      canceled: orders.filter((o) => o.status === STATUS.CANCELED).length,
      pending: orders.filter((o) => o.status === STATUS.PENDING).length,
      // "בטיפול" includes orders waiting on tomorrow's visit (locked today
      // under the one-visit-per-day rule) — they're still active work, just
      // not actionable again until the next calendar day.
      inProgress: orders.filter(
        (o) => o.status === STATUS.IN_PROGRESS || o.status === STATUS.PENDING_NEXT_VISIT
      ).length,
      // "הושלמו בהצלחה" covers every terminal, legally-valid completion method —
      // a signed delivery as well as a door-posting after 3 failed visits —
      // so a completed "הדבקה" task actually leaves the courier's active list
      // and shows up here instead of staying stuck in limbo.
      delivered: orders.filter((o) => isOrderCompleted(o) && o.status !== STATUS.REFUSED && o.status !== STATUS.CANCELED).length,
      needsAttention: orders.filter((o) => o.status === STATUS.REFUSED).length,
    };
  }, [orders]);

  const cards = [
    { key: "all", label: "מסירות פעילות", value: counts.active, icon: FileText, accent: "bg-slate-500", match: (o) => !isOrderCompleted(o) && o.status !== STATUS.CANCELED && o.status !== "בוטל" },
    { key: STATUS.PENDING, label: "ממתינות לשיבוץ", value: counts.pending, icon: Clock, accent: "bg-amber-500", match: (o) => o.status === STATUS.PENDING },
    { key: STATUS.IN_PROGRESS, label: "בטיפול", value: counts.inProgress, icon: Truck, accent: "bg-blue-500", match: (o) => o.status === STATUS.IN_PROGRESS || o.status === STATUS.PENDING_NEXT_VISIT },
    { key: "completed", label: "הושלמו בהצלחה", value: counts.delivered, icon: BadgeCheck, accent: "bg-emerald-500", match: (o) => isOrderCompleted(o) && o.status !== STATUS.REFUSED && o.status !== STATUS.CANCELED },
    { key: "attention", label: "דורשות טיפול", value: counts.needsAttention, icon: CircleAlert, accent: "bg-rose-500", match: (o) => o.status === STATUS.REFUSED },
    { key: "canceled", label: "בוטלו", value: counts.canceled, icon: X, accent: "bg-slate-400", match: (o) => o.status === STATUS.CANCELED },
  ];

  const filteredOrders = useMemo(() => {
    if (!activeFilter) return orders.filter((o) => !isOrderCompleted(o) && o.status !== STATUS.CANCELED && o.status !== "בוטל");
    const card = cards.find((c) => c.key === activeFilter);
    return orders.filter(card ? card.match : () => true);
  }, [orders, activeFilter]);

  const byCity = useMemo(() => {
    const groups = {};
    filteredOrders.forEach((o) => {
      groups[o.city] = groups[o.city] || [];
      groups[o.city].push(o);
    });
    return groups;
  }, [filteredOrders]);

  const navItems = [
    { key: "overview", label: "סקירה כללית", icon: BarChart3 },
    { key: "payroll", label: "שכר שליחים", icon: Wallet },
    {
      key: "couriers",
      label: "ניהול שליחים",
      icon: Users,
      badge: (couriers || []).filter((c) => c.approvalStatus === "pending").length,
    },
    { key: "requests", label: "בקשות תמחור", icon: Coins, badge: pendingRequestsCount },
    { key: "marketing", label: "שיווק", icon: QrCode },
    { key: "profile", label: "פרופיל", icon: User },
  ];

  return (
    <>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:pb-6">
      <div className="hidden w-fit gap-1 rounded-2xl bg-slate-100 p-1 sm:flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const activeTab = dashTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setDashTab(item.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                activeTab ? "bg-white text-indigo-700 shadow-sm transition-all duration-300 ease-in-out" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className={`h-4 w-4 ${activeTab ? "text-indigo-500" : ""}`} />
              {item.label}
              {!!item.badge && (
                <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {dashTab !== "overview" && (
        <button
          type="button"
          onClick={() => {
            setDashTab("overview");
            setActiveFilter(null);
            window.scrollTo({ top: 0 });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
        >
          <ArrowRight className="h-4 w-4" /> חזרה לסקירה
        </button>
      )}

      {dashTab === "marketing" && <MarketingTab lawyers={lawyers || []} orders={orders} />}

      {dashTab === "profile" && (
        <ProfileTab role="admin" onSwitchRole={onSwitchRole} />
      )}

      {dashTab === "payroll" && (
        <CourierPayroll
          orders={orders}
          pricing={pricing}
          onUpdatePricing={onUpdatePricing}
          onEditOrderPrice={setPricingOrder}
          adjustments={adjustments}
          payments={payments}
          onTogglePayment={onTogglePayment}
          onAddAdjustment={onAddAdjustment}
          onRemoveAdjustment={onRemoveAdjustment}
        />
      )}

      {dashTab === "couriers" && (
        <div className="space-y-8">
          <CourierDirectory
            couriers={couriers || COURIERS}
            orders={orders}
            onRegisterCourier={onRegisterCourier}
            onApproveCourier={onApproveCourier}
            onSetBlocked={onSetBlocked}
          />
          <LawyerDirectory lawyers={lawyers} orders={orders} onSetBlocked={onSetBlocked} />
          <ReferralControlPanel
            lawyers={lawyers || []}
            orders={orders}
            ledger={referralLedger}
            onApprove={onApproveReferral}
            onApplyCredit={onApplyReferralCredit}
          />
        </div>
      )}

      {dashTab === "requests" && (
        <PriceRequestsPanel
          orders={orders}
          onApprove={onApprovePriceRequest}
          onReject={onRejectPriceRequest}
        />
      )}

      {dashTab === "overview" && (
        <>
      {assignOrderId && (
        <AssignBanner
          order={orders.find((o) => o.id === assignOrderId) || null}
          orderId={assignOrderId}
          couriers={couriers}
          responses={responses}
          onAssign={onAssignCourier}
          onClose={onCloseAssign}
        />
      )}
      {notifyPermission !== "granted" && onEnableNotify && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <button
            type="button"
            onClick={onEnableNotify}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-base font-extrabold text-white shadow hover:bg-amber-600"
          >
            🔔 הפעל התראות באנר לנייד (כמו וואטסאפ)
          </button>
          <p className="mt-2 text-center text-xs font-medium text-amber-800">
            באייפון: לחץ שיתוף -&gt; הוסף למסך הבית -&gt; הפעל התראות
            {notifyPermission === "denied" ? " · ההתראות חסומות בדפדפן — יש לאפשר אותן בהגדרות האתר" : ""}
          </p>
        </div>
      )}
      {onTestNotify && notifyPermission !== "granted" && (
        <button
          type="button"
          onClick={onTestNotify}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 sm:w-fit"
        >
          📲 שלח התראת בדיקה לנייד
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={c.value}
            icon={c.icon}
            accent={c.accent}
            active={activeFilter === c.key || (!activeFilter && c.key === "all")}
            onClick={() => setActiveFilter(c.key === "all" ? null : c.key)}
          />
        ))}
      </div>

      {onCreateOrder && (
        <BulkImportPanel
          onCreate={onCreateOrder}
          owners={lawyers && lawyers.length ? lawyers : LAWYERS.map((n) => ({ id: null, name: n }))}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {activeFilter === "canceled" && onDeleteOrder && filteredOrders.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`למחוק לצמיתות את כל ${filteredOrders.length} ההזמנות המבוטלות? לא ניתן לשחזר.`)) {
                filteredOrders.filter(isOrderCancelled).forEach((o) => onDeleteOrder(o.id));
              }
            }}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            🗑️ מחק את כל המבוטלות לצמיתות
          </button>
        )}
        {activeFilter === "completed" && onDeleteOrder && filteredOrders.some(isOrderCompleted) && (
          <button
            type="button"
            onClick={() => {
              const done = filteredOrders.filter(isOrderCompleted);
              if (window.confirm(`למחוק לצמיתות את כל ${done.length} ההזמנות שהושלמו? כולל התיעוד, התמונות והתצהירים. לא ניתן לשחזר.`)) {
                done.forEach((o) => onDeleteOrder(o.id));
              }
            }}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            🗑️ מחק את כל ההזמנות שהושלמו לצמיתות
          </button>
        )}
        <CsvExportButton orders={filteredOrders} filename="דוח-מסירות-מנהל.csv" />
      </div>
      {activeFilter === "completed" && <MarginSummary orders={filteredOrders} pricing={pricing} />}

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionHeading
            title="מסירות לפי עיר"
            subtitle={activeFilter ? `מסונן לפי: ${cards.find((c) => c.key === activeFilter)?.label}` : "מסירות פעילות"}
            icon={Filter}
          />
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" /> נקה סינון
            </button>
          )}
        </div>

        <div className="space-y-6">
          {Object.keys(byCity).length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">אין מסירות בקטגוריה זו</p>
          )}
          {Object.entries(byCity).map(([city, cityOrders]) => (
            <div key={city}>
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                <p className="text-sm font-bold text-indigo-700">{city}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {cityOrders.length}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-right text-xs text-slate-400">
                      <th className="px-3 py-2 font-medium">הזמנה</th>
                      <th className="px-3 py-2 font-medium">נמען</th>
                      <th className="px-3 py-2 font-medium">כתובת</th>
                      <th className="px-3 py-2 font-medium">סטטוס</th>
                      <th className="px-3 py-2 font-medium">שליח</th>
                      <th className="px-3 py-2 font-medium">שכר שליח</th>
                      <th className="px-3 py-2 font-medium">מחיר לקוח / רווח</th>
                      <th className="px-3 py-2 font-medium">תצהיר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityOrders.map((o) => (
                      <tr
                        key={o.id}
                        id={`order-row-${o.id}`}
                        className={`border-t border-slate-100 ${assignOrderId === o.id ? "bg-orange-50 ring-2 ring-inset ring-orange-300" : ""}`}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-700">{formatOrderNum(o.id)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{o.recipientName}</td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {o.street} {o.houseNumber}
                          {o.apartment ? `/${o.apartment}` : ""}
                          {o.floor ? ` · ק${o.floor}` : ""}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusBadge status={o.status} />
                            <AffidavitBadge order={o} />
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1 empty:hidden">
                            <ServiceChips order={o} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
{isAssignmentLocked(o) ? (
                            <div
                              title="המשימה הושלמה — שיבוץ השליח נעול לשמירת שלמות הנתונים המשפטית"
                              className="flex w-36 items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700"
                            >
                              <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                              <span className="truncate">{o.assignedCourier || "לא משובץ"}</span>
                            </div>
                          ) : (
                          <div className="relative">
                            <select
                              value={o.assignedCourier}
                              onChange={(e) => onAssignCourier(o.id, e.target.value)}
                              className="w-36 appearance-none rounded-md border border-slate-200/60 bg-white px-2 py-1.5 pr-7 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="">לא משובץ</option>
                              {(() => {
                                const { region, local, other } = groupCouriersByRegion(o.city, couriers || COURIERS);
                                // A courier who declined this order can't be assigned to it.
                                const declined = declinedNamesFor(o.id, responses, couriers || COURIERS);
                                const opt = (c) => (
                                  <option key={c} value={c} disabled={declined.has(c)}>
                                    {c}
                                    {declined.has(c) ? " — דחה" : ""}
                                  </option>
                                );
                                const cur = o.assignedCourier;
                                return (
                                  <>
                                    {cur && !local.includes(cur) && !other.includes(cur) && (
                                      <option value={cur}>{cur} — מושבת</option>
                                    )}
                                    <optgroup label={`באזור ${region || ""} (מומלץ)`}>{local.map(opt)}</optgroup>
                                    {other.length > 0 && <optgroup label="שליחים מאזורים אחרים">{other.map(opt)}</optgroup>}
                                  </>
                                );
                              })()}
                            </select>
                            <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          </div>
                          )}
                          <DispatchResponses
                            order={o}
                            responses={responses}
                            couriers={couriers || COURIERS}
                            onAssign={onAssignCourier}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => setPricingOrder(o)}
                            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-700"
                          >
                            <Pencil className="h-3 w-3" />
                            {formatILS(calcOrderEarnings(o, pricing).total)}
                            {calcOrderEarnings(o, pricing).completionBonus && (
                              <span className="rounded-md bg-emerald-50 px-1.5 py-px text-[10px] font-medium leading-4 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                {calcOrderEarnings(o, pricing).firstVisitBonus ? "בונוס ביקור ראשון" : "בונוס השלמה"}
                              </span>
                            )}
                            {o.priceOverride?.perAttempt != null || o.priceOverride?.perCompleted != null ? (
                              <span className="rounded-md bg-amber-50 px-1.5 py-px text-[10px] font-medium leading-4 text-amber-600 ring-1 ring-inset ring-amber-200">
                                מותאם
                              </span>
                            ) : null}
                            {(o.priceRequests || []).some((r) => r.status === "pending") && (
                              <span className="flex items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-px text-[10px] font-medium leading-4 text-rose-600 ring-1 ring-inset ring-rose-200">
                                <Hourglass className="h-2.5 w-2.5" /> בקשה ממתינה
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => {
                            const m = calcOrderMargin(o, pricing);
                            return (
                              <button
                                onClick={() => setMarginOrderId(o.id)}
                                title="פירוט תמחור ורווחיות"
                                className="text-right text-xs"
                              >
                                <span className="block font-semibold text-slate-700">{formatILS(m.price.total)}</span>
                                <span className={`block font-semibold ${m.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  רווח {formatILS(m.margin)}
                                </span>
                                <span className="block text-[10px] text-slate-400">עלות שליח {formatILS(m.courierCost)}</span>
                              </button>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setDetailsId(o.id)}
                            className="rounded-md border border-slate-200/60 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            פרטים
                          </button>
                          {!isOrderCancelled(o) && (
                            <button
                              onClick={() => printWaybillLabel(o)}
                              title="הדפסת מדבקת ברקוד למעטפה"
                              className="rounded-md border border-slate-200/60 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                              🏷️ מדבקת ברקוד
                            </button>
                          )}
                          {onMarkPickedUp && needsCustody(o) && !o.pickedUpAt && !isOrderCompleted(o) && !isOrderCancelled(o) && (
                            <button
                              onClick={() => onMarkPickedUp(o.id)}
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              ✉️ סמן קליטת מסמכים למשמורת
                            </button>
                          )}
                          {needsCustody(o) && o.pickedUpAt && <span className="text-[10px] font-medium text-emerald-700">✉️ נקלט למשמורת {o.pickedUpAt}</span>}
                          {isTerminalOrder(o) ? (
                            <button
                              onClick={() => setAffidavitOrder(o)}
                              className="flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              <ScrollText className="h-3.5 w-3.5" /> {usesAffidavit(o) ? "הפקת תצהיר וחתימה" : "אישור מסירה רשמי"}
                            </button>
                          ) : null}
                          {(isOrderCancelled(o) || isOrderCompleted(o) || activeFilter === "completed") && onDeleteOrder && (
                            <button
                              onClick={() => {
                                if (window.confirm(`למחוק לצמיתות את ההזמנה ${formatOrderNum(o.id)}? לא ניתן לשחזר.`)) onDeleteOrder(o.id);
                              }}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              🗑️ מחק לצמיתות
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* Admin sees every order's full evidence trail (photos, GPS, visit
          log, signed affidavit). Both modals resolve the order live from the
          full list so a courier's new submission shows up immediately. */}
      <OrderDetailsModal order={orders.find((o) => o.id === detailsId) || null} onClose={() => setDetailsId(null)} onOpenAffidavit={(o) => setAffidavitOrder(o)} />
      <AffidavitModal
        order={orders.find((o) => o.id === (affidavitOrder && affidavitOrder.id)) || null}
        onClose={() => setAffidavitOrder(null)}
        onSign={onSignAffidavit}
      />
      <MarginModal
        order={orders.find((o) => o.id === marginOrderId) || null}
        pricing={pricing}
        onClose={() => setMarginOrderId(null)}
      />
      <PricingModal
        order={pricingOrder}
        pricing={pricing}
        onClose={() => setPricingOrder(null)}
        onSave={onSetOrderPrice}
      />
    </div>
    <BottomNav items={navItems} active={dashTab} onChange={setDashTab} />
    </>
  );
}

/* =========================================================================
   CLOUD BACKEND (Supabase) — auth, real-time sync, evidence storage
   =========================================================================
   Everything below is inert unless VITE_SUPABASE_URL and
   VITE_SUPABASE_ANON_KEY are set; without them the app runs exactly as the
   in-memory demo (role switcher, seeded data).

   Data model (see supabase/schema.sql):
     profiles       one row per user, with role admin | courier | lawyer
     orders         key columns + a `data` jsonb with the rest of the order
     visits         one immutable row per courier visit (evidence URLs)
     notifications  created by database triggers, read by the law firm
     settings       pricing (everyone reads) + per-courier payroll documents
   Row Level Security is the real access control: a courier only receives
   orders assigned to them, a lawyer only their own, an admin everything.
   Photos / audio / video / signatures live in the public `evidence` storage
   bucket; the database stores only their public URLs.
   ========================================================================= */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const EVIDENCE_BUCKET = "evidence";
// What the address bar said when the page opened — read BEFORE createClient,
// because supabase-js removes the auth tokens from the URL right after parsing.
//   #...type=signup     -> the user just clicked the e-mail verification link
//   #...type=recovery   -> the user just clicked the password-reset link
const URL_AUTH_INTENT = (() => {
  const raw = window.location.hash + "&" + window.location.search;
  return { verified: /type=(signup|email)\b/.test(raw), recovery: /type=recovery\b/.test(raw) };
})();
// "הישאר מחובר": where Supabase keeps the session token.
//   checked   -> localStorage   (survives restarts, shared by all tabs)
//   unchecked -> sessionStorage (this tab only; a new tab or a restart needs a fresh login)
// The choice itself is a harmless flag in localStorage. The adapter below is
// consulted on every read/write, so flipping the flag at login switches the store.
const STAY_KEY = "mesirot-stay-logged-in";
// Default = session only. localStorage is used ONLY after "הישאר מחובר" was ticked.
const readStayLoggedIn = () => {
  try {
    return window.localStorage.getItem(STAY_KEY) === "1";
  } catch (e) {
    return false;
  }
};
const writeStayLoggedIn = (stay) => {
  try {
    window.localStorage.setItem(STAY_KEY, stay ? "1" : "0");
  } catch (e) {
    /* storage unavailable */
  }
};
const authStorage = {
  getItem: (key) => {
    try {
      return (readStayLoggedIn() ? window.localStorage : window.sessionStorage).getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      const keep = readStayLoggedIn();
      (keep ? window.localStorage : window.sessionStorage).setItem(key, value);
      (keep ? window.sessionStorage : window.localStorage).removeItem(key); // never leave a copy in the other store
    } catch (e) {
      /* storage unavailable */
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch (e) {
      /* storage unavailable */
    }
  },
};
// STARTUP SESSION GUARD — runs before the Supabase client exists, so no stale
// session can ever be picked up. Unless "הישאר מחובר" was explicitly ticked:
//   • tokens in localStorage (also those left by older versions) are deleted;
//   • tokens in sessionStorage are deleted on every fresh visit (link click,
//     typed address, new tab, app relaunch) — only a plain page reload (F5)
//     keeps the current tab signed in.
// An e-mail verification / password-reset link carries its own tokens in the
// URL; those are untouched, so the verification flow still works.
const AUTH_TOKEN_KEY = /^sb-.+-auth-token/;
// Deletes the stored sessions and returns their access tokens (for revocation).
const wipeAuthTokens = (store) => {
  const tokens = [];
  try {
    Object.keys(store)
      .filter((k) => AUTH_TOKEN_KEY.test(k))
      .forEach((k) => {
        try {
          const t = JSON.parse(store.getItem(k) || "null");
          if (t && t.access_token) tokens.push(t.access_token);
        } catch (e) {
          /* not JSON — just delete it */
        }
        store.removeItem(k);
      });
  } catch (e) {
    /* storage unavailable */
  }
  return tokens;
};
// Also end the wiped sessions on the server, in the background. scope=local
// revokes ONLY that one session — the default (global) would sign the user out
// on every device, including ones where they ticked "הישאר מחובר".
const revokeTokensOnServer = (tokens) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  tokens.forEach((token) => {
    window
      .fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
        keepalive: true,
      })
      .catch(() => {});
  });
};
(() => {
  const arrivedViaAuthLink = /access_token=|[?&]code=|type=(signup|email|recovery|magiclink|invite)\b/.test(
    window.location.hash + window.location.search
  );
  if (readStayLoggedIn()) {
    // A stale "stay" flag without a stored session must not make a later
    // e-mail-link login permanent.
    const hasToken = Object.keys(window.localStorage).some((k) => AUTH_TOKEN_KEY.test(k));
    if (!hasToken && !arrivedViaAuthLink) writeStayLoggedIn(false);
    return;
  }
  if (arrivedViaAuthLink) return;
  const stale = wipeAuthTokens(window.localStorage);
  let navType = "navigate";
  try {
    const entry = window.performance.getEntriesByType("navigation")[0];
    if (entry) navType = entry.type;
  } catch (e) {
    /* default: treat as a fresh visit */
  }
  if (navType !== "reload") stale.push(...wipeAuthTokens(window.sessionStorage));
  revokeTokensOnServer(stale);
})();
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: authStorage, persistSession: true } })
    : null;
const CLOUD_ENABLED = !!supabase;

// Public address of the app (verification / password-reset emails send people
// back here). Set VITE_SITE_URL=https://mesirot.express in production; it falls
// back to whatever origin the app is running on (localhost, preview URLs).
// Deep link "#assign=<ORDER_ID>" (opened from the new-order notification).
// Captured at load and kept in sessionStorage so it survives the login screen.
const ASSIGN_INTENT = (() => {
  try {
    const m = /[#&]assign=([^&]+)/.exec(window.location.hash);
    if (m) {
      const id = decodeURIComponent(m[1]);
      window.sessionStorage.setItem("pendingAssign", id);
      return id;
    }
    return window.sessionStorage.getItem("pendingAssign") || "";
  } catch (e) {
    return "";
  }
})();

const SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  (/^(localhost|127\.)/.test(window.location.hostname) ? window.location.origin : "https://mesirot.express")
).replace(/\/+$/, "");

/* -------------------------------------------------------------------------
   ADMIN NEW-ORDER NOTIFICATIONS — a native banner (via the Service Worker in
   public/sw.js) with vibration and the system sound. It fires when a new
   order shows up in the live order list (Supabase Realtime keeps that list
   current). Tapping it opens "#assign=<ORDER_ID>".
   NOTE: this runs inside the open app / PWA (foreground or background). A
   banner while the app is fully closed needs server-side Web Push.
   ------------------------------------------------------------------------- */
const NOTIFY_SUPPORTED = () => typeof window.Notification !== "undefined" && !!window.navigator.serviceWorker;

// The one and only text of the "new delivery waiting for assignment" alert for
// the admin — in-app banner, browser / push notification and webhook payloads.
const ADMIN_NEW_ORDER_MSG = "מסירה חדשה ממתינה לשיבוץ (אבא תודה)";

async function registerServiceWorker() {
  try {
    await window.navigator.serviceWorker.register("/sw.js");
    return await window.navigator.serviceWorker.ready;
  } catch (e) {
    return null;
  }
}

// WhatsApp-style banner: bold title, 4 short lines, big icon, vibration,
// stays until tapped, and a one-tap "assign now" action.
async function showNewOrderNotification(order) {
  const reg = await registerServiceWorker();
  if (!reg) return;
  const address = [`${order.street || ""} ${order.houseNumber || ""}`.trim(), order.city].filter(Boolean).join(", ");
  reg.showNotification(ADMIN_NEW_ORDER_MSG, {
    body: `מס' הזמנה ${formatOrderNum(order.id)} · לקוח: ${order.submittedBy || "—"} · כתובת: ${address || "—"}`,
    tag: `new-order-${order.id}`,
    dir: "rtl",
    lang: "he",
    vibrate: [200, 100, 200],
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    requireInteraction: true,
    renotify: true,
    actions: [{ action: "assign", title: "שבץ שליח עכשיו" }],
    data: { orderId: order.id, url: `${SITE_URL}/#assign=${order.id}` },
  });
}

// Admin "send me a test banner" button — same look as a real new order.
async function showTestNotification() {
  await showNewOrderNotification({
    id: "TEST",
    submittedBy: "לקוח לדוגמה",
    recipientName: "נמען לדוגמה",
    street: "הרצל",
    houseNumber: "1",
    city: "תל אביב",
  });
}

function useAdminOrderAlerts({ enabled, ready, orders, onOpenOrder }) {
  const [permission, setPermission] = useState(() => (NOTIFY_SUPPORTED() ? window.Notification.permission : "unsupported"));
  const seenRef = useRef(null);
  const openRef = useRef(onOpenOrder);
  openRef.current = onOpenOrder;

  // Register the worker and listen for "notification tapped" messages.
  useEffect(() => {
    if (!enabled || !NOTIFY_SUPPORTED()) return undefined;
    registerServiceWorker();
    const onMessage = (e) => {
      if (e.data && e.data.type === "assign" && e.data.orderId && e.data.orderId !== "TEST") openRef.current(e.data.orderId);
    };
    window.navigator.serviceWorker.addEventListener("message", onMessage);
    return () => window.navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [enabled]);

  // New order = an id we have not seen since the first load.
  useEffect(() => {
    if (!ready) return;
    if (seenRef.current === null) {
      seenRef.current = new window.Set(orders.map((o) => o.id));
      return;
    }
    const fresh = orders.filter((o) => !seenRef.current.has(o.id));
    fresh.forEach((o) => seenRef.current.add(o.id));
    if (!enabled || permission !== "granted") return;
    fresh.filter((o) => o.status === STATUS.PENDING).forEach(showNewOrderNotification);
  }, [orders, ready, enabled, permission]);

  const requestPermission = async () => {
    try {
      setPermission(await window.Notification.requestPermission());
    } catch (e) {
      setPermission("denied");
    }
  };
  const sendTest = async () => {
    if (window.Notification.permission !== "granted") await requestPermission();
    if (NOTIFY_SUPPORTED() && window.Notification.permission === "granted") await showTestNotification();
  };
  return { permission, requestPermission, sendTest };
}

// Orange one-tap assignment banner — opened by the #assign=<ORDER_ID> link.
function AssignBanner({ order, orderId, couriers, responses, onAssign, onClose }) {
  const [pick, setPick] = useState("");
  const roster = couriers || COURIERS;
  const shell = (children) => (
    <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-orange-700">
          <Bell className="h-4 w-4" /> {ADMIN_NEW_ORDER_MSG} — {orderId}
        </p>
        <button type="button" onClick={onClose} aria-label="סגירה" className="text-orange-500 hover:text-orange-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
  if (!order) return shell(<p className="text-xs text-orange-700">טוען את ההזמנה…</p>);
  if (order.assignedCourier || isAssignmentLocked(order)) {
    return shell(
      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <Check className="h-4 w-4" /> {order.assignedCourier ? `שובץ: ${order.assignedCourier}` : `סטטוס: ${order.status}`}
      </p>
    );
  }
  // Blocked / pending couriers are already filtered out by groupCouriersByRegion;
  // couriers who declined this order are removed here.
  const declined = declinedNamesFor(order.id, responses, roster);
  const { region, local, other } = groupCouriersByRegion(order.city, roster);
  const takers = responses
    .filter((r) => r.orderId === order.id && r.action === RESPONSE.TAKE)
    .map((r) => (roster.find((c) => c.id === r.courierId) || {}).name)
    .filter((n) => n && [...local, ...other].includes(n));
  const opts = (list) => list.filter((n) => !declined.has(n)).map((n) => <option key={n} value={n}>{n}</option>);
  return shell(
    <>
      <p className="text-xs text-orange-800">
        {order.recipientName} · {order.street} {order.houseNumber}, {order.city}
        {order.submittedBy ? ` · ${order.submittedBy}` : ""}
      </p>
      {takers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-orange-700">ביקשו את המשימה:</span>
          {takers.map((n) => (
            <button key={n} type="button" onClick={() => onAssign(order.id, n)} className="rounded-md bg-emerald-600 px-2 py-0.5 font-semibold text-white hover:bg-emerald-700">
              שבץ את {n}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-orange-300 bg-white px-2 py-2 text-sm text-slate-700 focus:outline-none">
          <option value="">בחרו שליח…</option>
          <optgroup label={`באזור ${region || ""} (מומלץ)`}>{opts(local)}</optgroup>
          {other.length > 0 && <optgroup label="שליחים מאזורים אחרים">{opts(other)}</optgroup>}
        </select>
        <button
          type="button"
          disabled={!pick}
          onClick={() => onAssign(order.id, pick)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          שבץ שליח
        </button>
      </div>
    </>
  );
}

// Exposes the signed-in profile (or null in demo mode) to nested screens.
const SessionContext = React.createContext(null);

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const uploadCache = new window.Map();

// Evidence-upload problems are never silent: every failed upload is reported to
// the listeners (the cloud store turns them into a visible banner with a retry
// button). Images still fall back to a small inline copy so the evidence is
// kept; audio / video have no safe inline fallback and are reported as NOT saved.
const evidenceIssueListeners = new window.Set();
function reportEvidenceIssue(issue) {
  evidenceIssueListeners.forEach((fn) => {
    try {
      fn(issue);
    } catch (e) {
      /* a listener must never break an upload */
    }
  });
}
// A failed upload is remembered for a few seconds only, so the visit row and its
// mirror copy (same media, saved in the same pass) do not each retry and report
// it — but the NEXT save, or the retry button, tries again.
const uploadFailCache = new window.Map();
const UPLOAD_FAIL_TTL_MS = 15000;
const isLocalMedia = (v) => typeof v === "string" && (v.startsWith("data:") || v.startsWith("blob:"));
// True while an order still holds media that exists only on this device
// (not yet a Storage URL). Used by the "retry" action.
function orderHasUnsentMedia(o) {
  if (!o) return false;
  const att = (o.attempts || []).filter((a) => !a.synthetic);
  return (
    att.some((a) => isLocalMedia(a.photo && a.photo.dataUrl) || isLocalMedia(a.audio) || isLocalMedia(a.signatureDataUrl)) ||
    isLocalMedia(o.affidavit && o.affidavit.signature) ||
    isLocalMedia(o.signature)
  );
}

// ---- Private-storage support (works whether the bucket is public or private) ----
// What is SAVED in orders / visits is always the permanent reference: the public-style
// URL of the object (…/storage/v1/object/public/evidence/<path>) or an inline data: image.
// For display, printing and affidavits it is turned — in memory only — into a short-lived
// signed URL. If signing is impossible (demo mode, offline, no permission) the original
// value is used, so legacy public URLs and data: images keep working exactly as before.
const SIGNED_URL_SECONDS = 3600;
const signedUrlCache = new window.Map(); // path -> { url, exp }
const signedUrlPending = new window.Map();
const inlineDataCache = new window.Map(); // evidence ref -> data: URL (for documents)
function evidencePathOf(v) {
  if (typeof v !== "string" || !v) return null;
  let p = null;
  if (/^evidence\/[^?#\s"'<>\\]+$/.test(v)) p = v.slice(9);
  else if (/^https:\/\//i.test(v)) {
    try {
      const u = new window.URL(v);
      const host = supabaseHostOf();
      if (host && u.host === host) {
        const m = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/evidence\/(.+)$/.exec(u.pathname);
        if (m) p = m[1];
      }
    } catch (e) {
      return null;
    }
  }
  if (!p) return null;
  try {
    p = decodeURIComponent(p);
  } catch (e) {
    return null;
  }
  return p && !p.includes("..") && !p.startsWith("/") && p.length < 400 ? p : null;
}
async function resolveEvidenceUrl(v) {
  const path = evidencePathOf(v);
  if (!path || !supabase) return v;
  const hit = signedUrlCache.get(path);
  if (hit && hit.exp > window.Date.now()) return hit.url;
  if (!signedUrlPending.has(path)) {
    signedUrlPending.set(
      path,
      (async () => {
        try {
          const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
          if (error || !data || !data.signedUrl) throw error || new Error("no signed url");
          signedUrlCache.set(path, { url: data.signedUrl, exp: window.Date.now() + (SIGNED_URL_SECONDS - 300) * 1000 });
          return data.signedUrl;
        } catch (e) {
          return null; // not signable (public bucket + no policy, offline…) → the original value is used
        } finally {
          signedUrlPending.delete(path);
        }
      })()
    );
  }
  const url = await signedUrlPending.get(path);
  return url || v;
}
// What can be shown right now: a plain value, a cached signed URL, null (unusable) or
// undefined (a signed URL is still being requested).
function evidenceDisplayNow(src) {
  const path = evidencePathOf(src);
  if (!path) return src;
  if (!supabase) return /^https:/.test(src) ? src : null;
  const c = signedUrlCache.get(path);
  return c && c.exp > window.Date.now() ? c.url : undefined;
}
// React hook: the value to put in <img>/<audio>/<video> src. Never written back to any order.
function useEvidenceSrc(src) {
  const now = evidenceDisplayNow(src);
  const [resolved, setResolved] = useState({ src: null, url: null });
  useEffect(() => {
    if (now !== undefined) return undefined;
    let live = true;
    resolveEvidenceUrl(src).then((u) => {
      if (live) setResolved({ src, url: /^(https?:|data:|blob:)/.test(u || "") ? u : null });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, now === undefined]);
  return now !== undefined ? now : resolved.src === src ? resolved.url : undefined;
}
// A storage reference -> inline image (so printed / downloaded documents are self-contained
// and never carry an expiring link). Anything it cannot convert is returned unchanged.
async function inlineEvidenceValue(v) {
  if (!supabase || !evidencePathOf(v)) return v;
  if (inlineDataCache.has(v)) return inlineDataCache.get(v);
  try {
    const url = await resolveEvidenceUrl(v);
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(blob.type) || blob.size > 8000000) return v;
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new window.FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    if (inlineDataCache.size > 40) inlineDataCache.delete(inlineDataCache.keys().next().value);
    inlineDataCache.set(v, dataUrl);
    return dataUrl;
  } catch (e) {
    return v;
  }
}
// Copy of an order whose photos / signatures / stamps are inline images (documents only; never saved).
async function inlineOrderEvidence(order) {
  if (!order || !supabase) return order;
  const attempts = order.attempts || [];
  const topKeys = ["signature", "lawyerSignature", "lawyerStamp"];
  const needs =
    attempts.some((a) => evidencePathOf(a.photo && a.photo.dataUrl) || evidencePathOf(a.signatureDataUrl)) ||
    topKeys.some((k) => evidencePathOf(order[k])) ||
    evidencePathOf(order.affidavit && order.affidavit.signature);
  if (!needs) return order;
  const conv = (v) => (typeof v === "string" ? inlineEvidenceValue(v) : v);
  const next = { ...order };
  next.attempts = await Promise.all(
    attempts.map(async (a) => ({
      ...a,
      photo: a.photo && a.photo.dataUrl && a.photo.kind !== "video" ? { ...a.photo, dataUrl: await conv(a.photo.dataUrl) } : a.photo,
      signatureDataUrl: a.signatureDataUrl ? await conv(a.signatureDataUrl) : a.signatureDataUrl,
    }))
  );
  for (const k of topKeys) if (typeof order[k] === "string") next[k] = await conv(order[k]);
  if (order.affidavit && order.affidavit.signature) next.affidavit = { ...order.affidavit, signature: await conv(order.affidavit.signature) };
  return next;
}
// Last line of defence before saving: no temporary signed URL may ever reach the database.
function deepStripSigned(v, depth = 0) {
  if (typeof v === "string") return /^https:\/\//i.test(v) && (/\/object\/sign\//.test(v) || /[?&]token=/.test(v)) ? stripSignedUrl(v) : v;
  if (!v || typeof v !== "object" || depth > 8) return v;
  if (Array.isArray(v)) return v.map((x) => deepStripSigned(x, depth + 1));
  const out = {};
  Object.keys(v).forEach((k) => {
    out[k] = deepStripSigned(v[k], depth + 1);
  });
  return out;
}

// Uploads a data:/blob: URL to the evidence bucket and returns its public URL.
// Anything that is already a normal URL (or empty) is returned untouched —
// except that a temporary signed URL is turned back into the permanent one.
async function uploadEvidence(path, value) {
  if (typeof value !== "string" || !(value.startsWith("data:") || value.startsWith("blob:"))) return stripSignedUrl(value) || null;
  if (uploadCache.has(value)) return uploadCache.get(value);
  const failed = uploadFailCache.get(value);
  if (failed && window.Date.now() - failed.ts < UPLOAD_FAIL_TTL_MS) return failed.fallback;
  let type = "";
  try {
    const blob = await (await fetch(value)).blob();
    type = (blob.type || "").split(";")[0];
    const fullPath = `${path}-${window.Date.now().toString(36)}.${MIME_EXT[type] || "bin"}`;
    const { error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(fullPath, blob, { contentType: type || undefined, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(fullPath);
    uploadCache.set(value, data.publicUrl);
    uploadFailCache.delete(value);
    return data.publicUrl;
  } catch (e) {
    // A storage failure (size limit, 400, network) must NEVER abort saving the
    // visit. Images fall back to a tiny inline copy (900 px, JPEG 0.65, ~60 KB)
    // stored in the row itself, so the legal evidence is never lost.
    console.warn("Storage upload failed:", path, e);
    let fallback = null;
    if (!type || type.startsWith("image/")) {
      const small = await compressDataUrl(value, 900, 0.65).catch(() => null);
      fallback = typeof small === "string" && small.startsWith("data:image/") ? small : null;
    }
    // Not cached as a success: a later save (or the retry button) uploads again.
    uploadFailCache.set(value, { ts: window.Date.now(), fallback });
    const kind = type.startsWith("video/") ? "video" : type.startsWith("audio/") || /-audio$/.test(path) ? "audio" : "image";
    reportEvidenceIssue({
      orderId: String(path).split("/")[0],
      kind,
      saved: fallback ? "inline" : "none",
      reason: (e && e.message) || String(e),
    });
    return fallback;
  }
}

// order object (UI shape) -> database row. Heavy / derived fields are not
// stored on the order: visits live in their own table, and "last visit" and
// "posting photo" are recomputed from them when the order is loaded.
// Light copy of one visit for orders.data.visits (media already uploaded, or
// the inline fallback). A second, independent record of every visit.
async function visitMirror(order, a, i) {
  const base = `${order.id}/visit-${i + 1}`;
  const [photoUrl, audioUrl, sigUrl] = await Promise.all([
    a.photo && a.photo.dataUrl ? uploadEvidence(`${base}-photo`, a.photo.dataUrl) : null,
    typeof a.audio === "string" ? uploadEvidence(`${base}-audio`, a.audio) : null,
    a.signatureDataUrl ? uploadEvidence(`${base}-signature`, a.signatureDataUrl) : null,
  ]);
  return {
    type: a.type,
    timestamp: a.timestamp,
    location: a.location,
    lat: a.lat ?? null,
    lng: a.lng ?? null,
    gpsAccuracy: a.gpsAccuracy ?? null,
    gpsMissing: !!a.gpsMissing,
    notes: a.notes || "",
    courier: a.courier || order.assignedCourier || "",
    audioRecorded: !!(a.audioRecorded || audioUrl),
    audioSaveFailed: !!(typeof a.audio === "string" && a.audio && !audioUrl),
    audit: a.audit || null,
    deliveryMode: a.deliveryMode || null,
    deliveredToType: a.deliveredToType || null,
    receiverName: a.receiverName || "",
    receiverRelation: a.receiverRelation || "",
    residenceVerification: a.residenceVerification || null,
    verificationNote: a.verificationNote || "",
    verifiedIdType: a.verifiedIdType || null,
    verifiedIdLast4: a.verifiedIdLast4 || "",
    photo: photoUrl
      ? { dataUrl: photoUrl, kind: (a.photo && a.photo.kind) || "image", timestamp: a.photo && a.photo.timestamp, gps: (a.photo && a.photo.gps) ?? null }
      : null,
    audio: audioUrl,
    signatureDataUrl: sigUrl || undefined,
  };
}

async function orderToRow(o) {
  /* eslint-disable no-unused-vars */
  const { attempts, lastVisitAt, lastVisitGps, lastVisitLat, lastVisitLng, lastVisitPhoto, postingPhoto, courierId, lawyerId, visits: _oldMirror, ...data } = o;
  /* eslint-enable no-unused-vars */
  const real = (attempts || []).filter((a) => !a.synthetic);
  if (real.length) data.visits = await Promise.all(real.map((a, i) => visitMirror(o, a, i)));
  if (data.affidavit && data.affidavit.signature) {
    data.affidavit = {
      ...data.affidavit,
      signature: await uploadEvidence(`${o.id}/affidavit-signature`, data.affidavit.signature),
    };
  }
  if (typeof data.signature === "string") {
    data.signature = data.signature.startsWith("data:")
      ? await uploadEvidence(`${o.id}/recipient-signature`, data.signature)
      : stripSignedUrl(data.signature);
  }
  for (const k of ["lawyerSignature", "lawyerStamp"]) {
    if (typeof data[k] === "string") data[k] = data[k].startsWith("data:") ? await uploadEvidence(`${o.id}/${k}`, data[k]) : stripSignedUrl(data[k]);
  }
  return {
    id: o.id,
    status: o.status,
    city: o.city,
    region: o.region || CITY_REGION[o.city] || null,
    lawyer_id: lawyerId || null,
    courier_id: courierId || null,
    data: deepStripSigned(data),
  };
}

// One visit (attempt) -> visits row, uploading its media first.
async function visitToRow(order, a, seq, courierId) {
  const base = `${order.id}/visit-${seq}`;
  const [photoUrl, audioUrl, signatureUrl] = await Promise.all([
    a.photo && a.photo.dataUrl ? uploadEvidence(`${base}-photo`, a.photo.dataUrl) : null,
    typeof a.audio === "string" ? uploadEvidence(`${base}-audio`, a.audio) : null,
    a.signatureDataUrl ? uploadEvidence(`${base}-signature`, a.signatureDataUrl) : null,
  ]);
  return {
    order_id: order.id,
    seq,
    courier_id: courierId || null,
    data: {
      type: a.type,
      timestamp: a.timestamp,
      location: a.location,
      lat: a.lat ?? null,
      lng: a.lng ?? null,
      gpsAccuracy: a.gpsAccuracy ?? null,
      gpsMissing: !!a.gpsMissing,
      notes: a.notes || "",
      courier: a.courier || order.assignedCourier || "",
      audioRecorded: !!(a.audioRecorded || audioUrl),
      audioSaveFailed: !!(typeof a.audio === "string" && a.audio && !audioUrl),
      audit: a.audit || null,
      deliveryMode: a.deliveryMode || null,
      deliveredToType: a.deliveredToType || null,
      receiverName: a.receiverName || "",
      receiverRelation: a.receiverRelation || "",
      residenceVerification: a.residenceVerification || null,
      verificationNote: a.verificationNote || "",
      verifiedIdType: a.verifiedIdType || null,
      verifiedIdLast4: a.verifiedIdLast4 || "",
    },
    photo_url: deepStripSigned(photoUrl),
    photo_meta: a.photo ? { kind: a.photo.kind || "image", timestamp: a.photo.timestamp, gps: a.photo.gps ?? null } : null,
    audio_url: deepStripSigned(audioUrl),
    signature_url: deepStripSigned(signatureUrl),
  };
}

function visitFromRow(v) {
  const d = v.data || {};
  const meta = v.photo_meta || {};
  return {
    ...d,
    photo: v.photo_url
      ? { dataUrl: v.photo_url, kind: meta.kind || "image", timestamp: meta.timestamp, gps: meta.gps ?? null }
      : null,
    audio: v.audio_url || null,
    audioRecorded: !!(d.audioRecorded || v.audio_url),
    signatureDataUrl: v.signature_url || undefined,
  };
}

function orderFromRow(row, visitRows) {
  const { visits: mirror = [], ...rowData } = row.data || {};
  const fromTable = visitRows.slice().sort((x, y) => x.seq - y.seq).map(visitFromRow);
  // Merge the visits table with the copy mirrored inside orders.data.visits:
  // the table wins, but a missing photo / signature / audio is filled from the mirror.
  const merged = [];
  const n = Math.max(fromTable.length, Array.isArray(mirror) ? mirror.length : 0);
  for (let i = 0; i < n; i += 1) {
    const t = fromTable[i];
    const m = (Array.isArray(mirror) && mirror[i]) || null;
    merged.push(
      t && m
        ? { ...m, ...t, photo: t.photo || m.photo || null, audio: t.audio || m.audio || null, signatureDataUrl: t.signatureDataUrl || m.signatureDataUrl, audit: t.audit || m.audit || null }
        : t || m
    );
  }
  const attempts = merged;
  // A finished order must never show an empty visit history: if no visit was
  // saved at all, record the completion itself as the visit.
  const draft = { ...rowData, status: row.status };
  if (!attempts.length && isOrderCompleted(draft)) {
    attempts.push({
      type: isTerminalOrder(draft) ? row.status : STATUS.DELIVERED,
      timestamp: rowData.completedAt || (rowData.affidavit && rowData.affidavit.signedAt) || "",
      location: "לא נקלט GPS",
      lat: null,
      lng: null,
      gpsMissing: true,
      notes: "נרשם אוטומטית מהשלמת המשימה (פרטי הביקור לא נשמרו במלואם)",
      courier: rowData.assignedCourier || "",
      photo: null,
      audio: null,
      audioRecorded: false,
      signatureDataUrl: typeof rowData.signature === "string" && rowData.signature !== "SIGNED" ? rowData.signature : undefined,
      synthetic: true,
    });
  }
  const last = attempts[attempts.length - 1];
  const posted = attempts.slice().reverse().find((a) => a.type === STATUS.POSTED);
  return {
    ...rowData,
    id: row.id,
    status: row.status,
    city: row.city,
    courierId: row.courier_id,
    lawyerId: row.lawyer_id,
    attempts,
    lastVisitAt: last ? last.timestamp : undefined,
    lastVisitGps: last ? last.location : undefined,
    lastVisitLat: last ? last.lat ?? null : null,
    lastVisitLng: last ? last.lng ?? null : null,
    lastVisitPhoto: last ? last.photo || null : null,
    postingPhoto: posted ? posted.photo || null : null,
  };
}

function courierFromProfile(p) {
  return {
    id: p.id,
    name: p.full_name,
    phone: p.phone || "",
    email: p.email || "",
    residenceCity: p.residence_city || "",
    address: p.address || "",
    region: p.region || "",
    licenseNumber: p.license_number || "",
    businessType: p.business_type || "",
    approvalStatus: p.approval_status || "approved",
    blocked: !!p.blocked,
    // Optional: limit pickup alerts to these cities (empty = the whole region).
    workCities: Array.isArray(p.work_cities) ? p.work_cities : [],
  };
}

async function cloudFetchOrders() {
  const [o, v] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("visits").select("*").order("seq", { ascending: true }),
  ]);
  if (o.error) throw o.error;
  if (v.error) throw v.error;
  const byOrder = new window.Map();
  (v.data || []).forEach((r) => {
    if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, []);
    byOrder.get(r.order_id).push(r);
  });
  return (o.data || []).map((r) => orderFromRow(r, byOrder.get(r.id) || []));
}

async function cloudFetchNotifications(profile) {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((n) => ({
    id: n.id,
    key: n.key,
    orderId: n.order_id,
    lawyer: profile.full_name,
    message: n.message,
    createdAt: new window.Date(n.created_at).toLocaleString("he-IL"),
    read: !!n.read,
  }));
}

async function cloudFetchResponses() {
  const { data, error } = await supabase.from("order_responses").select("*");
  if (error) throw error;
  return (data || []).map((r) => ({
    orderId: r.order_id,
    courierId: r.courier_id,
    action: r.action,
    outcome: r.outcome,
    acknowledged: !!r.acknowledged,
    at: new window.Date(r.updated_at || r.created_at).toLocaleString("he-IL"),
  }));
}

// Admin only: registered law firms / clients (profiles.role = 'lawyer').
async function cloudFetchLawyers() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "lawyer").order("full_name");
  if (error) throw error;
  return (data || []).map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email || "",
    phone: p.phone || "",
    firm: p.firm || "",
    licenseNo: p.bar_license_no || "",
    address: p.office_address || "",
    blocked: !!p.blocked,
    createdAt: p.created_at || "",
  }));
}

async function cloudFetchCouriers() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "courier").order("full_name");
  if (error) throw error;
  return (data || []).map(courierFromProfile);
}

// Pricing is shared by everyone; payroll documents (`payroll:<courierId>`)
// are readable only by the admin and by that courier.
async function cloudFetchSettings() {
  const { data, error } = await supabase.from("settings").select("*");
  if (error) throw error;
  const out = { pricing: null, payments: {}, adjustments: [], payrollKeys: [], referrals: null };
  (data || []).forEach((row) => {
    if (row.key === "pricing") out.pricing = row.value;
    else if (row.key === "referrals") out.referrals = row.value && typeof row.value === "object" ? row.value : {};
    else if (row.key.startsWith("payroll:")) {
      out.payrollKeys.push(row.key);
      const v = row.value || {};
      Object.entries(v.payments || {}).forEach(([monthKey, status]) => {
        out.payments[paymentKey(v.courierName, monthKey)] = status;
      });
      (v.adjustments || []).forEach((a) => out.adjustments.push(a));
    }
  });
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// COURIER REGISTRATION WEBHOOK (Make.com / Zapier)
// ---------------------------------------------------------------------------
// >>> PASTE YOUR MAKE.COM / ZAPIER "CUSTOM WEBHOOK" URL BELOW <<<
// (or, better, set VITE_COURIER_WEBHOOK_URL in .env.local / Vercel and leave
// this line untouched). While the value is not a real https:// URL the app
// simply skips the webhook call, so registration keeps working.
const COURIER_WEBHOOK_URL = import.meta.env.VITE_COURIER_WEBHOOK_URL || "PASTE_YOUR_WEBHOOK_URL_HERE";
// Recipient of the "new courier" admin email — your scenario's email module
// can map this field (`notify_email`) or you can hard-code the address there.
const ADMIN_NOTIFY_EMAIL = "mesirot.express@gmail.com";

// ---------------------------------------------------------------------------
// NEW ORDER WEBHOOK (Make.com) — SMS & e-mail alerts
// ---------------------------------------------------------------------------
// >>> PASTE YOUR MAKE.COM "CUSTOM WEBHOOK" URL FOR NEW ORDERS BELOW <<<
// (or set VITE_NEW_ORDER_WEBHOOK_URL in .env.local / Vercel). Until it is a
// real https:// URL the call is skipped and order creation is unaffected.
const NEW_ORDER_WEBHOOK_URL = import.meta.env.VITE_NEW_ORDER_WEBHOOK_URL || "PASTE_NEW_ORDER_WEBHOOK_URL_HERE";

// Fires after an order was SUCCESSFULLY created (cloud: after the DB insert
// succeeded; demo: right after it is added). Fire-and-forget form-encoded
// POST in no-cors mode (no preflight) — a webhook failure never affects the order.
async function notifyNewOrder(o) {
  if (!/^https:\/\//i.test(NEW_ORDER_WEBHOOK_URL)) {
    console.warn("New-order webhook skipped: set NEW_ORDER_WEBHOOK_URL (or VITE_NEW_ORDER_WEBHOOK_URL).");
    return false;
  }
  try {
    const docType = o.docType === "אחר" && o.customDocType ? o.customDocType : o.docType;
    const zone = zoneForCity(o.city);
    const price = calcClientPrice(o);
    const info = o.lawyerInfo || {};
    const address = `${o.street || ""} ${o.houseNumber || ""}${o.apartment ? "/" + o.apartment : ""}, ${o.city || ""}`.trim();
    const speedLabel = (SPEED_OPTIONS.find((x) => x.key === (o.speed || "standard")) || SPEED_OPTIONS[0]).label;
    const message = [
      ADMIN_NEW_ORDER_MSG,
      `מספר הזמנה: ${formatOrderNum(o.id)}`,
      `לקוח: ${o.submittedBy || ""}${info.firm ? " (" + info.firm + ")" : ""}`,
      `נמען: ${o.recipientName}`,
      `כתובת: ${address}`,
      `סוג מסמך: ${docType || ""}`,
      `מהירות: ${speedLabel}`,
      `מחיר ללקוח: ${formatILS(price.total)}`,
    ].join("\n");
    const body = new window.URLSearchParams({
      event: "new_order",
      notify_email: ADMIN_NOTIFY_EMAIL,
      created_at: new window.Date().toISOString(),
      order_id: String(o.id || ""),
      client_name: o.submittedBy || "",
      client_firm: info.firm || "",
      client_phone: info.phone || "",
      recipient_name: o.recipientName || "",
      recipient_phone: o.phone || "",
      city: o.city || "",
      region: o.region || "",
      address,
      pricing_zone: zone ? zoneLabelFor(o.city) : "",
      doc_type: docType || "",
      case_number: o.caseNumber || "",
      court: o.court || "",
      speed: speedLabel,
      urgent: o.urgent ? "yes" : "no",
      addons: [o.addons && o.addons.tracing ? "איתור כתובת" : "", o.addons && o.addons.printing ? "הדפסת מסמכים" : ""].filter(Boolean).join(", "),
      notes: o.notes || "",
      price_total: String(price.total),
      subject: ADMIN_NEW_ORDER_MSG,
      admin_message: ADMIN_NEW_ORDER_MSG,
      order_label: `${formatOrderNum(o.id)} — ${o.city || ""}`,
      message,
    });
    await window.fetch(NEW_ORDER_WEBHOOK_URL, { method: "POST", mode: "no-cors", body, keepalive: true });
    return true;
  } catch (e) {
    console.warn("New-order webhook failed (the order itself was saved):", e);
    return false;
  }
}

// Fires right after a SUCCESSFUL courier sign-up. Sent as a form-encoded POST
// in `no-cors` mode: a "simple request" that needs no CORS preflight, which
// both Make.com and Zapier parse into separate fields automatically. It is
// fire-and-forget — a webhook problem never blocks or fails the registration.
async function notifyAdminOfCourier(c) {
  if (!/^https:\/\//i.test(COURIER_WEBHOOK_URL)) {
    console.warn("Courier webhook skipped: set COURIER_WEBHOOK_URL (or VITE_COURIER_WEBHOOK_URL).");
    return false;
  }
  try {
    const summary = [
      "בקשת הצטרפות חדשה של שליח",
      `שם מלא: ${c.fullName}`,
      `טלפון: ${c.phone}`,
      `אימייל: ${c.email}`,
      `עיר מגורים: ${c.residenceCity}`,
      `אזור עבודה: ${c.region}`,
      `מספר רישיון: ${c.licenseNumber}`,
      `סוג עוסק: ${c.businessType}`,
      `לאישור הבקשה: ${SITE_URL}/#couriers (התחברו כמנהל ← שליחים ← אישור)`,
    ].join("\n");
    const body = new window.URLSearchParams({
      event: "courier_registration",
      notify_email: ADMIN_NOTIFY_EMAIL,
      submitted_at: new window.Date().toISOString(),
      full_name: c.fullName,
      phone: c.phone,
      email: c.email,
      residence_city: c.residenceCity,
      region: c.region,
      license_number: c.licenseNumber,
      business_type: c.businessType,
      approval_link: `${SITE_URL}/#couriers`,
      subject: `בקשת הצטרפות שליח חדש: ${c.fullName}`,
      message: summary,
    });
    await window.fetch(COURIER_WEBHOOK_URL, { method: "POST", mode: "no-cors", body, keepalive: true });
    return true;
  } catch (e) {
    console.warn("Courier webhook failed (registration itself succeeded):", e);
    return false;
  }
}

// Guaranteed external alert for the admin (works when the phone app is killed):
// the SAME Make webhook as the courier sign-up, event "new_order", with the
// deep link that opens the orange assignment banner.
async function notifyAdminNewOrder(o) {
  if (!/^https:\/\//i.test(COURIER_WEBHOOK_URL)) return false;
  // Don't alert twice when both webhook constants point at the same scenario.
  if (COURIER_WEBHOOK_URL === NEW_ORDER_WEBHOOK_URL) return false;
  try {
    const assignUrl = `${SITE_URL}/#assign=${o.id}`;
    const destination = `${o.street || ""} ${o.houseNumber || ""}, ${o.city || ""}`.trim();
    const body = new window.URLSearchParams({
      event: "new_order",
      notify_email: ADMIN_NOTIFY_EMAIL,
      subject: ADMIN_NEW_ORDER_MSG,
      admin_message: ADMIN_NEW_ORDER_MSG,
      assign_url: assignUrl,
      order_id: String(o.id || ""),
      client: o.submittedBy || "",
      recipient: o.recipientName || "",
      destination,
      city: o.city || "",
      region: o.region || "",
      doc_type: (o.docType === "אחר" && o.customDocType ? o.customDocType : o.docType) || "",
      urgent: o.urgent ? "yes" : "no",
      created_at: new window.Date().toISOString(),
      message: `${ADMIN_NEW_ORDER_MSG}\nלקוח: ${o.submittedBy || ""}\nנמען: ${o.recipientName || ""}\nיעד: ${destination}\nמס' הזמנה: ${formatOrderNum(o.id)}\nלשיבוץ שליח: ${assignUrl}`,
    });
    await window.fetch(COURIER_WEBHOOK_URL, { method: "POST", mode: "no-cors", body, keepalive: true });
    return true;
  } catch (e) {
    console.warn("Admin new-order alert failed (the order itself was saved):", e);
    return false;
  }
}

// Both new-order webhooks (client alert + admin alert) in one call.
function notifyNewOrderEverywhere(o) {
  notifyNewOrder(o);
  notifyAdminNewOrder(o);
}

// Admin blocked / restored a user: tell Make (same webhook as the courier
// sign-up). Make can route on `event` and e-mail both the admin
// (`notify_email`) and the user (`email`). Fire-and-forget like the others.
async function notifyUserBlockChange(c, blocked) {
  if (!/^https:\/\//i.test(COURIER_WEBHOOK_URL)) {
    console.warn("Courier webhook skipped: set COURIER_WEBHOOK_URL (or VITE_COURIER_WEBHOOK_URL).");
    return false;
  }
  try {
    const state = blocked ? "הושבת מפעילות על ידי המנהל" : "הוחזר לפעילות על ידי המנהל";
    const body = new window.URLSearchParams({
      event: blocked ? "user_blocked" : "user_restored",
      notify_email: ADMIN_NOTIFY_EMAIL,
      email: c.email || "",
      full_name: c.name || "",
      user_id: String(c.id || ""),
      blocked: blocked ? "yes" : "no",
      changed_at: new window.Date().toISOString(),
      subject: `${blocked ? "חשבון הושבת" : "חשבון הוחזר לפעילות"}: ${c.name || c.email}`,
      message: `החשבון של ${c.name || ""} (${c.email || ""}) ${state}.`,
    });
    await window.fetch(COURIER_WEBHOOK_URL, { method: "POST", mode: "no-cors", body, keepalive: true });
    return true;
  } catch (e) {
    console.warn("Block/restore webhook failed (the change itself was saved):", e);
    return false;
  }
}

// Supabase session + the matching profile row (which carries the role).
// Two registration paths, each with its own metadata payload; the database
// trigger `handle_new_user` turns that metadata into the right profile:
//   signUpLawyer  -> account_type "lawyer"  -> role lawyer (active at once)
//   signUpCourier -> account_type "courier" -> role courier, approval "pending"
function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(CLOUD_ENABLED);
  const [profileError, setProfileError] = useState("");
  // True while the user arrived from a password-reset email and must choose a new password.
  const [recovery, setRecovery] = useState(URL_AUTH_INTENT.recovery);
  // "verified" = just verified the e-mail (green banner); "pending" = an unapproved
  // courier tried to get in. Both are shown on the login screen.
  const [authNotice, setAuthNotice] = useState("");
  const verifiedRef = useRef(URL_AUTH_INTENT.verified);
  const userId = session && session.user ? session.user.id : null;

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Keyed on the user id (not the session object) so token refreshes never
  // reload the profile or re-initialise the whole app.
  useEffect(() => {
    if (!supabase) return undefined;
    if (!userId) {
      setProfile(null);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setProfileError("");
    (async () => {
      // The profile row is created by a database trigger at sign-up; give it
      // a moment if the very first read races it.
      for (let i = 0; i < 4; i += 1) {
        const { data, error } = await supabase.from("profiles").select("*").eq("auth_id", userId).maybeSingle();
        if (!alive) return;
        if (error) {
          setProfileError(error.message);
          break;
        }
        if (data) {
          // A courier may not enter until the admin approves — not even right
          // after verifying the e-mail (that link creates a live session).
          // Drop the session at once and explain on the login screen.
          if (data.blocked) {
            setAuthNotice("blocked");
            verifiedRef.current = false;
            setProfile(null);
            setLoading(false);
            await supabase.auth.signOut();
            return;
          }
          if (data.role === "courier" && data.approval_status === "pending") {
            setAuthNotice(verifiedRef.current ? "verified" : "pending");
            verifiedRef.current = false;
            setProfile(null);
            setLoading(false);
            await supabase.auth.signOut();
            return;
          }
          verifiedRef.current = false;
          setProfile(data);
          setLoading(false);
          return;
        }
        await sleep(700);
      }
      if (alive) {
        setProfileError((e) => e || "לא נמצא פרופיל משתמש. פנו למנהל המערכת.");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // A user blocked WHILE signed in is signed out immediately: Realtime pushes
  // the profile change, and we re-check whenever the tab becomes visible again.
  const hasProfile = !!profile;
  useEffect(() => {
    if (!supabase || !userId || !hasProfile) return undefined;
    const kick = () => {
      setAuthNotice("blocked");
      setProfile(null);
      supabase.auth.signOut();
    };
    const check = async () => {
      const { data } = await supabase.from("profiles").select("blocked").eq("auth_id", userId).maybeSingle();
      if (data && data.blocked) kick();
    };
    const channel = supabase
      .channel(`self-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `auth_id=eq.${userId}` },
        (payload) => {
          if (payload.new && payload.new.blocked) kick();
        }
      )
      .subscribe();
    const onVisible = () => {
      if (window.document.visibilityState === "visible") check();
    };
    window.document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      window.document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, hasProfile]);

  // Re-reads the profile (used by a courier waiting for admin approval).
  const refreshProfile = async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("profiles").select("*").eq("auth_id", userId).maybeSingle();
    if (data) setProfile(data);
  };

  // Password login. Besides the credentials it checks the courier approval
  // status: an unapproved courier is signed straight back out.
  const signIn = async (email, password, stay = false) => {
    writeStayLoggedIn(stay); // choose the session store BEFORE the token is written
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return error.message;
    const { data: p } = await supabase
      .from("profiles")
      .select("role, approval_status, blocked")
      .eq("auth_id", data.user.id)
      .maybeSingle();
    if (p && p.blocked) {
      await supabase.auth.signOut();
      return BLOCKED_MSG;
    }
    if (p && p.role === "courier" && p.approval_status === "pending") {
      await supabase.auth.signOut();
      return COURIER_PENDING_MSG;
    }
    return "";
  };

  // Shared sign-up call. `metadata` is the role-specific payload.
  // Returns { error } or { needsConfirm } (true = a verification email was sent).
  const register = async (email, password, metadata) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: metadata, emailRedirectTo: SITE_URL },
    });
    if (error) return { error: error.message };
    // With "Confirm email" on, Supabase answers an already-registered address
    // with a user that has no identities instead of an error.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "כתובת האימייל כבר רשומה במערכת. נסו להתחבר." };
    }
    return { needsConfirm: !data.session };
  };

  // Law firm / company: only name + credentials.
  const signUpLawyer = ({ email, password, fullName, referredBy, refDeviceMatch }) =>
    register(email, password, {
      account_type: "lawyer",
      full_name: fullName.trim(),
      // Marketing channel (?src=…) is recorded only at account creation.
      ...(readSignupSource() ? { signup_source: readSignupSource() } : {}),
      // Referral data is accepted only here, at account creation (never later).
      ...(referredBy && verifyReferralCode(referredBy).ok
        ? { referred_by: verifyReferralCode(referredBy).code, ref_device_match: !!refDeviceMatch }
        : {}),
    });

  // Courier: full onboarding payload. On success the admin is notified via the webhook.
  const signUpCourier = async (f) => {
    const res = await register(f.email, f.password, {
      account_type: "courier",
      full_name: f.fullName.trim(),
      phone: f.phone.trim(),
      residence_city: f.residenceCity.trim(),
      region: f.region,
      license_number: f.licenseNumber.trim(),
      business_type: f.businessType,
    });
    if (!res.error) {
      await notifyAdminOfCourier({
        fullName: f.fullName.trim(),
        phone: f.phone.trim(),
        email: f.email.trim().toLowerCase(),
        residenceCity: f.residenceCity.trim(),
        region: f.region,
        licenseNumber: f.licenseNumber.trim(),
        businessType: f.businessType,
      });
    }
    return res;
  };

  // "Forgot password": Supabase emails a secure one-time link (template:
  // "Reset Password"). The link signs the user in and the app then shows the
  // new-password screen (event PASSWORD_RECOVERY).
  const requestPasswordReset = async (email) => {
    // Success is reported only when Supabase accepted the request; every failure (including a network
    // error) is returned so the screen never claims an e-mail was sent when the request failed.
    const addr = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return "invalid email";
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: SITE_URL });
      return error ? error.message || "reset failed" : "";
    } catch (e) {
      return (e && e.message) || "Failed to fetch";
    }
  };

  const updatePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    setRecovery(false);
    // Drop the recovery token from the address bar.
    window.history.replaceState(null, "", window.location.pathname);
    return "";
  };

  // Secure logout: end the Supabase session, drop the in-memory profile (the
  // whole AppShell unmounts with it), wipe any stored auth token and the deep
  // link, and clean the address bar. Other open tabs of this browser are signed
  // out too (supabase-js syncs the SIGNED_OUT event). Nothing in the URL can
  // log anyone in again — a session exists only as a token in the browser.
  const signOut = async () => {
    setProfile(null);
    setAuthNotice("");
    try {
      await supabase.auth.signOut();
    } catch (e) {
      /* the local cleanup below still runs */
    }
    try {
      wipeAuthTokens(window.localStorage);
      wipeAuthTokens(window.sessionStorage);
      writeStayLoggedIn(false); // the next login starts from the safe default
      window.sessionStorage.removeItem("pendingAssign");
    } catch (e) {
      /* storage unavailable */
    }
    window.history.replaceState(null, "", window.location.pathname);
  };

  return { session, loading, profile, profileError, authNotice, clearAuthNotice: () => setAuthNotice(""), recovery, requestPasswordReset, updatePassword, signIn, signUpLawyer, signUpCourier, refreshProfile, signOut };
}

// Loads everything the signed-in role is allowed to see, keeps it live via
// Realtime, and persists every change made through the app's order setter.
//
// Writes are funnelled through ONE serial queue so a visit report, the order
// update and a later signature can never overtake each other, and Realtime
// refreshes are deferred while writes are still in flight so a half-saved
// change is never overwritten by stale data.
function useCloudStore(profile, setters) {
  const profileId = profile ? profile.id : null;
  const [ready, setReady] = useState(!profile);
  const [error, setError] = useState("");
  // Evidence uploads that failed (reported by uploadEvidence) — shown as a banner.
  const [evidenceIssue, setEvidenceIssue] = useState(null);
  const [evidenceOk, setEvidenceOk] = useState(false);
  const issueSeqRef = useRef(0);
  useEffect(() => {
    const onIssue = (issue) => {
      issueSeqRef.current += 1;
      setEvidenceOk(false);
      setEvidenceIssue((cur) => {
        const base = cur || { none: 0, inline: 0, orderIds: [] };
        return {
          none: base.none + (issue.saved === "none" ? 1 : 0),
          inline: base.inline + (issue.saved === "inline" ? 1 : 0),
          orderIds: base.orderIds.includes(issue.orderId) ? base.orderIds : [...base.orderIds, issue.orderId],
        };
      });
    };
    evidenceIssueListeners.add(onIssue);
    return () => evidenceIssueListeners.delete(onIssue);
  }, []);
  const settersRef = useRef(setters);
  settersRef.current = setters;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const pendingRef = useRef(0);
  const dirtyRef = useRef(false);
  const queueRef = useRef(Promise.resolve());
  const payrollWrittenRef = useRef(new window.Map());
  const payrollKeysRef = useRef(new window.Set());

  // Closing / reloading while uploads are still running would lose them.
  useEffect(() => {
    const warn = (e) => {
      if (pendingRef.current > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const api = useMemo(() => {
    const refreshOrders = async () => {
      if (!profileRef.current) return;
      if (pendingRef.current > 0) {
        dirtyRef.current = true;
        return;
      }
      try {
        settersRef.current.replaceOrders(await cloudFetchOrders());
      } catch (e) {
        setError(e.message || String(e));
      }
    };
    const refreshNotifications = async () => {
      if (!profileRef.current) return;
      try {
        settersRef.current.setNotifications(await cloudFetchNotifications(profileRef.current));
      } catch (e) {
        setError(e.message || String(e));
      }
    };
    const refreshResponses = async () => {
      if (!profileRef.current) return;
      try {
        settersRef.current.setResponses(await cloudFetchResponses());
      } catch (e) {
        setError(e.message || String(e));
      }
    };
    const refreshLawyers = async () => {
      if (!profileRef.current || profileRef.current.role !== "admin") return;
      try {
        settersRef.current.setLawyers(await cloudFetchLawyers());
      } catch (e) {
        setError(e.message || String(e));
      }
    };
    const refreshCouriers = async () => {
      if (!profileRef.current || profileRef.current.role !== "admin") return;
      try {
        settersRef.current.setCouriers(await cloudFetchCouriers());
      } catch (e) {
        setError(e.message || String(e));
      }
    };
    const refreshSettings = async () => {
      if (!profileRef.current) return;
      try {
        const st = await cloudFetchSettings();
        if (st.pricing) settersRef.current.setPricing(st.pricing);
        settersRef.current.setPayments(st.payments);
        settersRef.current.setAdjustments(st.adjustments);
        if (st.referrals && settersRef.current.setReferralLedger) settersRef.current.setReferralLedger(st.referrals);
        st.payrollKeys.forEach((k) => payrollKeysRef.current.add(k));
      } catch (e) {
        setError(e.message || String(e));
      }
    };

    // Serial write queue.
    const enqueue = (job) => {
      pendingRef.current += 1;
      queueRef.current = queueRef.current
        .then(job)
        .catch((e) => {
          console.error(e);
          setError(e.message || String(e));
          dirtyRef.current = true; // re-sync so the UI shows what was really saved
        })
        .finally(() => {
          pendingRef.current -= 1;
          if (pendingRef.current === 0 && dirtyRef.current) {
            dirtyRef.current = false;
            refreshOrders();
          }
        });
    };

    // Compares the previous and next order lists and saves what changed:
    //   new order      -> INSERT
    //   changed order  -> INSERT the new visits (media uploaded first), then UPDATE the order row
    const persistOrders = (prev, next) => {
      const prevMap = new window.Map(prev.map((o) => [o.id, o]));
      const changed = next.filter((o) => prevMap.get(o.id) !== o);
      if (!changed.length) return;
      enqueue(async () => {
        for (const o of changed) {
          const p = prevMap.get(o.id);
          if (!p) {
            const { error: e } = await supabase.from("orders").insert(await orderToRow(o));
            if (e) throw e;
            notifyNewOrderEverywhere(o); // only after a successful insert
            continue;
          }
          // Terminal status FIRST (a tiny write, no uploads): even if the courier
          // refreshes while photos / audio are still uploading, the order is
          // already out of the active list after the reload.
          if (o.status !== p.status) {
            const { error: e0 } = await supabase.from("orders").update({ status: o.status }).eq("id", o.id);
            if (e0) throw e0;
          }
          for (let i = p.attempts.length; i < o.attempts.length; i += 1) {
            // The courier who records the visit is the one who performed it (an admin-side write falls back to the order's courier).
            const performerId = profileRef.current.role === "courier" ? profileRef.current.id : o.courierId || profileRef.current.id;
            const row = await visitToRow(o, o.attempts[i], i + 1, performerId);
            const { error: e } = await supabase.from("visits").insert(row);
            if (e && e.code !== "23505") throw e; // 23505 = already saved (retry)
          }
          const row = await orderToRow(o);
          const { data, error: e } = await supabase
            .from("orders")
            .update({ status: row.status, city: row.city, courier_id: row.courier_id, data: row.data })
            .eq("id", o.id)
            .select("id");
          if (e) throw e;
          if (!data || !data.length) throw new Error("אין הרשאה לעדכן את ההזמנה " + o.id);
        }
      });
    };

    // Retry the uploads of orders that still hold media on this device. It only
    // re-sends the media and rewrites orders.data (the visit rows are immutable);
    // returns how many orders were queued — 0 means nothing is left on this device
    // (e.g. the page was reloaded) and the evidence has to be captured again.
    const retryEvidence = (ordersNow, onlyIds) => {
      const ids = new window.Set((onlyIds || []).map(String));
      const pend = (ordersNow || []).filter((o) => orderHasUnsentMedia(o) && (!ids.size || ids.has(String(o.id))));
      if (!pend.length) return 0;
      uploadFailCache.clear();
      setEvidenceIssue(null);
      setEvidenceOk(false);
      const seq = issueSeqRef.current;
      enqueue(async () => {
        for (const o of pend) {
          const row = await orderToRow(o);
          const { data, error: e } = await supabase.from("orders").update({ data: row.data }).eq("id", o.id).select("id");
          if (e) throw e;
          if (!data || !data.length) throw new Error("אין הרשאה לעדכן את ההזמנה " + o.id);
        }
        if (issueSeqRef.current === seq) setEvidenceOk(true);
      });
      return pend.length;
    };

    // Lawyer/admin cancellation. Goes through a SECURITY DEFINER RPC that
    // re-checks on the server that no courier is assigned.
    const cancelOrder = async (id) => {
      const { error: e } = await supabase.rpc("cancel_order", { p_order_id: id });
      if (e) {
        setError(e.message || String(e));
        dirtyRef.current = true;
        refreshOrders(); // roll the UI back to what the DB really holds
        return false;
      }
      return true;
    };

    // Upgrade 3 — the owning lawyer's verification (license, date, signature,
    // stamp). Lawyers cannot UPDATE orders (RLS), so it goes through the
    // optional SECURITY DEFINER RPC in supabase/lawyer-actions.sql; admin may
    // write the row directly. If neither is possible the verification is kept
    // on this device only and the user is told.
    const saveLawyerVerification = async (id, f) => {
      const fields = {
        ...f,
        lawyerSignature: (await uploadEvidence(`${id}/lawyer-signature`, f.lawyerSignature)) || f.lawyerSignature,
        lawyerStamp: (await uploadEvidence(`${id}/lawyer-stamp`, f.lawyerStamp)) || f.lawyerStamp,
      };
      const { error: e } = await supabase.rpc("lawyer_save_verification", { p_order_id: id, p_fields: fields });
      if (!e) return { ok: true };
      if (profileRef.current && profileRef.current.role === "admin") {
        const { data: cur } = await supabase.from("orders").select("data").eq("id", id).maybeSingle();
        const { error: e2 } = await supabase
          .from("orders")
          .update({ data: { ...((cur && cur.data) || {}), ...fields } })
          .eq("id", id);
        if (!e2) return { ok: true };
      }
      rememberLawyerVerification(id, f);
      setError("אימות עורך הדין נשמר במכשיר זה בלבד. כדי לשמור אותו בשרת יש להריץ פעם אחת את supabase/lawyer-actions.sql ב-Supabase.");
      return { ok: false };
    };

    // Upgrade 2 — permanent delete of a cancelled order. Visits first, then the
    // order (visits also cascade). RLS allows this for admin only, so for a
    // lawyer the direct delete removes 0 rows; we then try the optional
    // SECURITY DEFINER RPC (supabase/lawyer-actions.sql). Returns
    // { ok, hiddenOnly }: hiddenOnly = could not delete in the database, the
    // order was only hidden for this user.
    const deleteOrder = async (id) => {
      const role = profileRef.current && profileRef.current.role;
      await supabase.from("visits").delete().eq("order_id", id);
      const { data, error: e } = await supabase.from("orders").delete().eq("id", id).select("id");
      if (!e && data && data.length) return { ok: true };
      if (role === "admin") {
        if (e) setError(e.message || String(e));
        dirtyRef.current = true;
        refreshOrders();
        return { ok: false };
      }
      const { error: e2 } = await supabase.rpc("lawyer_delete_cancelled_order", { p_order_id: id });
      if (!e2) return { ok: true };
      return { ok: false, hiddenOnly: true };
    };

    // Admin: block / restore a user. The SQL function updates the row by id AND
    // by e-mail (so a pre-registered twin of the same address is covered).
    const setUserBlocked = async (userId, blocked) => {
      const { error: e } = await supabase.rpc("set_user_blocked", { p_user_id: userId, p_blocked: blocked });
      if (e) setError(e.message || String(e));
      // Background re-sync (the UI was already updated optimistically).
      setTimeout(() => {
        refreshCouriers();
        refreshLawyers();
      }, 0);
    };

    // Next clean order number (ORD-1001 …) from the database sequence.
    const nextOrderId = async () => {
      const { data, error: e } = await supabase.rpc("next_order_id");
      if (e || !data) {
        setError((e && e.message) || "לא ניתן להפיק מספר הזמנה");
        return null;
      }
      // The sequence is global (a lawyer only sees their own orders, so a
      // client-side "max + 1" could collide) — only the legacy "ORD-" prefix
      // is dropped, giving strictly consecutive plain numbers.
      return orderNumberOf(data);
    };

    // A courier's own "take" / "decline" on an open order. The row's primary
    // key is (order, courier), so a second click flips the existing row.
    const respondToOrder = async (orderId, action, exists) => {
      const me = profileRef.current.id;
      const update = () =>
        supabase.from("order_responses").update({ action }).eq("order_id", orderId).eq("courier_id", me);
      let res = exists
        ? await update()
        : await supabase.from("order_responses").insert({ order_id: orderId, courier_id: me, action });
      if (res.error && res.error.code === "23505") res = await update(); // already answered elsewhere
      if (res.error) {
        setError(res.error.message || String(res.error));
        refreshResponses(); // show what was really saved
      }
    };

    const acknowledgeResponse = async (orderId) => {
      const { error: e } = await supabase
        .from("order_responses")
        .update({ acknowledged: true })
        .eq("order_id", orderId)
        .eq("courier_id", profileRef.current.id);
      if (e) setError(e.message);
    };

    const markNotificationRead = async (id) => {
      const { error: e } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (e) setError(e.message);
    };

    const saveSetting = async (key, value) => {
      const { error: e } = await supabase.from("settings").upsert({ key, value, updated_at: new window.Date().toISOString() });
      if (e) setError(e.message);
    };

    // Admin only: one payroll document per courier.
    const savePayroll = async (payments, adjustments, couriers) => {
      const idByName = new window.Map(couriers.map((c) => [c.name, c.id]));
      const docs = new window.Map();
      const docFor = (name) => {
        const id = idByName.get(name);
        if (!id) return null;
        if (!docs.has(id)) docs.set(id, { courierName: name, payments: {}, adjustments: [] });
        return docs.get(id);
      };
      Object.entries(payments).forEach(([k, status]) => {
        const [name, monthKey] = k.split("__");
        const d = docFor(name);
        if (d) d.payments[monthKey] = status;
      });
      adjustments.forEach((a) => {
        const d = docFor(a.courier);
        if (d) d.adjustments.push(a);
      });
      // Couriers whose data was all removed still get an (empty) document.
      payrollKeysRef.current.forEach((k) => {
        const id = k.slice("payroll:".length);
        if (!docs.has(id)) {
          const c = couriers.find((x) => x.id === id);
          docs.set(id, { courierName: c ? c.name : "", payments: {}, adjustments: [] });
        }
      });
      for (const [id, value] of docs) {
        const key = `payroll:${id}`;
        const json = JSON.stringify(value);
        if (payrollWrittenRef.current.get(key) === json) continue;
        const { error: e } = await supabase.from("settings").upsert({ key, value, updated_at: new window.Date().toISOString() });
        if (e) {
          setError(e.message);
          return;
        }
        payrollWrittenRef.current.set(key, json);
        payrollKeysRef.current.add(key);
      }
    };

    const approveCourier = async (id) => {
      const { error: e } = await supabase.from("profiles").update({ approval_status: "approved" }).eq("id", id);
      if (e) setError(e.message);
      else refreshCouriers();
    };

    const registerCourier = async (form) => {
      const { error: e } = await supabase.from("profiles").insert({
        role: "courier",
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        residence_city: form.residenceCity.trim(),
        address: form.address.trim(),
        region: form.region,
        license_number: form.licenseNumber.trim(),
        business_type: form.businessType,
      });
      if (e) setError(e.message);
      else refreshCouriers();
    };

    return {
      refreshOrders,
      refreshNotifications,
      refreshCouriers,
      refreshSettings,
      persistOrders,
      retryEvidence,
      cancelOrder,
      deleteOrder,
      saveLawyerVerification,
      setUserBlocked,
      nextOrderId,
      refreshLawyers,
      refreshResponses,
      respondToOrder,
      acknowledgeResponse,
      markNotificationRead,
      saveSetting,
      savePayroll,
      registerCourier,
      approveCourier,
    };
  }, []);

  // Initial load + Realtime subscriptions for every table.
  useEffect(() => {
    if (!profileId) return undefined;
    let alive = true;
    setReady(false);
    (async () => {
      await Promise.all([
        api.refreshOrders(),
        api.refreshNotifications(),
        api.refreshCouriers(),
        api.refreshLawyers(),
        api.refreshSettings(),
        api.refreshResponses(),
      ]);
      if (alive) setReady(true);
    })();

    const timers = {};
    const later = (key, fn) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(fn, 250);
    };
    const channel = supabase
      .channel(`sync-${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => later("o", api.refreshOrders))
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => later("o", api.refreshOrders))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        later("n", api.refreshNotifications)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "order_responses" }, () =>
        later("r", api.refreshResponses)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        later("p", api.refreshCouriers);
        later("l", api.refreshLawyers);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => later("s", api.refreshSettings))
      .subscribe();
    return () => {
      alive = false;
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [profileId, api]);

  return {
    ready,
    error,
    clearError: () => setError(""),
    evidenceIssue,
    evidenceOk,
    clearEvidenceIssue: () => {
      setEvidenceIssue(null);
      setEvidenceOk(false);
    },
    ...api,
  };
}

// Visible warning when evidence files could not be uploaded (never silent).
// "Retry" re-sends whatever is still held on this device.
function EvidenceIssueBanner({ issue, ok, canRetry, onRetry, onClose }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!ok) return undefined;
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps
  if (ok && !issue) {
    return (
      <div role="status" className="mx-auto mt-3 flex max-w-5xl items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
        <Check className="h-4 w-4 shrink-0" />
        <span className="flex-1">הקבצים נשלחו מחדש ונשמרו בשרת.</span>
        <button type="button" onClick={onClose} aria-label="סגירה"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  if (!issue) return null;
  const lost = issue.none > 0;
  return (
    <div
      role="alert"
      className={`mx-auto mt-3 flex max-w-5xl items-start gap-2 rounded-2xl px-4 py-2.5 text-xs font-medium ring-1 ring-inset ${
        lost ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-amber-50 text-amber-900 ring-amber-200"
      }`}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        {lost ? (
          <p>
            <strong>לא כל הראיות נשמרו בשרת:</strong> {issue.none} קבצים (הקלטה / וידאו / תמונה) לא הועלו ולא נשמרו. אל תסגרו ואל תרעננו את האפליקציה — לחצו
            "נסה שוב". קובץ שלא הועלה לא יופיע בתיק ובתצהיר.
          </p>
        ) : (
          <p>
            <strong>העלאה לשרת נכשלה:</strong> {issue.inline} תמונות / חתימות נשמרו כעותק מכווץ בתוך ההזמנה (לא נאבדו). מומלץ לנסות שוב כשיש קליטה טובה.
          </p>
        )}
        {issue.none > 0 && issue.inline > 0 && <p className="mt-0.5">בנוסף, {issue.inline} תמונות / חתימות נשמרו כעותק מכווץ בתוך ההזמנה.</p>}
        {note && <p className="mt-1 font-semibold">{note}</p>}
        {canRetry && (
          <button
            type="button"
            onClick={() => {
              const n = onRetry();
              setNote(n ? "" : "לא נמצאו קבצים שמורים במכשיר לשליחה מחדש (ייתכן שהדף נטען מחדש). יש לצלם / להקליט מחדש.");
            }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 font-bold ring-1 ring-inset ring-current hover:bg-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> נסה שוב
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="סגירה"><X className="h-4 w-4" /></button>
    </div>
  );
}

// Shown after the user clicks the link in the password-reset email.
function ResetPasswordScreen({ onUpdate, onSignOut }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return setError("הסיסמה קצרה מדי (לפחות 6 תווים).");
    if (pw !== pw2) return setError("הסיסמאות אינן תואמות.");
    setBusy(true);
    setError("");
    const err = await onUpdate(pw);
    if (err) setError(friendlyAuthError(err));
    setBusy(false);
  };
  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }} className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-extrabold text-indigo-700">בחירת סיסמה חדשה</p>
            <p className="text-xs text-slate-400">משלוחים משפטיים</p>
          </div>
        </div>
        <div className="space-y-3">
          <Field label="סיסמה חדשה" required>
            <input type="password" dir="ltr" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="אימות סיסמה" required>
            <input type="password" dir="ltr" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
          </Field>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy && <RefreshCw className="h-4 w-4 animate-spin" />} עדכון סיסמה
        </button>
        <button type="button" onClick={onSignOut} className="mt-3 w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600">
          ביטול
        </button>
      </form>
    </div>
  );
}

function FullScreenLoader({ text = "טוען..." }) {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f8f9fa]" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <RefreshCw className="h-4 w-4 animate-spin" /> {text}
      </div>
    </div>
  );
}

const BLOCKED_MSG = "החשבון הושבת מפעילות על ידי המנהל";
const COURIER_PENDING_MSG = "החשבון ממתין לאישור מנהל. תוכלו להתחבר לאחר שהבקשה תאושר.";

// Turns raw Supabase auth errors into Hebrew messages.
function friendlyAuthError(msg) {
  if (/invalid login/i.test(msg)) return "אימייל או סיסמה שגויים";
  if (/email not confirmed/i.test(msg)) return "האימייל טרם אומת. בדקו את תיבת הדואר שלכם ולחצו על קישור האימות.";
  if (/already registered/i.test(msg)) return "כתובת האימייל כבר רשומה במערכת. נסו להתחבר.";
  if (/at least \d+ characters/i.test(msg)) return "הסיסמה קצרה מדי (לפחות 6 תווים).";
  if (/same password|different from the old/i.test(msg)) return "הסיסמה החדשה חייבת להיות שונה מהקודמת.";
  if (/rate limit|too many/i.test(msg)) return "בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.";
  if (/security purposes|only request this after/i.test(msg)) return "נשלחה בקשה לפני רגע. המתינו כדקה ונסו שוב.";
  if (/invalid email|unable to validate email/i.test(msg)) return "כתובת האימייל אינה תקינה.";
  if (/sending (recovery|confirmation|magic link|email)|error sending|smtp/i.test(msg))
    return "שליחת המייל נכשלה — שירות הדוא\"ל של המערכת אינו זמין או אינו מוגדר כראוי. לא נשלח מייל. נסו שוב מאוחר יותר או פנו למנהל המערכת.";
  if (/failed to fetch|network|fetch/i.test(msg)) return "אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב. לא נשלח מייל.";
  return msg;
}

const EMPTY_LAWYER_FORM = { fullName: "", email: "", password: "" };
const EMPTY_COURIER_FORM = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  residenceCity: "",
  region: REGIONS[0],
  licenseNumber: "",
  businessType: BUSINESS_TYPES[0],
};

// Sign-in plus two SEPARATE registration experiences, each with its own form
// state so a lawyer never sees courier fields (and vice versa):
//   mode "in"      sign-in (+ entry points to the two registrations)
//   mode "lawyer"  law firm / company: name, email, password
//   mode "courier" courier join request: name, phone, city, region, license, business type
//   mode "sent"    "check your inbox to verify your email" confirmation
function LoginScreen({ onSignIn, onSignUpLawyer, onSignUpCourier, onResetPassword, profileError, notice = "", onClearNotice }) {
  // An invitation link (?ref=REF-…) opens the sign-up form and is remembered.
  const [refCode] = useState(() => captureReferralFromUrl());
  const [refInput, setRefInput] = useState(refCode);
  const [mode, setMode] = useState(() =>
    typeof window !== "undefined" && (window.location.pathname === "/register" || /[?&]ref=/.test(window.location.search))
      ? "lawyer"
      : "in"
  );
  const [login, setLogin] = useState({ email: "", password: "" });
  const [lawyer, setLawyer] = useState(EMPTY_LAWYER_FORM);
  const [courier, setCourier] = useState(EMPTY_COURIER_FORM);
  const [sent, setSent] = useState({ kind: "lawyer", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stay, setStay] = useState(false); // unticked by default: session-only

  const goto = (next) => {
    setMode(next);
    setError("");
  };
  const setField = (setter) => (key) => (e) => setter((f) => ({ ...f, [key]: e.target.value }));
  const setLoginField = setField(setLogin);
  const setLawyerField = setField(setLawyer);
  const setCourierField = setField(setCourier);

  const submitLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (onClearNotice) onClearNotice();
    const err = await onSignIn(login.email, login.password, stay);
    if (err) setError(friendlyAuthError(err));
    setBusy(false);
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const err = await onResetPassword(login.email);
    if (err) setError(friendlyAuthError(err));
    else setMode("forgotSent");
    setBusy(false);
  };

  const submitLawyer = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Layer A (client side): a typed / pasted code must pass the checksum.
    const rawRef = refInput.trim();
    const vr = verifyReferralCode(rawRef);
    if (rawRef && !vr.ok) {
      setError("קוד ההפניה אינו תקין. בדקו שהעתקתם אותו במלואו, או השאירו את השדה ריק.");
      setBusy(false);
      return;
    }
    const res = await onSignUpLawyer({ ...lawyer, referredBy: vr.ok ? vr.code : "", refDeviceMatch: vr.ok && deviceHasReferrer(vr.code) });
    if (res.error) setError(friendlyAuthError(res.error));
    else if (res.needsConfirm) {
      setSent({ kind: "lawyer", email: lawyer.email.trim() });
      setLawyer(EMPTY_LAWYER_FORM);
      setMode("sent");
    }
    setBusy(false);
  };

  const submitCourier = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await onSignUpCourier(courier);
    if (res.error) setError(friendlyAuthError(res.error));
    else if (res.needsConfirm) {
      setSent({ kind: "courier", email: courier.email.trim() });
      setCourier(EMPTY_COURIER_FORM);
      setMode("sent");
    }
    setBusy(false);
  };

  const titles = {
    in: { title: "התחברות למערכת", sub: "מסירות משפטיות", icon: Gavel },
    lawyer: { title: "פתיחת חשבון", sub: "משרד עורכי דין / חברה", icon: Briefcase },
    courier: { title: "בקשת הצטרפות לשליחים", sub: "מלאו את הפרטים ונחזור אליכם לאחר אישור", icon: Truck },
    sent: { title: "בדקו את תיבת הדואר", sub: "נשלח אליכם מייל אימות", icon: Mail },
    forgot: { title: "שכחתי סיסמה", sub: "נשלח אליכם קישור מאובטח לאיפוס", icon: Lock },
    forgotSent: { title: "בדקו את תיבת הדואר", sub: "נשלח קישור לאיפוס סיסמה", icon: Mail },
  };
  const head = titles[mode];
  const HeadIcon = head.icon;
  const errorBox = (error || (mode === "in" && profileError)) && (
    <p
      role="alert"
      className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
    >
      {error || profileError}
    </p>
  );
  const submitBtn = (label) => (
    <button
      type="submit"
      disabled={busy}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
  const backLink = (
    <button
      type="button"
      onClick={() => goto("in")}
      className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600"
    >
      <ArrowRight className="h-3.5 w-3.5" /> חזרה להתחברות
    </button>
  );

  return (
    <div
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
      className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-8"
    >
      <div
        className={`w-full rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm ${
          mode === "courier" ? "max-w-lg" : "max-w-sm"
        }`}
      >
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
            <HeadIcon className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-extrabold text-indigo-700">{head.title}</p>
            <p className="text-xs text-slate-400">{head.sub}</p>
          </div>
        </div>

        {/* ---------------- Sign in + the two registration entry points ---------------- */}
        {mode === "in" && notice === "verified" && (
          <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-center ring-1 ring-inset ring-green-300">
            <p className="flex items-center justify-center gap-2 text-base font-extrabold text-green-700">
              <CheckCircle2 className="h-5 w-5" /> האימות בוצע בהצלחה
            </p>
            <p className="mt-1 text-xs font-medium text-green-700">החשבון ממתין לאישור מנהל</p>
          </div>
        )}
        {mode === "in" && notice === "blocked" && !error && (
          <div role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            {BLOCKED_MSG}
          </div>
        )}
        {mode === "in" && notice === "pending" && !error && (
          <div role="status" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
            {COURIER_PENDING_MSG}
          </div>
        )}
        {mode === "in" && (
          <>
            <form onSubmit={submitLogin}>
              <div className="space-y-3">
                <Field label="אימייל" required>
                  <input
                    type="email"
                    dir="ltr"
                    className={inputCls}
                    value={login.email}
                    onChange={setLoginField("email")}
                    autoComplete="email"
                    required
                  />
                </Field>
                <Field label="סיסמה" required>
                  <PasswordInput
                    dir="ltr"
                    className={inputCls}
                    value={login.password}
                    onChange={setLoginField("password")}
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={stay}
                    onChange={(e) => setStay(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  הישאר מחובר
                </label>
              </div>
              {errorBox}
              {submitBtn("התחברות")}
              <button
                type="button"
                onClick={() => goto("forgot")}
                className="mt-3 w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
              >
                שכחתי סיסמה
              </button>
            </form>

            <button
              type="button"
              onClick={() => goto("lawyer")}
              className="mt-3 w-full text-center text-xs font-medium text-indigo-600 hover:underline"
            >
              משרד עורכי דין / חברה? פתיחת חשבון
            </button>

            <div className="my-4 flex items-center gap-3 text-[11px] text-slate-300">
              <span className="h-px flex-1 bg-slate-100" /> או <span className="h-px flex-1 bg-slate-100" />
            </div>

            <button
              type="button"
              onClick={() => goto("courier")}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Truck className="h-4 w-4" /> שליח חדש? הגשת בקשת הצטרפות
            </button>
          </>
        )}

        {/* ---------------- Forgot password ---------------- */}
        {mode === "forgot" && (
          <form onSubmit={submitForgot}>
            <Field label="אימייל החשבון" required>
              <input
                type="email"
                dir="ltr"
                className={inputCls}
                value={login.email}
                onChange={setLoginField("email")}
                autoComplete="email"
                required
              />
            </Field>
            {errorBox}
            {submitBtn("שליחת קישור לאיפוס סיסמה")}
            {backLink}
          </form>
        )}
        {mode === "forgotSent" && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              אם קיים חשבון עבור <strong dir="ltr">{login.email.trim()}</strong>, נשלח אליו כעת מייל עם קישור מאובטח לאיפוס הסיסמה.
            </p>
            <p className="text-xs text-slate-400">
              המייל עשוי להגיע בתוך מספר דקות. לא קיבלתם? בדקו בתיקיית הספאם, ודאו שהכתובת נכונה, או נסו שוב בעוד דקה. אם עדיין לא הגיע — פנו למנהל המערכת.
            </p>
            {backLink}
          </div>
        )}

        {/* ---------------- Law firm / company registration ---------------- */}
        {mode === "lawyer" && refCode && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            🎁 הוזמנתם על ידי חבר — ₪50 זיכוי למסירה הבאה, לאחר השלמת מסירה ראשונה ואישור הנהלה.
          </p>
        )}
        {mode === "lawyer" && (
          <form onSubmit={submitLawyer}>
            <div className="space-y-3">
              <Field label="שם מלא / שם המשרד או החברה" required>
                <input
                  className={inputCls}
                  value={lawyer.fullName}
                  onChange={setLawyerField("fullName")}
                  autoComplete="organization"
                  required
                />
              </Field>
              <Field label="אימייל" required>
                <input
                  type="email"
                  dir="ltr"
                  className={inputCls}
                  value={lawyer.email}
                  onChange={setLawyerField("email")}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="סיסמה (לפחות 6 תווים)" required>
                <input
                  type="password"
                  dir="ltr"
                  className={inputCls}
                  value={lawyer.password}
                  onChange={setLawyerField("password")}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </Field>
              <Field label="קוד הפניה (אם קיבלתם מחבר)">
                <input
                  dir="ltr"
                  className={inputCls}
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                  placeholder="REF-XXXXXXXX-XXXX"
                  autoComplete="off"
                  maxLength={20}
                />
              </Field>
            </div>
            {errorBox}
            {submitBtn("יצירת חשבון")}
            {backLink}
          </form>
        )}

        {/* ---------------- Courier join request ---------------- */}
        {mode === "courier" && (
          <form onSubmit={submitCourier}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="שם מלא" required>
                  <input
                    className={inputCls}
                    value={courier.fullName}
                    onChange={setCourierField("fullName")}
                    autoComplete="name"
                    required
                  />
                </Field>
              </div>
              <Field label="אימייל" required>
                <input
                  type="email"
                  dir="ltr"
                  className={inputCls}
                  value={courier.email}
                  onChange={setCourierField("email")}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="סיסמה (לפחות 6 תווים)" required>
                <input
                  type="password"
                  dir="ltr"
                  className={inputCls}
                  value={courier.password}
                  onChange={setCourierField("password")}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </Field>
              <Field label="טלפון נייד" required>
                <input
                  type="tel"
                  dir="ltr"
                  className={inputCls}
                  placeholder="050-1234567"
                  pattern="[0-9+\-\s]{9,15}"
                  title="מספר טלפון תקין, לדוגמה 050-1234567"
                  value={courier.phone}
                  onChange={setCourierField("phone")}
                  autoComplete="tel"
                  required
                />
              </Field>
              <Field label="עיר מגורים" required>
                <input
                  className={inputCls}
                  list="courier-cities"
                  value={courier.residenceCity}
                  onChange={setCourierField("residenceCity")}
                  required
                />
                <datalist id="courier-cities">
                  {CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="אזור עבודה" required>
                <div className="relative">
                  <select
                    className={inputCls + " appearance-none"}
                    value={courier.region}
                    onChange={setCourierField("region")}
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>
              <Field label="מספר רישיון" required>
                <input
                  className={inputCls}
                  dir="ltr"
                  value={courier.licenseNumber}
                  onChange={setCourierField("licenseNumber")}
                  required
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="סוג עוסק" required>
                  <div className="relative">
                    <select
                      className={inputCls + " appearance-none"}
                      value={courier.businessType}
                      onChange={setCourierField("businessType")}
                    >
                      {BUSINESS_TYPES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              לאחר ההגשה נשלח אליכם מייל לאימות הכתובת, ובקשתכם תועבר לאישור מנהל המערכת.
            </p>
            {errorBox}
            {submitBtn("הגשת בקשת הצטרפות")}
            {backLink}
          </form>
        )}

        {/* ---------------- "Check your inbox" confirmation ---------------- */}
        {mode === "sent" && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Mail className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">
              {sent.kind === "courier" ? "בקשת ההצטרפות התקבלה" : "החשבון נוצר בהצלחה"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              שלחנו הודעת אימות אל
              <br />
              <strong dir="ltr" className="text-slate-800">
                {sent.email}
              </strong>
              <br />
              <strong>יש לבדוק את תיבת הדואר הנכנס וללחוץ על קישור האימות</strong> כדי להפעיל את החשבון. אם ההודעה לא
              הגיעה — בדקו בתיקיית הספאם.
            </p>
            {sent.kind === "courier" && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                לאחר אימות האימייל הבקשה תיבדק על ידי מנהל המערכת. תקבלו גישה למשימות עם האישור.
              </p>
            )}
            {backLink}
          </div>
        )}
        {(mode === "in" || mode === "lawyer") && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <InstallAppButton className="w-full py-2.5 text-sm" />
          </div>
        )}
      </div>
    </div>
  );
}

// Shown to a courier whose join request has not been approved yet.
function PendingApprovalScreen({ profile, onRefresh, onSignOut }) {
  const [checking, setChecking] = useState(false);
  return (
    <div
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
      className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/60 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Hourglass className="h-7 w-7" />
        </div>
        <p className="mt-3 text-base font-bold text-slate-800">הבקשה ממתינה לאישור</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          שלום {profile.full_name}, בקשת ההצטרפות שלכם התקבלה וממתינה לאישור מנהל המערכת. נעדכן ברגע שתאושר, ואז ניתן יהיה
          לראות משימות.
        </p>
        <button
          type="button"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            await onRefresh();
            setChecking(false);
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> בדיקת סטטוס
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600"
        >
          <LogOut className="h-3.5 w-3.5" /> התנתקות
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   ROOT APP
   ========================================================================= */
// Public entry point: in cloud mode it gates the app behind sign-in and picks
// the view from the user's role; without Supabase keys it runs the demo.
// Demo mode (no Supabase, no login, all three portals open) is for local work
// only. A production build without the Supabase keys must NOT fall back to it.
const DEMO_ALLOWED = !!import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEMO === "true";
const KNOWN_ROLES = ["admin", "courier", "lawyer"];

// ---------------------------------------------------------------------------
// ACCESSIBILITY WIDGET (תקן ישראלי 5568 / WCAG 2.1 AA) — self-contained.
// Toggles classes on <html>; the CSS below is injected once. Prefs persist in
// localStorage (best effort). Rendered at the root, so it shows on every screen.
// ---------------------------------------------------------------------------
const A11Y_KEY = "mesirot-a11y";
const A11Y_DEFAULT = { text: 0, contrast: false, gray: false, links: false, motion: false };
const A11Y_CSS = `
html.a11y-t1{font-size:115%}
html.a11y-t2{font-size:130%}
html.a11y-gray{filter:grayscale(1)}
html.a11y-contrast body{background:#000!important;color:#fff!important}
html.a11y-contrast body *:not(#a11y-root):not(#a11y-root *){background-color:#000!important;color:#fff!important;border-color:#fff!important;box-shadow:none!important}
html.a11y-contrast body a{color:#ff0!important}
html.a11y-links a,html.a11y-links button,html.a11y-links [role="button"]{outline:3px solid #f59e0b!important;outline-offset:2px;text-decoration:underline!important}
html.a11y-motion *,html.a11y-motion *::before,html.a11y-motion *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
#a11y-root button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
`;

function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...A11Y_DEFAULT, ...JSON.parse(window.localStorage.getItem(A11Y_KEY) || "{}") };
    } catch (e) {
      return A11Y_DEFAULT;
    }
  });

  // Inject the stylesheet once.
  useEffect(() => {
    const doc = window.document;
    if (doc.getElementById("a11y-style")) return;
    const st = doc.createElement("style");
    st.id = "a11y-style";
    st.textContent = A11Y_CSS;
    doc.head.appendChild(st);
  }, []);

  // Apply + persist.
  useEffect(() => {
    const cl = window.document.documentElement.classList;
    cl.toggle("a11y-t1", prefs.text === 1);
    cl.toggle("a11y-t2", prefs.text === 2);
    cl.toggle("a11y-contrast", prefs.contrast);
    cl.toggle("a11y-gray", prefs.gray);
    cl.toggle("a11y-links", prefs.links);
    cl.toggle("a11y-motion", prefs.motion);
    try {
      window.localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
    } catch (e) {
      /* storage unavailable */
    }
  }, [prefs]);

  // Escape closes the menu (the statement modal handles its own Escape).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.document.addEventListener("keydown", onKey);
    return () => window.document.removeEventListener("keydown", onKey);
  }, [open]);

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const row = (active, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right text-sm font-medium ${
        active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-xs">{active ? "פעיל" : "כבוי"}</span>
    </button>
  );

  return (
    <div id="a11y-root" dir="rtl" className="fixed bottom-20 left-3 z-[60] sm:bottom-4">
      {open && (
        <div
          role="region"
          aria-label="תפריט נגישות"
          className="mb-2 w-64 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-indigo-700">נגישות</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="סגירת תפריט נגישות" className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={prefs.text === 1}
              onClick={() => set({ text: prefs.text === 1 ? 0 : 1 })}
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${prefs.text === 1 ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              טקסט +15%
            </button>
            <button
              type="button"
              aria-pressed={prefs.text === 2}
              onClick={() => set({ text: prefs.text === 2 ? 0 : 2 })}
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${prefs.text === 2 ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              טקסט +30%
            </button>
          </div>
          {row(prefs.contrast, "ניגודיות גבוהה", () => set({ contrast: !prefs.contrast }))}
          {row(prefs.gray, "גווני אפור", () => set({ gray: !prefs.gray }))}
          {row(prefs.links, "הדגשת קישורים וכפתורים", () => set({ links: !prefs.links }))}
          {row(prefs.motion, "עצירת אנימציות", () => set({ motion: !prefs.motion }))}
          <button type="button" onClick={() => setPrefs(A11Y_DEFAULT)} className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            איפוס הגדרות
          </button>
          <button
            type="button"
            onClick={() => {
              setStatement(true);
              setOpen(false);
            }}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          >
            הצהרת נגישות
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="תפריט נגישות"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg ring-2 ring-white hover:bg-indigo-700"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="4.5" r="1.8" />
          <path d="M5 8.5h14M12 8.5v5.5M12 14l-3.5 6M12 14l3.5 6" />
        </svg>
      </button>

      <Modal open={statement} onClose={() => setStatement(false)} title="הצהרת נגישות" wide>
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            אתר mesirot.express שואף להיות נגיש לכלל המשתמשים, לרבות אנשים עם מוגבלות, ופועל להתאמת השירות להוראות
            תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013, ולתקן הישראלי ת"י 5568 המבוסס על
            הנחיות WCAG 2.1 ברמה AA.
          </p>
          <p className="font-semibold">התאמות נגישות שבוצעו</p>
          <ul className="list-disc space-y-1 pr-5">
            <li>תפריט נגישות: הגדלת טקסט, ניגודיות גבוהה, גווני אפור, הדגשת קישורים וכפתורים ועצירת אנימציות.</li>
            <li>תמיכה מלאה בעברית ובכיווניות מימין לשמאל (RTL).</li>
            <li>ניווט במקלדת וסגירת חלונות ותפריטים באמצעות מקש Escape.</li>
            <li>תיוג ARIA לכפתורים וחלונות קופצים.</li>
          </ul>
          <p>
            למרות המאמצים, ייתכן שחלקים מסוימים באתר עדיין אינם נגישים במלואם. אנו ממשיכים לשפר את הנגישות באופן שוטף.
          </p>
          <p className="font-semibold">פניות בנושא נגישות</p>
          <p>
            נתקלתם בבעיית נגישות? נשמח לשמוע ולטפל בהקדם: דוא"ל{" "}
            <a className="font-medium text-indigo-700 underline" href="mailto:mesirot.express@gmail.com">
              mesirot.express@gmail.com
            </a>
            . נא לציין את כתובת העמוד ואת מהות הבעיה.
          </p>
          <p className="text-xs text-slate-400">תאריך עדכון ההצהרה האחרון: 16.10.2026</p>
        </div>
      </Modal>
    </div>
  );
}

function AppInner() {
  useHeebo();
  const auth = useAuth();
  if (!CLOUD_ENABLED) {
    return DEMO_ALLOWED ? (
      <AppShell profile={null} />
    ) : (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 text-center text-sm font-medium text-slate-500" style={{ fontFamily: "'Heebo', sans-serif" }}>
        המערכת אינה מוגדרת כראוי (חסרים פרטי חיבור). פנו למנהל המערכת.
      </div>
    );
  }
  // Never replace a mounted app with the loader while a profile already exists.
  if (auth.loading && !auth.profile) return <FullScreenLoader text="מתחבר..." />;
  // Arrived from the password-reset email: choose a new password first.
  if (auth.recovery) {
    return (
      <ResetPasswordScreen
        onUpdate={auth.updatePassword}
        onSignOut={() => {
          auth.signOut();
          window.history.replaceState(null, "", window.location.pathname);
          window.location.reload();
        }}
      />
    );
  }
  // AUTH GUARD — the portals render only for a live Supabase session whose
  // profile belongs to that very session and has a known role. Anything else
  // (logged out, copied link, stale profile for one frame after sign-out,
  // unknown role) shows the login screen and nothing else.
  const authed =
    !!auth.session &&
    !!auth.profile &&
    auth.profile.auth_id === auth.session.user.id &&
    KNOWN_ROLES.includes(auth.profile.role) &&
    !auth.profile.blocked;
  if (!authed) {
    return (
      <LoginScreen
        onSignIn={auth.signIn}
        onSignUpLawyer={auth.signUpLawyer}
        onSignUpCourier={auth.signUpCourier}
        onResetPassword={auth.requestPasswordReset}
        notice={auth.authNotice}
        onClearNotice={auth.clearAuthNotice}
        profileError={auth.profileError}
      />
    );
  }
  // A courier who applied through the join form waits here until the admin approves.
  if (auth.profile.role === "courier" && auth.profile.approval_status === "pending") {
    return <PendingApprovalScreen profile={auth.profile} onRefresh={auth.refreshProfile} onSignOut={auth.signOut} />;
  }
  return (
    <AppShell
      key={auth.profile.id}
      profile={auth.profile}
      onSignOut={auth.signOut}
      referredBy={(auth.session.user.user_metadata && auth.session.user.user_metadata.referred_by) || ""}
      referralDeviceMatch={!!(auth.session.user.user_metadata && auth.session.user.user_metadata.ref_device_match)}
      signupSource={sanitizeSource(auth.session.user.user_metadata && auth.session.user.user_metadata.signup_source)}
    />
  );
}

function AppShell({ profile, onSignOut, referredBy = "", referralDeviceMatch = false, signupSource = "" }) {
  const cloudOn = !!profile;
  // Welcome modal for brand-new clients (dismissal is remembered on this device).
  const [showWelcome, setShowWelcome] = useState(() => shouldShowWelcome(profile));
  // Remember (this browser only) which client accounts signed in here — Layer B device check.
  useEffect(() => {
    if (profile && profile.role === "lawyer") rememberDeviceOwner(profile.id);
  }, [profile]);
  const closeWelcome = () => {
    try {
      window.localStorage.setItem(welcomeSeenKey(profile.id), "1");
    } catch (e) {
      /* ignore */
    }
    setShowWelcome(false);
  };
  const [viewState, setView] = useState("admin");
  // Signed-in users are pinned to the view of their role.
  const view = cloudOn ? profile.role : viewState;
  const [orders, setOrdersState] = useState(() => (cloudOn ? [] : seedDemoPriceRequest(buildMockOrders())));
  const ordersRef = useRef(orders);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  // Payment status per (courier, month) — keyed by paymentKey(); missing key = unpaid.
  const [payments, setPayments] = useState({});
  // Manual payroll adjustments (bonuses / expense reimbursements / deductions),
  // each scoped to one courier + one month.
  const [adjustments, setAdjustments] = useState([]);
  // The courier roster itself — seeded from the mock COURIERS directory, and
  // grown by the Admin's Courier Onboarding form. Every region-filtered
  // dispatch dropdown and the Courier Directory table both read from here.
  const [couriers, setCouriers] = useState(cloudOn ? [] : COURIERS);
  // Registered law firms / clients (Admin "לקוחות" section; block / restore).
  const [lawyers, setLawyers] = useState(cloudOn ? [] : DEMO_LAWYERS);
  // In-app notifications for the Lawyer/Client portal. Created automatically
  // the moment any order is completed AND its affidavit signed — whoever
  // signed it (courier or Admin) — so every portal reads one shared source.
  const [notifications, setNotifications] = useState([]);
  // Couriers' "take" / "decline" answers on open orders (see RESPONSE helpers).
  const [responses, setResponses] = useState([]);
  const responsesRef = useRef(responses);
  responsesRef.current = responses;

  // Cloud store: loads the role-scoped data, subscribes to Realtime and saves
  // changes (a no-op in demo mode, where `profile` is null).
  const cloud = useCloudStore(profile, {
    replaceOrders: (rawList) => {
      // Orders this user deleted permanently stay gone even if the database
      // could not remove them (see deleteOrder → hiddenOnly).
      const hidden = readHiddenOrderIds();
      const visible = hidden.size ? rawList.filter((o) => !hidden.has(o.id)) : rawList;
      const localVerify = readLocalVerifications();
      const list = Object.keys(localVerify).length
        ? visible.map((o) => (localVerify[o.id] && !o.lawyerVerifiedAt ? { ...o, ...localVerify[o.id] } : o))
        : visible;
      ordersRef.current = list;
      setOrdersState(list);
    },
    setNotifications,
    setResponses,
    setCouriers,
    setLawyers,
    setPricing,
    setPayments,
    setAdjustments,
    setReferralLedger: (v) => setReferralLedger(v),
  });
  const persistOrders = cloud.persistOrders;
  const cloudCancelOrder = cloud.cancelOrder;
  const cloudDeleteOrder = cloud.deleteOrder;
  const cloudSaveLawyerVerification = cloud.saveLawyerVerification;
  const cloudNextOrderId = cloud.nextOrderId;
  const cloudSetUserBlocked = cloud.setUserBlocked;
  const cloudRespond = cloud.respondToOrder;
  const cloudAcknowledge = cloud.acknowledgeResponse;

  // Every existing handler updates orders through this setter. It applies the
  // change locally at once (instant UI) and, in cloud mode, hands the
  // before/after lists to the sync engine, which saves only what changed.
  const setOrders = useCallback(
    (updater, opts) => {
      const prev = ordersRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return;
      ordersRef.current = next;
      setOrdersState(next);
      if (cloudOn && !(opts && opts.localOnly)) persistOrders(prev, next);
    },
    [cloudOn, persistOrders]
  );

  // Real-time updates for the law firm. Two kinds, each deduplicated by key:
  //   • "visit"      — fires the moment a courier reports ANY new visit
  //                    (no answer / delivered / refused / posted), before the
  //                    affidavit is even signed.
  //   • "completion" — fires once the order is finished AND its affidavit signed.
  // Visits already on record at first load are marked as seen, not announced.
  const seenVisitsRef = useRef(null);
  useEffect(() => {
    // In cloud mode notifications come from database triggers instead.
    if (cloudOn) return;
    const visitKeys = [];
    orders.forEach((o) => (o.attempts || []).forEach((a, i) => visitKeys.push({ o, a, i, key: `${o.id}#v${i}` })));
    if (seenVisitsRef.current === null) {
      seenVisitsRef.current = new window.Set(visitKeys.map((v) => v.key));
    }
    const freshVisits = visitKeys.filter((v) => !seenVisitsRef.current.has(v.key));
    freshVisits.forEach((v) => seenVisitsRef.current.add(v.key));

    setNotifications((prev) => {
      const known = new window.Set(prev.map((n) => n.key || n.orderId));
      const visitNotes = freshVisits.map((v) => ({
        id: genId("NTF"),
        key: v.key,
        orderId: v.o.id,
        lawyer: v.o.submittedBy,
        message: `עדכון בזמן אמת: ביקור ${v.i + 1} (${v.a.type}) בוצע עבור מס' משימה ${formatOrderNum(v.o.id, true)} — ${v.a.timestamp}`,
        createdAt: v.a.timestamp || nowStamp(0),
        read: false,
      }));
      const completionNotes = orders
        .filter((o) => isTerminalOrder(o) && isAffidavitSigned(o) && !known.has(o.id))
        .map((o) => ({
          id: genId("NTF"),
          key: o.id,
          orderId: o.id,
          lawyer: o.submittedBy,
          message: completionNotificationText(o),
          createdAt: (o.affidavit && o.affidavit.signedAt) || nowStamp(0),
          read: false,
        }));
      const fresh = [...completionNotes, ...visitNotes];
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, [orders, cloudOn]);

  // Keep the affidavit generator's courier lookup in sync with the live roster.
  useEffect(() => {
    setCourierRegistry(couriers);
  }, [couriers]);

  const handleReadNotification = useCallback(
    (id) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (cloudOn) cloud.markNotificationRead(id);
    },
    [cloudOn, cloud.markNotificationRead] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Admin payroll (paid flags + adjustments) is saved per courier.
  const { ready: cloudReady, savePayroll } = cloud;
  useEffect(() => {
    if (cloudOn && profile.role === "admin" && cloudReady) savePayroll(payments, adjustments, couriers);
  }, [cloudOn, profile, cloudReady, savePayroll, payments, adjustments, couriers]);

  const handleRegisterCourier = useCallback((form) => {
    // Cloud: create the courier's profile (they then sign up with this email).
    if (cloudOn) {
      cloud.registerCourier(form);
      return;
    }
    setCouriers((prev) => [
      ...prev,
      {
        id: genId("CR"),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        residenceCity: form.residenceCity.trim(),
        address: form.address.trim(),
        region: form.region,
        licenseNumber: form.licenseNumber.trim(),
        licenseFileName: form.licenseFileName || "",
        businessType: form.businessType,
      },
    ]);
  }, [cloudOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = useCallback(async (form) => {
    // Clean, human-readable number (ORD-1001, ORD-1002 …): the database hands
    // out the next one in cloud mode; demo mode continues after the highest.
    const id = cloudOn ? await cloudNextOrderId() : nextDemoOrderId(ordersRef.current);
    if (!id) return; // the cloud error banner already explains why
    const newOrder = (
      {
        id,
        // Drives geo-targeted pickup: only couriers of this region see the order.
        region: CITY_REGION[form.city] || "",
        recipientName: form.recipientName,
        idNumber: form.idNumber,
        phone: form.phone,
        city: form.city,
        street: form.street,
        houseNumber: form.houseNumber,
        apartment: form.apartment,
        floor: form.floor || "",
        entranceCode: form.entranceCode || "",
        notes: form.notes,
        docType: form.docType,
        customDocType: form.customDocType,
        fileName: form.fileName,
        urgent: (form.speed || "standard") !== "standard",
        speed: form.speed || "standard",
        addons: { tracing: !!(form.addons && form.addons.tracing), printing: !!(form.addons && form.addons.printing) },
        caseNumber: form.caseNumber || "",
        court: form.court || "",
        plaintiff: form.plaintiff || "",
        defendant: form.defendant || "",
        recipientRole: form.recipientRole || RECIPIENT_ROLES[0],
        deliveryTrack: form.deliveryTrack || "legal",
        maxVisits: form.deliveryTrack === "municipal" || form.deliveryTrack === "bank" ? (Number(form.maxVisits) === 3 ? 3 : 1) : form.deliveryTrack === "standard" ? 1 : 3,
        bankConfidential: form.deliveryTrack === "bank" ? form.bankConfidential !== false : false,
        packageDescription: form.packageDescription || "",
        // Referral attribution (a client who joined through an invitation link).
        // Never taken from the form: only the sign-up metadata can set it, and a client's own code is ignored.
        ...(cloudOn && profile.role === "lawyer" && verifyReferralCode(referredBy).ok && referredBy !== generateReferralCode(profile)
          ? { referral: { code: referredBy, deviceMatch: !!referralDeviceMatch || deviceHasReferrer(referredBy) } }
          : {}),
        referralCredit: null,
        // Marketing channel that brought the client (sign-up metadata first, then the remembered ?src=).
        ...(cloudOn && profile.role === "lawyer" && (signupSource || readSignupSource()) ? { signupSource: signupSource || readSignupSource() } : {}),
        status: STATUS.PENDING,
        assignedCourier: "",
        createdDate: nowStamp(0),
        attempts: [],
        signature: null,
        priceOverride: { perAttempt: null, perCompleted: null },
        priceRequests: [],
        // Which signed-in lawyer submitted this order — the Lawyer Portal
        // uses this to show each lawyer only their own submissions.
        submittedBy: form.ownerLawyer && cloudOn && profile.role === "admin" ? form.ownerLawyer.name : cloudOn ? profile.full_name : form.submittedBy || LAWYERS[0],
        // Cloud: row ownership (used by Row Level Security) + the attorney's
        // details, frozen onto the order for the affidavit's verification block.
        ...(cloudOn
          ? form.ownerLawyer && profile.role === "admin" && form.ownerLawyer.id
            ? {
                // Admin bulk import on behalf of a client: the order belongs to that client.
                lawyerId: form.ownerLawyer.id,
                lawyerInfo: {
                  licenseNo: form.ownerLawyer.licenseNo || "________",
                  firm: form.ownerLawyer.firm || "",
                  address: form.ownerLawyer.address || "",
                  phone: form.ownerLawyer.phone || "",
                },
              }
            : {
                lawyerId: profile.id,
                lawyerInfo: {
                  licenseNo: profile.bar_license_no || "________",
                  firm: profile.firm || "",
                  address: profile.office_address || "",
                  phone: profile.phone || "",
                },
              }
          : {}),
      }
    );
    setOrders((prev) => [newOrder, ...prev]);
    // Cloud mode fires the webhook after the DB insert succeeds (persistOrders);
    // demo mode has no DB, so it fires right away.
    if (!cloudOn) notifyNewOrderEverywhere(newOrder);
  }, [cloudOn, profile, referredBy, setOrders, cloudNextOrderId]);

  // "חבר מביא חבר" — admin-only reward ledger (settings key "referrals"; one entry per
  // referred client, so a reward can never be approved twice for the same user).
  const [referralLedger, setReferralLedgerState] = useState({});
  const ledgerRef = useRef({});
  const setReferralLedger = useCallback((next) => {
    ledgerRef.current = next || {};
    setReferralLedgerState(next || {});
  }, []);
  const saveReferralLedger = useCallback(
    (next) => {
      setReferralLedger(next);
      if (cloudOn) cloud.saveSetting("referrals", next);
    },
    [cloudOn, cloud.saveSetting, setReferralLedger] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleApproveReferral = useCallback(
    (row) => {
      if (!row || ledgerRef.current[row.referredId]) return false; // one-way lock
      // Re-check everything against the current data before locking.
      const fresh = buildReferralRows({ lawyers, orders: ordersRef.current, ledger: ledgerRef.current }).find((r) => r.referredId === row.referredId);
      if (!fresh || fresh.fraudFlag || !fresh.firstCompleted || !fresh.referrer) return false;
      saveReferralLedger({
        ...ledgerRef.current,
        [row.referredId]: {
          referrerId: fresh.referrer.id,
          code: fresh.code,
          approvedAt: new window.Date().toISOString(),
          approvedBy: profile ? profile.full_name : "admin",
          credits: {
            friend: { holderId: fresh.referred.id, amount: REFERRAL_CREDIT, appliedOrderId: null, appliedAt: null },
            referrer: { holderId: fresh.referrer.id, amount: REFERRAL_CREDIT, appliedOrderId: null, appliedAt: null },
          },
        },
      });
      return true;
    },
    [lawyers, profile, saveReferralLedger]
  );
  // Attaches an approved ₪50 credit to the holder's next unassigned order (≥ ₪110 after credit).
  const handleApplyReferralCredit = useCallback(
    (referredId, side) => {
      const entry = ledgerRef.current[referredId];
      const credit = entry && entry.credits && entry.credits[side];
      if (!credit || credit.appliedOrderId) return false;
      const holder = lawyers.find((l) => l.id === credit.holderId);
      const target = holder && eligibleCreditOrder(holder, ordersRef.current);
      if (!target) return false;
      setOrders((prev) => prev.map((o) => (o.id === target.id ? { ...o, referralCredit: { amount: REFERRAL_CREDIT, ledgerId: referredId, side } } : o)));
      saveReferralLedger({
        ...ledgerRef.current,
        [referredId]: {
          ...entry,
          credits: { ...entry.credits, [side]: { ...credit, appliedOrderId: target.id, appliedAt: new window.Date().toISOString() } },
        },
      });
      return true;
    },
    [lawyers, setOrders, saveReferralLedger]
  );

  // Lawyer cancels an order that has no courier yet. Re-checks the rule against
  // the latest state, then marks it "בוטל" locally and (cloud) via the RPC.
  const handleCancelOrder = useCallback((id) => {
    const current = ordersRef.current.find((o) => o.id === id);
    if (!canCancelOrder(current)) return false;
    setOrders(
      (prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: STATUS.CANCELED, cancelledAt: nowStamp(0) } : o
        ),
      { localOnly: true }
    );
    if (cloudOn) cloudCancelOrder(id);
    return true;
  }, [cloudOn, cloudCancelOrder, setOrders]);

  // Upgrade 2 — permanently delete a CANCELLED order: local state at once, then
  // visits + order in Supabase (admin directly; lawyer via the optional RPC,
  // otherwise the order is hidden for that user only).
  const handleDeleteOrderPermanently = useCallback((orderId) => {
    const current = ordersRef.current.find((o) => o.id === orderId);
    if (!current) return false;
    // Cancelled or completed orders only, and only for the admin or the owning
    // lawyer (a lawyer sees nothing but their own orders). Never a courier.
    if (!isOrderCancelled(current) && !isOrderCompleted(current)) return false;
    if (cloudOn && !(profile && (profile.role === "admin" || profile.role === "lawyer"))) return false;
    setOrders((prev) => prev.filter((o) => o.id !== orderId), { localOnly: true });
    setNotifications((prev) => prev.filter((n) => n.orderId !== orderId));
    if (cloudOn) {
      // Always remembered as hidden: even if row-level security refuses the
      // real delete, the order is gone for this user immediately and for good.
      rememberHiddenOrderId(orderId);
      cloudDeleteOrder(orderId);
    }
    return true;
  }, [cloudOn, profile, cloudDeleteOrder, setOrders]);

  // Upgrade 3 — save the owning lawyer's verification onto the order. Only the
  // lawyer portal passes this handler (couriers / admin never get it) and the
  // order must be one this lawyer can see; the database re-checks ownership.
  const handleLawyerVerify = useCallback(async (orderId, fields) => {
    if (profile && profile.role && profile.role !== "lawyer" && profile.role !== "admin") return false;
    const current = ordersRef.current.find((o) => o.id === orderId);
    if (!current) return false;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...fields } : o)), { localOnly: true });
    if (cloudOn) await cloudSaveLawyerVerification(orderId, fields);
    return true;
  }, [cloudOn, profile, cloudSaveLawyerVerification, setOrders]);

  const handleUpdateOrder = useCallback((id, updater) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? updater(o) : o)));
  }, []);

  // Chain of custody: the admin marks an envelope as collected from the client.
  const handleMarkPickedUp = useCallback((id) => {
    const by = cloudOn && profile ? profile.full_name : "מנהל המערכת";
    setOrders((prev) => prev.map((o) => (o.id === id ? markPickedUp(o, by, "admin") : o)));
  }, [cloudOn, profile, setOrders]);

  // Admin "הפקת תצהיר וחתימה": the signature is captured on the Admin's
  // screen on behalf of the assigned courier, and the record says so
  // (`capturedBy`) so the audit trail never implies the courier signed
  // somewhere they didn't.
  const handleAdminSignAffidavit = useCallback((orderId, signatureDataUrl) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              affidavit: {
                signature: signatureDataUrl,
                signedAt: nowStamp(0),
                signedBy: o.assignedCourier || "השליח המשובץ",
                capturedBy: "מנהל המערכת",
              },
              completed: true,
              completedAt: nowStamp(0),
              affidavitStatus: "signed",
              taskClosed: true,
              closedAt: nowStamp(0),
            }
          : o
      )
    );
  }, []);

  // --- "#assign=<ORDER_ID>" deep link + admin new-order notifications -------
  const [assignOrderId, setAssignOrderId] = useState(ASSIGN_INTENT);
  const openAssign = useCallback((id) => {
    try {
      window.sessionStorage.setItem("pendingAssign", id);
    } catch (e) {
      /* storage unavailable — the in-memory state is enough */
    }
    setAssignOrderId(id);
    if (!cloudOn) setView("admin");
  }, [cloudOn]);
  const closeAssign = useCallback(() => {
    try {
      window.sessionStorage.removeItem("pendingAssign");
    } catch (e) {
      /* ignore */
    }
    setAssignOrderId("");
    if (/assign=/.test(window.location.hash)) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  useEffect(() => {
    const onHash = () => {
      const m = /[#&]assign=([^&]+)/.exec(window.location.hash);
      if (m) openAssign(decodeURIComponent(m[1]));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [openAssign]);
  const alerts = useAdminOrderAlerts({
    enabled: view === "admin",
    ready: !cloudOn || cloud.ready,
    orders,
    onOpenOrder: openAssign,
  });

  // Courier answers an open order. Re-checks that it is still open.
  const handleRespond = useCallback(
    (orderId, courierId, action) => {
      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!isOpenForPickup(order)) return;
      const exists = !!findResponse(responsesRef.current, orderId, courierId);
      setResponses((prev) => upsertResponse(prev, orderId, courierId, action));
      if (cloudOn) cloudRespond(orderId, action, exists);
    },
    [cloudOn, cloudRespond]
  );

  // Courier dismisses the "task taken" message.
  const handleAcknowledge = useCallback(
    (orderId, courierId) => {
      setResponses((prev) =>
        prev.map((r) => (r.orderId === orderId && r.courierId === courierId ? { ...r, acknowledged: true } : r))
      );
      if (cloudOn) cloudAcknowledge(orderId);
    },
    [cloudOn, cloudAcknowledge]
  );

  // Admin: block / restore a user ("חסום מפעילות" / "החזר לפעילות").
  const handleSetBlocked = useCallback(
    (c, blocked) => {
      const email = (c.email || "").toLowerCase();
      const flip = (list) =>
        list.map((x) => (x.id === c.id || (email && (x.email || "").toLowerCase() === email) ? { ...x, blocked } : x));
      setCouriers(flip);
      setLawyers(flip);
      // Fire-and-forget: the buttons flip instantly and the screen never waits.
      if (cloudOn) Promise.resolve(cloudSetUserBlocked(c.id, blocked)).catch(() => {});
      notifyUserBlockChange(c, blocked);
    },
    [cloudOn, cloudSetUserBlocked]
  );

  const handleAssignCourier = useCallback(
    (id, courier) => {
      // The courier's id (for Row Level Security) and a snapshot of the
      // details the affidavit needs travel with the order.
      const c = couriers.find((x) => x.name === courier);
      if (c && c.blocked) return; // blocked couriers can't be assigned
      const target = ordersRef.current.find((o) => o.id === id);
      // Resolve the pickup requests: chosen courier selected, the rest "taken".
      if (c && target && !isAssignmentLocked(target)) {
        setResponses((prev) => applyAssignmentToResponses(prev, id, c.id));
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id && !isAssignmentLocked(o)
            ? {
                ...o,
                // Reassignment keeps the full visit history. Every visit is first stamped with the courier who
                // performed it, so that courier keeps the pay for it after the order moves to someone else.
                attempts: (o.attempts || []).map((a) => (a.courier || !o.assignedCourier ? a : { ...a, courier: o.assignedCourier })),
                assignedCourier: courier,
                courierId: c ? c.id : null,
                courierInfo: c ? { name: c.name, licenseNumber: c.licenseNumber, phone: c.phone } : null,
                assignedAt: courier ? o.assignedAt || nowStamp(0) : o.assignedAt,
                status: courier && o.status === STATUS.PENDING ? STATUS.IN_PROGRESS : o.status,
              }
            : o
        )
      );
    },
    [couriers, setOrders]
  );

  const handleUpdatePricing = useCallback(
    (newPricing) => {
      setPricing(newPricing);
      if (cloudOn) cloud.saveSetting("pricing", newPricing);
    },
    [cloudOn, cloud.saveSetting] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleSetOrderPrice = useCallback((id, override) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, priceOverride: override } : o)));
  }, []);

  // --- Courier price-proposal workflow: the courier can only *submit* a
  // proposal; only these Admin-triggered handlers ever touch priceOverride.
  const handleSubmitPriceRequest = useCallback((orderId, request) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const hasPending = (o.priceRequests || []).some((r) => r.status === "pending");
        if (hasPending) return o; // one active proposal per order at a time
        const newRequest = {
          id: genId("REQ"),
          status: "pending",
          requestedAt: nowStamp(0),
          reviewedAt: null,
          ...request,
        };
        return { ...o, priceRequests: [...(o.priceRequests || []), newRequest] };
      })
    );
  }, []);

  const handleApprovePriceRequest = useCallback((orderId, requestId) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const request = (o.priceRequests || []).find((r) => r.id === requestId);
        if (!request) return o;
        const newOverride = {
          perAttempt: request.proposedPerAttempt != null ? request.proposedPerAttempt : o.priceOverride?.perAttempt ?? null,
          perCompleted:
            request.proposedPerCompleted != null ? request.proposedPerCompleted : o.priceOverride?.perCompleted ?? null,
        };
        return {
          ...o,
          priceOverride: newOverride,
          priceRequests: o.priceRequests.map((r) =>
            r.id === requestId ? { ...r, status: "approved", reviewedAt: nowStamp(0) } : r
          ),
        };
      })
    );
  }, []);

  const handleRejectPriceRequest = useCallback((orderId, requestId) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              priceRequests: (o.priceRequests || []).map((r) =>
                r.id === requestId ? { ...r, status: "rejected", reviewedAt: nowStamp(0) } : r
              ),
            }
      )
    );
  }, []);

  const handleTogglePayment = useCallback((courier, monthKey) => {
    setPayments((prev) => {
      const key = paymentKey(courier, monthKey);
      const current = prev[key] || "unpaid";
      // Irreversible: paid stays paid (no way back to "unpaid").
      if (current === "paid") return prev;
      return { ...prev, [key]: "paid" };
    });
  }, []);

  // Once a courier/month is paid its amount is frozen: no adding or removing
  // manual adjustments for it.
  const handleAddAdjustment = useCallback((adj) => {
    if (payments[paymentKey(adj.courier, adj.monthKey)] === "paid") return;
    setAdjustments((prev) => [...prev, { id: genId("ADJ"), createdAt: nowStamp(0), ...adj }]);
  }, [payments]);

  const handleRemoveAdjustment = useCallback((id) => {
    setAdjustments((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a && payments[paymentKey(a.courier, a.monthKey)] === "paid") return prev;
      return prev.filter((x) => x.id !== id);
    });
  }, [payments]);

  if (cloudOn && !cloud.ready) return <FullScreenLoader text="טוען נתונים מהענן..." />;

  return (
    <SessionContext.Provider value={{ profile, signOut: onSignOut }}>
    <div
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
      className="relative min-h-screen overflow-x-hidden bg-[#f8f9fa]"
    >
      {/* Ambient Gemini-style gradient glows — fixed, decorative, non-interactive */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-purple-200/20 blur-3xl" />
      </div>
      <TopNav view={view} setView={setView} />
      {showWelcome && cloudOn && <WelcomeModal profile={profile} onClose={closeWelcome} />}
      <EvidenceIssueBanner
        issue={cloud.evidenceIssue}
        ok={cloud.evidenceOk}
        canRetry={cloudOn && (profile.role === "admin" || profile.role === "courier")}
        onRetry={() => cloud.retryEvidence(ordersRef.current, cloud.evidenceIssue ? cloud.evidenceIssue.orderIds : [])}
        onClose={cloud.clearEvidenceIssue}
      />
      {cloud.error && (
        <div
          role="alert"
          className="mx-auto mt-3 flex max-w-5xl items-start gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">שגיאת סנכרון עם הענן: {cloud.error}</span>
          <button type="button" onClick={cloud.clearError} aria-label="סגירה">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {view === "lawyer" && (
        <LawyerPortal
          lockedLawyer={cloudOn ? profile.full_name : null}
          orders={orders}
          onCreate={handleCreate}
          onCancelOrder={handleCancelOrder}
          onDeleteOrder={handleDeleteOrderPermanently}
          onLawyerVerify={handleLawyerVerify}
          onSwitchRole={setView}
          notifications={notifications}
          onReadNotification={handleReadNotification}
        />
      )}
      {view === "courier" && (
        <CourierView
          lockedCourier={cloudOn ? profile.full_name : null}
          orders={orders}
          onUpdateOrder={handleUpdateOrder}
          pricing={pricing}
          adjustments={adjustments}
          payments={payments}
          onSubmitPriceRequest={handleSubmitPriceRequest}
          onSwitchRole={setView}
          couriers={couriers}
          responses={responses}
          onRespond={handleRespond}
          onAcknowledge={handleAcknowledge}
          myCourier={cloudOn ? courierFromProfile(profile) : null}
          ready={!cloudOn || cloud.ready}
        />
      )}
      {view === "admin" && (
        <AdminDashboard
          orders={orders}
          responses={responses}
          onAssignCourier={handleAssignCourier}
          pricing={pricing}
          onUpdatePricing={handleUpdatePricing}
          onSetOrderPrice={handleSetOrderPrice}
          adjustments={adjustments}
          payments={payments}
          onTogglePayment={handleTogglePayment}
          onAddAdjustment={handleAddAdjustment}
          onRemoveAdjustment={handleRemoveAdjustment}
          onApprovePriceRequest={handleApprovePriceRequest}
          onRejectPriceRequest={handleRejectPriceRequest}
          onSwitchRole={setView}
          couriers={couriers}
          onRegisterCourier={handleRegisterCourier}
          onApproveCourier={cloud.approveCourier}
          onSetBlocked={handleSetBlocked}
          referralLedger={referralLedger}
          onApproveReferral={handleApproveReferral}
          onApplyReferralCredit={handleApplyReferralCredit}
          lawyers={lawyers}
          assignOrderId={assignOrderId}
          onCloseAssign={closeAssign}
          notifyPermission={alerts.permission}
          onEnableNotify={alerts.requestPermission}
          onTestNotify={alerts.sendTest}
          onSignAffidavit={handleAdminSignAffidavit}
          onDeleteOrder={handleDeleteOrderPermanently}
          onMarkPickedUp={handleMarkPickedUp}
          onCreateOrder={handleCreate}
        />
      )}
    </div>
    </SessionContext.Provider>
  );
}

export default function App() {
  return (
    <>
      <AppInner />
      <AccessibilityWidget />
    </>
  );
}
