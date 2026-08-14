import type { SymptomCategory } from "../../shared/types";

/**
 * Voice input, behind an adapter.
 *
 * The prototype uses the browser's Web Speech API: zero signup, zero cost,
 * supports hi-IN and mr-IN in Chrome on Android, and it cannot fail on
 * deadline day because of an unactivated API key.
 *
 * Sarvam AI is the intended production recogniser for its code-mixed and
 * low-resource Indian language handling. Swapping is this file and nothing
 * else: implement the same two methods against their endpoint. Do not claim
 * Sarvam is running until it is.
 */

export interface Recogniser {
  supported: boolean;
  /** Returns a stop function. */
  listen(
    locale: string,
    handlers: {
      onResult: (transcript: string, isFinal: boolean) => void;
      onError: (message: string) => void;
      onEnd: () => void;
    },
  ): () => void;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export const webSpeech: Recogniser = {
  get supported() {
    return getConstructor() !== null;
  },

  listen(locale, { onResult, onError, onEnd }) {
    const Ctor = getConstructor();
    if (!Ctor) {
      onError("Speech recognition is not available in this browser.");
      onEnd();
      return () => {};
    }

    const rec = new Ctor();
    rec.lang = locale;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onResult(transcript.trim(), isFinal);
    };
    rec.onerror = (event: any) => {
      const code = event?.error ?? "unknown";
      onError(
        code === "not-allowed"
          ? "Microphone permission was refused."
          : code === "no-speech"
            ? "Nothing was heard. Try again."
            : `Speech recognition failed: ${code}`,
      );
    };
    rec.onend = onEnd;

    try {
      rec.start();
    } catch {
      onError("Could not start the microphone.");
      onEnd();
    }

    return () => {
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    };
  },
};

/**
 * Maps a spoken phrase onto one of the four structured categories.
 *
 * Free text is never stored. The transcript only selects a category, and the
 * worker confirms the selection on screen before saving, so a misrecognition
 * is visible and correctable rather than silently written to the record.
 */
const KEYWORDS: Record<SymptomCategory, string[]> = {
  dermal: [
    "skin", "rash", "itch", "itching", "burn", "burning", "blister", "red",
    "त्वचा", "खुजली", "जलन", "चकत्ते", "दाने", "खाज", "पुरळ",
  ],
  respiratory: [
    "breath", "breathing", "cough", "chest", "wheeze", "short of breath",
    "साँस", "सांस", "खांसी", "खाँसी", "छाती", "दमा", "श्वास", "खोकला",
  ],
  neuro: [
    "head", "headache", "dizzy", "dizziness", "faint", "blurred", "shaking",
    "tremor", "vomit nerve", "सिर", "चक्कर", "सिरदर्द", "कंपन", "बेहोश",
    "डोके", "चक्कर येणे",
  ],
  gi: [
    "stomach", "vomit", "vomiting", "nausea", "diarrhoea", "diarrhea", "belly",
    "पेट", "उल्टी", "मतली", "दस्त", "पोट", "उलटी", "जुलाब",
  ],
};

export function categoryFromSpeech(transcript: string): SymptomCategory | null {
  const text = transcript.toLowerCase();
  let best: { category: SymptomCategory; at: number } | null = null;

  for (const [category, words] of Object.entries(KEYWORDS) as [SymptomCategory, string[]][]) {
    for (const word of words) {
      const at = text.indexOf(word.toLowerCase());
      if (at !== -1 && (best === null || at < best.at)) {
        best = { category, at };
      }
    }
  }
  return best?.category ?? null;
}

/** Severity words, same treatment: a hint the worker confirms, never a value
 *  written straight to the record. */
export function severityFromSpeech(transcript: string): 1 | 2 | 3 | null {
  const text = transcript.toLowerCase();
  if (/severe|serious|bad|गंभीर|तीव्र|खूप/.test(text)) return 3;
  if (/moderate|medium|मध्यम/.test(text)) return 2;
  if (/mild|slight|हल्का|सौम्य/.test(text)) return 1;
  return null;
}
