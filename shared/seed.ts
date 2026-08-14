/**
 * Deterministic synthetic dataset for Yavatmal district, Maharashtra.
 *
 * Yavatmal is the site of a widely reported 2017 organophosphate poisoning
 * cluster among cotton farmers, which is why it is the demo geography: the
 * exposure rule describes something that has actually happened there.
 *
 * Every record here is synthetic. Block codes are shaped like LGD (Local
 * Government Directory) block codes because that is the key AgriStack and
 * state health systems join on, but they are demo values and are not claimed
 * to be the real codes for these blocks.
 *
 * Five blocks are deliberately rigged so the engine has a known answer:
 *   Ner        composite  exposure spike under sustained heat
 *   Ghatanji   exposure   spike with no heat
 *   Kalamb     exposure   weaker spike
 *   Ralegaon   heat       heat only, no application spike
 *   Digras     none       applications spike but symptoms stay below threshold
 * The last one matters most. It is the proof that the engine says no.
 */

import {
  type AgriRecord,
  type Block,
  type HealthRecord,
  type InputClass,
  type SymptomCategory,
  type WeatherDay,
} from "./types.js";
import { heatIndexC } from "./engine.js";
import { BLOCKS } from "./blocks.js";

export { BLOCKS };

// Deterministic PRNG so the acceptance test is reproducible.
function mulberry32(seed: number) {
  return function rand(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MS_PER_DAY = 86_400_000;
const iso = (d: number) => new Date(d * MS_PER_DAY).toISOString().slice(0, 10);
const dayOf = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / MS_PER_DAY);

const AGE_BANDS = ["0 to 5", "6 to 17", "18 to 40", "41 to 60", "60 plus"];
const CROPS = ["cotton", "soybean", "pigeon pea", "sorghum"];
const BENIGN_INPUTS: InputClass[] = ["pyrethroid", "herbicide", "fertiliser", "biological"];
const ALL_SYMPTOMS: SymptomCategory[] = ["dermal", "respiratory", "neuro", "gi"];

interface Rig {
  block_id: string;
  /** Days before asOf that the application spike begins. */
  spikeAt?: number;
  applications?: number;
  symptoms?: number;
  symptomMix?: SymptomCategory[];
  /** Adds a hot run of this many days ending shortly before asOf. */
  heatDays?: number;
  heatPeakTempC?: number;
  /** Multiplier on the block's ordinary symptom rate. */
  baseSymptomRate?: number;
}

const RIGS: Rig[] = [
  // Composite. Spike plus a hot run over the same window.
  { block_id: "LGD4162", spikeAt: 11, applications: 9, symptoms: 13, symptomMix: ["dermal", "dermal", "dermal", "respiratory", "neuro"], heatDays: 4, heatPeakTempC: 33.4 },
  // Exposure only, strong.
  { block_id: "LGD4171", spikeAt: 9, applications: 7, symptoms: 10, symptomMix: ["dermal", "dermal", "respiratory"] },
  // Exposure only, weaker.
  { block_id: "LGD4164", spikeAt: 14, applications: 5, symptoms: 8, symptomMix: ["dermal", "respiratory"] },
  // Heat only.
  { block_id: "LGD4168", heatDays: 3, heatPeakTempC: 34.0 },
  // Near miss: applications spike, symptoms deliberately stay under the floor.
  { block_id: "LGD4165", spikeAt: 10, applications: 8, symptoms: 2, symptomMix: ["dermal"], baseSymptomRate: 0.5 },
];

export interface SeedData {
  blocks: Block[];
  health: HealthRecord[];
  agri: AgriRecord[];
  weather: WeatherDay[];
  asOf: string;
}

export function buildSeed(asOfIso: string, seed = 20260814): SeedData {
  const rand = mulberry32(seed);
  const asOf = dayOf(asOfIso);
  const HISTORY = 60;

  const health: HealthRecord[] = [];
  const agri: AgriRecord[] = [];
  const weather: WeatherDay[] = [];

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  let opCounter = 0;
  const opId = (prefix: string) =>
    `${prefix}-${(++opCounter).toString(36).padStart(5, "0")}-${Math.floor(rand() * 0xffff).toString(16)}`;

  for (const block of BLOCKS) {
    const rig = RIGS.find((r) => r.block_id === block.block_id);
    const workers = [1, 2, 3].map(
      (n) => `ASHA-${block.block_id.slice(-4)}-${n}`,
    );
    const agriWorkers = [1, 2].map(
      (n) => `AGRI-${block.block_id.slice(-4)}-${n}`,
    );

    // ---- ordinary health background -------------------------------------
    // Roughly 2 to 3 reports per week per block, which lands close to the
    // per-block volume an ASHA worker realistically files.
    const rate = (rig?.baseSymptomRate ?? 1) * 0.33;
    for (let d = asOf - HISTORY; d <= asOf; d++) {
      if (rand() > rate) continue;
      health.push({
        op_id: opId("h"),
        block_id: block.block_id,
        observed_on: iso(d),
        symptom_category: pick(ALL_SYMPTOMS),
        severity: (1 + Math.floor(rand() * 3)) as 1 | 2 | 3,
        age_band: pick(AGE_BANDS),
        reporter_id: pick(workers),
      });
    }

    // ---- ordinary agri background ---------------------------------------
    for (let d = asOf - HISTORY; d <= asOf; d++) {
      if (rand() > 0.16) continue;
      // Hazardous compounds are a minority of ordinary applications.
      const hazardous = rand() < 0.28;
      agri.push({
        op_id: opId("a"),
        block_id: block.block_id,
        applied_on: iso(d),
        input_class: hazardous
          ? rand() < 0.7
            ? "organophosphate"
            : "carbamate"
          : pick(BENIGN_INPUTS),
        crop: pick(CROPS),
        area_ha: Math.round((0.4 + rand() * 3.2) * 10) / 10,
        reporter_id: pick(agriWorkers),
      });
    }

    // ---- rigged application spike ---------------------------------------
    if (rig?.spikeAt && rig.applications) {
      for (let i = 0; i < rig.applications; i++) {
        const offset = Math.floor(rand() * 5); // spike compressed into ~5 days
        agri.push({
          op_id: opId("a"),
          block_id: block.block_id,
          applied_on: iso(asOf - rig.spikeAt + offset),
          input_class: rand() < 0.75 ? "organophosphate" : "carbamate",
          crop: "cotton",
          area_ha: Math.round((1.2 + rand() * 2.6) * 10) / 10,
          reporter_id: pick(agriWorkers),
        });
      }
    }

    // ---- rigged symptom cluster -----------------------------------------
    if (rig?.spikeAt && rig.symptoms) {
      const mix = rig.symptomMix ?? ["dermal"];
      for (let i = 0; i < rig.symptoms; i++) {
        // Symptoms land 1 to 5 days after the applications begin.
        const offset = 1 + Math.floor(rand() * 5);
        health.push({
          op_id: opId("h"),
          block_id: block.block_id,
          observed_on: iso(asOf - rig.spikeAt + offset),
          symptom_category: pick(mix),
          severity: (rand() < 0.35 ? 3 : rand() < 0.7 ? 2 : 1) as 1 | 2 | 3,
          age_band: rand() < 0.7 ? "18 to 40" : pick(AGE_BANDS),
          reporter_id: pick(workers),
        });
      }
    }

    // ---- weather ---------------------------------------------------------
    // Monsoon-break conditions in Vidarbha: mid-30s with high humidity, which
    // is where the heat index becomes dangerous even though the dry-bulb
    // temperature does not look extreme.
    for (let d = asOf - 30; d <= asOf + 4; d++) {
      const daysBeforeEnd = asOf - 2 - d;
      const inHotRun =
        rig?.heatDays !== undefined &&
        daysBeforeEnd >= 0 &&
        daysBeforeEnd < rig.heatDays;

      // Around 33C at 70 percent humidity the Rothfusz index crosses 44C,
      // which is the danger band. Ordinary days are held below 30.5C and
      // 70 percent so they cannot drift over the 40C threshold on noise.
      const temp_c = inHotRun
        ? (rig!.heatPeakTempC ?? 33.4) - rand() * 0.8
        : 27.5 + rand() * 3.0;
      const humidity_pct = inHotRun ? 68 + rand() * 7 : 55 + rand() * 15;

      weather.push({
        block_id: block.block_id,
        for_date: iso(d),
        temp_c: Math.round(temp_c * 10) / 10,
        humidity_pct: Math.round(humidity_pct),
        heat_index_c: heatIndexC(temp_c, humidity_pct),
      });
    }
  }

  health.sort((a, b) => a.observed_on.localeCompare(b.observed_on));
  agri.sort((a, b) => a.applied_on.localeCompare(b.applied_on));

  return { blocks: BLOCKS, health, agri, weather, asOf: asOfIso };
}

/** What the acceptance test asserts. Changing the rigs means changing this. */
export const EXPECTED_FLAGS: Record<string, "composite" | "exposure" | "heat"> = {
  LGD4162: "composite",
  LGD4171: "exposure",
  LGD4164: "exposure",
  LGD4168: "heat",
};

/** Must produce no flag at all. */
export const EXPECTED_SILENT = ["LGD4165"];
