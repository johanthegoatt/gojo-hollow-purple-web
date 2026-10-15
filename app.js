import { fingerSpread, handGap, isOpenPalm, releaseEdge } from "./gestures.js";

const videoEl = document.getElementById("video");
const canvasEl = document.getElementById("canvas");
const statusText = document.getElementById("statusText");
const envHint = document.getElementById("envHint");
const phaseCalloutEl = document.getElementById("phaseCallout");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const intensityRange = document.getElementById("intensityRange");
const mergeRange = document.getElementById("mergeRange");
const landmarkToggle = document.getElementById("landmarkToggle");
const blueExpandRange = document.getElementById("blueExpandRange");
const redExpandRange = document.getElementById("redExpandRange");
const purpleExpandRange = document.getElementById("purpleExpandRange");

const ctx = canvasEl.getContext("2d");
const HANDS_VERSION = "0.4.1675469240";

const SYMBOLS = [
  "f(x)",
  "g(x)",
  "d/dx",
  "d2/dx2",
  "sum(n=1..N)",
  "lim(x->0)",
  "x^2",
  "x^3",
  "pi",
  "int_a^b",
  "sin(x)",
  "cos(x)",
  "tan(x)",
  "ln(x)",
  "exp(x)",
  "grad(f)",
  "div(F)",
  "curl(F)",
  "v(t)",
  "a(t)",
  "|x|",
  "det(A)",
  "A^-1",
  "lambda",
  "theta",
  "omega",
  "phi",
  "sigma",
  "delta",
  "n->inf",
];

const BLUE_SYMBOLS = [
  "f(x)",
  "d/dx",
  "sum(n=1..N)",
  "lim(x->0)",
  "x^2+y^2=r^2",
  "grad(f)",
  "div(F)",
  "v(t)",
  "a(t)",
  "sin(x)",
  "cos(x)",
  "int_0^t",
  "delta t",
  "A*x=b",
  "M^-1",
  "n->inf",
  "E=mc^2",
];

const RED_SYMBOLS = [
  "R(t)",
  "dR/dt",
  "F=ma",
  "div(F)",
  "rot(v)",
  "det(J)",
  "|grad f|",
  "dx/dt",
  "dy/dt",
  "sigma_r",
  "delta E",
  "omega t",
  "int_C",
  "nabla x F",
];

const PURPLE_SYMBOLS = [
  "Blue+Red",
  "Psi(x,t)",
  "sum(alpha_i)",
  "lim(n->inf)",
  "int_Omega",
  "e^(iwt)",
  "lambda_max",
  "phi(x)",
  "H(x,p)",
  "d2Psi/dx2",
  "A*B-B*A",
  "sigma^2",
  "delta x*delta p",
  "M(x,t)",
];

const BLUE_EQUATIONS = [
  "y = a(x-h)^2 + k",
  "V(h,k)",
  "dy/dx = 2a(x-h)",
  "x^2 + y^2 = r^2",
  "x = h +/- sqrt((y-k)/a)",
  "f(x+h)",
  "a > 0",
  "a < 0",
  "axis: x = h",
];

const RED_EQUATIONS = [
  "y = -a(x-h)^2 + k",
  "E = int F·dx",
  "dE/dt",
  "grad(Phi)",
  "R(h,k)",
  "dy/dx = -2a(x-h)",
  "mirror(x-h)",
  "potential well",
];

const PURPLE_EQUATIONS = [
  "a^2 + b^2 = c^2",
  "c = sqrt(a^2+b^2)",
  "proj_u(v) = (v·u/|u|^2)u",
  "M(x,t) = B(x,t) + R(x,t)",
  "Psi = B oplus R",
  "d2Psi/dx2",
  "sum(alpha_i)",
  "lim(n->inf)",
  "Omega fusion",
];

const PHASE = {
  IDLE: "idle",
  BLUE: "blue",
  DUAL: "dual",
  MERGE: "merge",
  PURPLE_HOLD: "purple_hold",
  PURPLE_RELEASE: "purple_release",
  TAIL: "tail",
};

const TECHNIQUE_CALLOUTS = {
  blue: {
    jp: "術式順転「蒼」",
    en: "Blue",
    audioCandidates: [
      "./assets/audio/gojo-lapse-blue.mp3",
      "./assets/audio/gojo-blue.mp3",
      "./assets/audio/blue.mp3",
      "./assets/audio/blue-ja.mp3",
    ],
  },
  red: {
    jp: "術式反転「赫」",
    en: "Red",
    audioCandidates: [
      "./assets/audio/gojo-reversal-red.mp3",
      "./assets/audio/gojo-red.mp3",
      "./assets/audio/red.mp3",
      "./assets/audio/red-ja.mp3",
    ],
  },
  purple: {
    jp: "虚式「茈」",
    en: "Hollow Purple",
    audioCandidates: [
      "./assets/audio/hollow-purple.mp3",
      "./assets/audio/gojo-hollow-purple.mp3",
      "./assets/audio/purple.mp3",
      "./assets/audio/purple-ja.mp3",
    ],
  },
};

const state = {
  phase: PHASE.IDLE,
  phaseStartMs: performance.now(),
  dualHoldMs: 0,
  mergeHoldMs: 0,
  dualLostMs: 0,
  release: { sawClosed: false },
  anchors: {
    blue: { x: 0.68, y: 0.28 },
    red: { x: 0.32, y: 0.32 },
    purple: { x: 0.5, y: 0.3 },
  },
  started: false,
  handsObs: { count: 0, hands: [], left: null, right: null, openAny: false, points: [] },
  nowMs: performance.now(),
  prevMs: performance.now(),
  viewport: { w: 1, h: 1, dpr: 1 },
  settings: {
    intensity: 1,
    // Gap between index fingertips that starts a merge, in palm lengths.
    mergeGap: 1.52,
    showLandmarks: false,
    expandBlue: 1,
    expandRed: 1,
    expandPurple: 1.1,
  },
  mathDrive: {
    blue: 0,
    red: 0,
    purple: 0,
  },
  drawBudget: {
    used: 0,
    max: 1,
    knee: 0.72,
  },
  performance: {
    emaDt: 16.7,
    lod: 1,
  },
  runtimeExpand: {
    blue: 1,
    red: 1,
    purple: 1.1,
  },
  techniqueAudio: {
    blue: null,
    red: null,
    purple: null,
  },
  techniqueAudioMissing: [],
  techniqueAudioReady: false,
  lastTechniqueAt: {
    blue: 0,
    red: 0,
    purple: 0,
  },
};

let handsModel = null;
let camera = null;
let phaseCalloutTimer = null;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function ease01(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function fract(v) {
  return v - Math.floor(v);
}

function hash(v) {
  return fract(Math.sin(v * 91.345) * 47453.5453);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(p0, p1, t) {
  return { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
}

function phaseAgeSec() {
  return (state.nowMs - state.phaseStartMs) / 1000;
}

function setPhase(next) {
  if (next !== state.phase) {
    state.phase = next;
    state.phaseStartMs = state.nowMs;
    state.dualHoldMs = 0;
    state.mergeHoldMs = 0;
    state.dualLostMs = 0;
    state.release.sawClosed = false;

    if (next === PHASE.BLUE) announceTechnique("blue");
    if (next === PHASE.DUAL) announceTechnique("red");
    if (next === PHASE.PURPLE_HOLD) announceTechnique("purple");
  }
}

async function mediaExists(url) {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    if (head.status !== 405) return false;
  } catch {}

  try {
    const get = await fetch(url, { method: "GET", cache: "no-store" });
    if (!get.ok) return false;
    if (get.body && typeof get.body.cancel === "function") {
      get.body.cancel();
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveTechniqueAudioPath(cfg) {
  const candidates = Array.isArray(cfg.audioCandidates) ? cfg.audioCandidates : [];
  for (const url of candidates) {
    if (await mediaExists(url)) return url;
  }
  return null;
}

async function ensureTechniqueAudio(forceRefresh = false) {
  if (state.techniqueAudioReady && !forceRefresh) {
    return state.techniqueAudioMissing.slice();
  }

  state.techniqueAudioMissing = [];
  for (const key of Object.keys(TECHNIQUE_CALLOUTS)) {
    const cfg = TECHNIQUE_CALLOUTS[key];
    const resolvedPath = await resolveTechniqueAudioPath(cfg);
    if (!resolvedPath) {
      state.techniqueAudio[key] = null;
      state.techniqueAudioMissing.push(key);
      continue;
    }
    const audio = new Audio(resolvedPath);
    audio.preload = "auto";
    audio.volume = 0.95;
    state.techniqueAudio[key] = audio;
    cfg.resolvedAudio = resolvedPath;
  }
  state.techniqueAudioReady = true;
  return state.techniqueAudioMissing.slice();
}

async function primeTechniqueAudio() {
  const missing = await ensureTechniqueAudio();
  if (missing.length > 0) {
    console.warn(
      `Technique audio missing: ${missing.join(
        ", "
      )}. Add files in ./assets/audio for full Japanese voice playback.`
    );
  }
  const list = Object.values(state.techniqueAudio).filter(Boolean);
  for (const audio of list) {
    try {
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    } catch {
      audio.muted = false;
    }
  }
}

function announceTechnique(key) {
  const cfg = TECHNIQUE_CALLOUTS[key];
  if (!cfg) return;

  const now = performance.now();
  if (now - (state.lastTechniqueAt[key] || 0) < 900) return;
  state.lastTechniqueAt[key] = now;

  if (phaseCalloutEl) {
    phaseCalloutEl.textContent = `${cfg.jp}   ${cfg.en}`;
    phaseCalloutEl.classList.remove("blue", "red", "purple", "show");
    // Force reflow so repeat triggers animate.
    void phaseCalloutEl.offsetWidth;
    phaseCalloutEl.classList.add(key, "show");
    if (phaseCalloutTimer) clearTimeout(phaseCalloutTimer);
    phaseCalloutTimer = setTimeout(() => {
      phaseCalloutEl.classList.remove("show");
    }, 1450);
  }

  const audio = state.techniqueAudio[key];
  if (audio) {
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }
}

function updatePhase(dtMs, obs) {
  const age = phaseAgeSec();

  if (state.phase === PHASE.IDLE) {
    if (obs.count >= 1) setPhase(PHASE.BLUE);
    return;
  }

  if (state.phase === PHASE.BLUE) {
    state.dualHoldMs += obs.count >= 2 ? dtMs : -dtMs * 0.65;
    state.dualHoldMs = clamp(state.dualHoldMs, 0, 1200);
    if (state.dualHoldMs > 180) setPhase(PHASE.DUAL);
    return;
  }

  if (state.phase === PHASE.DUAL) {
    if (obs.count === 0) {
      setPhase(PHASE.BLUE);
      return;
    }
    state.dualLostMs += obs.count < 2 ? dtMs : -dtMs;
    state.dualLostMs = clamp(state.dualLostMs, 0, 1400);
    if (state.dualLostMs > 260) {
      setPhase(PHASE.BLUE);
      return;
    }
    let closeEnough = false;
    if (obs.left && obs.right && obs.left !== obs.right) {
      closeEnough = handGap(obs.left.points, obs.right.points) < state.settings.mergeGap;
    }
    state.mergeHoldMs += closeEnough ? dtMs : -dtMs * 0.9;
    state.mergeHoldMs = clamp(state.mergeHoldMs, 0, 1000);
    if (state.mergeHoldMs > 120) setPhase(PHASE.MERGE);
    return;
  }

  if (state.phase === PHASE.MERGE) {
    if (age > 0.32) setPhase(PHASE.PURPLE_HOLD);
    return;
  }

  if (state.phase === PHASE.PURPLE_HOLD) {
    // Close your hands, then open them. Releases on its own after 4 s.
    const opened = releaseEdge(state.release, obs.openAny);
    if ((age > 0.55 && opened) || age > 4) setPhase(PHASE.PURPLE_RELEASE);
    return;
  }

  if (state.phase === PHASE.PURPLE_RELEASE) {
    if (age > 1.85) setPhase(PHASE.TAIL);
    return;
  }

  if (state.phase === PHASE.TAIL) {
    if (age > 1.2 && obs.count === 0) setPhase(PHASE.IDLE);
  }
}

function detectObservation(results) {
  const hands = [];
  const list = results.multiHandLandmarks || [];
  for (const lms of list) {
    const pts = lms.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    hands.push({
      points: pts,
      index: pts[8],
      openPalm: isOpenPalm(pts),
      spread: fingerSpread(pts),
    });
  }

  hands.sort((a, b) => a.index.x - b.index.x);
  const left = hands[0] || null;
  const right = hands[hands.length - 1] || null;

  return {
    count: hands.length,
    hands,
    left,
    right,
    points: hands.flatMap((h) => h.points),
    openAny: hands.some((h) => h.openPalm),
  };
}

function remap(v, inMin, inMax, outMin, outMax) {
  const t = clamp((v - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * t;
}

function lodCount(base, minimum = 1) {
  return Math.max(minimum, Math.round(base * state.performance.lod));
}

function lodSteps(base, minimum = 16) {
  return Math.max(minimum, Math.round(base * state.performance.lod));
}

function resetDrawBudget(intensity) {
  state.drawBudget.used = 0;
  state.drawBudget.max = 11 + intensity * 5.8;
}

function requestDrawAlpha(baseAlpha, weight = 1) {
  const budget = state.drawBudget;
  const projected = budget.used + weight;
  const ratio = projected / Math.max(0.001, budget.max);
  let scale = 1;
  if (ratio > budget.knee) {
    const over = (ratio - budget.knee) / Math.max(0.001, 1 - budget.knee);
    scale = 1 / (1 + 3.1 * over * over);
  }
  budget.used = projected;
  return clamp(baseAlpha * scale, 0, 1);
}

function updateAdaptiveLod(dtMs) {
  state.performance.emaDt = lerp(state.performance.emaDt, dtMs, 0.08);
  const avg = state.performance.emaDt;

  let target = 1;
  if (avg > 23.5) target = 0.56;
  else if (avg > 21.5) target = 0.68;
  else if (avg > 19.2) target = 0.8;
  else if (avg > 17.6) target = 0.9;

  const blend = target < state.performance.lod ? 0.24 : 0.06;
  state.performance.lod = lerp(state.performance.lod, target, blend);
}

function updateMathDrive(obs) {
  const blueTarget = obs.right ? remap(obs.right.spread, 1.3, 2.2, 0, 1) : 0;
  const redTarget = obs.left ? remap(obs.left.spread, 1.3, 2.2, 0, 1) : 0;

  let purpleTarget = 0;
  if (obs.left && obs.right && obs.left !== obs.right) {
    const distDrive = remap(handGap(obs.left.points, obs.right.points), 0.8, 3.4, 0, 1);
    const spreadMean = (obs.left.spread + obs.right.spread) * 0.5;
    const spreadDrive = remap(spreadMean, 1.3, 2.2, 0, 1);
    purpleTarget = clamp(distDrive * 0.6 + spreadDrive * 0.4, 0, 1);
  }

  // Faster rise, slower decay so complexity feels responsive but stable.
  const blueLerp = blueTarget > state.mathDrive.blue ? 0.24 : 0.09;
  const redLerp = redTarget > state.mathDrive.red ? 0.22 : 0.09;
  const purpleLerp = purpleTarget > state.mathDrive.purple ? 0.2 : 0.08;
  state.mathDrive.blue = lerp(state.mathDrive.blue, blueTarget, blueLerp);
  state.mathDrive.red = lerp(state.mathDrive.red, redTarget, redLerp);
  state.mathDrive.purple = lerp(state.mathDrive.purple, purpleTarget, purpleLerp);
}

function updateGestureExpansion(obs) {
  let targetBlue = state.settings.expandBlue;
  let targetRed = state.settings.expandRed;
  let targetPurple = state.settings.expandPurple;

  if ((state.phase === PHASE.BLUE || state.phase === PHASE.DUAL) && obs.right) {
    const gBlue = remap(obs.right.spread, 1.3, 2.1, 0.75, 2.5);
    targetBlue = Math.max(targetBlue, gBlue);
  }

  if (state.phase === PHASE.DUAL && obs.left) {
    const gRed = remap(obs.left.spread, 1.3, 2.1, 0.75, 2.5);
    targetRed = Math.max(targetRed, gRed);
  }

  if (
    (state.phase === PHASE.MERGE ||
      state.phase === PHASE.PURPLE_HOLD ||
      state.phase === PHASE.PURPLE_RELEASE ||
      state.phase === PHASE.TAIL) &&
    obs.left &&
    obs.right
  ) {
    const gap = obs.left === obs.right ? 0 : handGap(obs.left.points, obs.right.points);
    const gPurpleDist = remap(gap, 0.9, 3.2, 0.9, 2.8);
    const gPurpleSpread = remap((obs.left.spread + obs.right.spread) * 0.5, 1.3, 2.2, 0.85, 2.4);
    targetPurple = Math.max(targetPurple, gPurpleDist, gPurpleSpread);
  }

  state.runtimeExpand.blue = lerp(state.runtimeExpand.blue, clamp(targetBlue, 0.7, 2.6), 0.18);
  state.runtimeExpand.red = lerp(state.runtimeExpand.red, clamp(targetRed, 0.7, 2.6), 0.18);
  state.runtimeExpand.purple = lerp(state.runtimeExpand.purple, clamp(targetPurple, 0.7, 3.0), 0.16);
}

function updateAnchors(obs) {
  const t = state.nowMs * 0.001;
  const fallbackBlue = { x: 0.68 + 0.02 * Math.sin(t), y: 0.25 + 0.02 * Math.cos(t * 1.2) };
  const fallbackRed = { x: 0.32 + 0.015 * Math.sin(t * 0.7), y: 0.32 + 0.02 * Math.cos(t * 0.9) };
  const fallbackPurple = { x: 0.5, y: 0.3 + 0.018 * Math.cos(t * 0.8) };

  const bRaw = obs.right ? obs.right.index : fallbackBlue;
  const rRaw = obs.left ? obs.left.index : fallbackRed;

  let pRaw = fallbackPurple;
  if (obs.left && obs.right) {
    pRaw = {
      x: (obs.left.index.x + obs.right.index.x) * 0.5,
      y: (obs.left.index.y + obs.right.index.y) * 0.5 - 0.06,
    };
  } else if (obs.right) {
    pRaw = { x: obs.right.index.x - 0.09, y: obs.right.index.y + 0.02 };
  } else if (obs.left) {
    pRaw = { x: obs.left.index.x + 0.09, y: obs.left.index.y + 0.02 };
  }

  state.anchors.blue = lerpPoint(state.anchors.blue, bRaw, 0.23);
  state.anchors.red = lerpPoint(state.anchors.red, rRaw, 0.23);
  state.anchors.purple = lerpPoint(state.anchors.purple, pRaw, 0.23);
}

function p2x(p) {
  return Math.round((1 - p.x) * state.viewport.w);
}

function p2y(p) {
  return Math.round(p.y * state.viewport.h);
}

function drawGlow(x, y, radius, color, alpha = 1) {
  const grad = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.8 * alpha})`);
  grad.addColorStop(0.4, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.3 * alpha})`);
  grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrb(x, y, radius, coreColor, shellColor, timeSec, orbitCount = 3, alpha = 1) {
  drawGlow(x, y, radius * 2.2, shellColor, alpha);

  const grad = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.25,
    radius * 0.12,
    x,
    y,
    radius
  );
  grad.addColorStop(0, `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${alpha})`);
  grad.addColorStop(1, `rgba(${shellColor[0]}, ${shellColor[1]}, ${shellColor[2]}, ${0.92 * alpha})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 240, 255, ${0.72 * alpha})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < orbitCount; i += 1) {
    const rot = timeSec * 1.8 + i * 1.17;
    const rx = radius * (1.14 + 0.24 * Math.sin(timeSec + i));
    const ry = radius * (0.5 + 0.15 * Math.cos(timeSec * 1.2 + i));
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSymbols(
  center,
  density,
  spread,
  color,
  driftX,
  timeSec,
  scale = 1,
  tokenSet = SYMBOLS,
  alpha = 0.92
) {
  const cx = p2x(center);
  const cy = p2y(center);
  ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  ctx.font = `${Math.max(10, Math.round(11 * scale))}px "Space Mono", monospace`;
  for (let i = 0; i < density; i += 1) {
    const seed = i * 37.91 + Math.floor(timeSec * 30) * 13.7;
    const a = hash(seed + 1.1) * Math.PI * 2;
    const r = spread * Math.sqrt(hash(seed + 2.2));
    const x = cx + Math.cos(a) * r * (1.25 + 0.08 * Math.sin(timeSec + i)) + driftX;
    const y = cy + Math.sin(a) * r * 0.66 + 8 * Math.cos(timeSec * 2 + i * 0.1);
    const token = tokenSet[(i + Math.floor(timeSec * 10)) % tokenSet.length];
    ctx.fillText(token, x, y);
  }
}

function drawFullScreenSymbols(strength, timeSec, alpha = 0.8) {
  const count = Math.round(110 + 130 * strength);
  ctx.fillStyle = `rgba(242, 236, 255, ${alpha})`;
  ctx.font = '11px "Space Mono", monospace';
  for (let i = 0; i < count; i += 1) {
    const seed = i * 23.111 + Math.floor(timeSec * 60) * 31.7;
    const x = hash(seed + 0.1) * state.viewport.w;
    const y = hash(seed + 0.2) * state.viewport.h;
    const token = SYMBOLS[(i + Math.floor(timeSec * 16)) % SYMBOLS.length];
    ctx.fillText(token, x, y);
  }
}

function drawBlueMathStreams(center, intensity, timeSec) {
  const cx = p2x(center);
  const cy = p2y(center);
  const streamCount = Math.round(5 + intensity * 4);
  const streamLen = 230 + intensity * 130;

  for (let s = 0; s < streamCount; s += 1) {
    const seed = s * 41.3 + Math.floor(timeSec * 24);
    const angle = -0.05 + (s - (streamCount - 1) * 0.5) * 0.22;
    const wobble = 16 + hash(seed + 0.7) * 22;
    const k = 8 + Math.floor(hash(seed + 1.1) * 5);
    const token = BLUE_SYMBOLS[(s + Math.floor(timeSec * 7)) % BLUE_SYMBOLS.length];

    ctx.strokeStyle = "rgba(205, 230, 255, 0.35)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < k; i += 1) {
      const t = i / (k - 1);
      const x =
        cx -
        streamLen * t * Math.cos(angle) +
        Math.sin(timeSec * 2.1 + t * 8 + s) * wobble * (1 - t);
      const y =
        cy +
        (s - streamCount * 0.5) * 14 +
        streamLen * t * Math.sin(angle) * 0.18 +
        Math.cos(timeSec * 2.7 + t * 10 + s * 0.2) * 7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(230, 242, 255, 0.9)";
    ctx.font = '11px "Space Mono", monospace';
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const x =
        cx -
        streamLen * t * Math.cos(angle) +
        Math.sin(timeSec * 2.1 + t * 8 + s) * wobble * (1 - t);
      const y =
        cy +
        (s - streamCount * 0.5) * 14 +
        streamLen * t * Math.sin(angle) * 0.18 +
        Math.cos(timeSec * 2.7 + t * 10 + s * 0.2) * 7;
      ctx.fillText(token, x + 4, y - 2);
    }
  }
}

function drawBlueConstruction(center, intensity, timeSec) {
  const cx = p2x(center);
  const cy = p2y(center);
  const r = 62 + 30 * intensity;

  ctx.strokeStyle = "rgba(205, 240, 255, 0.35)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 6; i += 1) {
    const a = timeSec * 0.6 + (i / 6) * Math.PI * 2;
    const x0 = cx + Math.cos(a) * r * 0.62;
    const y0 = cy + Math.sin(a) * r * 0.62;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function drawMathRingLabels(
  center,
  radius,
  tokenSet,
  count,
  timeSec,
  color,
  scale = 1,
  spin = 1,
  alpha = 0.9
) {
  const cx = p2x(center);
  const cy = p2y(center);
  ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  ctx.font = `${Math.max(10, Math.round(10 * scale))}px "Space Mono", monospace`;
  for (let i = 0; i < count; i += 1) {
    const u = i / count;
    const a = timeSec * 0.35 * spin + u * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius * 0.72;
    const token = tokenSet[(i + Math.floor(timeSec * 5)) % tokenSet.length];
    ctx.fillText(token, x + 3, y - 2);
  }
}

function drawBlueLattice(center, intensity, timeSec) {
  const cx = p2x(center);
  const cy = p2y(center);
  const cols = 6;
  const rows = 4;
  const sx = 34 + intensity * 8;
  const sy = 24 + intensity * 6;
  const shear = Math.sin(timeSec * 0.7) * 0.26;

  ctx.strokeStyle = "rgba(190, 230, 255, 0.3)";
  ctx.lineWidth = 1;
  for (let r = -rows; r <= rows; r += 1) {
    ctx.beginPath();
    for (let c = -cols; c <= cols; c += 1) {
      const x = cx + c * sx + r * sx * 0.3 * shear;
      const y = cy + r * sy + Math.sin(timeSec + c * 0.4) * 1.8;
      if (c === -cols) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let c = -cols; c <= cols; c += 1) {
    ctx.beginPath();
    for (let r = -rows; r <= rows; r += 1) {
      const x = cx + c * sx + r * sx * 0.3 * shear;
      const y = cy + r * sy + Math.sin(timeSec + c * 0.4) * 1.8;
      if (r === -rows) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawMathRingLabels(center, 78 + intensity * 20, BLUE_SYMBOLS, 10, timeSec, [214, 240, 255], 1, 1);
}

function drawRedMathField(center, intensity, timeSec) {
  const cx = p2x(center);
  const cy = p2y(center);
  const r = 58 + intensity * 20;
  const spokes = 12;

  ctx.strokeStyle = "rgba(255, 175, 190, 0.34)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < spokes; i += 1) {
    const a = timeSec * 0.55 + (i / spokes) * Math.PI * 2;
    const x0 = cx + Math.cos(a) * r * 0.2;
    const y0 = cy + Math.sin(a) * r * 0.2;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  for (let i = 0; i < 3; i += 1) {
    const rr = r * (0.52 + i * 0.25);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr, rr * (0.6 + i * 0.08), timeSec * 0.45 + i * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawMathRingLabels(center, r * 1.05, RED_SYMBOLS, 9, timeSec, [255, 205, 216], 1, -1);
}

function drawLissajous(center, rx, ry, a, b, phase, color, alpha = 0.5, width = 1.1) {
  const cx = p2x(center);
  const cy = p2y(center);
  const steps = 170;
  ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const x = cx + rx * Math.sin(a * t + phase);
    const y = cy + ry * Math.sin(b * t);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function sampleParabola(a, h, k, xMin, xMax, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = lerp(xMin, xMax, t);
    const y = a * (x - h) * (x - h) + k;
    pts.push({ x, y });
  }
  return pts;
}

function drawParabolaBundle(center, config) {
  const cx = p2x(center);
  const cy = p2y(center);
  const count = Math.max(1, Math.round(config.count));
  const steps = Math.max(16, Math.round(config.steps));
  const alpha = clamp(config.alpha ?? 0.6, 0, 1);
  const color = config.color || [230, 240, 255];
  const xMin = -config.span;
  const xMax = config.span;
  const hJitter = config.hJitter ?? config.hSpan * 0.3;
  const kJitter = config.kJitter ?? 0.22;
  const mirrored = Boolean(config.mirrored);
  const invert = Boolean(config.invert);
  const width = config.lineWidth ?? 1.1;

  ctx.lineWidth = width;
  ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;

  for (let i = 0; i < count; i += 1) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const seed = (config.seed ?? 0) + i * 37.13 + Math.floor(config.timeSec * 18);
    const aNoise = (hash(seed + 0.9) - 0.5) * config.aJitter;
    const hNoise = (hash(seed + 1.7) - 0.5) * hJitter;
    const kNoise = (hash(seed + 2.6) - 0.5) * kJitter;
    let a = config.aBase + aNoise;
    if (invert) a *= -1;
    if (mirrored && i % 2 === 1) a *= -1;
    const h = lerp(-config.hSpan, config.hSpan, u) + hNoise;
    const k = kNoise;

    const pts = sampleParabola(a, h, k, xMin, xMax, steps);
    ctx.beginPath();
    for (let p = 0; p < pts.length; p += 1) {
      const x = cx + pts[p].x * config.xScale;
      const y = cy + pts[p].y * config.yScale;
      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawPythagoreanTriangles(center, config) {
  const cx = p2x(center);
  const cy = p2y(center);
  const count = Math.max(1, Math.round(config.count));
  const alpha = clamp(config.alpha ?? 0.52, 0, 1);
  const color = config.color || [240, 230, 255];
  const radius = config.radius;
  const spin = config.spin ?? 0.6;
  const timeSec = config.timeSec ?? 0;
  const labels = config.labels !== false;

  for (let i = 0; i < count; i += 1) {
    const u = i / count;
    const seed = (config.seed ?? 0) + i * 21.7;
    const angle = timeSec * spin + u * Math.PI * 2;
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const tangentX = -radialY;
    const tangentY = radialX;

    const ox = cx + radialX * radius;
    const oy = cy + radialY * radius;
    const sideA = lerp(config.sideMin, config.sideMax, hash(seed + 0.5));
    const sideB = lerp(config.sideMin * 0.8, config.sideMax * 1.12, hash(seed + 1.3));
    const ax = ox + tangentX * sideA;
    const ay = oy + tangentY * sideA;
    const bx = ox + radialX * sideB;
    const by = oy + radialY * sideB;

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.72})`;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.stroke();

    // Hypotenuse highlight.
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    if (labels && i % Math.max(2, Math.round(count / 8)) === 0) {
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.95})`;
      ctx.font = '10px "Space Mono", monospace';
      ctx.fillText("a^2+b^2=c^2", bx + 4, by - 2);
    }
  }
}

function drawAxesAndVertexMarkers(center, config) {
  const cx = p2x(center);
  const cy = p2y(center);
  const axisLen = config.axisLen ?? 120;
  const tickCount = Math.max(2, Math.round(config.tickCount ?? 7));
  const alpha = clamp(config.alpha ?? 0.6, 0, 1);
  const color = config.color || [214, 238, 255];

  ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.82})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - axisLen, cy);
  ctx.lineTo(cx + axisLen, cy);
  ctx.moveTo(cx, cy - axisLen * 0.72);
  ctx.lineTo(cx, cy + axisLen * 0.72);
  ctx.stroke();

  const tickSize = 4;
  for (let i = -tickCount; i <= tickCount; i += 1) {
    const u = i / tickCount;
    const tx = cx + u * axisLen;
    const ty = cy + u * axisLen * 0.72;
    ctx.beginPath();
    ctx.moveTo(tx, cy - tickSize);
    ctx.lineTo(tx, cy + tickSize);
    ctx.moveTo(cx - tickSize, ty);
    ctx.lineTo(cx + tickSize, ty);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '11px "Space Mono", monospace';
  ctx.fillText("V(h,k)", cx + 8, cy - 8);
}

function drawBlueConstructParabolaDisk(center, config) {
  const cx = p2x(center);
  const cy = p2y(center);
  const radius = config.radius;
  const alpha = clamp(config.alpha ?? 0.8, 0, 1);
  const drive = config.drive ?? 0.7;
  const timeSec = config.timeSec ?? 0;

  drawGlow(cx, cy, radius * 1.2, [150, 222, 255], alpha * 0.35);

  ctx.lineWidth = 1.3;
  ctx.strokeStyle = `rgba(210, 242, 255, ${alpha * 0.9})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(194, 232, 255, ${alpha * 0.68})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.76, 0, Math.PI * 2);
  ctx.stroke();

  const spokes = Math.max(6, lodCount(7 + 5 * drive, 6));
  ctx.strokeStyle = `rgba(190, 228, 255, ${alpha * 0.45})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < spokes; i += 1) {
    const a = timeSec * 0.55 + (i / spokes) * Math.PI * 2;
    const x0 = cx + Math.cos(a) * radius * 0.76;
    const y0 = cy + Math.sin(a) * radius * 0.76;
    const x1 = cx + Math.cos(a) * radius;
    const y1 = cy + Math.sin(a) * radius;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  drawAxesAndVertexMarkers(center, {
    axisLen: radius * 1.02,
    tickCount: lodCount(4 + 4 * drive, 3),
    color: [214, 238, 255],
    alpha: alpha * 0.62,
  });

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
  ctx.clip();
  drawParabolaBundle(center, {
    count: lodCount(10 + 22 * drive, 8),
    steps: lodSteps(68, 26),
    span: 1.35,
    aBase: 0.25,
    aJitter: 0.22,
    hSpan: 0.95,
    hJitter: 0.28,
    kJitter: 0.17,
    xScale: radius * 0.95,
    yScale: radius * 0.48,
    color: [206, 238, 255],
    alpha: alpha * 0.9,
    lineWidth: 1.06,
    timeSec,
    seed: config.seed ?? 41,
    mirrored: true,
  });
  ctx.restore();
}

function drawCleanRedGlobe(center, config) {
  const cx = p2x(center);
  const cy = p2y(center);
  const radius = config.radius;
  const timeSec = config.timeSec ?? 0;
  const alpha = clamp(config.alpha ?? 0.9, 0, 1);

  drawGlow(cx, cy, radius * 1.9, [255, 96, 124], alpha * 0.55);

  const grad = ctx.createRadialGradient(
    cx - radius * 0.32,
    cy - radius * 0.28,
    radius * 0.14,
    cx,
    cy,
    radius
  );
  grad.addColorStop(0, `rgba(255, 238, 243, ${alpha})`);
  grad.addColorStop(0.42, `rgba(255, 132, 156, ${alpha * 0.96})`);
  grad.addColorStop(1, `rgba(198, 32, 58, ${alpha})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = `rgba(255, 222, 230, ${alpha * 0.84})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 210, 222, ${alpha * 0.42})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 0.84, radius * 0.46, timeSec * 0.75, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEquationBands(center, tokens, config) {
  const cx = p2x(center);
  const cy = p2y(center);
  const bandCount = Math.max(1, Math.round(config.bandCount));
  const tokensPerBand = Math.max(3, Math.round(config.tokensPerBand));
  const width = config.width ?? 160;
  const bandSpan = config.bandSpan ?? 90;
  const curveAmp = config.curveAmp ?? 16;
  const drift = config.drift ?? 8;
  const timeSec = config.timeSec ?? 0;
  const alpha = clamp(config.alpha ?? 0.85, 0, 1);
  const color = config.color || [240, 246, 255];
  const scale = config.scale ?? 1;

  ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  ctx.font = `${Math.max(10, Math.round(11 * scale))}px "Space Mono", monospace`;

  for (let b = 0; b < bandCount; b += 1) {
    const bandU = bandCount === 1 ? 0.5 : b / (bandCount - 1);
    const yBase = cy + lerp(-bandSpan, bandSpan, bandU);
    const seed = (config.seed ?? 0) + b * 12.7;
    const curveSign = hash(seed + 0.4) > 0.5 ? 1 : -1;
    const shift = (hash(seed + 1.3) - 0.5) * drift;

    for (let i = 0; i < tokensPerBand; i += 1) {
      const u = tokensPerBand === 1 ? 0.5 : i / (tokensPerBand - 1);
      const x = cx + lerp(-width, width, u) + shift + Math.sin(timeSec * 1.1 + b + i * 0.2) * drift;
      const parabolaY = curveSign * curveAmp * Math.pow(u * 2 - 1, 2);
      const y = yBase + parabolaY;
      const token = tokens[(b * tokensPerBand + i + Math.floor(timeSec * 5)) % tokens.length];
      ctx.fillText(token, x, y);
    }
  }
}

function drawPurpleMathField(center, intensity, timeSec, charge = 1) {
  const rx = (62 + intensity * 24) * (0.85 + charge * 0.2);
  const ry = (44 + intensity * 18) * (0.85 + charge * 0.2);
  drawLissajous(center, rx, ry, 3, 2, timeSec * 0.8, [242, 190, 255], 0.54, 1.2);
  drawLissajous(center, rx * 0.84, ry * 1.05, 5, 4, timeSec * 1.1 + 0.8, [226, 170, 255], 0.45, 1.1);
  drawLissajous(center, rx * 0.66, ry * 0.72, 7, 3, timeSec * 1.35 + 1.2, [250, 210, 255], 0.4, 1);

  drawMathRingLabels(
    center,
    92 + intensity * 28,
    PURPLE_SYMBOLS,
    12,
    timeSec,
    [245, 220, 255],
    1,
    1
  );
}

function drawLightning(center, strength, timeSec, alpha = 0.92) {
  const cx = p2x(center);
  const cy = p2y(center);
  const rays = Math.round(30 + strength * 40);
  ctx.strokeStyle = `rgba(255, 190, 255, ${alpha})`;
  for (let i = 0; i < rays; i += 1) {
    const seed = i * 9.31 + Math.floor(timeSec * 100);
    const angle = hash(seed + 0.2) * Math.PI * 2;
    const length = (90 + hash(seed + 0.7) * 270) * (0.6 + 0.5 * strength);
    const segments = 3 + Math.floor(hash(seed + 1.9) * 3);
    ctx.lineWidth = 1 + hash(seed + 3.2) * 1.8;
    ctx.beginPath();
    for (let s = 0; s < segments; s += 1) {
      const t = s / (segments - 1);
      const radial = length * t;
      const jitter = (1 - t) * 20 + 5;
      const px = cx + Math.cos(angle) * radial + (hash(seed + s * 11.3) - 0.5) * jitter;
      const py = cy + Math.sin(angle) * radial + (hash(seed + s * 14.7) - 0.5) * jitter;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function renderEffects() {
  const t = state.nowMs * 0.001;
  const age = phaseAgeSec();
  const b = state.anchors.blue;
  const r = state.anchors.red;
  const p = state.anchors.purple;
  const intensity = state.settings.intensity;
  const densityMult = intensity * (0.82 + 0.22 * state.performance.lod);
  const radiusMult = 0.78 + 0.34 * intensity;
  const spreadMult = 0.84 + 0.28 * intensity;
  const lightningMult = 0.72 + 0.55 * intensity;
  const blueDrive = state.mathDrive.blue;
  const redDrive = state.mathDrive.red;
  const purpleDrive = state.mathDrive.purple;
  const blueExpand = state.runtimeExpand.blue;
  const redExpand = state.runtimeExpand.red;
  const purpleExpand = state.runtimeExpand.purple;
  const blueComplex = clamp(0.28 + blueDrive * 0.92, 0.2, 1.25);
  const purpleComplex = clamp(0.35 + purpleDrive * 1.05, 0.25, 1.35);

  const blue = [160, 225, 255];
  const purple = [230, 145, 255];

  resetDrawBudget(intensity);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  if (state.phase === PHASE.BLUE) {
    drawBlueConstructParabolaDisk(b, {
      radius: 62 * blueExpand,
      drive: blueComplex,
      timeSec: t,
      seed: 41,
      alpha: requestDrawAlpha(0.95, 2),
    });
    drawPythagoreanTriangles(b, {
      count: lodCount(8 + 16 * blueComplex, 6),
      radius: (62 + 36 * blueComplex) * blueExpand,
      sideMin: 8,
      sideMax: 17 + 8 * blueComplex,
      color: [227, 240, 255],
      alpha: requestDrawAlpha(0.6, 1.2),
      spin: 0.72,
      timeSec: t,
      seed: 71,
      labels: true,
    });
    drawEquationBands(b, BLUE_EQUATIONS, {
      bandCount: lodCount(3 + 4 * blueComplex, 3),
      tokensPerBand: lodCount(6 + 9 * blueComplex, 5),
      width: (112 + 38 * blueComplex) * blueExpand,
      bandSpan: 70 * blueExpand,
      curveAmp: 17 + 9 * blueComplex,
      drift: 12,
      timeSec: t,
      color: [238, 247, 255],
      alpha: requestDrawAlpha(0.94, 1.35),
      scale: 1.04,
      seed: 91,
    });
  }

  if (state.phase === PHASE.DUAL) {
    drawBlueConstructParabolaDisk(b, {
      radius: 57 * blueExpand,
      drive: blueComplex * 0.9,
      timeSec: t,
      seed: 101,
      alpha: requestDrawAlpha(0.88, 1.55),
    });
    drawEquationBands(b, BLUE_EQUATIONS, {
      bandCount: lodCount(2 + 3 * blueComplex, 2),
      tokensPerBand: lodCount(5 + 7 * blueComplex, 4),
      width: (94 + 30 * blueComplex) * blueExpand,
      bandSpan: 56 * blueExpand,
      curveAmp: 14 + 7 * blueComplex,
      drift: 9,
      timeSec: t,
      color: [236, 245, 255],
      alpha: requestDrawAlpha(0.86, 0.95),
      scale: 0.98,
      seed: 141,
    });

    drawCleanRedGlobe(r, {
      radius: 36 * redExpand,
      timeSec: t * 1.2,
      alpha: requestDrawAlpha(0.96, 1.7),
    });
  }

  if (state.phase === PHASE.MERGE) {
    const m = ease01(age / 0.32);
    const mergeExpand = lerp(redExpand, purpleExpand, m);
    const center = lerpPoint(r, p, m);
    const mr = (34 + 10 * m) * radiusMult * mergeExpand;
    const mergeDrive = clamp((blueDrive + redDrive + purpleDrive) / 3, 0, 1);
    drawOrb(
      p2x(center),
      p2y(center),
      mr,
      [255, 232, 255],
      purple,
      t,
      4,
      requestDrawAlpha(0.95, 2.1)
    );
    drawParabolaBundle(center, {
      count: lodCount(12 + 18 * mergeDrive, 8),
      steps: lodSteps(68, 24),
      span: 1.42,
      aBase: 0.24,
      aJitter: 0.24,
      hSpan: 0.92,
      hJitter: 0.32,
      kJitter: 0.17,
      xScale: 78 * mergeExpand,
      yScale: 38 * mergeExpand,
      color: [245, 214, 255],
      alpha: requestDrawAlpha(0.72, 1.6),
      lineWidth: 1.12,
      timeSec: t,
      seed: 311,
      mirrored: true,
    });
    drawParabolaBundle(center, {
      count: lodCount(8 + 12 * mergeDrive, 6),
      steps: lodSteps(56, 20),
      span: 1.1,
      aBase: 0.26,
      aJitter: 0.18,
      hSpan: 0.7,
      hJitter: 0.22,
      kJitter: 0.13,
      xScale: 68 * mergeExpand,
      yScale: 33 * mergeExpand,
      color: [235, 176, 255],
      alpha: requestDrawAlpha(0.58, 1),
      lineWidth: 1,
      timeSec: t * 1.2,
      seed: 353,
      invert: true,
      mirrored: true,
    });
    drawPythagoreanTriangles(center, {
      count: lodCount(10 + 16 * mergeDrive, 7),
      radius: (68 + 34 * mergeDrive) * mergeExpand,
      sideMin: 9,
      sideMax: 18 + 8 * mergeDrive,
      color: [250, 222, 255],
      alpha: requestDrawAlpha(0.64, 1.2),
      spin: 0.8,
      timeSec: t,
      seed: 389,
      labels: true,
    });
    drawEquationBands(center, PURPLE_EQUATIONS, {
      bandCount: lodCount(3 + 4 * mergeDrive, 3),
      tokensPerBand: lodCount(6 + 8 * mergeDrive, 5),
      width: (110 + 30 * mergeDrive) * mergeExpand,
      bandSpan: 68 * mergeExpand,
      curveAmp: 16 + 9 * mergeDrive,
      drift: 12,
      timeSec: t,
      color: [250, 232, 255],
      alpha: requestDrawAlpha(0.92, 1.2),
      scale: 1.02,
      seed: 401,
    });

    if (age > 0.16 && age < 0.2) {
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(0, 0, state.viewport.w, state.viewport.h);
      ctx.globalCompositeOperation = "screen";
    }
  }

  if (state.phase === PHASE.PURPLE_HOLD) {
    drawOrb(
      p2x(p),
      p2y(p),
      38 * radiusMult * purpleExpand,
      [255, 240, 255],
      purple,
      t * 1.1,
      4,
      requestDrawAlpha(0.95, 2)
    );
    drawParabolaBundle(p, {
      count: lodCount(14 + 22 * purpleComplex, 10),
      steps: lodSteps(72, 24),
      span: 1.48,
      aBase: 0.24,
      aJitter: 0.26,
      hSpan: 1.02,
      hJitter: 0.34,
      kJitter: 0.19,
      xScale: 82 * purpleExpand,
      yScale: 39 * purpleExpand,
      color: [243, 196, 255],
      alpha: requestDrawAlpha(0.75, 1.7),
      lineWidth: 1.14,
      timeSec: t,
      seed: 441,
      mirrored: true,
    });
    drawPythagoreanTriangles(p, {
      count: lodCount(12 + 20 * purpleComplex, 8),
      radius: (74 + 42 * purpleComplex) * purpleExpand,
      sideMin: 10,
      sideMax: 21 + 9 * purpleComplex,
      color: [248, 221, 255],
      alpha: requestDrawAlpha(0.68, 1.35),
      spin: 0.86,
      timeSec: t,
      seed: 479,
      labels: true,
    });
    drawEquationBands(p, PURPLE_EQUATIONS, {
      bandCount: lodCount(4 + 5 * purpleComplex, 3),
      tokensPerBand: lodCount(7 + 10 * purpleComplex, 5),
      width: (124 + 45 * purpleComplex) * purpleExpand,
      bandSpan: 78 * purpleExpand,
      curveAmp: 19 + 10 * purpleComplex,
      drift: 13,
      timeSec: t,
      color: [252, 236, 255],
      alpha: requestDrawAlpha(0.92, 1.3),
      scale: 1.06,
      seed: 511,
    });
  }

  if (state.phase === PHASE.PURPLE_RELEASE) {
    const burst = ease01(age / 0.5);
    const releaseExpand = purpleExpand * (1 + burst * 0.32);
    drawOrb(
      p2x(p),
      p2y(p),
      40 * radiusMult * releaseExpand,
      [255, 244, 255],
      [250, 170, 255],
      t * 1.4,
      4,
      requestDrawAlpha(0.98, 2.35)
    );
    drawParabolaBundle(p, {
      count: lodCount(16 + 24 * purpleComplex, 11),
      steps: lodSteps(78, 28),
      span: 1.6,
      aBase: 0.24,
      aJitter: 0.28,
      hSpan: 1.1,
      hJitter: 0.36,
      kJitter: 0.2,
      xScale: 88 * releaseExpand,
      yScale: 42 * releaseExpand,
      color: [250, 204, 255],
      alpha: requestDrawAlpha(0.78, 1.85),
      lineWidth: 1.15,
      timeSec: t * (1 + burst * 0.3),
      seed: 547,
      mirrored: true,
    });
    drawPythagoreanTriangles(p, {
      count: lodCount(14 + 22 * purpleComplex, 9),
      radius: (86 + 50 * purpleComplex) * releaseExpand,
      sideMin: 10,
      sideMax: 24 + 10 * purpleComplex,
      color: [250, 226, 255],
      alpha: requestDrawAlpha(0.7, 1.45),
      spin: 0.9,
      timeSec: t,
      seed: 571,
      labels: true,
    });
    drawEquationBands(p, PURPLE_EQUATIONS, {
      bandCount: lodCount(5 + 6 * purpleComplex, 4),
      tokensPerBand: lodCount(8 + 12 * purpleComplex, 6),
      width: (134 + 52 * purpleComplex) * releaseExpand,
      bandSpan: 88 * releaseExpand,
      curveAmp: 22 + 11 * purpleComplex,
      drift: 15,
      timeSec: t,
      color: [253, 240, 255],
      alpha: requestDrawAlpha(0.94, 1.45),
      scale: 1.08,
      seed: 613,
    });
    drawFullScreenSymbols(clamp(burst * (0.8 + intensity * 0.4), 0, 1.3), t, requestDrawAlpha(0.84, 1.15));
    drawLightning(
      p,
      burst * lightningMult * releaseExpand,
      t,
      requestDrawAlpha(0.9, 1.5)
    );
  }

  if (state.phase === PHASE.TAIL) {
    const d = 1 - ease01(age / 1.2);
    if (d > 0) {
      drawOrb(
        p2x(p),
        p2y(p),
        32 * d * radiusMult * purpleExpand,
        [240, 228, 255],
        [225, 156, 245],
        t,
        2,
        requestDrawAlpha(0.8 * d, 1.1)
      );
      drawEquationBands(p, PURPLE_EQUATIONS, {
        bandCount: lodCount(2 + 2 * purpleComplex, 2),
        tokensPerBand: lodCount(4 + 4 * purpleComplex, 3),
        width: 88 * purpleExpand,
        bandSpan: 52 * purpleExpand,
        curveAmp: 12 + 6 * purpleComplex,
        drift: 7,
        timeSec: t,
        color: [235, 220, 246],
        alpha: requestDrawAlpha(0.72 * d, 0.6),
        scale: 0.92,
        seed: 647,
      });
      drawSymbols(
        p,
        Math.max(10, Math.round(44 * d * densityMult * (0.85 + 0.15 * purpleExpand))),
        100 * spreadMult * purpleExpand,
        [225, 210, 244],
        18,
        t,
        0.9,
        SYMBOLS,
        requestDrawAlpha(0.65 * d, 0.5)
      );
    }
  }

  ctx.restore();
}

function drawLandmarks(obs) {
  if (!state.settings.showLandmarks || !obs.hands || obs.hands.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(150, 255, 210, 0.7)";
  for (const hand of obs.hands) {
    for (const p of hand.points) {
      ctx.beginPath();
      ctx.arc(p2x(p), p2y(p), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(p2x(hand.index), p2y(hand.index), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150, 255, 210, 0.7)";
  }
  ctx.restore();
}

function drawBackgroundVideo() {
  if (videoEl.readyState < 2) {
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, state.viewport.w, state.viewport.h);
    return;
  }
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, -state.viewport.w, 0, state.viewport.w, state.viewport.h);
  ctx.restore();
}

function drawDebug(obs) {
  ctx.fillStyle = "rgba(20, 24, 36, 0.5)";
  ctx.fillRect(12, 12, 390, 92);
  ctx.fillStyle = "#d4ffea";
  ctx.font = '14px "Space Mono", monospace';
  ctx.fillText(`phase: ${state.phase}`, 20, 33);
  ctx.fillText(`hands: ${obs.count}`, 20, 52);
  ctx.fillText(
    `exp b:${state.runtimeExpand.blue.toFixed(2)} r:${state.runtimeExpand.red.toFixed(2)} p:${state.runtimeExpand.purple.toFixed(2)}`,
    20,
    70
  );
  ctx.fillText(
    `math b:${state.mathDrive.blue.toFixed(2)} r:${state.mathDrive.red.toFixed(2)} p:${state.mathDrive.purple.toFixed(2)}`,
    20,
    88
  );
  ctx.fillText(
    `lod:${state.performance.lod.toFixed(2)} budget:${state.drawBudget.used.toFixed(1)}/${state.drawBudget.max.toFixed(1)}`,
    206,
    88
  );
}

function renderLoop() {
  state.nowMs = performance.now();
  const dt = clamp(state.nowMs - state.prevMs, 8, 48);
  state.prevMs = state.nowMs;
  updateAdaptiveLod(dt);

  const obs = state.handsObs;
  updateAnchors(obs);
  updatePhase(dt, obs);
  updateMathDrive(obs);
  updateGestureExpansion(obs);

  drawBackgroundVideo();
  renderEffects();
  drawLandmarks(obs);
  drawDebug(obs);

  // Until the camera runs, leave start-up and error messages on screen;
  // the loop used to overwrite them on the next frame.
  if (state.started) {
    const missing = state.techniqueAudioMissing.length ? ` (missing audio: ${state.techniqueAudioMissing.join(", ")})` : "";
    statusText.textContent = `Status: ${state.phase}${missing}`;
  }
  requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
  const rect = canvasEl.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  state.viewport.w = Math.max(1, Math.round(rect.width));
  state.viewport.h = Math.max(1, Math.round(rect.height));
  state.viewport.dpr = dpr;
  canvasEl.width = Math.round(rect.width * dpr);
  canvasEl.height = Math.round(rect.height * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function updateEnvironmentHint() {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const secure = window.isSecureContext || isLocal;
  if (!secure) {
    envHint.hidden = false;
    envHint.textContent =
      "Camera needs HTTPS or localhost. Open this page from a local server (not file://).";
  } else {
    envHint.hidden = true;
    envHint.textContent = "";
  }
}

async function startCamera() {
  if (state.started) return;
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!window.isSecureContext && !isLocal) {
    throw new Error("Camera requires HTTPS or localhost.");
  }

  await primeTechniqueAudio();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720, facingMode: "user" },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  handsModel = new Hands({
    // Same pinned version as the script tag: the model files must match hands.js.
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${HANDS_VERSION}/${file}`,
  });
  handsModel.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.45,
  });
  handsModel.onResults((results) => {
    state.handsObs = detectObservation(results);
  });

  camera = new Camera(videoEl, {
    onFrame: async () => {
      if (!handsModel) return;
      await handsModel.send({ image: videoEl });
    },
    width: 1280,
    height: 720,
  });
  await camera.start();

  state.started = true;
  if (state.techniqueAudioMissing.length > 0) {
    const missingText = state.techniqueAudioMissing.join(", ");
    statusText.textContent = `Status: blue (tracking active, missing audio: ${missingText})`;
  } else {
    statusText.textContent = "Status: blue (tracking active)";
  }
}

function resetState() {
  state.phase = PHASE.IDLE;
  state.phaseStartMs = performance.now();
  state.dualHoldMs = 0;
  state.mergeHoldMs = 0;
  state.dualLostMs = 0;
  state.release.sawClosed = false;
  state.anchors = {
    blue: { x: 0.68, y: 0.28 },
    red: { x: 0.32, y: 0.32 },
    purple: { x: 0.5, y: 0.3 },
  };
  state.runtimeExpand = {
    blue: state.settings.expandBlue,
    red: state.settings.expandRed,
    purple: state.settings.expandPurple,
  };
  state.mathDrive = {
    blue: 0,
    red: 0,
    purple: 0,
  };
  state.drawBudget.used = 0;
  state.drawBudget.max = 1;
  state.performance.emaDt = 16.7;
  state.performance.lod = 1;
  state.techniqueAudioMissing = [];
  state.techniqueAudioReady = false;
  statusText.textContent = "Status: idle";
}

function bindUiControls() {
  intensityRange.value = "100";
  mergeRange.value = "19";
  landmarkToggle.checked = false;
  blueExpandRange.value = "100";
  redExpandRange.value = "100";
  purpleExpandRange.value = "110";

  intensityRange.addEventListener("input", () => {
    state.settings.intensity = clamp(Number(intensityRange.value) / 100, 0.6, 1.8);
  });

  mergeRange.addEventListener("input", () => {
    // Slider 12..30 maps to about 1 to 2.4 palm lengths.
    state.settings.mergeGap = clamp(Number(mergeRange.value) / 12.5, 0.9, 2.5);
  });

  landmarkToggle.addEventListener("change", () => {
    state.settings.showLandmarks = landmarkToggle.checked;
  });

  blueExpandRange.addEventListener("input", () => {
    state.settings.expandBlue = clamp(Number(blueExpandRange.value) / 100, 0.7, 2.3);
    state.runtimeExpand.blue = state.settings.expandBlue;
  });

  redExpandRange.addEventListener("input", () => {
    state.settings.expandRed = clamp(Number(redExpandRange.value) / 100, 0.7, 2.3);
    state.runtimeExpand.red = state.settings.expandRed;
  });

  purpleExpandRange.addEventListener("input", () => {
    state.settings.expandPurple = clamp(Number(purpleExpandRange.value) / 100, 0.7, 2.6);
    state.runtimeExpand.purple = state.settings.expandPurple;
  });

  state.runtimeExpand.blue = state.settings.expandBlue;
  state.runtimeExpand.red = state.settings.expandRed;
  state.runtimeExpand.purple = state.settings.expandPurple;
}

// getUserMedia errors, in words someone can act on.
// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#exceptions
function cameraErrorText(err) {
  switch (err && err.name) {
    case "NotAllowedError":
      return "Camera blocked. Allow the camera for this site (the icon in the address bar), then press Start Camera again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera found. Plug one in or turn it on, then press Start Camera again.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is busy. Close other apps or tabs using it (video calls, other camera pages), then try again.";
    case "SecurityError":
      return "Camera needs HTTPS or localhost.";
    default:
      if (typeof Hands === "undefined" || typeof Camera === "undefined") {
        return "Hand tracking didn't load. Check your connection and reload the page.";
      }
      return `Camera start failed: ${(err && err.message) || "unknown error"}`;
  }
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  statusText.textContent = "Status: starting camera...";
  try {
    await startCamera();
  } catch (err) {
    console.error(err);
    stopStream();
    statusText.textContent = `Status: ${cameraErrorText(err)}`;
  } finally {
    startBtn.disabled = state.started;
  }
});

function stopStream() {
  const stream = videoEl.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  videoEl.srcObject = null;
}

// Stop sending frames to the hand model while the tab is hidden, so a
// background tab doesn't keep the GPU and camera pipeline busy.
document.addEventListener("visibilitychange", () => {
  if (!camera || !state.started) return;
  if (document.hidden) {
    camera.stop();
  } else {
    camera.start();
    state.handsObs = { count: 0, hands: [], left: null, right: null, openAny: false, points: [] };
  }
});

resetBtn.addEventListener("click", resetState);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
bindUiControls();
updateEnvironmentHint();
requestAnimationFrame(renderLoop);
