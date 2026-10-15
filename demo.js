// A scripted run of the technique for people without a camera (or who would
// rather not turn it on): synthetic hands go through the real sequence and
// renderer, so the demo is the same effect, not a recording of it.
import { detectObservation } from "./sequence.js";

// 21 MediaPipe-style landmarks for a hand centred at (cx, cy), palm length
// 0.1 of the frame, fingers straight (open) or curled.
function syntheticHand(cx, cy, open) {
  const pts = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  pts[0] = { x: cx, y: cy + 0.1, z: 0 };
  pts[9] = { x: cx, y: cy, z: 0 };
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    pts[pip] = { x: cx, y: cy - 0.03, z: 0 };
    pts[tip] = { x: cx, y: open ? cy - 0.1 : cy + 0.05, z: 0 };
  }
  // Thumb and remaining joints sit between wrist and knuckle so the hand
  // draws as a hand when landmarks are shown.
  for (const i of [1, 2, 3, 4, 5, 13, 17]) pts[i] = { x: cx + (i % 5) * 0.01 - 0.02, y: cy + 0.04, z: 0 };
  return pts;
}

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Timeline in ms: blue alone, red joins, hands drift together, close, open.
export const DEMO_LENGTH_MS = 7600;

export function demoObservationAt(ms) {
  const sway = Math.sin(ms / 420) * 0.012;
  if (ms < 1400) {
    return detectObservation({ multiHandLandmarks: [syntheticHand(0.68, 0.42 + sway, true)] });
  }
  if (ms < 2800) {
    return detectObservation({
      multiHandLandmarks: [syntheticHand(0.32, 0.44 - sway, true), syntheticHand(0.68, 0.42 + sway, true)],
    });
  }
  if (ms < 4200) {
    const t = ease(Math.min(1, (ms - 2800) / 900));
    return detectObservation({
      multiHandLandmarks: [syntheticHand(lerp(0.32, 0.46, t), 0.43, true), syntheticHand(lerp(0.68, 0.54, t), 0.43, true)],
    });
  }
  if (ms < 5000) {
    return detectObservation({ multiHandLandmarks: [syntheticHand(0.46, 0.43, false), syntheticHand(0.54, 0.43, false)] });
  }
  if (ms < DEMO_LENGTH_MS - 600) {
    return detectObservation({ multiHandLandmarks: [syntheticHand(0.4, 0.4, true), syntheticHand(0.6, 0.4, true)] });
  }
  return detectObservation({ multiHandLandmarks: [] });
}
