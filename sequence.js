// The Blue -> Red -> Merge -> Hollow Purple -> Release sequence as plain
// state and functions, so it runs (and is tested) without a camera or DOM.
// `seq` is any object with the fields createSequence returns; the app passes
// its own state object so the renderer reads the same `phase`.
import { fingerSpread, handGap, isOpenPalm, releaseEdge } from "./gestures.js";

export const PHASE = {
  IDLE: "idle",
  BLUE: "blue",
  DUAL: "dual",
  MERGE: "merge",
  PURPLE_HOLD: "purple_hold",
  PURPLE_RELEASE: "purple_release",
  TAIL: "tail",
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createSequence(nowMs = 0) {
  const seq = { phase: PHASE.IDLE, release: { sawClosed: false } };
  resetSequence(seq, nowMs);
  return seq;
}

export function resetSequence(seq, nowMs) {
  seq.phase = PHASE.IDLE;
  seq.phaseStartMs = nowMs;
  seq.dualHoldMs = 0;
  seq.mergeHoldMs = 0;
  seq.dualLostMs = 0;
  seq.release.sawClosed = false;
}

// Returns true when the phase actually changed.
export function enterPhase(seq, next, nowMs) {
  if (next === seq.phase) return false;
  seq.phase = next;
  seq.phaseStartMs = nowMs;
  seq.dualHoldMs = 0;
  seq.mergeHoldMs = 0;
  seq.dualLostMs = 0;
  seq.release.sawClosed = false;
  return true;
}

// Advances one frame. Returns the phase entered this frame, or null.
export function stepSequence(seq, dtMs, obs, nowMs, mergeGap) {
  const age = (nowMs - seq.phaseStartMs) / 1000;
  const go = (next) => (enterPhase(seq, next, nowMs) ? next : null);

  switch (seq.phase) {
    case PHASE.IDLE:
      return obs.count >= 1 ? go(PHASE.BLUE) : null;

    case PHASE.BLUE:
      seq.dualHoldMs = clamp(seq.dualHoldMs + (obs.count >= 2 ? dtMs : -dtMs * 0.65), 0, 1200);
      return seq.dualHoldMs > 180 ? go(PHASE.DUAL) : null;

    case PHASE.DUAL: {
      if (obs.count === 0) return go(PHASE.BLUE);
      seq.dualLostMs = clamp(seq.dualLostMs + (obs.count < 2 ? dtMs : -dtMs), 0, 1400);
      if (seq.dualLostMs > 260) return go(PHASE.BLUE);
      const closeEnough = Boolean(obs.left && obs.right && obs.left !== obs.right) &&
        handGap(obs.left.points, obs.right.points) < mergeGap;
      seq.mergeHoldMs = clamp(seq.mergeHoldMs + (closeEnough ? dtMs : -dtMs * 0.9), 0, 1000);
      return seq.mergeHoldMs > 120 ? go(PHASE.MERGE) : null;
    }

    case PHASE.MERGE:
      return age > 0.32 ? go(PHASE.PURPLE_HOLD) : null;

    case PHASE.PURPLE_HOLD: {
      // Close your hands, then open them. Releases on its own after 4 s.
      const opened = releaseEdge(seq.release, obs.openAny);
      return (age > 0.55 && opened) || age > 4 ? go(PHASE.PURPLE_RELEASE) : null;
    }

    case PHASE.PURPLE_RELEASE:
      return age > 1.85 ? go(PHASE.TAIL) : null;

    case PHASE.TAIL:
      return age > 1.2 && obs.count === 0 ? go(PHASE.IDLE) : null;

    default:
      return null;
  }
}

// MediaPipe Hands results -> what the sequence needs. Hands are ordered by
// index fingertip x, so "left" is the one further left in the image.
export function detectObservation(results) {
  const hands = (results.multiHandLandmarks || []).map((lms) => {
    const points = lms.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    return { points, index: points[8], openPalm: isOpenPalm(points), spread: fingerSpread(points) };
  });
  hands.sort((a, b) => a.index.x - b.index.x);
  return {
    count: hands.length,
    hands,
    left: hands[0] || null,
    right: hands[hands.length - 1] || null,
    points: hands.flatMap((h) => h.points),
    openAny: hands.some((h) => h.openPalm),
  };
}
