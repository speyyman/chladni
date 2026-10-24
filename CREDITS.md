# Credits and sources

## Code

No runtime dependencies in the library. The demo uses Vite to build; the tests use Vitest and Playwright; the film uses Playwright and FFmpeg.

## Fonts (demo)

- [Instrument Sans](https://fontsource.org/fonts/instrument-sans), SIL Open Font License 1.1, self-hosted from Fontsource.
- [Martian Mono](https://fontsource.org/fonts/martian-mono), SIL Open Font License 1.1, self-hosted from Fontsource.

The licence texts ship in `node_modules/@fontsource/*/LICENSE`.

## Fonts (film)

The film is media for speyyman.github.io and uses that site's type: [Big Shoulders Display](https://fontsource.org/fonts/big-shoulders-display) and [Geist Mono](https://fontsource.org/fonts/geist-mono), both SIL Open Font License 1.1.

## Data, images, audio

None. Every image is computed by the code here. The demo's optional tone is a sine wave generated in the browser.

## Reference values

Frequency parameters and nodal radii used in the tests come from A. W. Leissa, _Vibration of Plates_, NASA SP-160 (1969), tables 2.5, 2.7, 4.65 and 4.67 (a US government publication), and Y. Narita, EPI International Journal of Engineering 5 (2022), table 17. Bessel function values: Abramowitz and Stegun, _Handbook of Mathematical Functions_, and mpmath. See the README for full references.

## Licences

Code: MIT. The film, its stills and captions: CC BY 4.0.
