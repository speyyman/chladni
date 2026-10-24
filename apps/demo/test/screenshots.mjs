#!/usr/bin/env node
// Screenshots of the built demo for the README (docs/) and for review: square and disc at a resonance,
// with the sand settled, at 1280 and 375 wide. Serves apps/demo/dist itself; run `npm run build` first.
// Usage: node apps/demo/test/screenshots.mjs [outDir]
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const out = process.argv[2] ?? fileURLToPath(new URL('../../../docs', import.meta.url))
await mkdir(out, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/chladni\/?/, '')
  if (path === '' || path.endsWith('/')) path += 'index.html'
  try {
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
    res.end(await readFile(join(dist, path)))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/chladni/`
const browser = await chromium.launch()
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['375', { width: 375, height: 812 }],
]) {
  for (const [shape, mode] of [
    ['square', 11],
    ['circle', 7],
  ]) {
    // Reduced motion, so each change settles the sand at once and the shot is repeatable.
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.chladni.bench() && !document.getElementById('controls').inert)
    await page.click(`[data-shape="${shape}"]`)
    await page.waitForFunction((s) => window.chladni.bench()?.shape === s, shape)
    await page.click(`#modes li:nth-child(${mode + 1}) button`)
    await page.screenshot({ path: join(out, `demo-${shape}-${name}.png`), fullPage: name === '375' })
    await page.close()
  }
}
await browser.close()
server.close()
console.log(`wrote screenshots to ${out}`)
