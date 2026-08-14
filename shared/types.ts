// Shared between the browser app, the serverless API, and the local scripts.
// Keep this file free of any runtime import so every consumer can use it.

export type SymptomCategory = "dermal" | "respiratory" | "neuro" | "gi";

export type InputClass =
  | "organophosphate"
  | "carbamate"
  | "pyrethroid"
  | "herbicide"
  | "fertiliser"
  | "biological";

/** WHO Hazard Class II compounds. The exposure rule only counts these. */
export const HAZARDOUS_INPUTS: InputClass[] = ["organophosphate", "carbamate"];

/** Categories plausibly linked to acute pesticide exposure. GI is excluded
 *  because it has too high a background rate from waterborne causes to be
 *  informative at this sample size. */
export const EXPOSURE_SYMPTOMS: SymptomCategory[] = [
  "dermal",
  "respiratory",
  "neuro",
];

export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type RuleId = "exposure" | "heat" | "composite";
export type Role = "asha" | "agri" | "officer";

export interface Block {
  block_id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  households: number;
}

export interface HealthRecord {
  op_id: string;
  block_id: string;
  observed_on: string; // YYYY-MM-DD
  symptom_category: SymptomCategory;
  severity: 1 | 2 | 3;
  age_band: string;
  reporter_id: string;
}

export interface AgriRecord {
  op_id: string;
  block_id: string;
  applied_on: string; // YYYY-MM-DD
  input_class: InputClass;
  crop: string;
  area_ha: number;
  reporter_id: string;
}

export interface WeatherDay {
  block_id: string;
  for_date: string; // YYYY-MM-DD
  temp_c: number;
  humidity_pct: number;
  heat_index_c: number;
}

/** Everything the UI needs to explain a flag without recomputing anything. */
export interface FlagEvidence {
  applications_observed?: number;
  applications_expected?: number;
  symptoms_observed?: number;
  symptoms_expected?: number;
  symptom_categories?: SymptomCategory[];
  peak_heat_index_c?: number;
  heat_days?: number;
  ratio?: number;
  /** Daily counts across the flag window, so the UI can draw the two feeds
   *  without a second round trip or a second copy of the windowing logic. */
  series_start?: string;
  series_agri?: number[];
  series_health?: number[];
}

export interface CorrelationFlag {
  flag_id: string;
  block_id: string;
  block_name: string;
  rule: RuleId;
  severity: Severity;
  confidence: Confidence;
  window_start: string;
  window_end: string;
  evidence: FlagEvidence;
  headline: string;
  explanation: string;
  action: string;
  action_role: string;
}

/** One row of the append-only client op log. */
export interface SyncOp {
  op_id: string;
  kind: "health" | "agri";
  block_id: string;
  device_id: string;
  seq: number;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface SyncResult {
  accepted: string[];
  duplicates: string[];
  rejected: { op_id: string; reason: string }[];
}
