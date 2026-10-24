# Sound, made visible (the film)

An 89-second silent film of sand on a steel plate, rendered from the `chladni` library: the square plate driven from resonance to resonance, then the disc. It goes with the visual essay [Sound, made visible](https://speyyman.github.io/media/sound-made-visible/).

## Render

From the repository root, with FFmpeg on the PATH:

```sh
npm ci
npx playwright install chromium   # once
npm run film                      # builds the library, renders both cuts into film/out/ (about 15 minutes)
```

Or from this folder: `npm run render`, `node scripts/render.mjs --stills 17,52` for stills, `npm run e2e` for the end-to-end check.

Output in `film/out/`: `sound-made-visible-1920x1080.mp4` and `.webm`, `sound-made-visible-1080x1920.mp4`, posters (PNG and lossless WebP), `sound-made-visible.en.vtt`, and a SHA-256 of every frame.

## How it works

- `src/script.ts` is the timeline. It holds at resonances chosen by index from each plate's computed list (never typed in), glides between them on a log scale, and carries the captions.
- `src/draw.ts` paints a frame in the palette of speyyman.github.io. The sand is a simulation, so each plate's part starts from freshly scattered grains with a fixed seed, and any frame is rebuilt by replaying from the start of its part. The e2e test checks that a stretch rendered twice is identical, and that starting part-way gives the same frames as a longer run.
- `scripts/render.mjs` drives the page in headless Chromium, pipes PNG frames into a near-lossless master, then encodes the web files from it. Thrown grains move every frame, which is hard to compress, so the MP4s are H.264 capped at 1.5 Mbit/s and the WebM is two-pass VP9 at 1.1 Mbit/s.

## Licence

Code MIT; the film, its stills and captions CC BY 4.0. Fonts: Big Shoulders Display and Geist Mono, SIL Open Font License 1.1.
