import { useState } from "react";
import { Plant, SprayBottle } from "@phosphor-icons/react";
import type { InputClass } from "../../shared/types";
import { HAZARDOUS_INPUTS } from "../../shared/types";
import { blockName } from "../../shared/blocks";
import { enqueue } from "../lib/db";
import type { Session } from "../lib/session";
import type { T } from "../lib/i18n";
import { ActionBar, Big, Body, Field, Note, Screen, TopBar } from "../components/ui";
import { SpeakButton } from "../components/SpeakButton";

/**
 * Plain description first, chemical class second.
 *
 * "Organophosphate" is not a word a farmer with limited schooling uses. What
 * they know is what it does and how strong it is. The hazard scale is drawn as
 * filled dots so the danger is legible without reading anything at all, and
 * the technical name stays for the agri worker and for the record.
 */
const INPUTS: { key: InputClass; label: string; note: string; hazard: 1 | 2 | 3 }[] = [
  { key: "organophosphate", label: "Organophosphate", note: "Insect killer, strong", hazard: 3 },
  { key: "carbamate", label: "Carbamate", note: "Insect killer, strong", hazard: 3 },
  { key: "pyrethroid", label: "Pyrethroid", note: "Insect killer, milder", hazard: 2 },
  { key: "herbicide", label: "Herbicide", note: "Kills weeds", hazard: 2 },
  { key: "fertiliser", label: "Fertiliser", note: "Plant food", hazard: 1 },
  { key: "biological", label: "Biological", note: "Natural control", hazard: 1 },
];

const CROPS = ["cotton", "soybean", "pigeon pea", "sorghum"];
const AREAS = [0.5, 1, 2, 3, 5];

export function AgriCapture({
  t,
  session,
  navigate,
}: {
  t: T;
  session: Session;
  navigate: (to: string) => void;
}) {
  const [inputClass, setInputClass] = useState<InputClass | null>(null);
  const [crop, setCrop] = useState("cotton");
  const [area, setArea] = useState(1);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const hazardous = inputClass ? HAZARDOUS_INPUTS.includes(inputClass) : false;

  async function save() {
    if (!inputClass || !session.block_id) return;
    setSaving(true);
    await enqueue("agri", session.block_id, {
      applied_on: today,
      input_class: inputClass,
      crop,
      area_ha: area,
      reporter_id: session.reporter_id,
    });
    navigate("/saved");
  }

  return (
    <Screen>
      {/* Header carries context, body carries the question and its
          read-aloud control. Never state the same thing twice. */}
      <TopBar
        title={blockName(session.block_id)}
        subtitle={today}
        onBack={() => navigate("/")}
      />
      <Body>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[17px] font-semibold leading-tight">
            {t("whatDidYouApply")}
          </p>
          <SpeakButton text={t("whatDidYouApply")} lang={session.lang} />
        </div>

        {/* Two columns rather than six stacked rows: the same six options in
            half the vertical space, so the rest of the form stays on screen. */}
        <div className="grid grid-cols-2 gap-2.5">
          {INPUTS.map((i) => {
            const hazardous = HAZARDOUS_INPUTS.includes(i.key);
            const selected = inputClass === i.key;
            return (
              <button
                key={i.key}
                onClick={() => setInputClass(i.key)}
                aria-pressed={selected}
                className={`press flex min-h-[68px] flex-col justify-center gap-0.5 rounded-card border px-3 py-2.5 text-left ${
                  selected
                    ? hazardous
                      ? "border-2 border-warn bg-warn-b"
                      : "border-2 border-forest bg-forest-b"
                    : "border-rule bg-surface"
                }`}
              >
                {/* Hazard as a filled scale, readable without literacy. */}
                <span className="flex gap-1 pb-0.5" aria-label={`Hazard level ${i.hazard} of 3`}>
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className={`size-2 rounded-full ${
                        n <= i.hazard
                          ? i.hazard === 3
                            ? "bg-crit"
                            : i.hazard === 2
                              ? "bg-warn"
                              : "bg-forest"
                          : "border border-rule-2"
                      }`}
                    />
                  ))}
                </span>
                <span
                  className={`text-[13.5px] font-semibold leading-tight ${
                    selected ? (hazardous ? "text-warn" : "text-forest") : "text-ink"
                  }`}
                >
                  {i.note}
                </span>
                <span
                  className={`text-[10.5px] leading-tight ${selected ? "opacity-70" : "text-muted"}`}
                >
                  {i.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-1">
          <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            {t("crop")}
          </p>
          <div className="flex flex-wrap gap-2">
            {CROPS.map((c) => (
              <button
                key={c}
                onClick={() => setCrop(c)}
                aria-pressed={crop === c}
                className={`press min-h-[46px] min-w-[56px] rounded-full border px-3.5 text-[14px] font-medium capitalize ${
                  crop === c
                    ? "border-forest bg-forest-b text-forest"
                    : "border-rule bg-surface text-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            {t("areaHa")}
          </p>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => setArea(a)}
                aria-pressed={area === a}
                // min-w matters here: a one-character label like "1" renders a
                // 41px target, under the 44px minimum, even though the height
                // is fine.
                className={`press tabular min-h-[46px] min-w-[56px] rounded-full border px-4 text-[14px] font-medium ${
                  area === a
                    ? "border-forest bg-forest-b text-forest"
                    : "border-rule bg-surface text-muted"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {hazardous && (
          <Note tone="warn">
            This is a WHO Class II compound. Applications of these are what the
            exposure rule counts, so this entry can move a block flag on its
            own.
          </Note>
        )}

        <div className="rounded-card border border-rule bg-surface px-4">
          <Field label={t("block")} value={session.block_id ?? ""} />
          <Field label={t("appliedOn")} value={today} />
        </div>
      </Body>

      <ActionBar>
        <Big
          label={t("saveToDevice")}
          sub={t("sendsWhenSignal")}
          icon={SprayBottle}
          disabled={!inputClass || saving}
          onClick={save}
        />
      </ActionBar>
    </Screen>
  );
}
