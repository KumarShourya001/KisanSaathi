import { CheckCircle } from "@phosphor-icons/react";
import type { T } from "../lib/i18n";
import { Big, Body, Note, Screen, TopBar, useOnline, usePending } from "../components/ui";

export function Saved({ t, navigate }: { t: T; navigate: (to: string) => void }) {
  const online = useOnline();
  const pending = usePending();

  return (
    <Screen>
      <TopBar />
      <Body className="justify-center">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle size={56} weight="fill" className="text-forest" />
          <h1 className="text-[22px] font-semibold tracking-tight">
            {t("saved")}
          </h1>
          <p className="max-w-[30ch] text-[14px] text-muted">
            {t("savedSub")}
          </p>
        </div>

        <Note tone={online ? "plain" : "warn"}>
          {online
            ? `${pending === 0 ? "Sent already." : `${pending} record${pending === 1 ? "" : "s"} still going up.`} Nothing was lost either way.`
            : `${pending} record${pending === 1 ? "" : "s"} held on this device. Close the app, kill it, restart the phone: they stay.`}
        </Note>

        <div className="flex-1" />
        <Big label="Capture another" onClick={() => navigate("/capture/health")} />
        <Big label="Back to home" tone="plain" onClick={() => navigate("/")} />
        <Big label="See the queue" tone="plain" onClick={() => navigate("/sync")} />
      </Body>
    </Screen>
  );
}
