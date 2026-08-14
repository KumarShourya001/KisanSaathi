import { useState } from "react";
import { FirstAid, SprayBottle, ListChecks, MapPin } from "@phosphor-icons/react";
import { BLOCKS } from "../../shared/blocks";
import type { Role } from "../../shared/types";
import { DEMO_WORKERS, saveSession, type Lang } from "../lib/session";
import { LANG_LABELS, type T } from "../lib/i18n";
import { Big, Body, Choice, Screen, TopBar } from "../components/ui";

/**
 * Role is chosen once and decides the entire navigation tree. There is no
 * shared home screen, because a compromise home would serve neither a worker
 * standing in a field nor an officer reading a district console.
 */
export function RoleSelect({
  t,
  lang,
  onLang,
  onDone,
}: {
  t: T;
  lang: Lang;
  onLang: (l: Lang) => void;
  onDone: () => void;
}) {
  const [role, setRole] = useState<Role | null>(null);

  const choose = (block_id: string) => {
    if (!role) return;
    const persona = DEMO_WORKERS[role];
    saveSession({
      role,
      block_id,
      worker_name: persona.name,
      reporter_id: `${persona.prefix}-${block_id.slice(-4)}-1`,
      lang,
    });
    onDone();
  };

  return (
    <Screen>
      <TopBar onBack={role ? () => setRole(null) : undefined} />
      <Body>
        {!role ? (
          <>
            <div className="pb-1">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
                {t("appName")}
              </h1>
              <p className="mt-1 text-[15px] text-muted">{t("whoIsUsing")}</p>
            </div>

            <Big
              label={t("roleAsha")}
              sub={t("roleAshaSub")}
              icon={FirstAid}
              onClick={() => setRole("asha")}
            />
            <Big
              label={t("roleAgri")}
              sub={t("roleAgriSub")}
              icon={SprayBottle}
              tone="plain"
              onClick={() => setRole("agri")}
            />
            <Big
              label={t("roleOfficer")}
              sub={t("roleOfficerSub")}
              icon={ListChecks}
              tone="plain"
              onClick={() => setRole("officer")}
            />

            <div className="flex-1" />

            <div>
              <p className="pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                {t("language")}
              </p>
              <div
                role="radiogroup"
                aria-label="Language"
                className="flex overflow-hidden rounded-chip border border-rule"
              >
                {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
                  <button
                    key={code}
                    role="radio"
                    aria-checked={lang === code}
                    onClick={() => onLang(code)}
                    className={`press min-h-[46px] flex-1 text-[14px] font-medium ${
                      lang === code
                        ? "bg-forest text-on-forest"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {LANG_LABELS[code]}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 pb-1">
              <MapPin size={22} className="text-forest" />
              <h1 className="text-[22px] font-semibold tracking-tight">
                Which block?
              </h1>
            </div>
            <p className="-mt-2 text-[13px] text-muted">
              Yavatmal district, Maharashtra
            </p>
            {BLOCKS.map((b) => (
              <Choice
                key={b.block_id}
                label={b.name}
                sub={`${b.block_id} · ${b.households.toLocaleString("en-IN")} households`}
                onClick={() => choose(b.block_id)}
              />
            ))}
          </>
        )}
      </Body>
    </Screen>
  );
}
