import { useState } from "react";
import { Bandaids, Wind, Brain, BowlFood } from "@phosphor-icons/react";
import type { SymptomCategory } from "../../shared/types";
import { blockName } from "../../shared/blocks";
import { enqueue } from "../lib/db";
import type { Session } from "../lib/session";
import type { T } from "../lib/i18n";
import { Big, Body, Choice, IconTile, Note, Screen, TopBar, Field } from "../components/ui";
import { VoiceButton } from "../components/VoiceButton";

const AGE_BANDS = ["0 to 5", "6 to 17", "18 to 40", "41 to 60", "60 plus"];

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
      <TopBar
        title={step === 1 ? t("whatDidYouSee") : t("howBad")}
        subtitle={t("stepOf", { a: step, b: 2 })}
        onBack={() => (step === 1 ? navigate("/") : setStep(1))}
      />
      <Body>
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

            <div className="flex-1" />
            <Big
              label={t("next")}
              disabled={!category}
              onClick={() => setStep(2)}
            />
          </>
        ) : (
          <>
            <Choice
              label={t("mild")}
              sub={t("mildSub")}
              selected={severity === 1}
              onClick={() => setSeverity(1)}
            />
            <Choice
              label={t("moderate")}
              sub={t("moderateSub")}
              selected={severity === 2}
              tone="warn"
              onClick={() => setSeverity(2)}
            />
            <Choice
              label={t("severe")}
              sub={t("severeSub")}
              selected={severity === 3}
              tone="crit"
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
                    className={`press min-h-[42px] rounded-full border px-3.5 text-[13px] font-medium ${
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

            <div className="flex-1" />
            <Big
              label={t("saveToDevice")}
              sub={t("sendsWhenSignal")}
              disabled={!severity || saving}
              onClick={save}
            />
          </>
        )}
      </Body>
    </Screen>
  );
}
