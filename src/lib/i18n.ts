import type { Lang } from "./session";

/**
 * String table. Hindi and Marathi cover the field-worker path in full, which
 * is the path a low-literacy user actually walks. The block officer console is
 * English-first because it is used by clinical and administrative staff who
 * work in English, and pretending otherwise would be decoration rather than
 * accessibility. Missing keys fall back to English rather than rendering blank.
 */

type Key =
  | "appName" | "whoIsUsing" | "roleAsha" | "roleAshaSub" | "roleAgri"
  | "roleAgriSub" | "roleOfficer" | "roleOfficerSub" | "language"
  | "offline" | "online" | "queued" | "syncing" | "synced" | "syncNow"
  | "logHealth" | "logHealthSub" | "logAgri" | "logAgriSub"
  | "waitingToSend" | "nothingQueued" | "recentEntries"
  | "whatDidYouSee" | "stepOf" | "holdToSpeak" | "speakHint" | "heard"
  | "skin" | "breathing" | "head" | "stomach"
  | "howBad" | "mild" | "mildSub" | "moderate" | "moderateSub" | "severe" | "severeSub"
  | "ageBand" | "block" | "date" | "saveToDevice" | "sendsWhenSignal"
  | "next" | "back" | "saved" | "savedSub"
  | "inputClass" | "crop" | "areaHa" | "appliedOn" | "whatDidYouApply"
  | "activeFlags" | "noFlags" | "recommendedAction" | "evidence"
  | "consent" | "purpose" | "sharedWith" | "identity" | "notAttached"
  | "granted" | "expires" | "withdraw" | "changeRole" | "resetDemo";

type Table = Record<Key, string>;

const en: Table = {
  appName: "Rural Bridge",
  whoIsUsing: "Who is using this device?",
  roleAsha: "ASHA worker",
  roleAshaSub: "Log health visits",
  roleAgri: "Agri worker",
  roleAgriSub: "Log input applications",
  roleOfficer: "Block officer",
  roleOfficerSub: "Review risk flags",
  language: "Language",

  offline: "Offline",
  online: "Online",
  queued: "queued",
  syncing: "Sending",
  synced: "All sent",
  syncNow: "Send now",

  logHealth: "Log a health visit",
  logHealthSub: "Works without signal",
  logAgri: "Log an input application",
  logAgriSub: "Works without signal",

  waitingToSend: "Waiting to send",
  nothingQueued: "Everything on this device has been sent.",
  recentEntries: "Recent entries",

  whatDidYouSee: "What did you see?",
  stepOf: "Step {a} of {b}",
  holdToSpeak: "Tap to speak",
  speakHint: "Say the symptom out loud",
  heard: "Heard",

  skin: "Skin",
  breathing: "Breathing",
  head: "Head",
  stomach: "Stomach",

  howBad: "How bad is it?",
  mild: "Mild",
  mildSub: "Noticed it, still working",
  moderate: "Moderate",
  moderateSub: "Stopped work, no clinic",
  severe: "Severe",
  severeSub: "Needs referral today",

  ageBand: "Age band",
  block: "Block",
  date: "Date",
  saveToDevice: "Save to device",
  sendsWhenSignal: "Sends when signal returns",

  next: "Next",
  back: "Back",
  saved: "Saved on this device",
  savedSub: "It will send itself when the signal returns.",

  inputClass: "What was applied?",
  crop: "Crop",
  areaHa: "Area in hectares",
  appliedOn: "Applied on",
  whatDidYouApply: "What did you apply?",

  activeFlags: "Active risk flags",
  noFlags: "No block is above threshold today.",
  recommendedAction: "Recommended action",
  evidence: "Evidence",

  consent: "Consent for this record",
  purpose: "Purpose",
  sharedWith: "Shared with",
  identity: "Identity",
  notAttached: "Not attached",
  granted: "Granted",
  expires: "Expires",
  withdraw: "Withdraw consent",
  changeRole: "Change role",
  resetDemo: "Reset demo data",
};

const hi: Partial<Table> = {
  whoIsUsing: "यह डिवाइस कौन चला रहा है?",
  roleAsha: "आशा कार्यकर्ता",
  roleAshaSub: "स्वास्थ्य दौरे दर्ज करें",
  roleAgri: "कृषि कार्यकर्ता",
  roleAgriSub: "छिड़काव दर्ज करें",
  roleOfficer: "ब्लॉक अधिकारी",
  roleOfficerSub: "जोखिम चेतावनी देखें",
  language: "भाषा",

  offline: "ऑफ़लाइन",
  online: "ऑनलाइन",
  queued: "बाकी",
  syncing: "भेजा जा रहा है",
  synced: "सब भेज दिया",
  syncNow: "अभी भेजें",

  logHealth: "स्वास्थ्य दौरा दर्ज करें",
  logHealthSub: "बिना सिग्नल के काम करता है",
  logAgri: "छिड़काव दर्ज करें",
  logAgriSub: "बिना सिग्नल के काम करता है",

  waitingToSend: "भेजने के लिए बाकी",
  nothingQueued: "इस डिवाइस से सब कुछ भेजा जा चुका है।",
  recentEntries: "हाल की प्रविष्टियाँ",

  whatDidYouSee: "आपने क्या देखा?",
  stepOf: "चरण {a} / {b}",
  holdToSpeak: "बोलने के लिए दबाएँ",
  speakHint: "लक्षण बोलकर बताइए",
  heard: "सुना",

  skin: "त्वचा",
  breathing: "साँस",
  head: "सिर",
  stomach: "पेट",

  howBad: "यह कितना गंभीर है?",
  mild: "हल्का",
  mildSub: "दिखा, पर काम जारी है",
  moderate: "मध्यम",
  moderateSub: "काम रुका, अस्पताल नहीं गए",
  severe: "गंभीर",
  severeSub: "आज ही रेफर करना है",

  ageBand: "आयु वर्ग",
  block: "ब्लॉक",
  date: "तारीख",
  saveToDevice: "डिवाइस में सहेजें",
  sendsWhenSignal: "सिग्नल आने पर भेजा जाएगा",

  next: "आगे",
  back: "पीछे",
  saved: "डिवाइस में सहेजा गया",
  savedSub: "सिग्नल आते ही यह अपने आप भेज दिया जाएगा।",

  inputClass: "क्या छिड़का गया?",
  crop: "फ़सल",
  areaHa: "क्षेत्र (हेक्टेयर)",
  appliedOn: "छिड़काव की तारीख",
  whatDidYouApply: "आपने क्या छिड़का?",
  changeRole: "भूमिका बदलें",
};

const mr: Partial<Table> = {
  whoIsUsing: "हे डिव्हाइस कोण वापरत आहे?",
  roleAsha: "आशा सेविका",
  roleAshaSub: "आरोग्य भेटी नोंदवा",
  roleAgri: "कृषी कर्मचारी",
  roleAgriSub: "फवारणी नोंदवा",
  roleOfficer: "तालुका अधिकारी",
  roleOfficerSub: "धोका सूचना पहा",
  language: "भाषा",

  offline: "ऑफलाइन",
  online: "ऑनलाइन",
  queued: "बाकी",
  syncing: "पाठवत आहे",
  synced: "सर्व पाठवले",
  syncNow: "आता पाठवा",

  logHealth: "आरोग्य भेट नोंदवा",
  logHealthSub: "सिग्नलशिवाय चालते",
  logAgri: "फवारणी नोंदवा",
  logAgriSub: "सिग्नलशिवाय चालते",

  waitingToSend: "पाठवायचे बाकी",
  nothingQueued: "या डिव्हाइसवरून सर्व काही पाठवले गेले आहे.",
  recentEntries: "अलीकडील नोंदी",

  whatDidYouSee: "तुम्ही काय पाहिले?",
  stepOf: "पायरी {a} / {b}",
  holdToSpeak: "बोलण्यासाठी दाबा",
  speakHint: "लक्षण मोठ्याने सांगा",
  heard: "ऐकले",

  skin: "त्वचा",
  breathing: "श्वास",
  head: "डोके",
  stomach: "पोट",

  howBad: "किती गंभीर आहे?",
  mild: "सौम्य",
  mildSub: "जाणवले, काम सुरू आहे",
  moderate: "मध्यम",
  moderateSub: "काम थांबले, दवाखाना नाही",
  severe: "तीव्र",
  severeSub: "आजच संदर्भ द्यावा",

  ageBand: "वयोगट",
  block: "तालुका",
  date: "तारीख",
  saveToDevice: "डिव्हाइसमध्ये जतन करा",
  sendsWhenSignal: "सिग्नल आल्यावर पाठवले जाईल",

  next: "पुढे",
  back: "मागे",
  saved: "डिव्हाइसवर जतन झाले",
  savedSub: "सिग्नल आल्यावर ते आपोआप पाठवले जाईल.",

  inputClass: "काय फवारले?",
  crop: "पीक",
  areaHa: "क्षेत्र (हेक्टर)",
  appliedOn: "फवारणीची तारीख",
  whatDidYouApply: "तुम्ही काय फवारले?",
  changeRole: "भूमिका बदला",
};

const TABLES: Record<Lang, Partial<Table>> = { en, hi, mr };

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
};

/** BCP 47 tags for the speech recogniser. */
export const SPEECH_LOCALES: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

export function translator(lang: Lang) {
  return function t(key: Key, vars?: Record<string, string | number>): string {
    const raw = TABLES[lang]?.[key] ?? en[key];
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
  };
}

export type T = ReturnType<typeof translator>;
