import { useEffect, useMemo, useState } from "react";
import { House, Plus, ArrowsClockwise, ListChecks, ShieldCheck } from "@phosphor-icons/react";
import { useRoute, segments } from "./lib/router";
import { loadSession, saveSession, clearSession, type Lang, type Session } from "./lib/session";
import { translator } from "./lib/i18n";
import { startAutoSync, type DrainOutcome } from "./lib/sync";
import { usePending } from "./components/ui";
import { RoleSelect } from "./screens/RoleSelect";
import { FieldHome } from "./screens/FieldHome";
import { HealthCapture } from "./screens/HealthCapture";
import { AgriCapture } from "./screens/AgriCapture";
import { Saved } from "./screens/Saved";
import { SyncScreen } from "./screens/SyncScreen";
import { Dashboard } from "./screens/Dashboard";
import { FlagDetail } from "./screens/FlagDetail";
import { Consent } from "./screens/Consent";

export default function App() {
  const [session, setSession] = useState<Session>(() => loadSession());
  const [route, navigate] = useRoute();
  const [toast, setToast] = useState<string | null>(null);
  const t = useMemo(() => translator(session.lang), [session.lang]);

  // One auto-sync loop for the whole app: on the online event, on a timer, and
  // once at startup. Mounted here so it keeps running across screens.
  useEffect(() => {
    return startAutoSync((outcome: DrainOutcome) => {
      if (outcome.offline || outcome.attempted === 0) return;
      const parts: string[] = [];
      if (outcome.accepted) parts.push(`${outcome.accepted} sent`);
      if (outcome.duplicates) parts.push(`${outcome.duplicates} already there`);
      if (outcome.failed) parts.push(`${outcome.failed} failed`);
      setToast(parts.join(", "));
      window.setTimeout(() => setToast(null), 4000);
    });
  }, []);

  const update = (patch: Partial<Session>) => setSession(saveSession(patch));

  if (!session.role || !session.block_id) {
    return (
      <RoleSelect
        t={t}
        lang={session.lang}
        onLang={(lang: Lang) => update({ lang })}
        onDone={() => {
          setSession(loadSession());
          navigate("/");
        }}
      />
    );
  }

  const parts = segments(route);
  const isOfficer = session.role === "officer";

  let screen: React.ReactNode;

  if (parts[0] === "capture" && parts[1] === "agri") {
    screen = <AgriCapture t={t} session={session} navigate={navigate} />;
  } else if (parts[0] === "capture") {
    screen = <HealthCapture t={t} session={session} navigate={navigate} />;
  } else if (parts[0] === "saved") {
    screen = <Saved t={t} navigate={navigate} />;
  } else if (parts[0] === "sync") {
    screen = <SyncScreen t={t} navigate={navigate} />;
  } else if (parts[0] === "consent") {
    screen = <Consent t={t} session={session} navigate={navigate} />;
  } else if (parts[0] === "flag") {
    screen = <FlagDetail flagId={parts.slice(1).join("/")} navigate={navigate} />;
  } else if (parts[0] === "settings") {
    screen = (
      <Settings
        session={session}
        onReset={() => {
          clearSession();
          setSession(loadSession());
          navigate("/");
        }}
        navigate={navigate}
      />
    );
  } else {
    screen = isOfficer ? (
      <Dashboard navigate={navigate} />
    ) : (
      <FieldHome t={t} session={session} navigate={navigate} />
    );
  }

  const showTabs = !isOfficer && !["capture", "saved"].includes(parts[0] ?? "");

  return (
    <div className="flex h-full min-h-[100dvh] flex-col">
      <div className="flex-1 overflow-hidden">{screen}</div>

      {toast && (
        <div
          role="status"
          className="rise pointer-events-none fixed inset-x-0 bottom-20 z-20 mx-auto w-fit max-w-[90%] rounded-full border border-forest bg-forest px-4 py-2 text-[13px] font-medium text-on-forest shadow-lg"
        >
          {toast}
        </div>
      )}

      {showTabs && <TabBar route={route} navigate={navigate} />}
      {isOfficer && <OfficerTabs route={route} navigate={navigate} />}
    </div>
  );
}

function TabBar({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  const pending = usePending();
  const at = segments(route)[0] ?? "";

  const tabs = [
    { key: "", label: "Home", icon: House, to: "/" },
    { key: "capture", label: "Capture", icon: Plus, to: "/capture/health" },
    { key: "sync", label: "Outbox", icon: ArrowsClockwise, to: "/sync", badge: pending },
  ];

  return (
    <nav className="border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-md">
        {tabs.map((tab) => {
          const active = at === tab.key;
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.to)}
              aria-current={active ? "page" : undefined}
              className={`press relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium ${
                active ? "text-forest" : "text-muted"
              }`}
            >
              <tab.icon size={21} weight={active ? "fill" : "regular"} />
              {tab.label}
              {tab.badge ? (
                <span className="tabular absolute right-[24%] top-1.5 min-w-[17px] rounded-full bg-warn px-1 text-[9.5px] font-bold leading-[17px] text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function OfficerTabs({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  const at = segments(route)[0] ?? "";
  const tabs = [
    { key: "", label: "Flags", icon: ListChecks, to: "/" },
    { key: "consent", label: "Privacy", icon: ShieldCheck, to: "/consent" },
    { key: "settings", label: "Settings", icon: House, to: "/settings" },
  ];

  return (
    <nav className="border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-md">
        {tabs.map((tab) => {
          const active = at === tab.key;
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.to)}
              aria-current={active ? "page" : undefined}
              className={`press flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium ${
                active ? "text-forest" : "text-muted"
              }`}
            >
              <tab.icon size={21} weight={active ? "fill" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Settings({
  session,
  onReset,
  navigate,
}: {
  session: Session;
  onReset: () => void;
  navigate: (to: string) => void;
}) {
  return (
    <div className="flex h-full flex-col bg-ground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto p-4">
        <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
        <div className="rounded-card border border-rule bg-surface p-4 text-[13px]">
          <p className="font-semibold">{session.worker_name}</p>
          <p className="pt-0.5 font-mono text-[11px] text-muted">
            {session.reporter_id} · {session.block_id} · {session.lang}
          </p>
        </div>
        <button
          onClick={onReset}
          className="press min-h-[52px] rounded-card border border-rule bg-surface px-4 text-left text-[14px] font-medium"
        >
          Switch role or block
        </button>
        <button
          onClick={() => navigate("/sync")}
          className="press min-h-[52px] rounded-card border border-rule bg-surface px-4 text-left text-[14px] font-medium"
        >
          Open the outbox
        </button>
      </div>
    </div>
  );
}
