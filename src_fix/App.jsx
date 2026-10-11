import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
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
  Map,
  CreditCard,
  UserPlus,
  Bell,
  ShieldCheck,
  TrendingUp,
  LogOut,
  Calculator,
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
    cities: ["חדרה", "פרדס חנה-כרכור", "חריש", "אור עקיבא", "בנימינה-גבעת עדה", "זכרון יעקב", "קיסריה", "באקה אל-גרביה", "גבעת חיים", "כפר גליקסון", "מענית", "ברקאי"],
  },
  {
    key: "sharon",
    label: "אזור השרון / נתניה",
    short: "שרון / נתניה",
    price: 140,
    cities: ["נתניה", "כפר יונה", "כפר סבא", "רעננה", "הוד השרון", "רמת השרון", "הרצליה", "טירה", "טייבה", "קלנסווה", "קדימה-צורן", "אבן יהודה", "תל מונד"],
  },
  {
    key: "haifa",
    label: "חיפה והקריות",
    short: "חיפה והקריות",
    price: 160,
    cities: ["חיפה", "קריית אתא", "קריית ביאליק", "קריית מוצקין", "קריית ים", "נשר", "טירת כרמל", "רכסים", "קריית טבעון", "יקנעם עילית", "דלית אל-כרמל"],
  },
  {
    key: "center",
    label: "מרכז / גוש דן (אזור תל אביב)",
    short: "מרכז / גוש דן",
    price: 170,
    cities: ["תל אביב", "רמת גן", "גבעתיים", "בני ברק", "פתח תקווה", "חולון", "בת ים", "ראשון לציון", "אור יהודה", "יהוד-מונוסון", "קרית אונו", "גבעת שמואל"],
  },
  {
    key: "north_jlm",
    label: "צפון / ירושלים / שפלה",
    short: "צפון / ירושלים / שפלה",
    price: 210,
    cities: ["ירושלים", "מבשרת ציון", "מעלה אדומים", "בית שמש", "עפולה", "נצרת", "טבריה", "עכו", "נהריה", "כרמיאל", "צפת", "קריית שמונה", "אשדוד", "רחובות", "נס ציונה", "יבנה", "לוד", "רמלה", "מודיעין-מכבים-רעות"],
  },
  {
    key: "south",
    label: "דרום / באר שבע",
    short: "דרום / באר שבע",
    price: 270,
    cities: ["באר שבע", "אשקלון", "קריית גת", "דימונה", "אילת", "שדרות", "נתיבות", "אופקים", "ערד", "ירוחם", "מצפה רמון", "רהט"],
  },
];

// Flat city list for dropdowns (grouped by zone in the order form).
const CITIES = PRICING_ZONES.flatMap((z) => z.cities);

// Unknown / legacy cities fall back to the Center zone so an order is never
// left without a price.
function zoneForCity(city) {
  return PRICING_ZONES.find((z) => z.cities.includes(city)) || PRICING_ZONES.find((z) => z.key === "center");
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

// Client-facing price breakdown for one order.
function calcClientPrice(order) {
  const zone = zoneForCity(order.city);
  const speed = SPEED_OPTIONS.find((s) => s.key === speedOf(order)) || SPEED_OPTIONS[0];
  const addons = order.addons || {};
  const tracingFee = addons.tracing ? ADDON_OPTIONS[0].fee : 0;
  const printingFee = addons.printing ? ADDON_OPTIONS[1].fee : 0;
  const lines = [
    { key: "base", label: `מחיר בסיס — \${zone.short}`, amount: zone.price },
    ...(speed.fee ? [{ key: "speed", label: `תוספת ${speed.label} (${speed.hint})`, amount: speed.fee }] : []),
    ...(tracingFee ? [{ key: "tracing", label: ADDON_OPTIONS[0].label, amount: tracingFee }] : []),
    ...(printingFee ? [{ key: "printing", label: ADDON_OPTIONS[1].label, amount: printingFee }] : []),
  ];
  return {
    zone,
    speed,
    base: zone.price,
    speedFee: speed.fee,
    tracingFee,
    printingFee,
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

// The five work regions couriers are onboarded into, and the region each
// order's city belongs to — this is what lets dispatch filter candidate
// couriers down to the ones actually local to the delivery instead of
// showing the Admin the entire roster every time.
const REGIONS = ["צפון", "שרון", "מרכז", "שפלה", "דרום"];

// Automatically maps a city to a courier region based on its pricing zone,
// with some specific overrides where administrative region differs.
const CITY_REGION = {};
PRICING_ZONES.forEach(zone => {
    let regionAssigned = "מרכז";
    if (zone.key === "local" || zone.key === "sharon") regionAssigned = "שרון";
    else if (zone.key === "haifa") regionAssigned = "צפון";
    else if (zone.key === "south") regionAssigned = "דרום";
    else if (zone.key === "north_jlm") regionAssigned = "שפלה"; // Defaulting to Shfela for this mixed zone, handle specifics below

    zone.cities.forEach(city => {
        CITY_REGION[city] = regionAssigned;
    });
});
// Specific overrides for cities in the 'north_jlm' pricing zone which covers multiple courier regions
const northOverrides = ["עפולה", "נצרת", "טבריה", "עכו", "נהריה", "כרמיאל", "צפת", "קריית שמונה"];
northOverrides.forEach(city => { if(CITY_REGION[city]) CITY_REGION[city] = "צפון" });
CITY_REGION["ירושלים"] = "מרכז";
CITY_REGION["מעלה אדומים"] = "מרכז";
CITY_REGION["מבשרת ציון"] = "מרכז";


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

// Full courier roster
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
  const region = CITY_REGION[city];
  const local = roster.filter((c) => c.region === region).map((c) => c.name);
  return local.length ? local : roster.map((c) => c.name);
}

// Splits the roster into "same region as this order's city" vs. everyone
// else, so a dispatch dropdown can show the local, relevant couriers first
// (prioritized) while still letting the Admin reach any courier if needed —
// filtering down to a dead end would be worse than just sorting well.
function groupCouriersByRegion(city, roster = COURIERS) {
  const region = CITY_REGION[city];
  const local = roster.filter((c) => c.region === region).map((c) => c.name);
  const other = roster.filter((c) => c.region !== region).map((c) => c.name);
  return { region, local, other };
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
  const d = new window.Date(Date.now() - offsetMinutes * 60000);
  return `\${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
// High-accuracy device GPS — and NOTHING else. There is deliberately no
// fallback to made-up coordinates: if the fix can't be obtained, the caller
// gets { ok: false, reason } and must tell the courier. `maximumAge: 0`
// forces a fresh reading (never a cached one) and the generous timeout gives
// the GPS chip time to lock on, which is what makes the fix precise.
function getGps({ timeout = 15000 } = {}) {
  return new window.Promise((resolve) => {
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
          coords: `${lat},${lng}`,
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
  let lat = visit.lat;
  let lng = visit.lng;
  if (lat == null || lng == null) {
    const m = String(visit.location || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    lat = m[1];
    lng = m[2];
  }
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Two DIFFERENT kinds of map link are used in the app, on purpose:
//  • Address navigation ("ניווט לכתובת") — where the recipient LIVES. Built from
//    the address text only: street + house number + city (no floor / apartment).
//  • GPS audit ("מיקום דיווח בשטח (GPS)") — where the courier actually WAS when
//    the visit was reported; exact lat/lng for legal verification (mapUrlFor).
function orderAddress(order) {
  return `\${order.street} ${order.houseNumber},${order.city}`;
}
function addressNavUrl(order) {
  return `https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(orderAddress(order))}`;
}
function AddressNavLink({ order, className = "" }) {
  return (
    <a
      href={addressNavUrl(order)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200 hover:bg-sky-100 print:hidden \${className}`}
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
  return { lat, lng, location: `${lat},${lng}` };
}

// Reads a camera/gallery file into a downscaled base64 JPEG data URL. A
// base64 string (unlike URL.createObjectURL, which dies with the tab and
// can't be shared) can live on the order record itself, so Admin and the
// ordering lawyer can open the evidence later. Downscaling keeps the
// in-memory order list light even with many phone-camera photos.
function fileToDataUrl(file, maxDim = 1280, quality = 0.72) {
  return new window.Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const raw = reader.result;
      const img = new window.Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

function randomIsraelCoord() {
  // Rough bounding box for Israel
  const lat = (31.2 + Math.random() * 1.9).toFixed(6);
  const lng = (34.5 + Math.random() * 1.0).toFixed(6);
  return `${lat},${lng}`;
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

function monthLabel(monthKey) {
  const [y, m] = (monthKey || "").split("-").map(Number);
  if (!y || !m) return monthKey;
  return `${HEBREW_MONTHS[m - 1]}${y}`;
}

function formatILS(n) {
  return `₪\${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;
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
//       visit 1 completion  → ₪60                       (first-visit incentive)
//       visit 2 completion  → ₪20 + ₪40 = ₪60           (visit 2 pays ₪40)
//       visit 3 completion  → ₪20 + ₪20 + ₪20 = ₪60     (visit 3 pays ₪20)
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
function calcOrderEarnings(order, pricing, monthKey = null) {
  const rates = getOrderRates(order, pricing);
  const cap = rates.perCompleted;
  // A documented refusal legally ends the delivery process just like a signed
  // delivery or a door posting, so all three count as completing the order.
  const isCompletion = (a) =>
    a.type === STATUS.DELIVERED || a.type === STATUS.POSTED || a.type === STATUS.REFUSED;

  let paidSoFar = 0;
  let stopped = false;
  const allVisits = [];
  order.attempts.forEach((a, i) => {
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

  const perVisit = monthKey
    ? allVisits.filter((v) => monthKeyOf(v.attempt.timestamp) === monthKey)
    : allVisits;
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
  const finished = isTerminalOrder(order);
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
    ? `הודעה: בוצעה מסירה בהצלחה עבור מס' משימה \${o.id}`
    : o.status === STATUS.POSTED
    ? `הודעה: בוצעה הדבקה על הדלת (ביקור 3) עבור מס' משימה \${o.id}`
    : `הודעה: תועד סירוב קבלה עבור מס' משימה \${o.id}`;
}

// Green chip shown wherever an order's payout is listed once the order has
// reached its full completion payout (₪60 by default).
function FirstVisitBonusChip({ calc }) {
  if (!calc || !calc.completionBonus) return null;
  return (
    <span className={`\${PILL} bg-emerald-50 text-emerald-700 ring-emerald-200`}>
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

function genId(prefix) {
  return `\${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// An order is "terminal" once the service is legally complete — delivered,
// posted on the door, or a documented refusal. Only terminal orders have an
// affidavit for the courier to sign.
function isTerminalOrder(o) {
  return o.status === STATUS.DELIVERED || o.status === STATUS.POSTED || o.status === STATUS.REFUSED;
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
    .replace(/"/g, "&quot;");
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
function buildAffidavitHtml(order) {
  const attempts = order.attempts || [];
  const last = attempts[attempts.length - 1];
  const courier = order.courierInfo || lookupCourier(order.assignedCourier);
  const lawyer = order.lawyerInfo || LAWYER_PROFILES[order.submittedBy] || { licenseNo: "________", firm: "", address: "", phone: "" };
  const docLabel = order.docType === "אחר" ? order.customDocType || "אחר" : order.docType;
  const fullAddress = `\${order.street} ${order.houseNumber}${order.apartment ? `, דירה ${order.apartment}` : ""}\${
    order.floor ? `, קומה ${order.floor}` : ""
  }, \${order.city}`;
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
            <td>\${i + 1}</td>
            <td>\${escHtml(a.timestamp)}</td>
            <td>\${escHtml(a.type)}</td>
            <td dir="ltr" style="text-align:right">${escHtml(a.location)}${
              map ? ` <a href="${map}">מפה</a>` : ""
            }\${a.gpsAccuracy != null ? ` (±${escHtml(a.gpsAccuracy)} מ')` : ""}\${a.gpsMissing ? " ללא GPS" : ""}</td>
            <td>\${media.length ? media.join(", ") : "—"}</td>
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
            ? `<p class="meta">ביקור \${i + 1}: קובץ וידאו מצורף בתיק הדיגיטלי (${escHtml(a.photo.timestamp)}${
                a.photo.gps ? ` · ${escHtml(a.photo.gps)}` : ""
              })</p>`
            : `<figure><img src="\${a.photo.dataUrl}" alt="תיעוד ביקור ${i + 1}" /><figcaption>ביקור ${i + 1} — ${escHtml(                 a.photo.timestamp               )}${a.photo.gps ? ` · ${escHtml(a.photo.gps)}` : ""}</figcaption></figure>`
        );
      }
      if (a.signatureDataUrl) {
        parts.push(
          `<figure><img src="${a.signatureDataUrl}" alt="חתימת הנמען" style="background:#fff" /><figcaption>חתימת הנמען — ביקור ${
            i + 1
          }</figcaption></figure>`
        );
      }
      if (a.audio || a.audioRecorded) {
        parts.push(`<p class="meta">ביקור \${i + 1}: הקלטת שמע מצורפת בתיק הדיגיטלי.</p>`);
      }
      return parts.join("");
    })
    .join("");

  let outcome = "טרם הושלמה מסירת המסמך.";
  if (order.status === STATUS.DELIVERED && last) {
    outcome = `בביקור מס' ${attempts.length} נמסר המסמך לידי הנמען${
      last.signatureDataUrl ? ", אשר אישר את קבלתו בחתימה דיגיטלית (מצורפת להלן)" : ""
    }.`;
  } else if (order.status === STATUS.REFUSED && last) {
    outcome = `בביקור מס' ${attempts.length} סירב הנמען לקבל את המסמך. הסירוב תועד בצילום ובהקלטת שמע. ${escHtml(
      last.notes || ""
    )}`;
  } else if (order.status === STATUS.POSTED && last) {
    outcome = `לאחר ${Math.max(0, attempts.length - 1)} ביקורים קודמים בהם לא נמצא מי שיקבל את המסמך, בביקור מס' ${
      attempts.length
    } הודבק המסמך על דלת הנמען. ההדבקה תועדה בצילום.`;
  }

  const reportDate = (last && last.timestamp) || order.createdDate;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8" />
<base target="_blank" />
<title>תצהיר מוסר — \${escHtml(order.id)}</title>
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
  <div class="court">\${escHtml(order.court || "בית המשפט")}</div>
  <div class="caption">
    <div>תיק מס': <strong>\${escHtml(order.caseNumber || "—")}</strong></div>
    <div>מס' מסירה: \${escHtml(order.id)}</div>
  </div>
  <div class="parties">
    <div class="row"><span class="role">התובע / המבקש:</span><span>\${escHtml(order.plaintiff || "—")}</span></div>
    <div class="vs">— נגד —</div>
    <div class="row"><span class="role">הנתבע / המשיב:</span><span>\${escHtml(defendant)}</span></div>
  </div>

  <h1>תצהיר מוסר</h1>
  <p class="sub">המצאת מסמך בהתאם ל${escHtml(LEGAL_REFS.regulations)} (${escHtml(LEGAL_REFS.serviceRule)})</p>

  <p>
    אני הח"מ, <strong>${escHtml(order.assignedCourier \vert{}\vert{} "השליח המשובץ")}</strong>${
      courier
        ? `, נושא/ת ת.ז. / רישיון שליח מס' <strong>${escHtml(courier.licenseNumber)}</strong>, טלפון ${escHtml(courier.phone)}`
        : ""
    }, לאחר שהוזהרתי כי עליי לומר את האמת וכי אהיה צפוי/ה לעונשים הקבועים בחוק אם לא אעשה כן, מצהיר/ה בזאת בכתב כדלקמן:
  </p>

  <ol>
    <li>
      שימשתי כשליח מוסר מטעם \${escHtml(lawyer.firm || order.submittedBy || "משרד עורכי הדין")} והופניתי להמציא את המסמך
      "<strong>${escHtml(docLabel)}</strong>" בתיק שבכותרת, לידי <strong>${escHtml(order.recipientName)}</strong>,
      ת.ז. <strong>${escHtml(order.idNumber)}</strong>${order.recipientRole ? ` (${escHtml(order.recipientRole)} בהליך)` : ""},
      בכתובת <strong>\${escHtml(fullAddress)}</strong> (<a href="\${addressNavUrl(order)}">ניווט לכתובת</a>).
    </li>
    <li>
      לצורך ההמצאה ביצעתי ${attempts.length}${attempts.length === 1 ? "ביקור" : "ביקורים"} בכתובת
      \${distinctDays ? "(כל ביקור בתאריך שונה)" : ""}. בכל ביקור נרשמו תאריך ושעה מדויקים, מיקום GPS
      ותיעוד בצילום/וידאו ובהקלטת שמע, כמפורט בטבלה:
      <table>
        <thead><tr><th>#</th><th>תאריך ושעה</th><th>תוצאת הביקור</th><th>מיקום GPS</th><th>תיעוד מצורף</th></tr></thead>
        <tbody>\${visitRows}</tbody>
      </table>
    </li>
    <li>\${outcome}</li>
    <li>
      החומרים המצורפים (תמונות, וידאו, הקלטות וחתימות) נשמרו במערכת ובזיקה לכל ביקור, והם זמינים להצגה לבית המשפט
      על פי דרישה.
      <div>\${mediaHtml || '<p class="meta">לא צורף תיעוד מדיה.</p>'}</div>
    </li>
    <li>זהו שמי, זו חתימתי, ותוכן תצהירי לעיל אמת.</li>
  </ol>

  <div class="sig-row">
    <div>
      <div class="meta">חתימת המצהיר/ה (השליח)</div>
      \${
        signed
          ? `<img src="${order.affidavit.signature}" alt="חתימת השליח" style="height:60px;max-width:220px;" /><div class="meta">נחתם ב-${escHtml(
              order.affidavit.signedAt
            )}${order.affidavit.capturedBy ? ` (נקלט על ידי \${escHtml(order.affidavit.capturedBy)})` : ""}</div>`
          : '<div class="sig-line"></div><div class="meta">טרם נחתם</div>'
      }
    </div>
    <div style="text-align:left">
      <div class="meta">תאריך הפקת התצהיר</div>
      <div>\${nowStamp(0)}</div>
    </div>
  </div>

  <div class="verify">
    <h2>אימות עורך דין</h2>
    <p>
      אני הח"מ, עו"ד <strong>\${escHtml(String(order.submittedBy || "").replace(/^עו"ד\s*/, "") || "________")}</strong>,
      רישיון מס' <strong>${escHtml(lawyer.licenseNo)}</strong>${lawyer.firm ? `, ${escHtml(lawyer.firm)}` : ""}\${
        lawyer.address ? `, ${escHtml(lawyer.address)}` : ""
      }, מאשר/ת בזאת כי ביום ______________ הופיע/ה בפניי <strong>\${escHtml(order.assignedCourier || "________")}</strong>,
      שזיהיתי באמצעות ת.ז. / רישיון שליח מס' \${escHtml(courier ? courier.licenseNumber : "____________")}, ולאחר שהזהרתיו/ה כי עליו/ה
      להצהיר את האמת וכי יהיה/תהיה צפוי/ה לעונשים הקבועים בחוק אם לא יעשה/תעשה כן, אישר/ה את נכונות הצהרתו/ה וחתם/ה עליה בפניי.
    </p>
    <div class="sig-row" style="margin-top:12px">
      <div><div class="sig-line"></div><div class="meta">חתימת עורך הדין</div></div>
      <div><div class="sig-line"></div><div class="meta">חותמת</div></div>
    </div>
    <p class="meta" style="margin:8px 0 0">האימות ייחתם בידי עורך הדין בלבד — המערכת ממלאת את פרטיו מראש אך אינה חותמת במקומו.</p>
  </div>

  <p class="foot">הופק אוטומטית ממערכת מסירות משפטיות · \${escHtml(reportDate)} · כולל תיעוד GPS, מדיה ושמע לכל ביקור</p>
</body>
</html>`;
}

// Triggers a real browser download of the affidavit as a standalone .html
// file the lawyer/admin can open, print or attach to a court filing —
// a functional fallback since there's no server generating a signed PDF here.
function downloadAffidavit(order) {
  const html = buildAffidavitHtml(order);
  const blob = new window.Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `תצהיר-מסירה-\${order.id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      id: `ORD-\${1000 + i}`,
      recipientName: randomFrom(NAMES),
      idNumber: `\${200000000 + Math.floor(Math.random() * 90000000)}`,
      phone: `05${Math.floor(Math.random() * 9)}-${Math.floor(1000000 + Math.random() * 8999999)}`,
      city,
      street: randomFrom(STREETS),
      houseNumber: `\${1 + Math.floor(Math.random() * 60)}`,
      apartment: Math.random() > 0.5 ? `\${1 + Math.floor(Math.random() * 12)}` : "",
      floor: Math.random() > 0.4 ? `\${1 + Math.floor(Math.random() * 10)}` : "",
      entranceCode: Math.random() > 0.6 ? `#\${1000 + Math.floor(Math.random() * 8999)}` : "",
      notes: Math.random() > 0.6 ? "יש כלב בחצר, יש להתקשר לפני ההגעה" : "",
      docType: randomFrom(DOC_TYPES.slice(0, 8)),
      customDocType: "",
      fileName: `מסמך_\${1000 + i}.pdf`,
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
    <span className={`${PILL}${s.bg} ${s.text}${s.ring}`}>
      <span className={`h-1 w-1 rounded-full \${s.dot}`} />
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

const inputCls =
  "w-full rounded-3xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 transition-all duration-300 ease-in-out";

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full \${
          wide ? "max-w-2xl" : "max-w-md"
        } overflow-y-auto rounded-3xl border border-slate-200/60 bg-white shadow-2xl`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="text-base font-bold text-indigo-700">{title}</h3>
          <button
            onClick={onClose}
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
  lawyer: { key: "lawyer", label: "עו\"ד / חברה", fullLabel: "פורטל עורכי דין וחברות", icon: Briefcase, personaName: 'עו"ד ישראל ישראלי' },
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
function TopNav({ view, setView }) {
  const session = React.useContext(SessionContext);
  const signedIn = !!(session && session.profile);
  // Signed-in users see only their own role; the demo shows all three.
  const roleList = signedIn ? [ROLES[view]] : [ROLES.lawyer, ROLES.courier, ROLES.admin];
  const current = ROLES[view];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
              <Gavel className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-indigo-700">מסירות משפטיות</p>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                {signedIn ? `מחובר כ: \${session.profile.full_name} · סנכרון בזמן אמת` : "מצב הדגמה · החלפת תצוגה בין תפקידים"}
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
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3.5 sm:text-sm \${
                    active ? "bg-white text-indigo-700 shadow-sm transition-all duration-300 ease-in-out" : "text-slate-500 hover:text-slate-7
