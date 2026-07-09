import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, "..");
const sourcePath = join(backendDir, "take-home-data.json");
const outputPath = join(backendDir, "take-home-data-v2.json");

const data = JSON.parse(readFileSync(sourcePath, "utf8"));
const asOfYear = new Date(data.asOf).getUTCFullYear();

function parseKey(key) {
  const [term, merchantPct, cycling, profile] = key.split("|");

  return {
    term: Number(term),
    merchantPct: Number(merchantPct),
    cycling: Number(cycling),
    profile,
  };
}

function byPercentile(points) {
  return Object.fromEntries(points.map((point) => [point.p, point.pnlPerMwYr]));
}

function round(value) {
  return Math.round(value);
}

function hashString(value) {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildHistoryCurve(key, curve, terms) {
  const rng = createRng(hashString(key));
  const historyYears = Array.from({ length: 11 }, (_, index) => asOfYear - 10 + index);
  const currentValue = Number.isFinite(curve?.strikePerMwYr)
    ? curve.strikePerMwYr
    : 0;
  const profileBias = terms.profile === "solar" ? -0.015 : 0.02;
  const termBias = terms.term >= 15 ? 0.007 : 0.004;
  const merchantBias = terms.merchantPct / 1200;
  const cyclingBias = (terms.cycling - 1) * 0.01;
  const baseGrowth = 0.018 + profileBias + termBias + merchantBias + cyclingBias;
  let value =
    currentValue *
    (0.74 +
      terms.merchantPct / 1000 +
      (terms.profile === "solar" ? -0.015 : 0.03) +
      (terms.cycling - 1) * 0.02);

  const rawHistory = historyYears.map((year, index) => {
    const seasonal = Math.sin(index * 0.72) * 0.018;
    const cyclical = Math.cos(index * 0.33) * 0.008;
    const shock =
      index === 3
        ? -0.045
        : index === 6
          ? 0.032
          : index === 8
            ? -0.018
            : 0;
    const noise = (rng() - 0.5) * 0.05;
    value *= 1 + baseGrowth + seasonal + cyclical + shock + noise;

    return {
      year,
      pnlPerMwYr: value,
    };
  });

  const scale = currentValue / rawHistory.at(-1).pnlPerMwYr;

  return rawHistory.map((point) => ({
    year: point.year,
    pnlPerMwYr: round(point.pnlPerMwYr * scale),
  }));
}

function hasUsablePnlCurve(curve, points) {
  return (
    Number.isFinite(curve?.strikePerMwYr) &&
    [10, 25, 50, 75, 90].every((percentile) =>
      Number.isFinite(points[percentile]),
    )
  );
}

function buildFanCurve(key, curve) {
  const terms = parseKey(key);
  const points = byPercentile(curve.points || []);

  if (!hasUsablePnlCurve(curve, points)) {
    return {
      asOf: data.asOf,
      strikePerMwYr: curve.strikePerMwYr,
      term: terms.term,
      historyStartYear: asOfYear - 10,
      historyEndYear: asOfYear,
      forecastStartYear: asOfYear + 1,
      forecastEndYear: asOfYear + terms.term,
      bands: [],
      history: [],
      timeline: [],
    };
  }

  const medianStart = points[50];
  const history = buildHistoryCurve(key, curve, terms);
  const historyStartYear = history[0]?.year ?? asOfYear - 10;
  const historyEndYear = history.at(-1)?.year ?? asOfYear;
  const forecastStartYear = historyEndYear + 1;
  const forecastEndYear = forecastStartYear + terms.term - 1;

  // The original P&L curve is treated as year 1. Each subsequent year nudges
  // the median upward and widens the tail spread to represent increasing
  // forecast uncertainty across the contract horizon.
  const medianGrowthRate = terms.profile === "solar" ? 0.011 : 0.014;
  const horizonRiskRate =
    0.052 +
    terms.merchantPct / 1000 +
    (terms.cycling - 1) * 0.018 +
    (terms.profile === "solar" ? 0.012 : 0);

  const bands = Array.from({ length: terms.term }, (_, index) => {
    const year = index + 1;
    const elapsedYears = year - 1;
    const p50 = medianStart * Math.pow(1 + medianGrowthRate, elapsedYears);
    const spreadMultiplier = 1 + horizonRiskRate * elapsedYears;

    return {
      year,
      p10: round(p50 - Math.abs(medianStart - points[10]) * spreadMultiplier),
      p25: round(p50 - Math.abs(medianStart - points[25]) * spreadMultiplier),
      p50: round(p50),
      p75: round(p50 + Math.abs(points[75] - medianStart) * spreadMultiplier),
      p90: round(p50 + Math.abs(points[90] - medianStart) * spreadMultiplier),
    };
  });

  const timeline = [
    ...history.map((point) => ({
      kind: "history",
      calendarYear: point.year,
      pnlPerMwYr: point.pnlPerMwYr,
    })),
    ...bands.map((band) => ({
      kind: band.year === 1 ? "bridge" : "forecast",
      calendarYear: forecastStartYear + band.year - 1,
      forecastYear: band.year,
      p10: band.p10,
      p25: band.p25,
      p50: band.p50,
      p75: band.p75,
      p90: band.p90,
    })),
  ];

  return {
    asOf: data.asOf,
    strikePerMwYr: curve.strikePerMwYr,
    term: terms.term,
    historyStartYear,
    historyEndYear,
    forecastStartYear,
    forecastEndYear,
    history,
    bands,
    timeline,
  };
}

function buildCashflow(key, curve, fanCurve) {
  const terms = parseKey(key);

  if (!Number.isFinite(curve?.strikePerMwYr) || fanCurve.bands.length === 0) {
    return {
      asOf: data.asOf,
      term: terms.term,
      rows: [],
      timeline: [],
    };
  }

  const contractedShare = (100 - terms.merchantPct) / 100;
  const merchantShare = terms.merchantPct / 100;
  const baseOpex =
    -(18_000 + terms.cycling * 4_000 + (terms.profile === "solar" ? 1_200 : 0));
  const forecastStartYear = fanCurve.forecastStartYear ?? asOfYear + 1;

  let cumulativeNet = 0;

  const rows = fanCurve.bands.map((band) => {
    const elapsedYears = band.year - 1;
    const contracted = round(
      curve.strikePerMwYr * contractedShare * Math.pow(1.005, elapsedYears),
    );
    const merchant = round(band.p50 * merchantShare);
    const opex = round(baseOpex * Math.pow(1.025, elapsedYears));
    cumulativeNet += contracted + merchant + opex;

    return {
      year: band.year,
      contracted,
      merchant,
      opex,
      cumulativeNet: round(cumulativeNet),
    };
  });

  const timeline = rows.map((row) => ({
    kind: "forecast",
    calendarYear: forecastStartYear + row.year - 1,
    ...row,
  }));

  return {
    asOf: data.asOf,
    term: terms.term,
    rows,
    timeline,
  };
}

const fanCurves = {};
const cashflows = {};

for (const [key, curve] of Object.entries(data.pnlCurves)) {
  fanCurves[key] = buildFanCurve(key, curve);
  cashflows[key] = buildCashflow(key, curve, fanCurves[key]);
}

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      ...data,
      fanCurves,
      cashflows,
    },
    null,
    2,
  )}\n`,
);

console.log(`Generated ${outputPath}`);
console.log(`fanCurves: ${Object.keys(fanCurves).length}`);
console.log(`cashflows: ${Object.keys(cashflows).length}`);
