import { describe, expect, it } from 'vitest'
import { Bench } from '../src/bench.js'

describe('bench', () => {
  it('lists the square’s resonances in hertz for the 24 cm steel plate, lowest near 57 Hz', () => {
    const b = new Bench({ grains: 500 })
    expect(b.resonances.length).toBeGreaterThan(30)
    expect(b.resonances[0]!.hz).toBeGreaterThan(56)
    expect(b.resonances[0]!.hz).toBeLessThan(58)
    expect(b.resonances.every((r, i) => i === 0 || r.hz >= b.resonances[i - 1]!.hz)).toBe(true)
    expect(b.resonances[0]!.label).toBe('AAS')
  })

  it('lists the disc’s resonances with nodal diameters and circles', () => {
    const b = new Bench({ shape: 'circle', grains: 500 })
    expect(b.resonances.slice(0, 3).map((r) => r.label)).toEqual(['2,0', '0,1', '3,0'])
  })

  it('throws sand hard at a resonance and not at all between two', () => {
    const b = new Bench({ grains: 2000 })
    const [r1, r2] = [b.resonances[1]!, b.resonances[2]!]
    b.setHz(r2.hz)
    expect(b.strength).toBeGreaterThan(0.1)
    expect(b.dominant).toBe(r2.index)
    b.setHz(Math.sqrt(r1.hz * r2.hz))
    expect(b.strength).toBeLessThan(0.05)
    expect(b.step()).toBe(0)
  })

  it('draws nodal lines for the current motion', () => {
    const b = new Bench({ grains: 100 })
    b.setHz(b.resonances[1]!.hz)
    expect(b.nodalLines().length).toBeGreaterThan(100)
  })
})
