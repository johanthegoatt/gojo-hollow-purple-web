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

Then open the local URL in Chrome/Edge and click **Start Camera**.

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
- `Merge Distance`: how close hands must be to trigger merge
- `Show Hand Landmarks`: draws tracked hand points on top of the effect
- `Blue Expand`, `Red Expand`, `Purple Expand`: independent expansion controls for each technique

## Gesture Flow

1. Show one hand to enter `blue`
2. Show both hands to enter `dual`
3. Move hands close together to trigger `merge`
4. Open palm during hold to trigger `purple_release`
