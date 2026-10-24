/**
 * chladni: vibration modes of free square and circular plates (Kirchhoff
 * plate theory), their nodal lines, a plate driven at one frequency, and sand
 * that finds the still lines.
 *
 * @packageDocumentation
 */
export { besselJ, besselI, besselJPrime, besselIPrime } from './bessel.js'
export { symmetricEigen, matrix, type Matrix, type Eigen } from './linalg.js'
export {
  squareModes,
  squareModeAt,
  membraneModeAt,
  gaussLegendre,
  legendre,
  type SquareMode,
  type SquareOptions,
  type SquareSymmetry,
} from './square.js'
export { circleModes, circleModeAt, circleRadial, nodalCircles, type CircleMode, type CircleOptions } from './circle.js'
export { modeField, nodalLines, sample, coord, isInside, type Field, type Mode, type PlateShape } from './field.js'
export { preparePlate, drive, resonantPeak, referenceAcceleration, type Plate, type DriveOptions, type Response } from './drive.js'
export { Sand, mulberry32, type SandOptions, type StepOptions } from './sand.js'
export { hertz, omegaFor, STEEL, DEMO_SQUARE, DEMO_DISC, type Material, type PhysicalPlate } from './plate.js'
export { Bench, labelFor, type BenchOptions, type Resonance } from './bench.js'
