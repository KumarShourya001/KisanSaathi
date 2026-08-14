import { useEffect, useRef, useState } from "react";
import { Microphone, MicrophoneSlash } from "@phosphor-icons/react";
import type { SymptomCategory } from "../../shared/types";
import { categoryFromSpeech, severityFromSpeech, webSpeech, sarvamSpeech } from "../lib/voice";
import { SPEECH_LOCALES, type T } from "../lib/i18n";
import type { Lang } from "../lib/session";

/**
 * Voice is a shortcut into the structured form, never a replacement for it.
 *
 * The transcript is used only to preselect a category, the selection is shown
 * on screen, and the worker confirms it before saving. Nothing spoken is
 * stored. That keeps a misrecognition visible and correctable, and it keeps
 * free-text clinical description out of the record entirely, which is what
 * makes the data joinable in the first place.
 */
export function VoiceButton({
  t,
  lang,
  onCategory,
  onSeverity,
}: {
  t: T;
  lang: Lang;
  onCategory: (c: SymptomCategory) => void;
  onSeverity: (s: 1 | 2 | 3) => void;
}) {
  const recogniser = sarvamSpeech.supported ? sarvamSpeech : webSpeech;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  if (!recogniser.supported) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-rule bg-sunk px-4 py-3 text-muted">
        <MicrophoneSlash size={22} />
        <p className="text-[12.5px] leading-snug">
          Voice entry needs Chrome or Edge. Tap a symptom below instead.
        </p>
      </div>
    );
  }

  function toggle() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    setError(null);
    setHeard("");
    setListening(true);

    stopRef.current = recogniser.listen(SPEECH_LOCALES[lang], {
      onResult: (transcript, isFinal) => {
        setHeard(transcript);
        if (!isFinal) return;
        const category = categoryFromSpeech(transcript);
        if (category) onCategory(category);
        const severity = severityFromSpeech(transcript);
        if (severity) onSeverity(severity);
        if (!category) setError("Could not match that to a symptom. Tap one below.");
      },
      onError: (message) => setError(message),
      onEnd: () => setListening(false),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={toggle}
        aria-pressed={listening}
        className={`press flex min-h-[68px] items-center gap-3.5 rounded-card border-2 border-dashed px-4 py-3 text-left ${
          listening
            ? "border-forest bg-forest-b"
            : "border-rule-2 bg-surface"
        }`}
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
            listening ? "bg-forest pulse" : "bg-forest"
          }`}
        >
          <Microphone size={21} weight="fill" className="text-on-forest" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">
            {listening ? "Listening" : t("holdToSpeak")}
          </span>
          <span className="block text-xs text-muted">
            {heard ? `${t("heard")}: ${heard}` : t("speakHint")}
          </span>
        </span>
      </button>

      {error && (
        <p role="alert" className="px-1 text-[12.5px] text-crit">
          {error}
        </p>
      )}
    </div>
  );
}
