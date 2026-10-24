#!/usr/bin/env node
// End-to-end checks of the built demo (run `npm run build` first; this serves dist/ itself):
// sound never starts without a click, the sweep moves the frequency, modes and the drive point
// respond, reduced motion settles the sand at once, the disc works, nothing overflows at 375 px,
// and frame rate under 4× CPU throttling, with the fallback that sheds work if frames run long.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/chladni\/?/, '')
  if (path === '' || path.endsWith('/')) path += 'index.html'
  try {
    const body = await readFile(join(dist, path))
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/chladni/`
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const report = []
// The plate is computed in a worker: wait until it is in place and the controls are live.
const ready = (page, shape = 'square') =>
  page.waitForFunction((s) => window.chladni.bench()?.shape === s && !document.getElementById('controls').inert, shape)
const ok = (m) => {
  report.push(m)
  console.log(`ok ${m}`)
}

// Count AudioContexts and oscillators the page creates.
const spyAudio = () => {
  window.__audio = { contexts: 0, started: 0 }
  const Real = window.AudioContext
  window.AudioContext = class extends Real {
    constructor(...a) {
      super(...a)
      window.__audio.contexts++
    }
    createOscillator() {
      const o = super.createOscillator()
      const start = o.start.bind(o)
      o.start = (...a) => {
        window.__audio.started++
        return start(...a)
      }
      return o
    }
  }
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(spyAudio)
  await page.goto(url, { waitUntil: 'networkidle' })
  await ready(page)

  // Everything but the sound switch: no audio at all.
  await page.click('#sweep')
  await page.waitForTimeout(1500)
  const hzAfterSweep = await page.evaluate(() => window.chladni.bench().hz)
  assert.ok(hzAfterSweep > 58, `sweep should raise the frequency, got ${hzAfterSweep}`)
  ok(`sweep raised the frequency to ${hzAfterSweep.toFixed(1)} Hz`)
  await page.click('#sweep')
  await page.click('#modes li:nth-child(3) button')
  const third = await page.evaluate(() => window.chladni.bench().resonances[2].hz)
  assert.equal(await page.evaluate(() => window.chladni.bench().hz), third)
  assert.equal(await page.getAttribute('#modes li:nth-child(3) button', 'aria-current'), 'true')
  ok(`mode list sets the frequency to a resonance (${third.toFixed(1)} Hz) and marks it`)
  await page.fill('#freq', '600')
  await page.click('#lines')
  await page.click('#scatter')
  await page.click('[data-shape="circle"]')
  await ready(page, 'circle')
  await page.click('[data-shape="square"]')
  await ready(page)
  const before = await page.evaluate(() => window.chladni.bench().drivePoint)
  await page.focus('#plate')
  await page.keyboard.press('ArrowLeft')
  const after = await page.evaluate(() => window.chladni.bench().drivePoint)
  assert.ok(after.x < before.x, 'arrow key should move the drive point')
  ok('arrow keys move the drive point')
  assert.deepEqual(await page.evaluate(() => window.__audio), { contexts: 0, started: 0 })
  ok('no AudioContext and no oscillator after sweeping, choosing modes, the slider, switches and keys')

  await page.click('#sound')
  await page.waitForTimeout(200)
  assert.deepEqual(await page.evaluate(() => window.__audio), { contexts: 1, started: 1 })
  assert.equal(await page.getAttribute('#sound', 'aria-pressed'), 'true')
  await page.click('#sound')
  assert.equal(await page.getAttribute('#sound', 'aria-pressed'), 'false')
  ok('one click on Sound creates the audio context and starts one tone; a second click turns it off')
  assert.deepEqual(errors, [], 'console errors')
  ok('no console errors')
  await page.close()
}

{
  // Disc.
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await ready(page)
  await page.click('[data-shape="circle"]')
  await ready(page, 'circle')
  const labels = await page.evaluate(() =>
    window.chladni
      .bench()
      .resonances.slice(0, 3)
      .map((r) => r.label),
  )
  assert.deepEqual(labels, ['2,0', '0,1', '3,0'])
  ok('disc lists its modes by nodal diameters and circles: 2,0 then 0,1 then 3,0')
  await page.close()
}

{
  // Reduced motion: the sand is settled as soon as the frequency changes, and Sweep jumps.
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.goto(url, { waitUntil: 'networkidle' })
  await ready(page)
  await page.click('#sweep')
  const s = await page.evaluate(() => {
    const b = window.chladni.bench()
    const peak = Math.max(...b.acceleration.values)
    return { hz: b.hz, second: b.resonances[1].hz, settled: b.sand.meanUnder(b.acceleration, peak) }
  })
  assert.equal(s.hz, s.second)
  assert.ok(s.settled < 0.12, `sand should be settled, mean ${s.settled}`)
  assert.equal(await page.getAttribute('#sweep', 'aria-pressed'), 'false')
  ok(`reduced motion: Sweep jumps to the next resonance and the sand is already on the lines (mean ${s.settled.toFixed(3)} of peak)`)
  await page.close()
}

{
  // 375 px: no horizontal scrolling.
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await ready(page)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375)
  ok('375 px wide: no horizontal overflow')
  await page.close()
}

{
  // Frame rate while sweeping, without throttling and with the CPU slowed 4×.
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const cdp = await page.context().newCDPSession(page)
    await page.goto(url, { waitUntil: 'networkidle' })
    await ready(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    await page.click('#sweep')
    const measure = () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const times = []
            const tick = (t) => {
              times.push(t)
              if (times.length < 121) requestAnimationFrame(tick)
              else {
                const d = times
                  .slice(1)
                  .map((t, i) => t - times[i])
                  .sort((a, b) => a - b)
                resolve({
                  median: 1000 / d[d.length >> 1],
                  grains: window.chladni.bench().sand.count,
                  steps: window.chladni.stepsPerFrame(),
                })
              }
            }
            requestAnimationFrame(tick)
          }),
      )
    const first = await measure()
    // Give the fallback time to act, then measure again.
    await page.waitForTimeout(4000)
    const settled = await measure()
    ok(
      `CPU throttle ${rate}×: ${first.median.toFixed(0)} fps at first (${first.grains} grains, ${first.steps} steps per frame), ` +
        `${settled.median.toFixed(0)} fps after the fallback (${settled.grains} grains, ${settled.steps} steps per frame)`,
    )
    if (rate === 4) assert.ok(settled.median >= 45, 'with 4× throttling the fallback should bring the frame rate back near 60 fps')
    await page.close()
  }
}

await browser.close()
server.close()
console.log(`\n${report.length} checks passed`)
