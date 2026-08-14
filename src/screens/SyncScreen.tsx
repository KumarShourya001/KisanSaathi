import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowsClockwise, Trash } from "@phosphor-icons/react";
import { clearOutbox, recentOps } from "../lib/db";
import { drain, type DrainOutcome } from "../lib/sync";
import type { T } from "../lib/i18n";
import {
  ActionBar,
  Big,
  Body,
  Card,
  Empty,
  Note,
  Screen,
  TopBar,
  useOnline,
  usePending,
} from "../components/ui";
import { OpRow } from "../components/OpRow";

export function SyncScreen({
  t,
  navigate,
}: {
  t: T;
  navigate: (to: string) => void;
}) {
  const ops = useLiveQuery(() => recentOps(50), [], []) ?? [];
  const pending = usePending();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<DrainOutcome | null>(null);

  async function send() {
    setBusy(true);
    setLast(await drain());
    setBusy(false);
  }

  return (
    <Screen>
      <TopBar
        title="Outbox"
        subtitle={
          pending === 0
            ? t("synced")
            : `${pending} ${t("queued")}`
        }
        onBack={() => navigate("/")}
      />
      <Body>
        {ops.length === 0 ? (
          <Empty
            title="Nothing captured yet"
            body="Records written on this device appear here with the id the server will see."
          />
        ) : (
          <Card className="p-0">
            {ops.map((op) => (
              <OpRow key={op.op_id} op={op} />
            ))}
          </Card>
        )}

        {last && last.attempted > 0 && (
          <Note tone={last.failed > 0 ? "crit" : "plain"}>
            Sent {last.attempted}: {last.accepted} accepted
            {last.duplicates > 0 && `, ${last.duplicates} already on the server`}
            {last.failed > 0 && `, ${last.failed} rejected`}.
            {last.duplicates > 0 && (
              <>
                {" "}
                The duplicates were retries. The server matched the device-issued
                id and kept one row, which is why a dropped connection mid-sync
                cannot double-count a case.
              </>
            )}
          </Note>
        )}

        {!online && pending > 0 && (
          <Note tone="warn">
            No signal. The queue drains by itself the moment one returns, and
            survives the app being force-killed in the meantime.
          </Note>
        )}

      </Body>

      <ActionBar>
        <Big
          label={busy ? t("syncing") : t("syncNow")}
          sub={
            pending === 0
              ? "Nothing waiting"
              : `${pending} record${pending === 1 ? "" : "s"} ready`
          }
          icon={ArrowsClockwise}
          disabled={busy || pending === 0}
          onClick={send}
        />

        {ops.length > 0 && (
          <button
            onClick={() => {
              void clearOutbox();
              setLast(null);
            }}
            className="press flex min-h-[44px] items-center justify-center gap-2 rounded-chip text-[13px] font-medium text-muted"
          >
            <Trash size={16} />
            Clear this device for a fresh demo run
          </button>
        )}
      </ActionBar>
    </Screen>
  );
}
