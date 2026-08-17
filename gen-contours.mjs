// Generates irregular concentric contour fields (topographic map rings) as SVG
// symbol markup. Deterministic: each seed produces a fixed set of sinusoid
// coefficients, so re-running yields byte-identical output.
import { writeFileSync } from 'fs';

const W = 1200, H = 900;

// Small deterministic PRNG so seeds are reproducible across runs.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Radial displacement: a few octaves of sinusoid in theta. Keeps rings closed
// (period is exactly 2pi) while reading as natural terrain.
function makeNoise(rand) {
  const oct = [];
  for (let k = 0; k < 4; k++) {
    oct.push({
      freq: [2, 3, 5, 7][k],
      amp: [0.16, 0.09, 0.05, 0.028][k],
      phase: rand() * Math.PI * 2,
    });
  }
  return (theta) => oct.reduce((a, o) => a + o.amp * Math.sin(o.freq * theta + o.phase), 0);
}

// Catmull-Rom through the sampled points, converted to cubic beziers so the
// ring is smooth and closes on itself without a seam.
function closedSpline(pts) {
  const n = pts.length;
  const at = (i) => pts[(i % n + n) % n];
  let d = `M${at(0)[0].toFixed(1)},${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// One field = nested rings around an off-centre peak, squashed horizontally so
// it reads as a wide ridge rather than a bullseye.
function field(seed, { cx, cy, rings, rMin, rMax, squash }) {
  const rand = rng(seed);
  const noise = makeNoise(rand);
  const SAMPLES = 26;
  const out = [];
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1);
    const radius = rMin + (rMax - rMin) * t;
    // Inner rings wobble less: peaks are smoother than foothills.
    const rough = 0.35 + 0.65 * t;
    const pts = [];
    for (let i = 0; i < SAMPLES; i++) {
      const theta = (i / SAMPLES) * Math.PI * 2;
      const rr = radius * (1 + noise(theta) * rough);
      pts.push([cx + Math.cos(theta) * rr * squash, cy + Math.sin(theta) * rr]);
    }
    out.push(closedSpline(pts));
  }
  return out;
}

const specs = [
  { id: 'c-ridge', seed: 20260812, cx: 470, cy: 470, rings: 11, rMin: 46, rMax: 430, squash: 1.42 },
  { id: 'c-basin', seed: 77341, cx: 700, cy: 400, rings: 10, rMin: 38, rMax: 385, squash: 1.28 },
  { id: 'c-pass', seed: 5150923, cx: 560, cy: 520, rings: 12, rMin: 30, rMax: 460, squash: 1.55 },
];

const symbols = specs.map(s => {
  const paths = field(s.seed, s);
  // Innermost two rings carry a heavier stroke, the way a summit is emphasised
  // on a real topo sheet.
  const body = paths.map((d, i) =>
    `<path d="${d}" stroke-width="${i < 2 ? 2.6 : 1.4}"${i < 2 ? ' opacity=".95"' : ''}/>`
  ).join('');
  return `<symbol id="${s.id}" viewBox="0 0 ${W} ${H}"><g fill="none" stroke="currentColor" stroke-linejoin="round">${body}</g></symbol>`;
}).join('\n');

writeFileSync(process.argv[2] || 'contours.svg', symbols);
console.log(`bytes: ${symbols.length}`);
