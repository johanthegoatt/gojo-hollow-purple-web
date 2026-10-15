// Hand gestures from MediaPipe Hands landmarks, measured so they work the
// same whether the hand is upright or tilted, near the camera or far away.
//
// Landmarks are normalised to the image (0..1), so a raw distance between two
// hands shrinks as you step back from the camera. Every distance here is
// divided by the palm length (wrist to the middle finger's knuckle, landmarks
// 0 and 9), which scales with the hand on screen.
// Landmark numbering: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker

const WRIST = 0;
const MIDDLE_MCP = 9;
// [tip, pip] for index, middle, ring and little finger.
const FINGERS = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function palmLength(pts) {
  return Math.max(1e-6, dist(pts[WRIST], pts[MIDDLE_MCP]));
}

// A finger is straight when its tip is clearly further from the wrist than
// its middle joint. Comparing distances instead of "tip above joint" keeps
// it working when the hand is sideways or pointing down.
export function extendedFingers(pts) {
  const wrist = pts[WRIST];
  let n = 0;
  for (const [tip, pip] of FINGERS) {
    if (dist(pts[tip], wrist) > dist(pts[pip], wrist) * 1.15) n += 1;
  }
  return n;
}

export function isOpenPalm(pts) {
  return extendedFingers(pts) >= 3;
}

export function isFist(pts) {
  return extendedFingers(pts) <= 1;
}

// How spread the fingers are, in palm lengths. About 1.2 for a fist and
// 1.9 to 2.2 for a wide open hand.
export function fingerSpread(pts) {
  const wrist = pts[WRIST];
  let sum = 0;
  for (const [tip] of FINGERS) sum += dist(pts[tip], wrist);
  return sum / FINGERS.length / palmLength(pts);
}

// Gap between two index fingertips, in palm lengths (averaged over both
// hands), so stepping back from the camera doesn't trigger a merge.
export function handGap(a, b) {
  const scale = (palmLength(a) + palmLength(b)) / 2;
  return dist(a[8], b[8]) / scale;
}

// Release fires on the moment hands open after being closed, not merely
// while they are open: hands are usually already open when they merge, so a
// level check released the technique as soon as the hold began.
export function releaseEdge(memory, openNow) {
  const fired = memory.sawClosed && openNow;
  if (!openNow) memory.sawClosed = true;
  return fired;
}
