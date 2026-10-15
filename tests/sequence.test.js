import test from "node:test";
import assert from "node:assert/strict";
import { PHASE, createSequence, detectObservation, stepSequence } from "../sequence.js";

// A 21-point hand at (cx, cy): palm length 0.1, fingers straight or curled.
function hand(cx, cy, open) {
  const pts = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  pts[0] = { x: cx, y: cy + 0.1, z: 0 };
  pts[9] = { x: cx, y: cy, z: 0 };
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    pts[pip] = { x: cx, y: cy - 0.03, z: 0 };
    pts[tip] = { x: cx, y: open ? cy - 0.1 : cy + 0.05, z: 0 };
  }
  return pts;
}

const see = (...hands) => detectObservation({ multiHandLandmarks: hands });
const MERGE_GAP = 1.52;

// Feeds the same observation for `ms` in 16 ms frames; returns phases entered.
function run(seq, clock, obs, ms) {
  const entered = [];
  for (let t = 0; t < ms; t += 16) {
    clock.now += 16;
    const phase = stepSequence(seq, 16, obs, clock.now, MERGE_GAP);
    if (phase) entered.push(phase);
  }
  return entered;
}

test("one hand starts blue, two hands held bring red", () => {
  const clock = { now: 0 };
  const seq = createSequence(0);
  assert.deepEqual(run(seq, clock, see(hand(0.5, 0.5, true)), 50), [PHASE.BLUE]);
  assert.deepEqual(run(seq, clock, see(hand(0.2, 0.5, true), hand(0.8, 0.5, true)), 300), [PHASE.DUAL]);
});

test("the full technique: merge, hold, close and open to release", () => {
  const clock = { now: 0 };
  const seq = createSequence(0);
  run(seq, clock, see(hand(0.5, 0.5, true)), 50);
  run(seq, clock, see(hand(0.2, 0.5, true), hand(0.8, 0.5, true)), 300);
  // Index tips 0.1 apart is 1 palm length: under the merge gap.
  const together = see(hand(0.45, 0.5, true), hand(0.55, 0.5, true));
  assert.deepEqual(run(seq, clock, together, 600), [PHASE.MERGE, PHASE.PURPLE_HOLD]);
  run(seq, clock, see(hand(0.45, 0.5, false), hand(0.55, 0.5, false)), 700);
  assert.deepEqual(run(seq, clock, together, 50), [PHASE.PURPLE_RELEASE]);
});

test("hands already open at the merge do not release by themselves", () => {
  const clock = { now: 0 };
  const seq = createSequence(0);
  run(seq, clock, see(hand(0.5, 0.5, true)), 50);
  run(seq, clock, see(hand(0.2, 0.5, true), hand(0.8, 0.5, true)), 300);
  const together = see(hand(0.45, 0.5, true), hand(0.55, 0.5, true));
  run(seq, clock, together, 600);
  assert.equal(seq.phase, PHASE.PURPLE_HOLD);
  run(seq, clock, together, 2000);
  assert.equal(seq.phase, PHASE.PURPLE_HOLD);
});

test("losing a hand during red falls back to blue", () => {
  const clock = { now: 0 };
  const seq = createSequence(0);
  run(seq, clock, see(hand(0.5, 0.5, true)), 50);
  run(seq, clock, see(hand(0.2, 0.5, true), hand(0.8, 0.5, true)), 300);
  assert.deepEqual(run(seq, clock, see(hand(0.2, 0.5, true)), 400), [PHASE.BLUE]);
});

test("observations order hands left to right by index fingertip", () => {
  const obs = see(hand(0.8, 0.5, true), hand(0.2, 0.5, false));
  assert.equal(obs.count, 2);
  assert.equal(obs.left.index.x, 0.2);
  assert.equal(obs.openAny, true);
});
