import { useEffect, useState } from "react";
import { Users, SprayBottle, Thermometer, Warning } from "@phosphor-icons/react";
import type { CorrelationFlag } from "../../shared/types";
import { api } from "../lib/api";
import {
  Big,
  Body,
  Card,
  Note,
  Screen,
  SeverityPill,
  TopBar,
  TwinSpark,
} from "../components/ui";

const RULE_ICON = {
  exposure: SprayBottle,
  heat: Thermometer,
  composite: Warning,
} as const;

/**
 * The screen the whole product exists to produce.
 *
 * Observed against expected for both feeds, with the action attached and
 * addressed to a named role. The comparison is shown as a pair of figures
 * rather than buried in a sentence, because "9 against under 1" is the finding
 * and the prose around it is only there to explain how it was reached.
 */
export function FlagDetail({
  flagId,
  navigate,
}: {
  flagId: string;
  navigate: (to: string) => void;
}) {
  const [flag, setFlag] = useState<CorrelationFlag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .correlations()
      .then((data) => {
        if (!alive) return;
        setFlag(data.flags.find((f) => f.flag_id === flagId) ?? null);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, [flagId]);

  if (error) {
    return (
      <Screen>
        <TopBar title="Flag" onBack={() => navigate("/")} />
        <Body>
          <Card>
            <p className="text-[14px] font-semibold text-crit">
              Could not load this flag
            </p>
            <p className="pt-1 text-[13px] text-muted">{error}</p>
          </Card>
        </Body>
      </Screen>
    );
  }

  if (!flag) {
    return (
      <Screen>
        <TopBar title="Flag" onBack={() => navigate("/")} />
        <Body>
          <div className="pulse h-24 rounded-card border border-rule bg-sunk" />
          <div className="pulse h-40 rounded-card border border-rule bg-sunk" />
        </Body>
      </Screen>
    );
  }

  const e = flag.evidence;
  const Icon = RULE_ICON[flag.rule];

  return (
    <Screen>
      <TopBar
        title={flag.block_name}
        subtitle={`${flag.window_start} to ${flag.window_end}`}
        onBack={() => navigate("/")}
      />
      <Body>
        <div className="rise flex items-center gap-2">
          <SeverityPill severity={flag.severity} rule={flag.rule} />
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            {flag.confidence} confidence
          </span>
        </div>

        <h2 className="rise flex items-start gap-2.5 text-[19px] font-semibold leading-snug tracking-tight">
          <Icon size={22} className="mt-0.5 shrink-0 text-muted" />
          {flag.headline}
        </h2>

        {/* The finding, as figures. Observed on the left, this block's own
            baseline on the right, ratio between them. */}
        <div className="rise flex flex-col gap-2" style={{ animationDelay: "60ms" }}>
          {e.applications_observed !== undefined && (
            <Compare
              label="Class II applications, 7 days"
              observed={e.applications_observed}
              expected={e.applications_expected ?? 0}
              unit="per week"
            />
          )}
          {e.symptoms_observed !== undefined && (
            <Compare
              label={`${(e.symptom_categories ?? []).join(", ") || "Symptom"} reports`}
              observed={e.symptoms_observed}
              expected={e.symptoms_expected ?? 0}
              unit="baseline"
              tone="crit"
            />
          )}
          {e.peak_heat_index_c !== undefined && (
            <Compare
              label="Peak heat index"
              observed={e.peak_heat_index_c}
              expected={40}
              unit="threshold"
              suffix="C"
              tone="warn"
            />
          )}
        </div>

        {e.series_agri && e.series_health && (
          <Card className="rise" >
            <TwinSpark agri={e.series_agri} health={e.series_health} height={70} />
            <div className="flex items-center gap-4 pt-2.5">
              <Legend color="var(--crit)" label="Symptom reports" />
              <Legend color="var(--forest)" label="Class II applications" />
            </div>
            <p className="pt-2 font-mono text-[10.5px] text-muted">
              {e.series_start} onward, one bar per day
            </p>
          </Card>
        )}

        <Note tone={flag.severity === "high" ? "crit" : "warn"}>
          {flag.explanation}
        </Note>

        <p className="px-0.5 text-[12px] leading-relaxed text-muted">
          Expected is this block's own 60 day baseline, with the two weeks
          before the window excluded so a spike cannot inflate the baseline it
          is measured against.
        </p>

        <div className="flex-1" />

        <div>
          <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            Recommended action · {flag.action_role}
          </p>
          <Note>{flag.action}</Note>
        </div>

        <Big
          label={sent ? "Advisory sent" : "Send this advisory"}
          sub={sent ? "Logged against this flag" : flag.action_role}
          icon={sent ? Users : SprayBottle}
          tone={sent ? "plain" : "accent"}
          disabled={sent}
          onClick={() => setSent(true)}
        />
        <p className="px-0.5 text-[11.5px] text-muted">
          Dispatch is stubbed in the prototype. It records intent locally and
          does not contact anyone.
        </p>
      </Body>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Compare({
  label,
  observed,
  expected,
  unit,
  suffix = "",
  tone,
}: {
  label: string;
  observed: number;
  expected: number;
  unit: string;
  suffix?: string;
  tone?: "crit" | "warn";
}) {
  const color =
    tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-forest";
  const multiple = expected > 0 ? observed / expected : null;

  return (
    <div className="rounded-card border border-rule bg-surface px-4 py-3">
      {/* first-letter only: `capitalize` would title-case every word and turn
          "Class II applications, 7 days" into "Class II Applications, 7 Days" */}
      <p className="text-[12px] text-muted first-letter:uppercase">{label}</p>
      <div className="flex items-baseline gap-3 pt-1">
        <span className={`tabular text-[30px] font-semibold leading-none ${color}`}>
          {observed}
          {suffix}
        </span>
        <span className="text-[13px] text-muted">
          against{" "}
          <span className="tabular font-mono font-semibold text-ink-2">
            {/* A baseline of zero is a real and common result: routine
                hazardous spraying is seasonal, so most weeks have none.
                Printing "0" reads as a missing value rather than a finding. */}
            {expected < 1 ? "under 1" : `${expected}${suffix}`}
          </span>{" "}
          {unit}
        </span>
        {multiple !== null && multiple >= 2 && (
          <span className="tabular ml-auto shrink-0 font-mono text-[12px] font-semibold text-muted">
            {multiple >= 10 ? "10x+" : `${multiple.toFixed(1)}x`}
          </span>
        )}
      </div>
    </div>
  );
}
