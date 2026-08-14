import { useState } from "react";
import { Plant, SprayBottle } from "@phosphor-icons/react";
import type { InputClass } from "../../shared/types";
import { HAZARDOUS_INPUTS } from "../../shared/types";
import { enqueue } from "../lib/db";
import type { Session } from "../lib/session";
import type { T } from "../lib/i18n";
import { Big, Body, Choice, Field, Note, Screen, TopBar } from "../components/ui";

const INPUTS: { key: InputClass; label: string; note: string }[] = [
  { key: "organophosphate", label: "Organophosphate", note: "WHO Class II" },
  { key: "carbamate", label: "Carbamate", note: "WHO Class II" },
  { key: "pyrethroid", label: "Pyrethroid", note: "Lower hazard" },
  { key: "herbicide", label: "Herbicide", note: "Weed control" },
  { key: "fertiliser", label: "Fertiliser", note: "Nutrient" },
  { key: "biological", label: "Biological", note: "Bio control" },
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
      <TopBar
        title={t("whatDidYouApply")}
        subtitle={`${session.block_id} · ${today}`}
        onBack={() => navigate("/")}
      />
      <Body>
        {INPUTS.map((i) => (
          <Choice
            key={i.key}
            label={i.label}
            sub={i.note}
            selected={inputClass === i.key}
            tone={HAZARDOUS_INPUTS.includes(i.key) ? "warn" : undefined}
            onClick={() => setInputClass(i.key)}
          />
        ))}

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
                className={`press min-h-[42px] rounded-full border px-3.5 text-[13px] font-medium capitalize ${
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
                className={`press tabular min-h-[42px] rounded-full border px-4 text-[13px] font-medium ${
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

        <div className="flex-1" />
        <Big
          label={t("saveToDevice")}
          sub={t("sendsWhenSignal")}
          icon={SprayBottle}
          disabled={!inputClass || saving}
          onClick={save}
        />
      </Body>
    </Screen>
  );
}
