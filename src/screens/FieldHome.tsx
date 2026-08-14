import { useLiveQuery } from "dexie-react-hooks";
import { FirstAid, SprayBottle, ShieldCheck } from "@phosphor-icons/react";
import { blockName } from "../../shared/blocks";
import { recentOps } from "../lib/db";
import type { Session } from "../lib/session";
import type { T } from "../lib/i18n";
import { Big, Body, Card, Screen, TopBar } from "../components/ui";
import { OpRow } from "../components/OpRow";

export function FieldHome({
  t,
  session,
  navigate,
}: {
  t: T;
  session: Session;
  navigate: (to: string) => void;
}) {
  const ops = useLiveQuery(() => recentOps(6), [], []) ?? [];
  const queued = ops.filter((o) => o.state !== "sent");

  return (
    <Screen>
      <TopBar
        title={blockName(session.block_id)}
        subtitle={`${session.worker_name} · ${session.reporter_id}`}
      />
      <Body>
        <Big
          label={t("logHealth")}
          sub={t("logHealthSub")}
          icon={FirstAid}
          onClick={() => navigate("/capture/health")}
        />
        <Big
          label={t("logAgri")}
          sub={t("logAgriSub")}
          icon={SprayBottle}
          tone="plain"
          onClick={() => navigate("/capture/agri")}
        />

        <div className="pt-1">
          <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            {queued.length > 0 ? t("waitingToSend") : t("recentEntries")}
          </p>

          {ops.length === 0 ? (
            <Card>
              <p className="text-[13px] text-muted">
                Nothing captured on this device yet. Both buttons above work
                with no signal.
              </p>
            </Card>
          ) : (
            <Card className="p-0">
              {ops.map((op) => (
                <OpRow key={op.op_id} op={op} />
              ))}
            </Card>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => navigate("/consent")}
          className="press flex min-h-[46px] items-center justify-center gap-2 rounded-chip border border-rule bg-surface text-[13px] font-medium text-ink-2"
        >
          <ShieldCheck size={17} />
          What leaves this device
        </button>
      </Body>
    </Screen>
  );
}
