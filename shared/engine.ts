/**
 * Rural Bridge correlation engine.
 *
 * Pure and dependency-free on purpose: it runs identically in a serverless
 * function, in a Node script, and in the browser, and it can be unit-tested
 * from the command line before any UI exists.
 *
 * Rule-based rather than learned. There is no labelled dataset for this join,
 * so a model would be trained on data we invented. Rules can be explained to a
 * district health officer with the numbers attached, which is the only kind of
 * output a block office can act on.
 */

import {
  type AgriRecord,
  type Block,
  type Confidence,
  type CorrelationFlag,
  type HealthRecord,
  type Severity,
  type WeatherDay,
  EXPOSURE_SYMPTOMS,
  HAZARDOUS_INPUTS,
} from "./types.js";

// ---------------------------------------------------------------- thresholds

export const THRESHOLDS = {
  /** Days of recent history scanned for a candidate spike day. */
  evalLookbackDays: 25,
  /** Rolling window over which applications are counted. */
  exposureWindowDays: 7,
  /** Days of symptom reports observed after the spike. */
  symptomWindowDays: 6,
  /** Baseline is 7 buckets of 7 days, ending 14 days before the candidate day,
   *  so a spike can never inflate the baseline it is measured against. */
  baselineBuckets: 7,
  baselineBucketDays: 7,
  baselineGapDays: 14,

  minApplications: 3,
  applicationMultiple: 3,
  /** Absolute floor on the symptom cluster. Raised from 4 to 5 after measuring
   *  the false-positive rate against unrigged blocks: at 4 a quiet block can
   *  clear the bar on ordinary noise roughly 3 percent of the time. */
  minSymptoms: 5,
  symptomMultiple: 2.5,

  /** Below this many baseline health records a block is reported as
   *  "insufficient data" rather than as a weak signal. */
  minBaselineHealthRecords: 8,

  heatIndexC: 40,
  minHeatRunDays: 2,
} as const;

// -------------------------------------------------------------- date helpers

const MS_PER_DAY = 86_400_000;

export function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_PER_DAY);
}

export function fromDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Counts per day number, so window sums are cheap. */
function tally(days: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of days) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
}

function sumRange(counts: Map<number, number>, from: number, to: number): number {
  let total = 0;
  for (let d = from; d <= to; d++) total += counts.get(d) ?? 0;
  return total;
}

// ------------------------------------------------------------------- scoring

function bandSeverity(score: number): Severity {
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function bandConfidence(ratio: number): Confidence {
  if (ratio >= 3) return "high";
  if (ratio >= 2) return "medium";
  return "low";
}

function escalate(s: Severity): Severity {
  return s === "low" ? "medium" : "high";
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Baselines below 1 are real and common: routine hazardous spraying is
 * seasonal, so most weeks in most blocks genuinely have none. Printing
 * "a baseline of 0" reads like a missing value rather than a finding, so
 * say what it means instead.
 */
function baselinePhrase(expected: number, unit: string): string {
  if (expected < 1) return `a baseline of under 1 ${unit}`;
  return `a baseline of ${round(expected, 1)} ${unit}`;
}

// -------------------------------------------------------------- heat index

/**
 * Rothfusz heat index, the same regression the US National Weather Service
 * publishes. Computed in Fahrenheit because that is how the coefficients are
 * defined, then converted back. Below 26.7C the regression is not meaningful
 * and the dry-bulb temperature is returned unchanged.
 */
export function heatIndexC(tempC: number, humidityPct: number): number {
  if (tempC < 26.7) return round(tempC, 1);

  const T = tempC * 1.8 + 32;
  const R = humidityPct;

  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;

  // NWS adjustments at the edges of the regression's valid range.
  if (R < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (R > 85 && T >= 80 && T <= 87) {
    hi += ((R - 85) / 10) * ((87 - T) / 5);
  }

  return round((hi - 32) / 1.8, 1);
}

// ------------------------------------------------------------------- engine

export interface EngineInput {
  blocks: Block[];
  health: HealthRecord[];
  agri: AgriRecord[];
  weather: WeatherDay[];
  /** Evaluation date, YYYY-MM-DD. Defaults to today in UTC. */
  asOf?: string;
}

interface Partial_ {
  flag: CorrelationFlag;
  score: number;
}

export function runEngine(input: EngineInput): CorrelationFlag[] {
  const asOf = toDay(input.asOf ?? new Date().toISOString().slice(0, 10));
  const T = THRESHOLDS;

  const byBlock = new Map<string, Block>();
  for (const b of input.blocks) byBlock.set(b.block_id, b);

  const out: CorrelationFlag[] = [];

  for (const block of input.blocks) {
    const health = input.health.filter((h) => h.block_id === block.block_id);
    const agri = input.agri.filter((a) => a.block_id === block.block_id);
    const weather = input.weather
      .filter((w) => w.block_id === block.block_id)
      .sort((a, b) => a.for_date.localeCompare(b.for_date));

    const exposure = detectExposure(block, health, agri, asOf);
    const heat = detectHeat(block, weather, health, asOf);

    if (exposure && heat) {
      out.push(composite(block, exposure, heat, health));
    } else if (exposure) {
      out.push(exposure.flag);
    } else if (heat) {
      out.push(heat.flag);
    }
  }

  // Severity first, then rule. A composite outranks its own components at the
  // same severity: it is the one finding neither source system could have
  // produced alone, so it is the one an officer should read first.
  const RULE_RANK: Record<string, number> = { composite: 2, exposure: 1, heat: 0 };

  return out.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      RULE_RANK[b.rule] - RULE_RANK[a.rule] ||
      (b.evidence.ratio ?? 0) - (a.evidence.ratio ?? 0),
  );
}

// ------------------------------------------------------- rule 1: exposure

function detectExposure(
  block: Block,
  health: HealthRecord[],
  agri: AgriRecord[],
  asOf: number,
): Partial_ | null {
  const T = THRESHOLDS;

  const hazardDays = agri
    .filter((a) => HAZARDOUS_INPUTS.includes(a.input_class))
    .map((a) => toDay(a.applied_on));
  const symptomDays = health
    .filter((h) => EXPOSURE_SYMPTOMS.includes(h.symptom_category))
    .map((h) => toDay(h.observed_on));

  const hazardCounts = tally(hazardDays);
  const symptomCounts = tally(symptomDays);
  const allHealthCounts = tally(health.map((h) => toDay(h.observed_on)));

  const baselineSpan = T.baselineBuckets * T.baselineBucketDays;
  let best: Partial_ | null = null;

  // Candidate spike days, most recent first so ties keep the freshest window.
  for (let d = asOf - 2; d >= asOf - T.evalLookbackDays; d--) {
    const baselineEnd = d - T.baselineGapDays;
    const baselineStart = baselineEnd - baselineSpan + 1;

    // Suppression: a block with too little history cannot support a claim.
    const baselineHealth = sumRange(allHealthCounts, baselineStart, baselineEnd);
    if (baselineHealth < T.minBaselineHealthRecords) continue;

    // Applications in the trailing 7 days.
    const applications = sumRange(
      hazardCounts,
      d - T.exposureWindowDays + 1,
      d,
    );

    const hazardBuckets: number[] = [];
    for (let i = 0; i < T.baselineBuckets; i++) {
      const end = baselineEnd - i * T.baselineBucketDays;
      hazardBuckets.push(
        sumRange(hazardCounts, end - T.baselineBucketDays + 1, end),
      );
    }
    const expectedApps = median(hazardBuckets);

    const appTrigger = Math.max(
      T.minApplications,
      expectedApps * T.applicationMultiple,
    );
    if (applications < appTrigger) continue;

    // Symptoms in the following 6 days, clipped at the evaluation date.
    const symptomEnd = Math.min(d + T.symptomWindowDays - 1, asOf);
    const symptoms = sumRange(symptomCounts, d, symptomEnd);
    const observedDays = symptomEnd - d + 1;

    const symptomBaselineTotal = sumRange(
      symptomCounts,
      baselineStart,
      baselineEnd,
    );
    const expectedSymptoms =
      (symptomBaselineTotal / baselineSpan) * observedDays;

    const symptomTrigger = Math.max(
      T.minSymptoms,
      expectedSymptoms * T.symptomMultiple,
    );
    if (symptoms < symptomTrigger) continue;

    const symptomRatio = symptoms / Math.max(expectedSymptoms, 0.5);
    const appRatio = applications / Math.max(expectedApps, 0.5);
    const score =
      Math.min(4, symptomRatio) * 0.6 + Math.min(4, appRatio) * 0.4;

    if (best && best.score >= score) continue;

    const windowStart = fromDay(d - T.exposureWindowDays + 1);
    const windowEnd = fromDay(symptomEnd);
    const categories = [
      ...new Set(
        health
          .filter(
            (h) =>
              EXPOSURE_SYMPTOMS.includes(h.symptom_category) &&
              toDay(h.observed_on) >= d &&
              toDay(h.observed_on) <= symptomEnd,
          )
          .map((h) => h.symptom_category),
      ),
    ];
    const workers = new Set(
      health
        .filter((h) => toDay(h.observed_on) >= baselineStart)
        .map((h) => h.reporter_id),
    ).size;

    // Daily series across the whole flag window, for the two-sided sparkline.
    const seriesFrom = d - T.exposureWindowDays + 1;
    const seriesAgri: number[] = [];
    const seriesHealth: number[] = [];
    for (let day = seriesFrom; day <= symptomEnd; day++) {
      seriesAgri.push(hazardCounts.get(day) ?? 0);
      seriesHealth.push(symptomCounts.get(day) ?? 0);
    }

    best = {
      score,
      flag: {
        flag_id: `exposure:${block.block_id}:${windowStart}`,
        block_id: block.block_id,
        block_name: block.name,
        rule: "exposure",
        severity: bandSeverity(score),
        confidence: bandConfidence(symptomRatio),
        window_start: windowStart,
        window_end: windowEnd,
        evidence: {
          applications_observed: applications,
          applications_expected: round(expectedApps, 1),
          symptoms_observed: symptoms,
          symptoms_expected: round(expectedSymptoms, 1),
          symptom_categories: categories,
          ratio: round(symptomRatio, 1),
          series_start: windowStart,
          series_agri: seriesAgri,
          series_health: seriesHealth,
        },
        headline: "Input applications followed by a symptom cluster",
        explanation:
          `WHO Class II applications in ${block.name} reached ${applications} ` +
          `in 7 days against ${baselinePhrase(expectedApps, "per week")}. ` +
          `${categories.join(", ")} reports over the following ` +
          `${observedDays} days reached ${symptoms} against ` +
          `${baselinePhrase(expectedSymptoms, `per ${observedDays} days`)}.`,
        action:
          `Alert ${Math.max(workers, 1)} ASHA worker${workers === 1 ? "" : "s"} ` +
          `in ${block.name} with the exposure protocol, and advise a spraying ` +
          `pause pending review.`,
        action_role: "Block health officer",
      },
    };
  }

  return best;
}

// ----------------------------------------------------------- rule 2: heat

function detectHeat(
  block: Block,
  weather: WeatherDay[],
  health: HealthRecord[],
  asOf: number,
): Partial_ | null {
  const T = THRESHOLDS;

  const recent = weather.filter((w) => {
    const d = toDay(w.for_date);
    return d >= asOf - T.evalLookbackDays && d <= asOf + 5;
  });
  if (recent.length === 0) return null;

  // Longest run of consecutive days at or above the threshold.
  let runStart: string | null = null;
  let bestRun: { start: string; end: string; peak: number; days: number } | null =
    null;
  let current: { start: string; end: string; peak: number; days: number } | null =
    null;

  for (let i = 0; i < recent.length; i++) {
    const w = recent[i];
    const hot = w.heat_index_c >= T.heatIndexC;
    const contiguous =
      i > 0 && toDay(w.for_date) === toDay(recent[i - 1].for_date) + 1;

    if (hot && current && contiguous) {
      current.end = w.for_date;
      current.days += 1;
      current.peak = Math.max(current.peak, w.heat_index_c);
    } else if (hot) {
      current = {
        start: w.for_date,
        end: w.for_date,
        peak: w.heat_index_c,
        days: 1,
      };
    } else {
      if (current && (!bestRun || current.days > bestRun.days)) bestRun = current;
      current = null;
    }
  }
  if (current && (!bestRun || current.days > bestRun.days)) bestRun = current;

  if (!bestRun || bestRun.days < T.minHeatRunDays) return null;

  const severity: Severity =
    bestRun.peak >= 52 ? "high" : bestRun.peak >= 45 ? "medium" : "low";
  const band =
    bestRun.peak >= 52 ? "extreme" : bestRun.peak >= 45 ? "danger" : "caution";

  const workers = new Set(health.map((h) => h.reporter_id)).size;

  return {
    score: SEVERITY_RANK[severity] + 1,
    flag: {
      flag_id: `heat:${block.block_id}:${bestRun.start}`,
      block_id: block.block_id,
      block_name: block.name,
      rule: "heat",
      severity,
      confidence: bestRun.days >= 3 ? "high" : "medium",
      window_start: bestRun.start,
      window_end: bestRun.end,
      evidence: {
        peak_heat_index_c: bestRun.peak,
        heat_days: bestRun.days,
        ratio: round(bestRun.peak / T.heatIndexC, 2),
      },
      headline: `Heat index in the ${band} band for ${bestRun.days} days`,
      explanation:
        `${block.name} held a heat index at or above ${T.heatIndexC}C for ` +
        `${bestRun.days} consecutive days, peaking at ${bestRun.peak}C, which ` +
        `is the ${band} band.`,
      action:
        `Shift field labour out of the 11:00 to 16:00 window and prompt ORS ` +
        `distribution through ${Math.max(workers, 1)} ASHA worker${workers === 1 ? "" : "s"}.`,
      action_role: "Block agriculture officer",
    },
  };
}

// ------------------------------------------------------ rule 3: composite

/**
 * The bridge, stated as a rule. Heat drives sweating and a higher respiratory
 * rate, and both increase dermal and inhalation uptake of the same compound.
 * A health system cannot see the applications and an agriculture system cannot
 * see the symptoms, so neither can raise this on its own.
 */
function composite(
  block: Block,
  exposure: Partial_,
  heat: Partial_,
  health: HealthRecord[],
): CorrelationFlag {
  const base =
    SEVERITY_RANK[exposure.flag.severity] >= SEVERITY_RANK[heat.flag.severity]
      ? exposure.flag.severity
      : heat.flag.severity;

  const workers = new Set(health.map((h) => h.reporter_id)).size;
  const e = exposure.flag.evidence;
  const h = heat.flag.evidence;

  const windowStart =
    exposure.flag.window_start < heat.flag.window_start
      ? exposure.flag.window_start
      : heat.flag.window_start;
  const windowEnd =
    exposure.flag.window_end > heat.flag.window_end
      ? exposure.flag.window_end
      : heat.flag.window_end;

  return {
    flag_id: `composite:${block.block_id}:${windowStart}`,
    block_id: block.block_id,
    block_name: block.name,
    rule: "composite",
    severity: escalate(base),
    confidence: "high",
    window_start: windowStart,
    window_end: windowEnd,
    // Spread heat over exposure, then restore the exposure ratio: the symptom
    // ratio is what expresses how far outside baseline this block is, and the
    // heat ratio would otherwise silently replace it.
    evidence: { ...e, ...h, ratio: e.ratio },
    headline: "Exposure spike under sustained heat",
    explanation:
      `${exposure.flag.explanation} Heat index held above ` +
      `${h.peak_heat_index_c}C across ${h.heat_days} days of the same window, ` +
      `which raises dermal absorption of the compounds applied.`,
    action:
      `Escalate to district. Alert ${Math.max(workers, 1)} ASHA worker` +
      `${workers === 1 ? "" : "s"} with the exposure protocol, advise a ` +
      `spraying pause, and shift field labour out of 11:00 to 16:00.`,
    action_role: "District health and agriculture officers",
  };
}
