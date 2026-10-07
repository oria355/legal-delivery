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
    cities: ["חדרה", "פרדס חנה-כרכור", "חריש"],
  },
  {
    key: "sharon",
    label: "אזור השרון / נתניה",
    short: "שרון / נתניה",
    price: 140,
    cities: ["נתניה", "כפר יונה", "כפר סבא", "רעננה", "הוד השרון"],
  },
  {
    key: "haifa",
    label: "חיפה והקריות",
    short: "חיפה והקריות",
    price: 160,
    cities: ["חיפה", "קריית אתא", "קריית ביאליק", "קריית מוצקין", "קריית ים", "נשר"],
  },
  {
    key: "center",
    label: "מרכז / גוש דן (אזור תל אביב)",
    short: "מרכז / גוש דן",
    price: 170,
    cities: ["תל אביב", "רמת גן", "גבעתיים", "בני ברק", "פתח תקווה", "חולון", "בת ים", "הרצליה", "ראשון לציון"],
  },
  {
    key: "north_jlm",
    label: "צפון / ירושלים / שפלה",
    short: "צפון / ירושלים / שפלה",
    price: 210,
    cities: ["ירושלים", "עפולה", "נצרת", "טבריה", "עכו", "נהריה", "כרמיאל", "אשדוד", "רחובות", "לוד", "רמלה", "מודיעין"],
  },
  {
    key: "south",
    label: "דרום / באר שבע",
    short: "דרום / באר שבע",
    price: 270,
    cities: ["באר שבע", "אשקלון", "קריית גת", "דימונה", "אילת"],
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
    { key: "base", label: `מחיר בסיס — ${zone.short}`, amount: zone.price },
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

const CITY_REGION = {
  "תל אביב": "מרכז",
  חדרה: "שרון",
  נתניה: "שרון",
  ירושלים: "מרכז",
  חיפה: "צפון",
  "ראשון לציון": "שפלה",
  "פתח תקווה": "מרכז",
  "פרדס חנה-כרכור": "שרון",
  חריש: "שרון",
  "כפר יונה": "שרון",
  "כפר סבא": "שרון",
  רעננה: "שרון",
  "הוד השרון": "שרון",
  "קריית אתא": "צפון",
  "קריית ביאליק": "צפון",
  "קריית מוצקין": "צפון",
  "קריית ים": "צפון",
  נשר: "צפון",
  "רמת גן": "מרכז",
  גבעתיים: "מרכז",
  "בני ברק": "מרכז",
  חולון: "מרכז",
  "בת ים": "מרכז",
  הרצליה: "מרכז",
  עפולה: "צפון",
  נצרת: "צפון",
  טבריה: "צפון",
  עכו: "צפון",
  נהריה: "צפון",
  כרמיאל: "צפון",
  אשדוד: "שפלה",
  רחובות: "שפלה",
  לוד: "שפלה",
  רמלה: "שפלה",
  מודיעין: "שפלה",
  "באר שבע": "דרום",
  אשקלון: "דרום",
  "קריית גת": "דרום",
  דימונה: "דרום",
  אילת: "דרום",
};

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

const ALL_COURIERS = Array.from(new Set(COURIERS.map((c) => c.name)));

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
  const d = new Date(Date.now() - offsetMinutes * 60000);
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
function fileToDataUrl(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const raw = reader.result;
      const img = new Image();
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
    ? `הודעה: בוצעה מסירה בהצלחה עבור מס' משימה ${o.id}`
    : o.status === STATUS.POSTED
    ? `הודעה: בוצעה הדבקה על הדלת (ביקור 3) עבור מס' משימה ${o.id}`
    : `הודעה: תועד סירוב קבלה עבור מס' משימה ${o.id}`;
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
  const set = new Set([monthKeyOf(nowStamp(0))]);
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
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
  const fullAddress = `${order.street} ${order.houseNumber}${order.apartment ? `, דירה ${order.apartment}` : ""}${
    order.floor ? `, קומה ${order.floor}` : ""
  }, ${order.city}`;
  const defendant = order.defendant || order.recipientName;
  const signed = !!(order.affidavit && order.affidavit.signature);
  const dayKeys = attempts.map((a) => dayKeyOf(a.timestamp));
  const distinctDays = attempts.length > 1 && new Set(dayKeys).size === attempts.length;

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
            : `<figure><img src="${a.photo.dataUrl}" alt="תיעוד ביקור ${i + 1}" /><figcaption>ביקור ${i + 1} — ${escHtml(
                a.photo.timestamp
              )}${a.photo.gps ? ` · ${escHtml(a.photo.gps)}` : ""}</figcaption></figure>`
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
        parts.push(`<p class="meta">ביקור ${i + 1}: הקלטת שמע מצורפת בתיק הדיגיטלי.</p>`);
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
<title>תצהיר מוסר — ${escHtml(order.id)}</title>
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
    <div>מס' מסירה: ${escHtml(order.id)}</div>
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
          ? `<img src="${order.affidavit.signature}" alt="חתימת השליח" style="height:60px;max-width:220px;" /><div class="meta">נחתם ב-${escHtml(
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

  <div class="verify">
    <h2>אימות עורך דין</h2>
    <p>
      אני הח"מ, עו"ד <strong>${escHtml(String(order.submittedBy || "").replace(/^עו"ד\s*/, "") || "________")}</strong>,
      רישיון מס' <strong>${escHtml(lawyer.licenseNo)}</strong>${lawyer.firm ? `, ${escHtml(lawyer.firm)}` : ""}${
        lawyer.address ? `, ${escHtml(lawyer.address)}` : ""
      }, מאשר/ת בזאת כי ביום ______________ הופיע/ה בפניי <strong>${escHtml(order.assignedCourier || "________")}</strong>,
      שזיהיתי באמצעות ת.ז. / רישיון שליח מס' ${escHtml(courier ? courier.licenseNumber : "____________")}, ולאחר שהזהרתיו/ה כי עליו/ה
      להצהיר את האמת וכי יהיה/תהיה צפוי/ה לעונשים הקבועים בחוק אם לא יעשה/תעשה כן, אישר/ה את נכונות הצהרתו/ה וחתם/ה עליה בפניי.
    </p>
    <div class="sig-row" style="margin-top:12px">
      <div><div class="sig-line"></div><div class="meta">חתימת עורך הדין</div></div>
      <div><div class="sig-line"></div><div class="meta">חותמת</div></div>
    </div>
    <p class="meta" style="margin:8px 0 0">האימות ייחתם בידי עורך הדין בלבד — המערכת ממלאת את פרטיו מראש אך אינה חותמת במקומו.</p>
  </div>

  <p class="foot">הופק אוטומטית ממערכת מסירות משפטיות · ${escHtml(reportDate)} · כולל תיעוד GPS, מדיה ושמע לכל ביקור</p>
</body>
</html>`;
}

// Triggers a real browser download of the affidavit as a standalone .html
// file the lawyer/admin can open, print or attach to a court filing —
// a functional fallback since there's no server generating a signed PDF here.
function downloadAffidavit(order) {
  const html = buildAffidavitHtml(order);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `תצהיר-מסירה-${order.id}.html`;
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

const inputCls =
  "w-full rounded-3xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 transition-all duration-300 ease-in-out";

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
  // Pricing options
  speed: "standard",
  addons: { tracing: false, printing: false },
};

function NewOrderForm({ onCreate }) {
  const [form, setForm] = useState(EMPTY_ORDER_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [printingFileError, setPrintingFileError] = useState(false);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target && "value" in e.target ? e.target.value : e }));

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setForm((f2) => ({ ...f2, fileName: f.name }));
      setPrintingFileError(false);
    }
  };

  // Live quote — same calculator the Admin dashboard uses for its margin.
  const quote = calcClientPrice(form);

  const submit = (e) => {
    e.preventDefault();
    if (!form.recipientName || !form.idNumber || !form.phone || !form.street) return;
    // The printing service prints the PDF the law firm uploads, so a file is required.
    if (form.addons.printing && !form.fileName) {
      setPrintingFileError(true);
      return;
    }
    onCreate({ ...form, urgent: form.speed !== "standard" });
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

      <AuditTrailHighlight />

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
        <Field label="מספר תעודת זהות" required>
          <input
            className={inputCls}
            placeholder="9 ספרות"
            value={form.idNumber}
            onChange={update("idNumber")}
            required
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
            <select className={inputCls + " pr-9 appearance-none"} value={form.city} onChange={update("city")}>
              {PRICING_ZONES.map((z) => (
                <optgroup key={z.key} label={`${z.short} — ${formatILS(z.price)}`}>
                  {z.cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              {DOC_TYPES.map((d) => (
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
  if (!photo || !photo.dataUrl) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
      <button type="button" onClick={() => setOpen((v) => !v)} className="block text-right" title="לחצו להגדלה / צמצום">
        {photo.kind === "video" ? (
          <video
            src={photo.dataUrl}
            controls={open}
            muted
            playsInline
            className={`rounded-lg border border-slate-200/60 bg-black object-cover transition-all ${
              open ? "max-h-96 w-full object-contain" : "h-20 w-20"
            }`}
          />
        ) : (
          <img
            src={photo.dataUrl}
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
      <EvidencePhoto photo={a.photo} label={photoLabelFor(a.type)} />
      {a.audio && (
        <audio controls src={a.audio} className="mt-2 h-8 w-full">
          <track kind="captions" />
        </audio>
      )}
      {!a.audio && a.audioRecorded && <p className="mt-1 text-[11px] text-slate-400">🎙️ הקלטה תועדה</p>}
      {a.signatureDataUrl && (
        <div className="mt-2">
          <p className="text-[11px] text-slate-400">חתימת הנמען</p>
          <img src={a.signatureDataUrl} alt="חתימת הנמען" className="h-14 rounded border border-slate-200/60 bg-white p-1" />
        </div>
      )}
    </li>
  );
}

// Small chips for the order's service speed and advanced services.
function ServiceChips({ order }) {
  const speed = speedOf(order);
  const addons = order.addons || {};
  return (
    <>
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

function OrderDetailsModal({ order, onClose, onOpenAffidavit, showPrice = true }) {
  if (!order) return null;
  return (
    <Modal open={!!order} onClose={onClose} title={`תיק ביקורת מסירה — ${order.id}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <AffidavitBadge order={order} />
          <ServiceChips order={order} />
        </div>
        {(order.caseNumber || order.court || order.plaintiff) && (
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
        <div className="rounded-lg border border-slate-200/60 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">חתימת שליח ותצהיר מוסר</p>
          {isAffidavitSigned(order) ? (
            <div className="space-y-2">
              <img
                src={order.affidavit.signature}
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
                  <Download className="h-4 w-4" /> הורדת תצהיר חתום
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
function LawyerPortal({ orders, onCreate, onSwitchRole, notifications = [], onReadNotification, lockedLawyer = null }) {
  const [tab, setTab] = useState("status");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [affidavitId, setAffidavitId] = useState(null);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return myOrders;
    return myOrders.filter(
      (o) => o.recipientName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
    );
  }, [myOrders, query]);

  // Details / affidavit are always resolved from THIS lawyer's own orders
  // (and live, so they refresh the moment a courier submits) — an id that
  // belongs to another client simply resolves to nothing.
  const selected = myOrders.find((o) => o.id === selectedId) || null;
  const affidavitOrder = myOrders.find((o) => o.id === affidavitId) || null;

  // Clicking a notification opens the full audit file of that order (only if
  // it really is one of this lawyer's own) and marks the notification read.
  const openNotification = (n) => {
    onReadNotification && onReadNotification(n.id);
    setBellOpen(false);
    if (myOrders.some((o) => o.id === n.orderId)) setSelectedId(n.orderId);
  };

  const handleCreateForLawyer = (form) => {
    onCreate({ ...form, submittedBy: currentLawyer });
  };

  const navItems = [
    { key: "status", label: "סטטוס", icon: FileText },
    { key: "new", label: "הזמנה חדשה", icon: Plus },
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
                      {n.message}
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
              <span className="font-bold">🔔 {n.message}</span>
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

        {tab === "new" && <NewOrderForm onCreate={handleCreateForLawyer} />}

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
                          {isAffidavitSigned(o) && (
                            <button
                              onClick={() => setAffidavitId(o.id)}
                              className="flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:brightness-110"
                            >
                              <Download className="h-3.5 w-3.5" /> תצהיר
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

        {tab === "profile" && (
          <ProfileTab role="lawyer" subtitle={`מחובר כ: ${currentLawyer}`} onSwitchRole={onSwitchRole} />
        )}

        <OrderDetailsModal order={selected} onClose={() => setSelectedId(null)} onOpenAffidavit={(o) => setAffidavitId(o.id)} />
        {/* Read-only for the lawyer: shows the courier's signature, with print / download. */}
        <AffidavitModal order={affidavitOrder} onClose={() => setAffidavitId(null)} />
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
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecorded(true);
        // Keep the actual recording (base64) so it can be attached to the
        // refusal record; fall back to a plain "recorded" flag on failure.
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
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
function PhotoUpload({ label, onCaptured, invalid }) {
  const [photo, setPhoto] = useState(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // `url` is a base64 data URL so the photo can be stored on the order.
    // (The visit's GPS fix is attached to the photo when the visit is saved.)
    // Photos become base64 data URLs; videos are too large to inline, so
    // they are kept as an in-session object URL and flagged kind: "video".
    const isVideo = (file.type || "").startsWith("video/");
    const url = isVideo ? URL.createObjectURL(file) : await fileToDataUrl(file);
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
          לחצו לצילום תמונה / וידאו
          <input
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={handleChange}
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200/60 p-2">
          {photo.kind === "video" ? (
            <video src={photo.url} muted playsInline className="h-16 w-16 rounded-md bg-black object-cover" />
          ) : (
            <img src={photo.url} alt="תיעוד" className="h-16 w-16 rounded-md object-cover" />
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
      ? signed && !!audioOk
      : actionType === "refused"
      ? !!audioOk && !!description.trim()
      : !!audioOk;

  const complete = async () => {
    if (submitting) return;
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
    let g = await getGps();
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
      notes:
        actionType === "refused"
          ? `סירוב מתועד. תיאור: ${description}`
          : actionType === "posted"
          ? "המעטפה הודבקה על דלת הנמען לאחר 3 ביקורים ללא מענה"
          : actionType === "noanswer"
          ? "לא נענתה הדלת, הביקור הבא יתוזמן"
          : "נמסר וחתום על ידי הנמען",
      ...(actionType === "delivered" && recipientSig ? { signatureDataUrl: recipientSig } : {}),
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
            ...(actionType === "delivered" ? [{ ok: signed, label: "חתימת הנמען" }] : []),
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
          <PhotoUpload label="צילום מסירה / וידאו (חובה)" onCaptured={handlePhoto} invalid={photoError && !photo} />
          <SignaturePad onSave={(dataUrl) => { setRecipientSig(dataUrl); setSigned(true); }} onCancel={onClose} />
        </div>
      )}

      {actionType === "refused" && (
        <div className="space-y-4">
          <PhotoUpload label="צילום / וידאו דיסקרטי של הנמען או הדלת (חובה)" onCaptured={handlePhoto} invalid={photoError && !photo} />
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
          <PhotoUpload label="צילום / וידאו של הדלת או הכניסה (חובה)" onCaptured={handlePhoto} invalid={photoError && !photo} />
        </div>
      )}

      {actionType === "posted" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
            זהו ביקור שלישי ואחרון — יש לצלם את המעטפה כשהיא מודבקת על הדלת בהתאם לתקנות.
          </div>
          <PhotoUpload label="צילום / וידאו של המעטפה מודבקת על הדלת (חובה)" onCaptured={handlePhoto} invalid={photoError && !photo} />
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

      {actionType === "delivered" && signed && (
        <button
          onClick={complete}
          disabled={submitting || !gpsReady || !audioOk}
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
            {order.street} {order.houseNumber}, {order.city} · {order.id}
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

function CourierTaskCard({ order, onAction, onRequestPrice }) {
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
  const [clockTick, setClockTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = dayKeyOf(nowStamp(0));
  const lockedToday = !!lastAttempt && dayKeyOf(lastAttempt.timestamp) === today;

  // Time remaining until local midnight (00:00:00 of the next calendar
  // day), formatted as HH:MM:SS for the locked banner.
  const countdownLabel = useMemo(() => {
    const now = new Date(clockTick);
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const totalSeconds = Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
    const h = pad(Math.floor(totalSeconds / 3600));
    const m = pad(Math.floor((totalSeconds % 3600) / 60));
    const s = pad(totalSeconds % 60);
    return `${h}:${m}:${s}`;
  }, [clockTick]);

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
      if (!askedPermissionRef.current && typeof Notification !== "undefined") {
        askedPermissionRef.current = true;
        if (Notification.permission === "default") {
          Notification.requestPermission();
        }
      }
      return;
    }

    if (wasLocked && !notifiedRef.current) {
      notifiedRef.current = true;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("הגיע הזמן לביקור הבא! 🚀", {
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
  const noAnswerLocked = attemptsCount >= 2;
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
    <div className="rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-slate-800">
            {order.recipientName}
            {speedOf(order) !== "standard" && <Zap className="h-4 w-4 text-amber-500" />}
          </p>
          <p className="text-xs text-slate-400">{order.id} · {order.docType}</p>
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
      {/* {LEGAL_REFS.serviceRule}: up to three attempts, each on a different day. */}
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
      {lockedToday && (
        <div className="mt-2.5 space-y-1.5 rounded-lg bg-orange-50 px-2.5 py-2 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            בוצע ביקור היום ({timeOfDay(lastAttempt?.timestamp)}) — לפי תקנות סדר הדין האזרחי, ביקור נוסף יתאפשר רק
            מחר, בשעה אחרת ביום.
          </div>
          <div className="flex items-center gap-1.5 text-orange-600">
            <Clock className="h-3.5 w-3.5 shrink-0" />
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
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/60 px-2 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Timer className="h-3.5 w-3.5" /> אין מענה — ביקור {attemptsCount + 1}
          </button>
        )}
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

function CourierView({ orders, onUpdateOrder, pricing, adjustments, payments, onSubmitPriceRequest, onSwitchRole, couriers, lockedCourier = null }) {
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
  // Only this courier's own assignments, and only ones still awaiting action —
  // once an order reaches a terminal state (delivered, posted on the door, or
  // a documented refusal), the service is legally complete and it drops off
  // the active task list, whichever courier is currently selected.
  const activeOrders = orders.filter(
    (o) =>
      o.assignedCourier === currentCourier &&
      o.status !== STATUS.DELIVERED &&
      o.status !== STATUS.POSTED &&
      o.status !== STATUS.REFUSED
  );

  const handleAction = (order, type) => {
    setActiveOrder(order);
    setActionType(type);
  };

  const currentMonthKey = monthKeyOf(nowStamp(0));
  const myOrders = orders.filter((o) => o.assignedCourier === currentCourier);
  const myOrdersThisMonth = myOrders.filter((o) =>
    o.attempts.some((a) => monthKeyOf(a.timestamp) === currentMonthKey)
  );
  const myEarnings = myOrders.reduce(
    (acc, o) => {
      const { visits, completed, total } = calcOrderEarnings(o, pricing, currentMonthKey);
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
    if (attempt.type !== "אין מענה") {
      setAffidavitId(activeOrder.id);
      // The order has left the active list — make it findable under "בוצעו".
      setTasksView("completed");
    }
  };

  // Saves the courier's signature (base64 PNG) onto the order's affidavit
  // record — the Admin dashboard and Lawyer portal read the same record.
  const handleSignAffidavit = (orderId, signatureDataUrl) => {
    onUpdateOrder(orderId, (o) => ({
      ...o,
      ...(o.assignedCourier !== currentCourier
        ? {}
        : {
            affidavit: { signature: signatureDataUrl, signedAt: nowStamp(0), signedBy: currentCourier },
            // Signing the affidavit completes and closes the task.
            completed: true,
            completedAt: nowStamp(0),
            affidavitStatus: "signed",
            taskClosed: true,
            closedAt: nowStamp(0),
          }),
    }));
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
    calc: calcOrderEarnings(o, pricing, currentMonthKey),
  }));
  // "משימות שבוצעו": every finished order of this courier, newest first.
  const completedOrders = myOrders
    .filter(isTerminalOrder)
    .sort((a, b) => {
      const ta = (a.attempts[a.attempts.length - 1] || {}).timestamp || "";
      const tb = (b.attempts[b.attempts.length - 1] || {}).timestamp || "";
      return tb.localeCompare(ta);
    });
  const completedRows = earningRows.filter((r) => isTerminalOrder(r.order));
  const inProgressRows = earningRows.filter((r) => !isTerminalOrder(r.order) && r.calc.visits > 0);
  const visibleRows =
    earningsFilter === "visits" ? inProgressRows : earningsFilter === "completed" ? completedRows : earningRows;
  const visibleTotal = visibleRows.reduce((sum, r) => sum + r.calc.total, 0);

  const navItems = [
    { key: "tasks", label: "משימות", icon: Truck },
    { key: "earnings", label: "הכנסות", icon: Wallet },
    { key: "profile", label: "פרופיל", icon: User },
  ];

  return (
    <>
    <div className="mx-auto max-w-md space-y-4 px-4 py-5 pb-24 sm:pb-5">
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
                          {o.id} · {o.docType}
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
                          <PenTool className="h-3.5 w-3.5" /> הפקת תצהיר וחתימה
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

      {tab === "earnings" && (
        <div className="space-y-4">
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
                const done = isTerminalOrder(o);
                const last = o.attempts[o.attempts.length - 1];
                const custom = o.priceOverride?.perAttempt != null || o.priceOverride?.perCompleted != null;
                return (
                  <div key={o.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700">
                          {o.id} - {o.recipientName}
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
                            <PenTool className="h-3.5 w-3.5" /> הפקת תצהיר וחתימה
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
        order={myOrders.find((o) => o.id === affidavitId) || null}
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
      <BadgeCheck className="h-2.5 w-2.5" /> תצהיר נחתם
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
function AffidavitModal({ order, onClose, onSign }) {
  const [signing, setSigning] = useState(false);
  const frameRef = useRef(null);

  // The modal component stays mounted between orders, so start clean each time.
  useEffect(() => {
    setSigning(false);
  }, [order?.id]);

  if (!order) return null;
  const signed = isAffidavitSigned(order);
  const canEdit = !!onSign;

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
    if (w) {
      w.focus();
      w.print();
    }
  };

  return (
    <Modal open={!!order} onClose={onClose} title={canEdit ? "הפקת תצהיר וחתימה" : "תצהיר מוסר — תצוגה מקדימה"} wide>
      {signed && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <BadgeCheck className="h-4 w-4 shrink-0" />
          התצהיר נחתם על ידי {order.affidavit.signedBy || order.assignedCourier}
          {order.affidavit.capturedBy ? ` (נקלט על ידי ${order.affidavit.capturedBy})` : ""} ב-{order.affidavit.signedAt} וזמין
          לצפייה והורדה אצל המנהל ואצל עורך הדין.
        </div>
      )}

      {/* The exact same HTML that is printed / downloaded. */}
      <iframe
        ref={frameRef}
        title={`תצהיר מוסר ${order.id}`}
        srcDoc={buildAffidavitHtml(order)}
        className="h-[60vh] w-full rounded-lg border border-slate-200/60 bg-white"
      />

      {canEdit && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-slate-500">חתימת השליח על התצהיר</p>
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
              onClick={() => downloadAffidavit(order)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <Download className="h-4 w-4" /> הורדת קובץ
            </button>
          </div>
        </div>
      )}

      <FullScreenSignatureModal
        open={signing}
        title="חתימת השליח על התצהיר"
        subtitle={`${order.id} · ${order.recipientName}`}
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
    <Modal open={!!order} onClose={onClose} title={`תמחור מותאם אישית — ${order.id}`}>
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
      if (!o.assignedCourier) return;
      const calc = calcOrderEarnings(o, pricing, month);
      const { visits, completed, total } = calc;
      if (visits === 0) return;
      if (!map[o.assignedCourier]) {
        map[o.assignedCourier] = { courier: o.assignedCourier, visits: 0, completed: 0, ordersTotal: 0, orders: [] };
      }
      map[o.assignedCourier].visits += visits;
      map[o.assignedCourier].completed += completed;
      map[o.assignedCourier].ordersTotal += total;
      map[o.assignedCourier].orders.push({ order: o, visits, completed, total, calc });
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
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `שכר-שליחים-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
                        onClick={() => onTogglePayment(r.courier, month)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset transition ${
                          r.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {r.status === "paid" ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {r.status === "paid" ? "שולם" : "לא שולם"}
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
                            title={r.status === "paid" ? "יש לסמן כ'לא שולם' לפני עריכת התאמות" : ""}
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
                      {order.recipientName} · {order.id}
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
                      {order.id} · {order.recipientName}
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
            <Map className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
function CourierDirectory({ couriers, orders, onRegisterCourier }) {
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
        <SectionHeading title="ניהול שליחים" subtitle={`${couriers.length} שליחים רשומים במערכת`} icon={Users} />
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <UserPlus className="h-4 w-4" /> הרשמת שליח חדש
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full min-w-[920px] text-right text-sm">
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
                      <Map className="h-3 w-3" /> {c.region}
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
  const rows = orders.map((o) => ({ o, m: calcOrderMargin(o, pricing) }));
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
    <Modal open={!!order} onClose={onClose} title={`תמחור ורווחיות — ${order.id}`}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <MapPin className="h-3 w-3" /> {order.city} · {m.price.zone.short}
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
  onSignAffidavit,
}) {
  const [dashTab, setDashTab] = useState("overview");
  const [activeFilter, setActiveFilter] = useState(null);
  const [affidavitOrder, setAffidavitOrder] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [pricingOrder, setPricingOrder] = useState(null);
  const [marginOrderId, setMarginOrderId] = useState(null);

  const pendingRequestsCount = useMemo(
    () => orders.reduce((sum, o) => sum + (o.priceRequests || []).filter((r) => r.status === "pending").length, 0),
    [orders]
  );

  const counts = useMemo(() => {
    return {
      total: orders.length,
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
      delivered: orders.filter((o) => o.status === STATUS.DELIVERED || o.status === STATUS.POSTED).length,
      needsAttention: orders.filter((o) => o.status === STATUS.REFUSED).length,
    };
  }, [orders]);

  const cards = [
    { key: "all", label: 'סה"כ מסירות', value: counts.total, icon: FileText, accent: "bg-slate-500", match: () => true },
    { key: STATUS.PENDING, label: "ממתינות לשיבוץ", value: counts.pending, icon: Clock, accent: "bg-amber-500", match: (o) => o.status === STATUS.PENDING },
    { key: STATUS.IN_PROGRESS, label: "בטיפול", value: counts.inProgress, icon: Truck, accent: "bg-blue-500", match: (o) => o.status === STATUS.IN_PROGRESS || o.status === STATUS.PENDING_NEXT_VISIT },
    { key: "completed", label: "הושלמו בהצלחה", value: counts.delivered, icon: BadgeCheck, accent: "bg-emerald-500", match: (o) => o.status === STATUS.DELIVERED || o.status === STATUS.POSTED },
    { key: "attention", label: "דורשות טיפול", value: counts.needsAttention, icon: CircleAlert, accent: "bg-rose-500", match: (o) => o.status === STATUS.REFUSED },
  ];

  const filteredOrders = useMemo(() => {
    if (!activeFilter || activeFilter === "all") return orders;
    const card = cards.find((c) => c.key === activeFilter);
    return orders.filter(card.match);
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
    { key: "couriers", label: "ניהול שליחים", icon: Users },
    { key: "requests", label: "בקשות תמחור", icon: Coins, badge: pendingRequestsCount },
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
        <CourierDirectory
          couriers={couriers || COURIERS}
          orders={orders}
          onRegisterCourier={onRegisterCourier}
        />
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      <MarginSummary orders={filteredOrders} pricing={pricing} />

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionHeading
            title="מסירות לפי עיר"
            subtitle={activeFilter ? `מסונן לפי: ${cards.find((c) => c.key === activeFilter)?.label}` : "כל המסירות"}
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
                      <tr key={o.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5 font-medium text-slate-700">{o.id}</td>
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
                                return (
                                  <>
                                    <optgroup label={`באזור ${region || ""} (מומלץ)`}>
                                      {local.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </optgroup>
                                    {other.length > 0 && (
                                      <optgroup label="שליחים מאזורים אחרים">
                                        {other.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                );
                              })()}
                            </select>
                            <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          </div>
                          )}
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
                          <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setDetailsId(o.id)}
                            className="rounded-md border border-slate-200/60 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            פרטים
                          </button>
                          {isTerminalOrder(o) ? (
                            <button
                              onClick={() => setAffidavitOrder(o)}
                              className="flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              <ScrollText className="h-3.5 w-3.5" /> הפקת תצהיר וחתימה
                            </button>
                          ) : null}
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
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const CLOUD_ENABLED = !!supabase;

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
const uploadCache = new Map();

// Uploads a data:/blob: URL to the evidence bucket and returns its public URL.
// Anything that is already a normal URL (or empty) is returned untouched.
async function uploadEvidence(path, value) {
  if (typeof value !== "string" || !(value.startsWith("data:") || value.startsWith("blob:"))) return value || null;
  if (uploadCache.has(value)) return uploadCache.get(value);
  const blob = await (await fetch(value)).blob();
  const type = (blob.type || "").split(";")[0];
  const fullPath = `${path}-${Date.now().toString(36)}.${MIME_EXT[type] || "bin"}`;
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(fullPath, blob, { contentType: type || undefined, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(fullPath);
  uploadCache.set(value, data.publicUrl);
  return data.publicUrl;
}

// order object (UI shape) -> database row. Heavy / derived fields are not
// stored on the order: visits live in their own table, and "last visit" and
// "posting photo" are recomputed from them when the order is loaded.
async function orderToRow(o) {
  /* eslint-disable no-unused-vars */
  const { attempts, lastVisitAt, lastVisitGps, lastVisitLat, lastVisitLng, lastVisitPhoto, postingPhoto, courierId, lawyerId, ...data } = o;
  /* eslint-enable no-unused-vars */
  if (data.affidavit && data.affidavit.signature) {
    data.affidavit = {
      ...data.affidavit,
      signature: await uploadEvidence(`${o.id}/affidavit-signature`, data.affidavit.signature),
    };
  }
  if (typeof data.signature === "string" && data.signature.startsWith("data:")) {
    data.signature = await uploadEvidence(`${o.id}/recipient-signature`, data.signature);
  }
  return {
    id: o.id,
    status: o.status,
    city: o.city,
    lawyer_id: lawyerId || null,
    courier_id: courierId || null,
    data,
  };
}

// One visit (attempt) -> visits row, uploading its media first.
async function visitToRow(order, a, seq, courierId) {
  const base = `${order.id}/visit-${seq}`;
  const photoUrl = a.photo && a.photo.dataUrl ? await uploadEvidence(`${base}-photo`, a.photo.dataUrl) : null;
  const audioUrl = typeof a.audio === "string" ? await uploadEvidence(`${base}-audio`, a.audio) : null;
  const signatureUrl = a.signatureDataUrl ? await uploadEvidence(`${base}-signature`, a.signatureDataUrl) : null;
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
    },
    photo_url: photoUrl,
    photo_meta: a.photo ? { kind: a.photo.kind || "image", timestamp: a.photo.timestamp, gps: a.photo.gps ?? null } : null,
    audio_url: audioUrl,
    signature_url: signatureUrl,
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
  const attempts = visitRows.slice().sort((x, y) => x.seq - y.seq).map(visitFromRow);
  const last = attempts[attempts.length - 1];
  const posted = attempts.slice().reverse().find((a) => a.type === STATUS.POSTED);
  return {
    ...row.data,
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
  };
}

async function cloudFetchOrders() {
  const [o, v] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("visits").select("*").order("seq", { ascending: true }),
  ]);
  if (o.error) throw o.error;
  if (v.error) throw v.error;
  const byOrder = new Map();
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
    createdAt: new Date(n.created_at).toLocaleString("he-IL"),
    read: !!n.read,
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
  const out = { pricing: null, payments: {}, adjustments: [], payrollKeys: [] };
  (data || []).forEach((row) => {
    if (row.key === "pricing") out.pricing = row.value;
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

// Supabase session + the matching profile row (which carries the role).
function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(CLOUD_ENABLED);
  const [profileError, setProfileError] = useState("");
  const userId = session && session.user ? session.user.id : null;

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : "";
  };
  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) return { error: error.message };
    return { needsConfirm: !data.session };
  };
  const signOut = () => supabase.auth.signOut();

  return { loading, profile, profileError, signIn, signUp, signOut };
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
  const settersRef = useRef(setters);
  settersRef.current = setters;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const pendingRef = useRef(0);
  const dirtyRef = useRef(false);
  const queueRef = useRef(Promise.resolve());
  const payrollWrittenRef = useRef(new Map());
  const payrollKeysRef = useRef(new Set());

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
      const prevMap = new Map(prev.map((o) => [o.id, o]));
      const changed = next.filter((o) => prevMap.get(o.id) !== o);
      if (!changed.length) return;
      enqueue(async () => {
        for (const o of changed) {
          const p = prevMap.get(o.id);
          if (!p) {
            const { error: e } = await supabase.from("orders").insert(await orderToRow(o));
            if (e) throw e;
            continue;
          }
          for (let i = p.attempts.length; i < o.attempts.length; i += 1) {
            const row = await visitToRow(o, o.attempts[i], i + 1, o.courierId || profileRef.current.id);
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

    const markNotificationRead = async (id) => {
      const { error: e } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (e) setError(e.message);
    };

    const saveSetting = async (key, value) => {
      const { error: e } = await supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
      if (e) setError(e.message);
    };

    // Admin only: one payroll document per courier.
    const savePayroll = async (payments, adjustments, couriers) => {
      const idByName = new Map(couriers.map((c) => [c.name, c.id]));
      const docs = new Map();
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
        const { error: e } = await supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
        if (e) {
          setError(e.message);
          return;
        }
        payrollWrittenRef.current.set(key, json);
        payrollKeysRef.current.add(key);
      }
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
      markNotificationRead,
      saveSetting,
      savePayroll,
      registerCourier,
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
        api.refreshSettings(),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => later("p", api.refreshCouriers))
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => later("s", api.refreshSettings))
      .subscribe();
    return () => {
      alive = false;
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [profileId, api]);

  return { ready, error, clearError: () => setError(""), ...api };
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

// Email + password sign-in. Couriers and admins are registered by the system
// administrator (they sign up with the same email the admin registered);
// law-firm users can open an account themselves.
function LoginScreen({ onSignIn, onSignUp, profileError }) {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage({ type: "", text: "" });
    if (mode === "in") {
      const err = await onSignIn(email, password);
      if (err) setMessage({ type: "error", text: /invalid login/i.test(err) ? "אימייל או סיסמה שגויים" : err });
    } else {
      const res = await onSignUp(email, password, fullName);
      if (res.error) setMessage({ type: "error", text: res.error });
      else if (res.needsConfirm)
        setMessage({ type: "ok", text: "החשבון נוצר. שלחנו אליכם מייל אישור — אשרו אותו ואז התחברו." });
    }
    setBusy(false);
  };

  return (
    <div
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
      className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4"
    >
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
            <Gavel className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-extrabold text-indigo-700">מסירות משפטיות</p>
            <p className="text-xs text-slate-400">{mode === "in" ? "התחברות למערכת" : "פתיחת חשבון למשרד עורכי דין"}</p>
          </div>
        </div>

        <div className="space-y-3">
          {mode === "up" && (
            <Field label="שם מלא" required>
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
          )}
          <Field label="אימייל" required>
            <input
              type="email"
              dir="ltr"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="סיסמה" required>
            <input
              type="password"
              dir="ltr"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </Field>
        </div>

        {(message.text || profileError) && (
          <p
            role="alert"
            className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-inset ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-rose-200"
            }`}
          >
            {message.text || profileError}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
          {mode === "in" ? "התחברות" : "יצירת חשבון"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setMessage({ type: "", text: "" });
          }}
          className="mt-3 w-full text-center text-xs font-medium text-indigo-600 hover:underline"
        >
          {mode === "in" ? "משרד עורכי דין חדש? פתיחת חשבון" : "יש לכם חשבון? התחברות"}
        </button>
        <p className="mt-4 text-center text-[11px] text-slate-400">
          שליחים ומנהלים נרשמים על ידי מנהל המערכת — התחברו עם האימייל שנרשם עבורכם.
        </p>
      </form>
    </div>
  );
}

/* =========================================================================
   ROOT APP
   ========================================================================= */
// Public entry point: in cloud mode it gates the app behind sign-in and picks
// the view from the user's role; without Supabase keys it runs the demo.
export default function App() {
  useHeebo();
  const auth = useAuth();
  if (!CLOUD_ENABLED) return <AppShell profile={null} />;
  if (auth.loading) return <FullScreenLoader text="מתחבר..." />;
  if (!auth.profile) {
    return <LoginScreen onSignIn={auth.signIn} onSignUp={auth.signUp} profileError={auth.profileError} />;
  }
  return <AppShell key={auth.profile.id} profile={auth.profile} onSignOut={auth.signOut} />;
}

function AppShell({ profile, onSignOut }) {
  const cloudOn = !!profile;
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
  // In-app notifications for the Lawyer/Client portal. Created automatically
  // the moment any order is completed AND its affidavit signed — whoever
  // signed it (courier or Admin) — so every portal reads one shared source.
  const [notifications, setNotifications] = useState([]);

  // Cloud store: loads the role-scoped data, subscribes to Realtime and saves
  // changes (a no-op in demo mode, where `profile` is null).
  const cloud = useCloudStore(profile, {
    replaceOrders: (list) => {
      ordersRef.current = list;
      setOrdersState(list);
    },
    setNotifications,
    setCouriers,
    setPricing,
    setPayments,
    setAdjustments,
  });
  const persistOrders = cloud.persistOrders;

  // Every existing handler updates orders through this setter. It applies the
  // change locally at once (instant UI) and, in cloud mode, hands the
  // before/after lists to the sync engine, which saves only what changed.
  const setOrders = useCallback(
    (updater) => {
      const prev = ordersRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return;
      ordersRef.current = next;
      setOrdersState(next);
      if (cloudOn) persistOrders(prev, next);
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
      seenVisitsRef.current = new Set(visitKeys.map((v) => v.key));
    }
    const freshVisits = visitKeys.filter((v) => !seenVisitsRef.current.has(v.key));
    freshVisits.forEach((v) => seenVisitsRef.current.add(v.key));

    setNotifications((prev) => {
      const known = new Set(prev.map((n) => n.key || n.orderId));
      const visitNotes = freshVisits.map((v) => ({
        id: genId("NTF"),
        key: v.key,
        orderId: v.o.id,
        lawyer: v.o.submittedBy,
        message: `עדכון בזמן אמת: ביקור ${v.i + 1} (${v.a.type}) בוצע עבור מס' משימה ${v.o.id} — ${v.a.timestamp}`,
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

  const handleCreate = useCallback((form) => {
    setOrders((prev) => [
      {
        id: cloudOn
          ? `ORD-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`
          : `ORD-${1000 + prev.length + Math.floor(Math.random() * 100)}`,
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
        status: STATUS.PENDING,
        assignedCourier: "",
        createdDate: nowStamp(0),
        attempts: [],
        signature: null,
        priceOverride: { perAttempt: null, perCompleted: null },
        priceRequests: [],
        // Which signed-in lawyer submitted this order — the Lawyer Portal
        // uses this to show each lawyer only their own submissions.
        submittedBy: cloudOn ? profile.full_name : form.submittedBy || LAWYERS[0],
        // Cloud: row ownership (used by Row Level Security) + the attorney's
        // details, frozen onto the order for the affidavit's verification block.
        ...(cloudOn
          ? {
              lawyerId: profile.id,
              lawyerInfo: {
                licenseNo: profile.bar_license_no || "________",
                firm: profile.firm || "",
                address: profile.office_address || "",
                phone: profile.phone || "",
              },
            }
          : {}),
      },
      ...prev,
    ]);
  }, [cloudOn, profile, setOrders]);

  const handleUpdateOrder = useCallback((id, updater) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? updater(o) : o)));
  }, []);

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

  const handleAssignCourier = useCallback(
    (id, courier) => {
      // The courier's id (for Row Level Security) and a snapshot of the
      // details the affidavit needs travel with the order.
      const c = couriers.find((x) => x.name === courier);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id && !isAssignmentLocked(o)
            ? {
                ...o,
                assignedCourier: courier,
                courierId: c ? c.id : null,
                courierInfo: c ? { name: c.name, licenseNumber: c.licenseNumber, phone: c.phone } : null,
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
      return { ...prev, [key]: current === "paid" ? "unpaid" : "paid" };
    });
  }, []);

  const handleAddAdjustment = useCallback((adj) => {
    setAdjustments((prev) => [...prev, { id: genId("ADJ"), createdAt: nowStamp(0), ...adj }]);
  }, []);

  const handleRemoveAdjustment = useCallback((id) => {
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
  }, []);

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
        />
      )}
      {view === "admin" && (
        <AdminDashboard
          orders={orders}
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
          onSignAffidavit={handleAdminSignAffidavit}
        />
      )}
    </div>
    </SessionContext.Provider>
  );
}
