# Temper

**Concept.** The demo is a plate on a bench. Chladni's plates were metal; this one is steel, and its look comes from what happens to steel when it is heated and quenched: it turns straw, then bronze, then violet, then blue. The plate itself is heat-blued steel, the sand is white quartz, and the few colours the interface uses are temper colours, in the order the metal takes them. Everything else is lamp-black bench. The physics is the content, so the chrome stays dark, quiet and numerical, like the dial of a laboratory instrument.

It shares nothing with the speyyman.github.io Herbarium system (no greens, no parchment, no plate frames or marginalia, different type) and nothing with Copyboard (Plate Studio's graphite and safelight amber).

## Tokens

Implemented as CSS custom properties in `src/style.css`.

### Colour

| Token          | Hex       | Use                                                                |
| -------------- | --------- | ------------------------------------------------------------------ |
| `--bench`      | `#0f1112` | Page background                                                    |
| `--panel`      | `#141b24` | Control panel                                                      |
| `--rule`       | `#33424f` | Hairlines and slider tracks (never text)                           |
| `--steel`      | `#1f3550` | The plate                                                          |
| `--steel-edge` | `#2e4a69` | The plate's rim                                                    |
| `--quartz`     | `#f2f4f6` | Sand grains                                                        |
| `--ink`        | `#e7ebef` | Text                                                               |
| `--ink-dim`    | `#9ba7b4` | Labels, secondary readouts                                         |
| `--straw`      | `#e2c46c` | Focus, the selected mode, the frequency needle, nodal-line overlay |
| `--bronze`     | `#cf8a52` | Sound: on, and the drive point                                     |
| `--violet`     | `#a98bc4` | Sweep in progress                                                  |

Text contrast (WCAG 2, computed; the bench is a near-neutral lamp-black, not a blue-black): ink on bench 15.8:1, on panel 14.5:1; ink-dim on bench 7.7:1, on panel 7.1:1; straw on bench 11.1:1; bronze on bench 6.7:1; violet on bench 6.5:1; bench-coloured text on a straw button 11.1:1. Rule (1.8:1) is decoration only.

### Type

- **Instrument Sans** (400, 600), OFL: labels and headings. A grotesque cut for instrument panels: narrow enough for a dense control column, plain enough to stay out of the way. Self-hosted from Fontsource.
- **Martian Mono** (400), OFL: every number, so frequencies line up digit for digit and change without the line jumping. Self-hosted.

Scale (px): 12 (labels, caps, +0.08em tracking), 14 (body), 16 (readouts), 22 (frequency), 40 (the big hertz figure).

### Space, shape, depth

- Spacing on a 4 px base: 4, 8, 12, 16, 24, 32, 48.
- Radius: 2 px on controls; the plate's corners are square, the disc is a circle. Nothing is pill-shaped.
- Borders: 1 px `--rule`. Focus: 2 px `--straw` outline, offset 2 px.
- Elevation: none. The panel is a flat field of `--panel`; depth comes only from the plate, which has a 1 px rim and nothing else.

## Motion

- Motion is the simulation, never decoration. Sand moves because the plate moves; controls do not animate.
- A sweep moves the frequency smoothly through the range at a rate slow enough to see patterns form and dissolve (about 4 Hz per second near the low modes, faster above).
- With `prefers-reduced-motion: reduce`, sweeping is off (the button jumps to the next resonance instead), and the sand jumps straight to its settled pattern instead of drifting there.

## Iconography

No icon set. Controls are words. The drive point is a small bronze ring on the plate; the frequency needle is a straw tick on the scale.

## Components

1. **Plate**: the canvas. Steel ground, quartz grains, optional straw nodal lines, a bronze ring at the drive point (click or arrow keys to move it).
2. **Frequency dial**: a horizontal scale in hertz (logarithmic) with resonance ticks, a straw needle, and the big hertz readout.
3. **Mode list**: a column of rows, one per resonance: hertz, Ω, and the symmetry or (n, s) label. The current one is marked in straw.
4. **Switch**: a two-state text button with `aria-pressed` (plate shape, nodal lines, sound).
5. **Button**: a flat text button with a 1 px rule (sweep, scatter sand).
6. **Readout**: label over value, Martian Mono values.

## Rules

- Never make a sound the visitor did not ask for. Sound starts off, and nothing creates an audio context until the sound switch is pressed.
- Never draw a number the model did not compute: every hertz figure comes from the plate's frequency parameter and the stated steel plate.
- Never use more than one temper colour for one meaning, and never use green, or a saturated orange such as Copyboard's safelight amber: straw is the palest temper colour and stays pale.

## Layout

At 375 px the plate is full width with the dial under it and the panel below. From 900 px the plate sits left at up to 640 px and the panel is a 320 px column on the right.
