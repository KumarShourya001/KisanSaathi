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
 * Sarvam recogniser, via our own server so the API key never reaches the phone.
 *
 * Records a short clip with MediaRecorder, POSTs it to /api/transcribe, and
 * returns the transcript through the same Recogniser interface the Web Speech
 * path uses, so VoiceButton does not care which one it got.
 *
 * `supported` is false until a probe confirms the server actually has a key
 * configured. That default matters: with no key the app silently keeps using
 * Web Speech, which is the path that is known to work. Sarvam is better at
 * code-mixed Hindi and Marathi, so it wins when it is available.
 */

let sarvamReady = false;

/** Probe once at startup. Failure is not an error; it just means Web Speech. */
export async function probeSarvam(): Promise<boolean> {
  try {
    const res = await fetch("/api/transcribe", { method: "GET" });
    if (!res.ok) return false;
    const body = (await res.json()) as { configured?: boolean };
    sarvamReady = Boolean(body.configured);
  } catch {
    sarvamReady = false;
  }
  return sarvamReady;
}

export const sarvamSpeech: Recogniser = {
  get supported() {
    return (
      sarvamReady &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  },

  listen(locale, { onResult, onError, onEnd }) {
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const stopTracks = () => stream?.getTracks().forEach((t) => t.stop());

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const chunks: BlobPart[] = [];
        recorder = new MediaRecorder(s);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          stopTracks();
          if (cancelled || chunks.length === 0) {
            onEnd();
            return;
          }
          try {
            const form = new FormData();
            form.append("audio", new Blob(chunks, { type: "audio/webm" }), "clip.webm");
            form.append("language", locale);
            const res = await fetch("/api/transcribe", { method: "POST", body: form });
            if (!res.ok) throw new Error(`transcribe ${res.status}`);
            const body = (await res.json()) as { transcript?: string };
            const text = (body.transcript ?? "").trim();
            if (text) onResult(text, true);
            else onError("Nothing was heard. Try again.");
          } catch (err) {
            onError(err instanceof Error ? err.message : "Transcription failed.");
          } finally {
            onEnd();
          }
        };

        recorder.start();
        // Field entries are a word or two. Cap the clip so a forgotten tap
        // does not upload a minute of audio over a metered connection.
        window.setTimeout(() => {
          if (recorder && recorder.state === "recording") recorder.stop();
        }, 6000);
      })
      .catch(() => {
        onError("Microphone permission was refused.");
        onEnd();
      });

    return () => {
      cancelled = true;
      if (recorder && recorder.state === "recording") recorder.stop();
      else stopTracks();
    };
  },
};

/**
 * Read-aloud, the other half of a voice-first interface.
 *
 * Speech recognition lets a worker who cannot type still enter data. Speech
 * synthesis lets a worker who cannot read still understand what is being
 * asked. A low-literacy interface needs both directions, and only having the
 * input half is a common and serious omission.
 *
 * SpeechSynthesis ships in the browser, costs nothing, needs no key, and on
 * Android it works with no network once the language pack is present. Voices
 * for hi-IN and mr-IN are not guaranteed on every device, so `voiceFor` falls
 * back rather than failing silently.
 */
export const readAloud = {
  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  voiceFor(locale: string): SpeechSynthesisVoice | null {
    if (!this.supported) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === locale) ??
      voices.find((v) => v.lang.startsWith(locale.split("-")[0])) ??
      null
    );
  },

  speak(text: string, locale: string): void {
    if (!this.supported || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    const voice = this.voiceFor(locale);
    if (voice) utterance.voice = voice;
    // Slower than default: these are instructions, not prose, and the
    // listener may be hearing the app for the first time.
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  },

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
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
