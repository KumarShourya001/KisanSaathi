/**
 * Does real weather in the demo district actually produce heat advisories?
 *
 * If it does, the weather feed can be fully real and the synthetic heat run
 * can be deleted. If it does not, overwriting the seed with live data would
 * silently remove the composite flag, which is the demo's whole argument.
 * Worth knowing before switching, rather than after.
 */

import { heatIndexC, THRESHOLDS } from "../shared/engine.js";
import { BLOCKS } from "../shared/blocks.js";

interface OpenMeteo {
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
  };
}

for (const block of BLOCKS.slice(0, 4)) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${block.lat}&longitude=${block.lon}` +
    `&hourly=temperature_2m,relative_humidity_2m&past_days=60&forecast_days=7&timezone=auto`;

  const res = await fetch(url);
  const json = (await res.json()) as OpenMeteo;

  // Daily maximum temperature, with the humidity recorded at that same hour.
  const perDay = new Map<string, { temp: number; rh: number }>();
  json.hourly.time.forEach((stamp, i) => {
    const t = json.hourly.temperature_2m[i];
    const rh = json.hourly.relative_humidity_2m[i];
    if (t === null || rh === null) return;
    const day = stamp.slice(0, 10);
    const prev = perDay.get(day);
    if (!prev || t > prev.temp) perDay.set(day, { temp: t, rh });
  });

  const rows = [...perDay.entries()]
    .map(([day, v]) => ({ day, ...v, hi: heatIndexC(v.temp, v.rh) }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const hot = rows.filter((r) => r.hi >= THRESHOLDS.heatIndexC);
  const peak = rows.reduce((m, r) => (r.hi > m.hi ? r : m), rows[0]);

  // Longest consecutive run at or above threshold.
  let run = 0;
  let best = 0;
  for (const r of rows) {
    run = r.hi >= THRESHOLDS.heatIndexC ? run + 1 : 0;
    best = Math.max(best, run);
  }

  console.log(
    `${block.name.padEnd(11)} days=${rows.length}  ` +
      `peakHI=${peak.hi}C (${peak.temp}C/${peak.rh}%) on ${peak.day}  ` +
      `daysOver${THRESHOLDS.heatIndexC}=${hot.length}  longestRun=${best}`,
  );
}
