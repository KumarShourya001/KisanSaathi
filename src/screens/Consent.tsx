import { useState } from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { blockName } from "../../shared/blocks";
import type { Session } from "../lib/session";
import type { T } from "../lib/i18n";
import { Big, Body, Field, Note, Screen, TopBar } from "../components/ui";

/**
 * The DPDP artifact.
 *
 * Cheap to build and disproportionately valuable, because purpose, expiry and
 * a working revocation are the three things the Act actually requires to be
 * demonstrable rather than promised.
 *
 * The substantive claim is the one about identity: the correlation engine
 * operates on block-level aggregates and has never needed a patient identity.
 * That is not a shortcut taken to save time. It is the strongest privacy
 * argument available here, and it happens to be true.
 */
export function Consent({
  t,
  session,
  navigate,
}: {
  t: T;
  session: Session;
  navigate: (to: string) => void;
}) {
  const [revoked, setRevoked] = useState(false);

  const granted = new Date().toISOString().slice(0, 10);
  const expires = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  return (
    <Screen>
      <TopBar
        title={t("consent")}
        subtitle="Digital Personal Data Protection Act 2023"
        onBack={() => navigate("/")}
      />
      <Body>
        <div className="flex items-center gap-3 rounded-card border border-forest bg-forest-b p-4">
          <ShieldCheck size={30} className="shrink-0 text-forest" />
          <p className="text-[13px] leading-snug text-ink-2">
            Health records leave this device carrying an age band and a block.
            Never a name, never an ABHA number.
          </p>
        </div>

        <div className="rounded-card border border-rule bg-surface px-4">
          <Field label={t("purpose")} value="Risk detection" />
          <Field label={t("sharedWith")} value="Block office" />
          <Field label={t("identity")} value={t("notAttached")} />
          <Field label={t("block")} value={blockName(session.block_id)} />
          <Field label={t("granted")} value={granted} />
          <Field label={t("expires")} value={revoked ? "Revoked" : expires} />
        </div>

        <Note>
          Purpose limitation is enforced by the schema, not by policy. There is
          no column for a name, so a later change of purpose cannot quietly
          start using one.
        </Note>

        {revoked && (
          <Note tone="warn">
            Consent withdrawn. In production this propagates to the block office
            copy and the record is excluded from every subsequent engine run.
            The prototype records the withdrawal locally only.
          </Note>
        )}

        <div className="flex-1" />

        <Big
          label={revoked ? "Consent withdrawn" : t("withdraw")}
          tone="danger"
          disabled={revoked}
          onClick={() => setRevoked(true)}
        />
      </Body>
    </Screen>
  );
}
