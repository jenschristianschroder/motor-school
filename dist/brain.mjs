// A periodic radial-basis-function policy. Each independently taught body part
// has two trainable output channels. All learning happens on the device.
export const PARTS = ['nearFoot', 'farFoot', 'nearHand', 'farHand', 'belly', 'back', 'head'];
export const NAMES = {
  nearFoot: 'Front foot', farFoot: 'Back foot', nearHand: 'Front hand',
  farHand: 'Back hand', belly: 'Belly', back: 'Back', head: 'Head'
};
export const K = 18;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const lerp = (a, b, t) => a + (b - a) * t;
const wrap = n => n - Math.floor(n);
const zeros = () => Array(K).fill(0);
const paired = {nearFoot:'farFoot', farFoot:'nearFoot', nearHand:'farHand', farHand:'nearHand'};
const offset = {nearFoot:0, farFoot:0.5, nearHand:0.5, farHand:0, belly:0, back:0, head:0};

// Precompute circular Gaussian features on a fine grid for cheap inference.
const featureTable = Array.from({length:256}, (_, i) => {
  const features = Array.from({length:K}, (_, k) => {
    const d = Math.abs(i / 256 - k / K);
    return Math.exp(-0.5 * (Math.min(d, 1 - d) * K / 0.78) ** 2);
  });
  const sum = features.reduce((a, b) => a + b, 0);
  return features.map(v => v / sum);
});
function features(phase) { return featureTable[Math.floor(wrap(phase) * 256)]; }
function output(w, f) {
  let result = 0;
  for (let i = 0; i < K; i++) result += w[i] * f[i];
  return result;
}
const blankPart = () => ({x:zeros(), y:zeros(), n:0});
const defaultGait = () => ({tempo:1, stride:1, lift:1});
const newRecord = () => ({best:0, runs:0, won:false, fit:null, tuning:defaultGait()});
export function newMemory() {
  return {version:1, parts:Object.fromEntries(PARTS.map(p => [p, blankPart()])),
    examples:0, tempo:1.14, trials:0, records:[newRecord(), newRecord(), newRecord()],
    lastPart:null, lesson:0, sound:false};
}
const valid = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
export function readMemory(raw) {
  const fresh = newMemory();
  if (!raw) return fresh;
  try {
    const m = JSON.parse(raw);
    if (m.version !== 1) return fresh;
    for (const p of PARTS) {
      const a = m.parts?.[p];
      if (a && Number.isInteger(a.n) && valid(a.n,0,1e7) &&
          [a.x,a.y].every(v => Array.isArray(v) && v.length === K && v.every(n => valid(n,-200,200)))) {
        fresh.parts[p] = {n:a.n, x:a.x.slice(), y:a.y.slice()};
      }
    }
    fresh.examples = PARTS.reduce((s,p) => s + fresh.parts[p].n, 0);
    if (valid(m.tempo,0.6,2)) fresh.tempo = m.tempo;
    if (PARTS.includes(m.lastPart) && fresh.parts[m.lastPart].n) fresh.lastPart = m.lastPart;
    if (Number.isInteger(m.lesson) && valid(m.lesson,0,2)) fresh.lesson = m.lesson;
    fresh.sound = m.sound === true;
    fresh.records.forEach((record,i) => {
      const saved = m.records?.[i];
      if (!saved) return;
      if (valid(saved.best,0,25)) record.best = saved.best;
      if (Number.isInteger(saved.runs) && valid(saved.runs,0,1e8)) record.runs = saved.runs;
      record.won = saved.won === true;
      if (valid(saved.fit,-5,40)) record.fit = saved.fit;
      for (const k of Object.keys(record.tuning)) {
        if (valid(saved.tuning?.[k],0.65,1.5)) record.tuning[k] = saved.tuning[k];
      }
      fresh.trials += record.runs;
    });
  } catch { return fresh; }
  return fresh;
}

function motionPath(samples) {
  const points = [{x:0, y:0, t:0, distance:0}];
  for (const s of samples) {
    const prev = points[points.length - 1];
    const step = Math.hypot(s.x - prev.x, s.y - prev.y);
    if (step < 0.75 || !Number.isFinite(step)) continue;
    points.push({x:s.x, y:s.y, t:s.t, distance:prev.distance + step});
  }
  return points;
}
function samplePath(points, at) {
  const last = points[points.length-1];
  const want = last.distance * clamp(at,0,1);
  let i = 1;
  while (i < points.length-1 && points[i].distance < want) i++;
  const a = points[i-1], b = points[i];
  const t = (want - a.distance) / (b.distance - a.distance || 1);
  return [lerp(a.x,b.x,t), lerp(a.y,b.y,t)];
}
function targetAt(points, foot, phase) {
  const end = points[points.length-1];
  // The taught arc is the swing. Close the cycle by planting the foot
  // and returning to neutral under load. Direction and clearance are taught.
  if (phase < 0.46) return samplePath(points, phase / 0.46);
  if (phase < 0.57) {
    const t = (phase - 0.46) / 0.11;
    return [end.x, foot ? lerp(end.y,0,t) : end.y];
  }
  const t = (phase - 0.57) / 0.43;
  const ease = t * t * (3 - 2 * t);
  return [lerp(end.x,0,ease), foot ? 0 : lerp(end.y,0,ease)];
}
export function teach(memory, part, samples) {
  if (!PARTS.includes(part) || samples.length === 0) return false;
  const points = motionPath(samples);
  const last = points[points.length-1];
  if (points.length < 2 || last.distance < 5) return false;
  const foot = part.endsWith('Foot');
  const model = memory.parts[part];
  const previousX = model.x.slice(), previousY = model.y.slice();
  const weight = model.n ? 0.53 : 1;
  const examples = Array.from({length:64}, (_,i) => {
    const phase = i / 64, f = features(phase);
    const [x,y] = targetAt(points,foot,phase);
    return {f, x:lerp(output(previousX,f),x,weight), y:lerp(output(previousY,f),y,weight)};
  });
  // Normalized online least-mean-squares updates on the demonstrations.
  for (let epoch = 0; epoch < 8; epoch++) {
    for (let j = 0; j < 64; j++) {
      const {f,x,y} = examples[(j * 23 + epoch * 7) % 64];
      const gain = 0.32 / f.reduce((s,v) => s + v*v,0);
      const dx = (x - output(model.x,f)) * gain, dy = (y - output(model.y,f)) * gain;
      for (let i = 0; i < K; i++) {
        model.x[i] += dx * f[i];
        model.y[i] += dy * f[i];
      }
    }
  }
  if (foot && last.t > 0.08) {
    const rate = clamp(0.58 / last.t, 0.83, 1.65);
    memory.tempo = lerp(memory.tempo, rate, model.n ? 0.18 : 0.35);
  }
  model.n++; memory.examples++; memory.lastPart = part;
  // A changed demonstration policy gets a fresh score on each course.
  for (const record of memory.records) record.fit = null;
  return true;
}
export function predict(memory, part, phase, gait = defaultGait()) {
  let model = memory.parts[part], gain = 1;
  if (!model.n && paired[part]) { model = memory.parts[paired[part]]; gain = 0.77; }
  if (!model.n) return {x:0,y:0};
  const f = features(phase + offset[part]);
  return {x:gain * gait.stride * output(model.x,f), y:gain * gait.lift * output(model.y,f)};
}
export function trialGait(memory, lesson, random = Math.random) {
  const record = memory.records[lesson], gait = {...record.tuning};
  if (record.fit === null || !memory.examples) return gait;
  // A small (1+1) evolution strategy explores a bounded policy perturbation.
  // Failed variants are discarded. Better cadence / reach survives the trial.
  for (const key of Object.keys(gait)) gait[key] = clamp(gait[key] + (random()*2-0.9)*0.13, 0.67,1.48);
  return gait;
}
export function finishTrial(memory, lesson, gait, distance, elapsed, success) {
  const r = memory.records[lesson];
  const best = distance > r.best + 0.005;
  const score = distance + (success ? 1 + 1 / Math.max(1,elapsed) : 0);
  if (memory.examples && (r.fit === null || score > r.fit)) { r.fit = score; r.tuning = {...gait}; }
  r.best = Math.max(r.best,distance); r.runs++; r.won ||= success; memory.trials++;
  return best;
}
