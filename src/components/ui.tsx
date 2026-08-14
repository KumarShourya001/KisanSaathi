import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CellSignalHigh,
  CellSignalSlash,
  CaretLeft,
  type Icon,
} from "@phosphor-icons/react";
import { pendingCount } from "../lib/db";
import type { Severity } from "../../shared/types";

// ------------------------------------------------------------------- hooks

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function usePending(): number {
  return useLiveQuery(() => pendingCount(), [], 0) ?? 0;
}

export function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------------ layout

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-ground text-ink">
      {children}
    </div>
  );
}

export function Body({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-4 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Connection state is on every screen rather than in a settings page.
 * A worker who cannot see whether their work is safe does not trust the app,
 * and the whole offline claim rests on them trusting it.
 */
export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const online = useOnline();
  const pending = usePending();
  const time = useClock();

  return (
    <header className="sticky top-0 z-10 border-b border-rule bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-2 font-mono text-[11px] text-muted">
        <span className="tabular">{time}</span>
        <span className="flex-1" />
        {pending > 0 && (
          <span className="tabular text-warn">
            {pending} queued
          </span>
        )}
        <span
          className={`flex items-center gap-1.5 ${online ? "text-forest" : "text-warn"}`}
          role="status"
          aria-live="polite"
        >
          {online ? (
            <CellSignalHigh size={14} weight="bold" />
          ) : (
            <CellSignalSlash size={14} weight="bold" />
          )}
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {(title || onBack) && (
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="press -ml-2 flex size-11 min-h-0 items-center justify-center rounded-chip text-ink-2 hover:bg-sunk"
            >
              <CaretLeft size={22} weight="bold" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h1 className="truncate text-[17px] font-semibold tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
    </header>
  );
}

// ----------------------------------------------------------------- controls

/** Primary action. 60px tall because it is tapped with a thumb, outdoors,
 *  sometimes while holding something else. */
export function Big({
  label,
  sub,
  icon: IconCmp,
  onClick,
  tone = "accent",
  disabled,
  type = "button",
}: {
  label: string;
  sub?: string;
  icon?: Icon;
  onClick?: () => void;
  tone?: "accent" | "plain" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const tones = {
    accent: "bg-forest text-on-forest border-forest",
    plain: "bg-surface text-ink border-rule",
    danger: "bg-surface text-crit border-crit",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press flex min-h-[60px] w-full items-center gap-3 rounded-card border px-4 py-3 text-left disabled:opacity-45 ${tones[tone]}`}
    >
      {IconCmp && <IconCmp size={24} weight="regular" className="shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight">
          {label}
        </span>
        {sub && (
          <span
            className={`block text-xs leading-snug ${tone === "accent" ? "opacity-80" : "text-muted"}`}
          >
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

/** Single-select option row. Selection is shown by border weight and a tinted
 *  fill, never by colour alone, so it survives sunlight and colour blindness. */
export function Choice({
  label,
  sub,
  selected,
  onClick,
  tone,
}: {
  label: string;
  sub?: string;
  selected?: boolean;
  onClick: () => void;
  tone?: "warn" | "crit";
}) {
  const accent =
    tone === "crit"
      ? "border-crit bg-crit-b text-crit"
      : tone === "warn"
        ? "border-warn bg-warn-b text-warn"
        : "border-forest bg-forest-b text-forest";

  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`press flex min-h-[58px] w-full flex-col justify-center rounded-card border px-4 py-3 text-left ${
        selected ? `${accent} border-2` : "border-rule bg-surface text-ink"
      }`}
    >
      <span className="text-[15px] font-semibold leading-tight">{label}</span>
      {sub && (
        <span className={`text-xs ${selected ? "opacity-80" : "text-muted"}`}>
          {sub}
        </span>
      )}
    </button>
  );
}

/** Big icon target for the symptom grid. Icon plus word, never icon alone. */
export function IconTile({
  label,
  icon: IconCmp,
  selected,
  onClick,
}: {
  label: string;
  icon: Icon;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`press flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-card border px-2 py-3 ${
        selected
          ? "border-2 border-forest bg-forest-b text-forest"
          : "border-rule bg-surface text-ink"
      }`}
    >
      <IconCmp size={30} weight={selected ? "fill" : "regular"} />
      <span className="text-[13px] font-semibold">{label}</span>
    </button>
  );
}

/**
 * Primary action, pinned below the scrolling content rather than at the end of
 * it.
 *
 * Measured problem: the agri capture form needed 204px of scrolling before Save
 * came into view, and the outbox put Send below the fold. A worker operating
 * one-handed outdoors should never have to scroll to find the action that
 * finishes the task, and a form whose content grows must not be able to push
 * its own button off screen.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-rule bg-surface px-4 pb-3 pt-3">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-rule bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2.5 last:border-b-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="tabular text-right font-mono text-[13px] font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

export function SeverityPill({ severity, rule }: { severity: Severity; rule?: string }) {
  const tone =
    severity === "high"
      ? "bg-crit-b text-crit border-crit"
      : severity === "medium"
        ? "bg-warn-b text-warn border-warn"
        : "bg-sunk text-muted border-rule-2";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}
    >
      {rule ?? severity}
    </span>
  );
}

export function Note({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "warn" | "crit";
}) {
  const edge =
    tone === "crit"
      ? "border-l-crit"
      : tone === "warn"
        ? "border-l-warn"
        : "border-l-forest";
  return (
    <div
      className={`rounded-chip border border-rule border-l-[3px] bg-sunk px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 ${edge}`}
    >
      {children}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-rule-2 px-6 py-12 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="max-w-[34ch] text-[13px] text-muted">{body}</p>
    </div>
  );
}

/**
 * Two feeds on one axis: agri applications below, symptom reports above.
 * Drawn rather than charted because a library for this would cost more
 * transferred bytes than every other dependency combined.
 */
export function TwinSpark({
  agri,
  health,
  height = 44,
}: {
  agri: number[];
  health: number[];
  height?: number;
}) {
  const n = Math.max(agri.length, health.length, 1);
  const peak = Math.max(1, ...agri, ...health);
  const w = 100 / n;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Input applications and symptom reports over the flag window"
    >
      {Array.from({ length: n }).map((_, i) => {
        const a = ((agri[i] ?? 0) / peak) * (height / 2 - 2);
        const h = ((health[i] ?? 0) / peak) * (height / 2 - 2);
        const x = i * w + w * 0.18;
        const bw = w * 0.64;
        return (
          <g key={i}>
            <rect
              x={x}
              y={height / 2 - h}
              width={bw}
              height={Math.max(h, 0.6)}
              fill="var(--crit)"
              rx="0.6"
            />
            <rect
              x={x}
              y={height / 2 + 1}
              width={bw}
              height={Math.max(a, 0.6)}
              fill="var(--forest)"
              rx="0.6"
            />
          </g>
        );
      })}
      <line
        x1="0"
        y1={height / 2}
        x2="100"
        y2={height / 2}
        stroke="var(--rule-2)"
        strokeWidth="0.4"
      />
    </svg>
  );
}
