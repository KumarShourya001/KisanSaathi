import { useState } from "react";
import { Bandaids, Wind, Brain, BowlFood } from "@phosphor-icons/react";
import type { SymptomCategory } from "../../shared/types";
import { blockName } from "../../shared/blocks";
import { enqueue } from "../lib/db";
import type { Session } from "../lib/session";
import type { T } from "../lib/i18n";
import { ActionBar, Big, Body, IconTile, Note, Screen, TopBar, Field } from "../components/ui";
import { VoiceButton } from "../components/VoiceButton";
import { SpeakButton } from "../components/SpeakButton";

const AGE_BANDS = ["0 to 5", "6 to 17", "18 to 40", "41 to 60", "60 plus"];

/**
 * Severity shown as a filled scale, not only as a word.
 *
 * "Moderate" requires reading and requires calibration against a scale the
 * worker has to hold in her head. Three dots, of which two are filled, does
 * not. The word stays for workers who do read, and the plain description says
 * what the level means in terms of what the person can still do.
 */
function SeverityChoice({
  level,
  label,
  sub,
  selected,
  onClick,
}: {
  level: 1 | 2 | 3;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  const tone =
    level === 3
      ? { border: "border-crit", bg: "bg-crit-b", text: "text-crit", dot: "bg-crit" }
      : level === 2
        ? { border: "border-warn", bg: "bg-warn-b", text: "text-warn", dot: "bg-warn" }
        : { border: "border-forest", bg: "bg-forest-b", text: "text-forest", dot: "bg-forest" };

  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`press flex min-h-[64px] w-full items-center gap-3.5 rounded-card border px-4 py-3 text-left ${
        selected ? `border-2 ${tone.border} ${tone.bg}` : "border-rule bg-surface"
      }`}
    >
      <span className="flex shrink-0 gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`size-3.5 rounded-full ${
              n <= level ? tone.dot : "border-2 border-rule-2"
            }`}
          />
        ))}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[16px] font-semibold leading-tight ${selected ? tone.text : "text-ink"}`}
        >
          {label}
        </span>
        <span className={`block text-[12.5px] ${selected ? "opacity-80" : "text-muted"}`}>
          {sub}
        </span>
      </span>
    </button>
  );
}

export function HealthCapture({
  t,
  session,
  navigate,
}: {
  t: T;
  session: Session;
  navigate: (to: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<SymptomCategory | null>(null);
  const [severity, setSeverity] = useState<1 | 2 | 3 | null>(null);
  const [ageBand, setAgeBand] = useState("18 to 40");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const tiles: { key: SymptomCategory; label: string; icon: typeof Bandaids }[] = [
    { key: "dermal", label: t("skin"), icon: Bandaids },
    { key: "respiratory", label: t("breathing"), icon: Wind },
    { key: "neuro", label: t("head"), icon: Brain },
    { key: "gi", label: t("stomach"), icon: BowlFood },
  ];

  async function save() {
    if (!category || !severity || !session.block_id) return;
    setSaving(true);
    // No network call. The write is durable the moment IndexedDB accepts it.
    await enqueue("health", session.block_id, {
      observed_on: today,
      symptom_category: category,
      severity,
      age_band: ageBand,
      reporter_id: session.reporter_id,
    });
    navigate("/saved");
  }

  return (
    <Screen>
      {/* The header carries context; the question lives in the body next to
          its read-aloud control, so it is never stated twice. */}
      <TopBar
        title={blockName(session.block_id)}
        subtitle={today}
        onBack={() => (step === 1 ? navigate("/") : setStep(1))}
      />
      <Body>
        {/* Question restated in the body with a read-aloud control. A worker
            who cannot read the header cannot read a menu offering to read it
            either, so the control sits next to the question itself. */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[17px] font-semibold leading-tight">
            {step === 1 ? t("whatDidYouSee") : t("howBad")}
          </p>
          <SpeakButton
            text={step === 1 ? t("whatDidYouSee") : t("howBad")}
            lang={session.lang}
          />
        </div>

        {/* Progress as filled dots, not "Step 1 of 2", which requires reading. */}
        <div className="flex items-center gap-1.5" aria-label={t("stepOf", { a: step, b: 2 })}>
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-forest" : "bg-rule"}`}
            />
          ))}
        </div>

        {step === 1 ? (
          <>
            <VoiceButton
              t={t}
              lang={session.lang}
              onCategory={(c) => setCategory(c)}
              onSeverity={(s) => setSeverity(s)}
            />

            <div className="grid grid-cols-2 gap-3">
              {tiles.map((tile) => (
                <IconTile
                  key={tile.key}
                  label={tile.label}
                  icon={tile.icon}
                  selected={category === tile.key}
                  onClick={() => setCategory(tile.key)}
                />
              ))}
            </div>

          </>
        ) : (
          <>
            <SeverityChoice
              level={1}
              label={t("mild")}
              sub={t("mildSub")}
              selected={severity === 1}
              onClick={() => setSeverity(1)}
            />
            <SeverityChoice
              level={2}
              label={t("moderate")}
              sub={t("moderateSub")}
              selected={severity === 2}
              onClick={() => setSeverity(2)}
            />
            <SeverityChoice
              level={3}
              label={t("severe")}
              sub={t("severeSub")}
              selected={severity === 3}
              onClick={() => setSeverity(3)}
            />

            <div className="pt-1">
              <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                {t("ageBand")}
              </p>
              <div className="flex flex-wrap gap-2">
                {AGE_BANDS.map((band) => (
                  <button
                    key={band}
                    onClick={() => setAgeBand(band)}
                    aria-pressed={ageBand === band}
                    className={`press min-h-[46px] min-w-[56px] rounded-full border px-3.5 text-[14px] font-medium ${
                      ageBand === band
                        ? "border-forest bg-forest-b text-forest"
                        : "border-rule bg-surface text-muted"
                    }`}
                  >
                    {band}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-card border border-rule bg-surface px-4">
              <Field label={t("block")} value={session.block_id ?? ""} />
              <Field label={t("date")} value={today} />
            </div>

            <Note>
              Captured automatically: the block and the date. A worker never
              types either, so the join key cannot be mistyped.
            </Note>
          </>
        )}
      </Body>

      <ActionBar>
        {step === 1 ? (
          <Big label={t("next")} disabled={!category} onClick={() => setStep(2)} />
        ) : (
          <Big
            label={t("saveToDevice")}
            sub={t("sendsWhenSignal")}
            disabled={!severity || saving}
            onClick={save}
          />
        )}
      </ActionBar>
    </Screen>
  );
}
