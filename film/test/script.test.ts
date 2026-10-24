import { Bench } from 'chladni'
import { describe, expect, it } from 'vitest'
import { DISC_PICKS, DURATION, FPS, FRAMES, HOLD, RAMP, SQUARE_PICKS, cueAt, cues, momentAt, parts, toVTT } from '../src/script.js'

const square = new Bench({ shape: 'square', grains: 10 })
const circle = new Bench({ shape: 'circle', grains: 10 })
const hz = { square: square.resonances.map((r) => r.hz), circle: circle.resonances.map((r) => r.hz) }

describe('timeline', () => {
  it('runs between 45 and 90 seconds', () => {
    expect(DURATION).toBeGreaterThanOrEqual(45)
    expect(DURATION).toBeLessThanOrEqual(90)
    expect(FRAMES).toBe(Math.round(DURATION * FPS))
  })

  it('holds exactly at computed resonances, in rising order, and glides between them', () => {
    for (const [p, picks, list] of [
      [parts()[0], SQUARE_PICKS, hz.square],
      [parts()[1], DISC_PICKS, hz.circle],
    ] as const) {
      let last = 0
      picks.forEach((pick, k) => {
        const mid = momentAt(p.start + k * (RAMP + HOLD) + RAMP + HOLD / 2, hz)
        expect(mid.scene).toBe('plate')
        if (mid.scene !== 'plate') return
        expect(mid.holding).toBe(true)
        expect(mid.hz).toBe(list[pick])
        expect(mid.hz).toBeGreaterThan(last)
        last = mid.hz
        const ramp = momentAt(p.start + k * (RAMP + HOLD) + RAMP / 2, hz)
        if (ramp.scene === 'plate') expect(ramp.holding).toBe(false)
      })
    }
  })

  it('picks resonances that exist on each plate', () => {
    expect(Math.max(...SQUARE_PICKS)).toBeLessThan(hz.square.length)
    expect(Math.max(...DISC_PICKS)).toBeLessThan(hz.circle.length)
  })
})

describe('captions', () => {
  const list = cues(hz)
  it('are in order, never overlap, and name the first resonance’s real frequency', () => {
    list.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start)
      if (i) expect(c.start).toBeGreaterThanOrEqual(list[i - 1]!.end)
      expect(c.text).not.toMatch(/undefined|NaN|!/)
    })
    expect(list.some((c) => c.text.includes(`first resonance at ${hz.square[0]!.toFixed(1)} Hz`))).toBe(true)
  })

  it('stay up long enough to read, at most 3 words a second', () => {
    for (const c of list) {
      expect(c.text.split(/\s+/).length / (c.end - c.start)).toBeLessThanOrEqual(3)
      expect(cueAt(list, c.start + 0.01)).toBe(c)
    }
  })

  it('write valid WebVTT', () => {
    const vtt = toVTT(list)
    expect(vtt.startsWith('WEBVTT\n\n1\n00:00:00.500 --> 00:00:04.800\n')).toBe(true)
    expect(vtt.match(/-->/g)).toHaveLength(list.length)
  })
})
