/**
 * The film's timeline: which plate, which frequency at every moment, and the
 * captions. Pure functions of time and of the plate's resonances, so the
 * renderer, the caption file and the tests read the same script.
 *
 * Frequencies are never typed in: each hold is at a resonance the library
 * computed, chosen by its index in the plate's sorted list.
 */
export const FPS = 30

/** Resonances shown, by index into each plate's sorted list. Chosen for clear figures with the default drive point. */
export const SQUARE_PICKS = [0, 1, 3, 5, 8, 11]
export const DISC_PICKS = [0, 1, 2, 3, 6, 7]

export const TITLE = 5
/** Seconds from one resonance to the next, during which the sand rests. */
export const RAMP = 2
/** Seconds held at each resonance while the sand finds the lines. */
export const HOLD = 4.5
export const START_HZ = 40
export const END = 6

export type Part = { plate: 'square' | 'circle'; start: number; end: number; picks: number[] }

export function parts(): [Part, Part] {
  const square = TITLE
  const squareEnd = square + SQUARE_PICKS.length * (RAMP + HOLD)
  const discEnd = squareEnd + DISC_PICKS.length * (RAMP + HOLD)
  return [
    { plate: 'square', start: square, end: squareEnd, picks: SQUARE_PICKS },
    { plate: 'circle', start: squareEnd, end: discEnd, picks: DISC_PICKS },
  ]
}

export const DURATION = parts()[1].end + END
export const FRAMES = Math.round(DURATION * FPS)

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

export type Moment =
  | { scene: 'title' | 'end' }
  | { scene: 'plate'; plate: 'square' | 'circle'; hz: number; holding: boolean; pick: number; part: Part; u: number }

/**
 * Where the film is at time t, given each plate's resonance frequencies. During
 * a ramp the frequency glides on a log scale from the last hold (or 40 Hz) to
 * the next.
 */
export function momentAt(t: number, resonanceHz: { square: number[]; circle: number[] }): Moment {
  const ps = parts()
  if (t < ps[0].start) return { scene: 'title' }
  const part = ps.find((p) => t >= p.start && t < p.end)
  if (!part) return { scene: 'end' }
  const list = resonanceHz[part.plate]
  const u = t - part.start
  const slot = Math.min(part.picks.length - 1, Math.floor(u / (RAMP + HOLD)))
  const inSlot = u - slot * (RAMP + HOLD)
  const target = list[part.picks[slot]!]!
  const from = slot === 0 ? START_HZ : list[part.picks[slot - 1]!]!
  if (inSlot < RAMP) {
    const k = ease(inSlot / RAMP)
    return { scene: 'plate', plate: part.plate, hz: from * (target / from) ** k, holding: false, pick: slot, part, u }
  }
  return { scene: 'plate', plate: part.plate, hz: target, holding: true, pick: slot, part, u }
}

export type Cue = { start: number; end: number; text: string }

/** Every caption, in order. They appear in the frame and in the WebVTT file. */
export function cues(resonanceHz: { square: number[]; circle: number[] }): Cue[] {
  const [sq, disc] = parts()
  const slot = (p: Part, k: number) => p.start + k * (RAMP + HOLD)
  const hz = (v: number) => `${v < 100 ? v.toFixed(1) : v.toFixed(0)} Hz`
  const s0 = resonanceHz.square[SQUARE_PICKS[0]!]!
  return [
    { start: 0.5, end: 4.8, text: 'Sand on a steel plate, shaken at one frequency at a time.' },
    {
      start: slot(sq, 0),
      end: slot(sq, 0) + RAMP,
      text: 'A 24 cm square of steel, 1 mm thick, free at every edge. Most frequencies barely move it.',
    },
    {
      start: slot(sq, 0) + RAMP,
      end: slot(sq, 1),
      text: `At ${hz(s0)} it resonates. Where the plate moves, sand is thrown off. Where it stays still, sand collects.`,
    },
    { start: slot(sq, 1), end: slot(sq, 1) + RAMP, text: 'Between resonances the plate hardly moves, and the sand rests.' },
    {
      start: slot(sq, 1) + RAMP,
      end: slot(sq, 4),
      text: 'Each resonance has its own still lines, its nodal lines. Same plate, different frequency.',
    },
    { start: slot(sq, 4), end: sq.end, text: 'Higher resonances, more lines.' },
    { start: slot(disc, 0), end: slot(disc, 2), text: 'A disc of the same steel. Its still lines are diameters and circles.' },
    { start: slot(disc, 2), end: slot(disc, 4), text: 'These are Chladni figures, after Ernst Chladni, who published them in 1787.' },
    {
      start: slot(disc, 4),
      end: disc.end,
      text: 'Every figure here is computed from the physics of a thin plate. Nothing draws the lines but the sand.',
    },
    { start: disc.end + 0.5, end: DURATION - 0.2, text: 'Sound, made visible.' },
  ]
}

export const cueAt = (list: readonly Cue[], t: number) => list.find((c) => t >= c.start && t < c.end)

/** WebVTT for the captions. */
export function toVTT(list: readonly Cue[]): string {
  const ts = (s: number) => {
    const ms = Math.round(s * 1000)
    const p = (n: number, l = 2) => String(n).padStart(l, '0')
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))}.${p(ms % 1000, 3)}`
  }
  return `WEBVTT\n\n${list.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n')}`
}
