# Hollow Purple Web

Standalone website prototype for a Gojo-style sequence:

`Blue -> Red + Blue -> Merge -> Hollow Purple -> Release`

Blue phase includes dense formula glyphs, equation streams, and geometric construction lines.
Current renderer also uses deterministic parabola bundles and Pythagorean theorem geometry across Blue/Red/Purple.

## Run

Use any static server (camera access requires `https` or `localhost`):

```bash
cd "gojo-hollow-purple-web"
npx serve .
```

Then open the local URL in Chrome/Edge and click **Start Camera**. No camera, or rather not? **Watch Demo** runs the whole technique with scripted hands through the same sequence and renderer.

## Japanese Voice Clips

Drop your clips in `assets/audio` using any of these names:

- Blue: `gojo-lapse-blue.mp3` (preferred), `gojo-blue.mp3`
- Red: `gojo-reversal-red.mp3` (preferred), `gojo-red.mp3`
- Purple: `hollow-purple.mp3` (preferred), `gojo-hollow-purple.mp3`

If a clip is missing, the visual callout still shows and `Status` will list the missing technique audio.

## Controls

- `Start Camera`: enable webcam + MediaPipe Hands
- `Reset State`: reset the phase machine
- `Intensity`: scales orb/symbol/burst strength
- `Merge Distance`: how close hands must be to trigger merge, from about 1 to 2.4 palm lengths
- `Show Hand Landmarks`: draws tracked hand points on top of the effect
- `Blue Expand`, `Red Expand`, `Purple Expand`: independent expansion controls for each technique

## Gesture Flow

1. Show one hand to enter `blue`
2. Show both hands to enter `dual`
3. Move hands close together to trigger `merge`
4. Close your hands, then open them to trigger `purple_release` (it releases on its own after 4 seconds)

## How gestures are measured

MediaPipe Hands gives 21 landmarks per hand, normalised to the video frame ([landmark map](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)). Raw distances in that frame shrink as you step back, so `gestures.js` measures everything in palm lengths (wrist to the middle finger's knuckle):

- **Open palm:** a finger counts as straight when its tip is at least 15% further from the wrist than its middle joint. The old check was "tip above joint", which called a sideways or downward open hand closed.
- **Merge:** the gap between index fingertips, divided by palm length. With the old fixed 0.19-of-the-frame threshold, two hands two palms apart merged as soon as you stood back from the camera.
- **Expansion:** finger spread and hand gap drive the Blue, Red and Purple sizes in palm lengths too, so the effect grows the same at any distance.
- **Release:** fires on the moment your hands open after being closed. Hands are usually already open when they merge, so the old open-palm check released Purple the instant the hold began.

`npm test` checks these against synthetic hands rotated, scaled and moved around the frame.

## Camera

MediaPipe Hands and Camera Utils are pinned to `hands@0.4.1675469240` and `camera_utils@0.3.1675466862`; the model files are fetched from the same pinned version. If the camera can't start, the status line says why in plain words (permission blocked, no camera, camera busy in another app). Tracking pauses while the tab is hidden.
