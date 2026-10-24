/**
 * An optional sine tone at the drive frequency. Nothing here runs until the
 * visitor presses the sound switch: no AudioContext exists before that, so
 * the page can never make a sound on its own.
 */
let ctx: AudioContext | undefined
let osc: OscillatorNode | undefined
let gain: GainNode | undefined

const LEVEL = 0.05

export function soundOn(hz: number) {
  ctx ??= new AudioContext()
  void ctx.resume()
  gain = ctx.createGain()
  gain.gain.value = 0
  gain.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.05)
  gain.connect(ctx.destination)
  osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = hz
  osc.connect(gain)
  osc.start()
}

export function soundOff() {
  if (!ctx || !osc || !gain) return
  const o = osc
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
  o.stop(ctx.currentTime + 0.2)
  osc = undefined
  gain = undefined
}

export function soundFrequency(hz: number) {
  if (ctx && osc) osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02)
}
