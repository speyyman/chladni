/**
 * From frequency parameter to hertz. Leissa's parameter is Ω = ω a² √(ρh/D),
 * with a the side (square) or radius (circle), ρ the density, h the thickness
 * and D = E h³ / (12 (1 − ν²)) the flexural rigidity. So
 *
 *   f = Ω / (2π a²) · √(D / (ρh)).
 */

export type Material = {
  /** Young's modulus, Pa. */
  E: number
  /** Density, kg/m³. */
  rho: number
  /** Poisson's ratio. */
  nu: number
}

/** Typical handbook values for steel. */
export const STEEL: Material = { E: 200e9, rho: 7850, nu: 0.3 }

export type PhysicalPlate = {
  material: Material
  /** Side of the square or radius of the disc, metres. */
  a: number
  /** Thickness, metres. */
  h: number
}

/** The plates the demo describes: a 24 cm steel square and a 24 cm steel disc, both 1 mm thick. */
export const DEMO_SQUARE: PhysicalPlate = { material: STEEL, a: 0.24, h: 0.001 }
export const DEMO_DISC: PhysicalPlate = { material: STEEL, a: 0.12, h: 0.001 }

const rigidity = ({ material: m, h }: PhysicalPlate) => (m.E * h ** 3) / (12 * (1 - m.nu ** 2))

/** Hertz for a frequency parameter Ω on a physical plate. */
export const hertz = (omega: number, p: PhysicalPlate) =>
  (omega / (2 * Math.PI * p.a * p.a)) * Math.sqrt(rigidity(p) / (p.material.rho * p.h))

/** Frequency parameter Ω for a frequency in hertz. */
export const omegaFor = (hz: number, p: PhysicalPlate) => hz / hertz(1, p)
