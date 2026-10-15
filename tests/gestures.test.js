import test from "node:test";
import assert from "node:assert/strict";

import { extendedFingers, fingerSpread, handGap, isOpenPalm, isFist, releaseEdge } from "../gestures.js";

// A simple hand: wrist at the origin, palm along +y, fingers along +y.
// `curl` folds each finger tip back toward the palm. Then rotate, scale and
// move it, the way a hand moves in front of a camera.
function hand({ curl = 0, angle = 0, scale = 1, at = { x: 0.5, y: 0.5 } } = {}) {
  const raw = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  raw[0] = { x: 0, y: 0 };
  raw[9] = { x: 0, y: 1 };
  const cols = { 8: -0.35, 12: -0.1, 16: 0.12, 20: 0.33 };
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    const x = cols[tip];
    raw[pip - 1] = { x, y: 1.0 };
    raw[pip] = { x, y: 1.45 };
    raw[tip] = curl ? { x, y: 1.15 } : { x, y: 2.0 };
    raw[tip - 1] = { x, y: curl ? 1.3 : 1.75 };
  }
  for (const k of [1, 2, 3, 4]) raw[k] = { x: -0.5 - k * 0.1, y: 0.3 + k * 0.15 };
  const c = Math.cos(angle), s = Math.sin(angle);
  return raw.map((p) => ({
    x: at.x + (p.x * c - p.y * s) * 0.08 * scale,
    y: at.y - (p.x * s + p.y * c) * 0.08 * scale,
    z: 0
  }));
}

test("an open hand reads as open upright, sideways and upside down", () => {
  for (const angle of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const h = hand({ angle });
    assert.equal(extendedFingers(h), 4, `angle ${angle}`);
    assert.equal(isOpenPalm(h), true);
  }
});

test("the old tip-above-joint check failed a sideways open hand", () => {
  const h = hand({ angle: Math.PI / 2 });
  const oldCount = [[8, 6], [12, 10], [16, 14], [20, 18]].filter(([t, p]) => h[t].y < h[p].y - 0.015).length;
  assert.ok(oldCount < 3, "old rule said closed");
  assert.equal(isOpenPalm(h), true, "new rule says open");
});

test("a fist reads as a fist at any angle", () => {
  for (const angle of [0, 1, 2.5]) assert.equal(isFist(hand({ curl: 1, angle })), true);
});

test("finger spread and hand gap do not change with distance from the camera", () => {
  const near = hand({ scale: 2 });
  const far = hand({ scale: 0.6 });
  assert.ok(Math.abs(fingerSpread(near) - fingerSpread(far)) < 1e-9);
  const gapNear = handGap(hand({ scale: 2, at: { x: 0.3, y: 0.5 } }), hand({ scale: 2, at: { x: 0.62, y: 0.5 } }));
  const gapFar = handGap(hand({ scale: 0.6, at: { x: 0.45, y: 0.5 } }), hand({ scale: 0.6, at: { x: 0.546, y: 0.5 } }));
  assert.ok(Math.abs(gapNear - gapFar) < 1e-6, `${gapNear} vs ${gapFar}`);
});

test("standing back no longer merges hands that are a hand-width apart", () => {
  // Far from the camera two hands 2 palms apart are only ~0.1 of the frame
  // apart, under the old fixed 0.19 threshold.
  const a = hand({ scale: 0.6, at: { x: 0.45, y: 0.5 } });
  const b = hand({ scale: 0.6, at: { x: 0.546, y: 0.5 } });
  assert.ok(Math.hypot(a[8].x - b[8].x, a[8].y - b[8].y) < 0.19, "old rule would merge");
  assert.ok(handGap(a, b) > 1.52, "new rule waits until the hands are close");
});

test("release fires when hands open after closing, not while already open", () => {
  const mem = { sawClosed: false };
  assert.equal(releaseEdge(mem, true), false);
  assert.equal(releaseEdge(mem, true), false);
  assert.equal(releaseEdge(mem, false), false);
  assert.equal(releaseEdge(mem, true), true);
});
