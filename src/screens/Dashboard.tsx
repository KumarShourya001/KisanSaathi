import { useEffect, useState } from "react";
import { ArrowsClockwise, Thermometer, SprayBottle, Warning, CaretRight } from "@phosphor-icons/react";
import type { CorrelationFlag } from "../../shared/types";
import { api, type CorrelationResponse } from "../lib/api";
import {
  Body,
  Card,
  Empty,
  Screen,
  SeverityPill,
  TopBar,
  TwinSpark,
  useOnline,
} from "../components/ui";

const RULE_ICON = {
  exposure: SprayBottle,
  heat: Thermometer,
  composite: Warning,
} as const;

const RULE_LABEL = {
  exposure: "Exposure",
  heat: "Heat",
  composite: "Composite",
} as const;

/**
 * The one line of evidence worth putting on a card.
 *
 * The rule name is not news: three cards saying "input applications followed by
 * a symptom cluster" tells an officer nothing about which to open first. The
 * figures do, so the figures go on the card and the prose moves inside.
 */
function evidenceLine(flag: CorrelationFlag): string {
  const e = flag.evidence;
  if (flag.rule === "heat") {
    return `${e.heat_days} days above 40C, peaking at ${e.peak_heat_index_c}C`;
  }
  const apps =
    e.applications_expected && e.applications_expected >= 1
      ? `${e.applications_observed} applications against ${e.applications_expected}`
      : `${e.applications_observed} applications against under 1`;
  const sym =
    e.symptoms_expected && e.symptoms_expected >= 1
      ? `${e.symptoms_observed} reports against ${e.symptoms_expected}`
      : `${e.symptoms_observed} reports against under 1`;
  return `${apps} · ${sym}`;
}

export function Dashboard({ navigate }: { navigate: (to: string) => void }) {
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const online = useOnline();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await api.correlations());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // A record that synced seconds ago should move a flag without a reload.
  useEffect(() => {
    if (!online) return;
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [online]);

  const flags = data?.flags ?? [];
  const [lead, ...rest] = flags;
  const urgent = flags.filter((f) => f.severity === "high").length;

  return (
    <Screen>
      <TopBar
        title="Active risk flags"
        subtitle={
          data
            ? `Yavatmal district · engine ${data.elapsed_ms} ms`
            : "Yavatmal district"
        }
        right={
          <button
            onClick={() => void load()}
            aria-label="Refresh"
            className="press flex size-11 min-h-0 items-center justify-center rounded-chip text-ink-2 hover:bg-sunk"
          >
            <ArrowsClockwise size={19} className={loading ? "pulse" : ""} />
          </button>
        }
      />
      <Body>
        {loading && !data && (
          <>
            <div className="pulse h-[68px] rounded-card border border-rule bg-sunk" />
            <div className="pulse h-[188px] rounded-card border border-rule bg-sunk" />
            <div className="pulse h-[72px] rounded-card border border-rule bg-sunk" />
          </>
        )}

        {error && (
          <Card>
            <p className="text-[14px] font-semibold text-crit">
              Could not reach the correlation service
            </p>
            <p className="pt-1 text-[13px] text-muted">{error}</p>
            <p className="pt-2 text-[13px] text-muted">
              Field capture keeps working offline. Only this console needs the
              network.
            </p>
          </Card>
        )}

        {data && flags.length === 0 && (
          <Empty
            title="No block is above threshold"
            body="Every block is inside its own 60 day baseline today. The engine reports quiet as quiet rather than inventing a weak signal."
          />
        )}

        {/* Summary before detail: the count is what an officer reads first. */}
        {data && flags.length > 0 && (
          <div className="rise flex overflow-hidden rounded-card border border-rule bg-surface">
            <Stat n={flags.length} label="flagged" />
            <Stat n={urgent} label="urgent" tone={urgent > 0 ? "crit" : undefined} />
            <Stat n={data.quiet_blocks.length} label="clear" last />
          </div>
        )}

        {lead && <LeadFlag flag={lead} onOpen={() => navigate(`/flag/${lead.flag_id}`)} />}

        {rest.length > 0 && (
          <div className="flex flex-col gap-2">
            {rest.map((flag, i) => (
              <FlagRow
                key={flag.flag_id}
                flag={flag}
                index={i}
                onOpen={() => navigate(`/flag/${flag.flag_id}`)}
              />
            ))}
          </div>
        )}

        {data && data.quiet_blocks.length > 0 && (
          <div className="pt-1">
            <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              Below threshold
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.quiet_blocks.map((b) => (
                <span
                  key={b.block_id}
                  className="rounded-full border border-rule bg-surface px-2.5 py-1 text-[12px] text-muted"
                >
                  {b.name}
                </span>
              ))}
            </div>
            <p className="px-0.5 pt-2.5 text-[12px] leading-relaxed text-muted">
              Quiet blocks stay listed on purpose. A detector that only ever
              shows hits gives no evidence it can discriminate.
            </p>
          </div>
        )}
      </Body>
    </Screen>
  );
}

function Stat({
  n,
  label,
  tone,
  last,
}: {
  n: number;
  label: string;
  tone?: "crit";
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-0.5 py-3 ${last ? "" : "border-r border-rule"}`}
    >
      <span
        className={`tabular text-[22px] font-semibold leading-none ${tone === "crit" ? "text-crit" : "text-ink"}`}
      >
        {n}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
    </div>
  );
}

/**
 * The top-ranked flag gets a card of its own, because a composite outranking
 * three single-domain flags is the entire argument for the platform and it
 * should not look like a fourth row in a list.
 */
function LeadFlag({ flag, onOpen }: { flag: CorrelationFlag; onOpen: () => void }) {
  const Icon = RULE_ICON[flag.rule];
  const stripe =
    flag.severity === "high" ? "bg-crit" : flag.severity === "medium" ? "bg-warn" : "bg-rule-2";

  return (
    <button
      onClick={onOpen}
      className="press rise flex overflow-hidden rounded-card border border-rule bg-surface text-left"
      style={{ animationDelay: "60ms" }}
    >
      <span className={`w-1.5 shrink-0 ${stripe}`} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[20px] font-semibold leading-tight tracking-tight">
              {flag.block_name}
            </span>
            <span className="mt-0.5 block font-mono text-[10.5px] text-muted">
              {flag.block_id} · {flag.window_start} to {flag.window_end}
            </span>
          </span>
          <SeverityPill severity={flag.severity} rule={RULE_LABEL[flag.rule]} />
        </span>

        <span className="flex items-start gap-2 text-[13.5px] font-medium leading-snug text-ink-2">
          <Icon size={17} className="mt-0.5 shrink-0 text-muted" />
          {evidenceLine(flag)}
        </span>

        {flag.evidence.series_agri && flag.evidence.series_health && (
          <span className="block">
            <TwinSpark
              agri={flag.evidence.series_agri}
              health={flag.evidence.series_health}
              height={56}
            />
            <span className="mt-1.5 flex items-center gap-3.5">
              <Legend color="var(--crit)" label="Symptom reports" />
              <Legend color="var(--forest)" label="Class II applications" />
            </span>
          </span>
        )}

        <span className="flex items-center justify-between gap-2 border-t border-rule pt-2.5">
          <span className="truncate text-[12.5px] text-muted">
            {flag.action_role}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-forest">
            Open <CaretRight size={13} weight="bold" />
          </span>
        </span>
      </span>
    </button>
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

function FlagRow({
  flag,
  index,
  onOpen,
}: {
  flag: CorrelationFlag;
  index: number;
  onOpen: () => void;
}) {
  const Icon = RULE_ICON[flag.rule];
  const stripe =
    flag.severity === "high" ? "bg-crit" : flag.severity === "medium" ? "bg-warn" : "bg-rule-2";

  return (
    <button
      onClick={onOpen}
      className="press rise flex overflow-hidden rounded-card border border-rule bg-surface text-left"
      style={{ animationDelay: `${120 + index * 55}ms` }}
    >
      <span className={`w-1 shrink-0 ${stripe}`} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3">
        <Icon size={19} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-semibold">
              {flag.block_name}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted">
              {RULE_LABEL[flag.rule]}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {evidenceLine(flag)}
          </span>
        </span>
        <CaretRight size={15} className="shrink-0 text-rule-2" />
      </span>
    </button>
  );
}
