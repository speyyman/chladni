/// <reference lib="webworker" />
/**
 * Computes a plate's modes, fields and reference acceleration off the main
 * thread (a few hundred milliseconds of maths), so the page can paint and stay
 * responsive while it works.
 */
import { prepareBench, type PlateShape } from 'chladni'

self.onmessage = (e: MessageEvent<{ shape: PlateShape }>) => {
  const prepared = prepareBench({ shape: e.data.shape })
  const buffers = prepared.fields.map((f) => f.values.buffer as ArrayBuffer)
  ;(self as unknown as Worker).postMessage({ shape: e.data.shape, prepared }, buffers)
}
