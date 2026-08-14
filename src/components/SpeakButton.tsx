import { useEffect, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { readAloud } from "../lib/voice";
import { SPEECH_LOCALES } from "../lib/i18n";
import type { Lang } from "../lib/session";

/**
 * Reads the screen's question aloud.
 *
 * Speech recognition alone only solves half of a low-literacy interface: it
 * lets someone who cannot type still enter data, but it does nothing for
 * someone who cannot read the question. This is the other half, and it is the
 * cheaper half, because the browser already has a speech synthesiser.
 *
 * Placed beside the question rather than in a settings menu, because a user
 * who cannot read the question also cannot read a menu item offering to read
 * the question.
 */
export function SpeakButton({
  text,
  lang,
  label = "Listen",
}: {
  text: string;
  lang: Lang;
  label?: string;
}) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => readAloud.stop(), []);

  if (!readAloud.supported) return null;

  function toggle() {
    if (speaking) {
      readAloud.stop();
      setSpeaking(false);
      return;
    }
    readAloud.speak(text, SPEECH_LOCALES[lang]);
    setSpeaking(true);
    // No reliable end event across engines, so fall back to polling the queue.
    const id = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        window.clearInterval(id);
      }
    }, 300);
  }

  return (
    <button
      onClick={toggle}
      aria-label={speaking ? "Stop reading" : `Read aloud: ${text}`}
      className={`press flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold ${
        speaking
          ? "border-forest bg-forest text-on-forest"
          : "border-rule bg-surface text-forest"
      }`}
    >
      {speaking ? <SpeakerSlash size={17} weight="fill" /> : <SpeakerHigh size={17} />}
      {label}
    </button>
  );
}
