import express from "express";
import cors from "cors";

// ------------------------- Utils -------------------------

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function mean(arr) {
  const xs = arr.filter(isNum);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(arr) {
  const xs = arr.filter(isNum);
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Ordinary least squares slope with missing y; x are indices (0..n-1) for days used
function slopePerDay(values) {
  const pts = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (isNum(v)) pts.push([i, v]);
  }
  const n = pts.length;
  if (n < 2) return 0;
  const sx = pts.reduce((a, [x]) => a + x, 0);
  const sy = pts.reduce((a, [, y]) => a + y, 0);
  const sxx = pts.reduce((a, [x]) => a + x * x, 0);
  const sxy = pts.reduce((a, [x, y]) => a + x * y, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-8) return 0;
  const m = (n * sxy - sx * sy) / denom; // per day
  return m;
}

function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (isNum(arr[i])) return arr[i];
  }
  return null;
}

function countValid(arr) {
  return arr.filter(isNum).length;
}

function pctMissing(arr, total) {
  const v = countValid(arr);
  return total === 0 ? 1 : 1 - v / total;
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ------------------------- Feature Engineering -------------------------

function computeBMI(weight_kg, height_cm) {
  if (!isNum(weight_kg) || !isNum(height_cm) || height_cm <= 0) return null;
  const h = height_cm / 100;
  return weight_kg / (h * h);
}

function engineerFeatures(days, demographics = {}) {
  // days: array of { date, resting_hr, systolic_bp, diastolic_bp, steps, sleep_hours, water_l, diet_score, activity_minutes, weight_kg, mood, stress, hrv? }
  const N = days.length;

  const age = toNumberOrNull(demographics.age);
  const sex = (demographics.sex || "").toUpperCase(); // "M"/"F" or empty
  const smoker = !!demographics.smoker;
  const height_cm = toNumberOrNull(demographics.height_cm);

  const arrays = {
    resting_hr: [],
    systolic_bp: [],
    diastolic_bp: [],
    steps: [],
    sleep_hours: [],
    water_l: [],
    diet_score: [],
    activity_minutes: [],
    weight_kg: [],
    bmi: [],
    mood: [],
    stress: [],
    hrv: []
  };

  for (const d of days) {
    const w = toNumberOrNull(d.weight_kg);
    const bmi = isNum(d.bmi)
      ? toNumberOrNull(d.bmi)
      : computeBMI(w, height_cm);
    arrays.resting_hr.push(toNumberOrNull(d.resting_hr));
    arrays.systolic_bp.push(toNumberOrNull(d.systolic_bp));
    arrays.diastolic_bp.push(toNumberOrNull(d.diastolic_bp));
    arrays.steps.push(toNumberOrNull(d.steps));
    arrays.sleep_hours.push(toNumberOrNull(d.sleep_hours));
    arrays.water_l.push(toNumberOrNull(d.water_l));
    arrays.diet_score.push(toNumberOrNull(d.diet_score));
    arrays.activity_minutes.push(toNumberOrNull(d.activity_minutes));
    arrays.weight_kg.push(w);
    arrays.bmi.push(bmi);
    arrays.mood.push(toNumberOrNull(d.mood));
    arrays.stress.push(toNumberOrNull(d.stress));
    arrays.hrv.push(toNumberOrNull(d.hrv));
  }

  // Aggregates (means, stds, trends)
  const agg = {};
  for (const key of Object.keys(arrays)) {
    const arr = arrays[key];
    agg[`${key}_mean`] = mean(arr);
    agg[`${key}_std`] = std(arr);
    agg[`${key}_last`] = last(arr);
    agg[`${key}_trend_per_day`] = slopePerDay(arr);
    agg[`${key}_trend_per_week`] = agg[`${key}_trend_per_day`] * 7;
    agg[`${key}_missing_frac`] = pctMissing(arr, N);
  }

  // Derived helpers
  agg.sbp_over_130_rate =
    N > 0
      ? arrays.systolic_bp.filter((x) => isNum(x) && x >= 130).length / N
      : 0;

  agg.dbp_over_80_rate =
    N > 0
      ? arrays.diastolic_bp.filter((x) => isNum(x) && x >= 80).length / N
      : 0;

  // Missingness summary across key features
  const keyFeatures = [
    "resting_hr",
    "systolic_bp",
    "diastolic_bp",
    "steps",
    "sleep_hours",
    "weight_kg",
    "diet_score",
    "activity_minutes",
    "bmi",
    "stress",
    "mood"
  ];
  const missFracs = keyFeatures
    .map((k) => agg[`${k}_missing_frac`] ?? 1)
    .filter((x) => typeof x === "number");
  agg.global_missing_frac =
    missFracs.length ? missFracs.reduce((a, b) => a + b, 0) / missFracs.length : 1;

  return { N, arrays, agg, demographics: { age, sex, smoker, height_cm } };
}

// ------------------------- Anomaly Detection -------------------------

function anomalyFromBaseline(arrays, baselineDays = 7) {
  // Compute baseline (first 7 days) and anomaly series for last days
  const keys = ["resting_hr", "systolic_bp", "sleep_hours", "steps", "weight_kg"];
  const baselines = {};
  const znormsByDay = []; // per-day average |z|

  const N = arrays.resting_hr.length;
  const K = keys.length;

  // Baselines
  for (const k of keys) {
    const baseSlice = arrays[k].slice(0, Math.min(baselineDays, N)).filter(isNum);
    const m = mean(baseSlice);
    const s = std(baseSlice);
    baselines[k] = { mean: m, std: s > 1e-6 ? s : 1e-6 };
  }

  // Compute |z| per day across keys
  for (let i = 0; i < N; i++) {
    let sumAbsZ = 0;
    let cnt = 0;
    for (const k of keys) {
      const v = arrays[k][i];
      if (!isNum(v)) continue;
      const { mean: m, std: s } = baselines[k];
      if (!isNum(m) || !isNum(s)) continue;
      const z = Math.abs((v - m) / s);
      sumAbsZ += Math.min(z, 4); // cap
      cnt++;
    }
    znormsByDay.push(cnt ? sumAbsZ / cnt : 0);
  }

  // Map to 0..1 via smooth transform; cap to [0,1]
  const dailyAnoms = znormsByDay.map((z) => clamp(Math.tanh(z / 2.5), 0, 1));

  // Score for the last day, and persistence check (last 2 days)
  const score = dailyAnoms.length ? dailyAnoms[dailyAnoms.length - 1] : 0;
  const persist =
    dailyAnoms.length >= 2 &&
    dailyAnoms[dailyAnoms.length - 1] >= 0.75 &&
    dailyAnoms[dailyAnoms.length - 2] >= 0.75;

  const flag = persist || score >= 0.9; // high spike or 2-day persistence
  return { score: round2(score), flag, dailyAnoms };
}

// ------------------------- Risk Models (Rule-based Logistic) -------------------------

function riskT2D(agg, demographics) {
  // Normalized feature terms
  const age = isNum(demographics.age) ? demographics.age : 40;
  const bmi = isNum(agg.bmi_mean) ? agg.bmi_mean : 26;

  const steps = isNum(agg.steps_mean) ? agg.steps_mean : 6000;
  const stepsBad = clamp((10000 - steps) / 5000, 0, 2); // higher = worse
  const dietScore = isNum(agg.diet_score_mean) ? agg.diet_score_mean : 3;
  const dietBad = clamp((3 - dietScore) / 2, -1.5, 1.5); // lower diet score = worse
  const sleep = isNum(agg.sleep_hours_mean) ? agg.sleep_hours_mean : 7;
  const sleepBad = clamp(Math.abs(sleep - 7) / 3, 0, 2); // deviation from 7h
  const stress = isNum(agg.stress_mean) ? agg.stress_mean : 3;
  const stressNorm = clamp((stress - 3) / 2, -1.5, 1.5);
  const wtTrendWk =
    isNum(agg.weight_kg_trend_per_week) ? agg.weight_kg_trend_per_week : 0;
  const wtGain = clamp(Math.max(0, wtTrendWk) / 0.5, 0, 2); // 0.5 kg/wk gain = 1.0

  // Linear score (weights are heuristic for MVP)
  let z =
    -1.2 + 0.02 * (age - 45) +
    0.35 * ((bmi - 27) / 5) +
    0.25 * wtGain +
    -0.25 * (1 - stepsBad) + // reward for more steps
    0.18 * dietBad +
    0.15 * sleepBad +
    0.12 * stressNorm;

  const p = clamp(sigmoid(z), 0.01, 0.99);

  // Contributions for explanations (approximate)
  const contrib = {
    age: 0.02 * (age - 45),
    bmi: 0.35 * ((bmi - 27) / 5),
    weight_trend_wk: 0.25 * wtGain,
    steps_mean: -0.25 * (1 - stepsBad),
    diet_score_mean: 0.18 * dietBad,
    sleep_hours_mean: 0.15 * sleepBad,
    stress_mean: 0.12 * stressNorm
  };

  return { prob: round2(p), contrib };
}

function riskHTN(agg, demographics) {
  const age = isNum(demographics.age) ? demographics.age : 40;
  const smoker = !!demographics.smoker;
  const bmi = isNum(agg.bmi_mean) ? agg.bmi_mean : 26;
  const sbp = isNum(agg.systolic_bp_mean) ? agg.systolic_bp_mean : 118;
  const sbpTrendWk =
    isNum(agg.systolic_bp_trend_per_week) ? agg.systolic_bp_trend_per_week : 0;
  const rhr = isNum(agg.resting_hr_mean) ? agg.resting_hr_mean : 65;
  const stress = isNum(agg.stress_mean) ? agg.stress_mean : 3;
  const activity = isNum(agg.activity_minutes_mean) ? agg.activity_minutes_mean : 25;

  const sbpNorm = (sbp - 115) / 15;
  const sbpTrendNorm = sbpTrendWk / 5; // 5 mmHg/week
  const bmiNorm = (bmi - 25) / 5;
  const rhrNorm = (rhr - 60) / 15;
  const stressNorm = (stress - 3) / 2;
  const actNorm = (activity - 30) / 60;

  let z =
    -1.0 + 0.02 * (age - 40) +
    (smoker ? 0.2 : 0) +
    0.5 * sbpNorm +
    0.25 * sbpTrendNorm +
    0.2 * bmiNorm +
    0.12 * rhrNorm +
    0.12 * stressNorm +
    -0.1 * actNorm;

  const p = clamp(sigmoid(z), 0.01, 0.99);

  const contrib = {
    age: 0.02 * (age - 40),
    smoker: smoker ? 0.2 : 0,
    systolic_bp_mean: 0.5 * sbpNorm,
    systolic_bp_trend_wk: 0.25 * sbpTrendNorm,
    bmi: 0.2 * bmiNorm,
    resting_hr_mean: 0.12 * rhrNorm,
    stress_mean: 0.12 * stressNorm,
    activity_minutes_mean: -0.1 * actNorm
  };

  return { prob: round2(p), contrib };
}

// ------------------------- Confidence, Explanations, Decision -------------------------

function ci90(prob, missingFrac) {
  // Wider CI with more missingness; clamp to [0,1]
  const base = 0.12;
  const width = clamp(base + 0.25 * missingFrac, 0.1, 0.4);
  return [round2(clamp(prob - width, 0, 1)), round2(clamp(prob + width, 0, 1))];
}

function topContributors(contrib, topK = 5) {
  const items = Object.entries(contrib).map(([feature, impact]) => ({
    feature,
    impact: round3(Math.abs(impact)),
    signedImpact: impact
  }));
  items.sort((a, b) => b.impact - a.impact);
  return items.slice(0, topK).map(({ feature, impact }) => ({ feature, impact }));
}

function computeDecision({ risks, anomaly, agg }) {
  const notifyClient =
    anomaly.flag ||
    risks.t2d.prob >= 0.55 ||
    risks.htn.prob >= 0.55 ||
    (isNum(agg.systolic_bp_mean) && agg.systolic_bp_mean >= 140) ||
    (isNum(agg.diastolic_bp_mean) && agg.diastolic_bp_mean >= 90);

  const notifyDoctor =
    risks.t2d.prob >= 0.75 ||
    risks.htn.prob >= 0.75 ||
    agg.sbp_over_130_rate >= 0.5 ||
    agg.dbp_over_80_rate >= 0.5;

  const reasons = [];
  if (anomaly.flag) reasons.push("Anomaly persisted for 2 days");
  if (risks.t2d.prob >= 0.55) reasons.push(`Elevated T2D risk (${risks.t2d.prob})`);
  if (risks.htn.prob >= 0.55) reasons.push(`Elevated HTN risk (${risks.htn.prob})`);
  if (isNum(agg.systolic_bp_mean) && agg.systolic_bp_mean >= 130)
    reasons.push(`Rising BP trend / high mean SBP (${round1(agg.systolic_bp_mean)} mmHg)`);
  if (isNum(agg.diastolic_bp_mean) && agg.diastolic_bp_mean >= 80)
    reasons.push(`Elevated DBP (${round1(agg.diastolic_bp_mean)} mmHg)`);

  return {
    notify_client: !!notifyClient,
    notify_doctor: !!notifyDoctor,
    reason: reasons.slice(0, 2).join(" + ") || "Stable"
  };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
function round2(x) {
  return Math.round(x * 100) / 100;
}
function round3(x) {
  return Math.round(x * 1000) / 1000;
}

// ------------------------- API Server -------------------------

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "healthcare-eclipse-detective" });
});

app.post("/predict", (req, res) => {
  try {
    const body = req.body || {};
    const features = Array.isArray(body.features) ? body.features : [];
    const demographics = body.demographics || {};
    const window_start = body.window_start || null;
    const window_end = body.window_end || null;

    if (features.length < 14) {
      return res.status(400).json({
        error: "Need at least 14 days of features (30 preferred) in `features` array"
      });
    }

    const { N, arrays, agg, demographics: cleanDemo } = engineerFeatures(
      features,
      demographics
    );

    const anomaly = anomalyFromBaseline(arrays, 7);
    const t2d = riskT2D(agg, cleanDemo);
    const htn = riskHTN(agg, cleanDemo);

    const risks = {
      t2d: { prob: t2d.prob, ci90: ci90(t2d.prob, agg.global_missing_frac) },
      htn: { prob: htn.prob, ci90: ci90(htn.prob, agg.global_missing_frac) }
    };

    const decision = computeDecision({ risks, anomaly, agg });

    const response = {
      meta: {
        window_start,
        window_end,
        days: N,
        missing_frac: round2(agg.global_missing_frac)
      },
      risk: risks,
      anomaly: { score: anomaly.score, flag: anomaly.flag },
      top_contributors: {
        t2d: topContributors(t2d.contrib, 5),
        htn: topContributors(htn.contrib, 5)
      },
      decision
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error", details: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Detective service listening on http://localhost:${PORT}`);
});