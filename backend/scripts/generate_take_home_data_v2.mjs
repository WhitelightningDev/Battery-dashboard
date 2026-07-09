import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, "..");
const sourcePath = join(backendDir, "take-home-data.json");
const outputPath = join(backendDir, "take-home-data-v2.json");

const data = JSON.parse(readFileSync(sourcePath, "utf8"));

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
      bands: [],
    };
  }

  const medianStart = points[50];

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

  return {
    asOf: data.asOf,
    strikePerMwYr: curve.strikePerMwYr,
    term: terms.term,
    bands,
  };
}

function buildCashflow(key, curve, fanCurve) {
  const terms = parseKey(key);

  if (!Number.isFinite(curve?.strikePerMwYr) || fanCurve.bands.length === 0) {
    return {
      asOf: data.asOf,
      term: terms.term,
      rows: [],
    };
  }

  const contractedShare = (100 - terms.merchantPct) / 100;
  const merchantShare = terms.merchantPct / 100;
  const baseOpex =
    -(18_000 + terms.cycling * 4_000 + (terms.profile === "solar" ? 1_200 : 0));

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

  return {
    asOf: data.asOf,
    term: terms.term,
    rows,
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
