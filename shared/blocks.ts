import type { Block } from "./types.js";

/**
 * Block reference data for the demo district.
 *
 * Kept in its own module so the browser bundle can import the block list
 * without dragging in the synthetic data generator. It ships with the app so
 * a first run with no signal still knows which blocks exist.
 *
 * Block codes are shaped like LGD (Local Government Directory) block codes,
 * which is the key AgriStack and state health systems join on. These specific
 * values are demo codes and are not claimed to be the real LGD codes for
 * these blocks. Replace them with verified codes before any pilot.
 */
export const BLOCKS: Block[] = [
  { block_id: "LGD4162", name: "Ner",        district: "Yavatmal", state: "Maharashtra", lat: 20.4, lon: 78.0, households: 2840 },
  { block_id: "LGD4163", name: "Babhulgaon", district: "Yavatmal", state: "Maharashtra", lat: 20.3, lon: 78.2, households: 2190 },
  { block_id: "LGD4164", name: "Kalamb",     district: "Yavatmal", state: "Maharashtra", lat: 20.1, lon: 78.3, households: 2460 },
  { block_id: "LGD4165", name: "Digras",     district: "Yavatmal", state: "Maharashtra", lat: 20.1, lon: 77.7, households: 3120 },
  { block_id: "LGD4166", name: "Darwha",     district: "Yavatmal", state: "Maharashtra", lat: 20.3, lon: 77.8, households: 2730 },
  { block_id: "LGD4167", name: "Arni",       district: "Yavatmal", state: "Maharashtra", lat: 19.9, lon: 78.2, households: 2050 },
  { block_id: "LGD4168", name: "Ralegaon",   district: "Yavatmal", state: "Maharashtra", lat: 20.2, lon: 78.5, households: 1980 },
  { block_id: "LGD4169", name: "Maregaon",   district: "Yavatmal", state: "Maharashtra", lat: 20.1, lon: 78.7, households: 1640 },
  { block_id: "LGD4170", name: "Wani",       district: "Yavatmal", state: "Maharashtra", lat: 20.0, lon: 78.9, households: 3480 },
  { block_id: "LGD4171", name: "Ghatanji",   district: "Yavatmal", state: "Maharashtra", lat: 20.1, lon: 78.3, households: 2270 },
];

export function blockName(id: string | null | undefined): string {
  return BLOCKS.find((b) => b.block_id === id)?.name ?? "Unknown block";
}
