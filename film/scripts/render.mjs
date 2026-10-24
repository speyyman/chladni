#!/usr/bin/env node
// Renders the film "Sound, made visible", the same way as engravings-film: drives
// the canvas page in headless Chromium one frame at a time, pipes each frame to
// ffmpeg as a PNG, and writes the videos, a poster, the captions and a SHA-256
// of every frame (so a re-render can be checked).
//
//   node scripts/render.mjs                 both cuts, full length, into out/
//   node scripts/render.mjs --preview       landscape only, first 10 seconds, low effort
//   options: --only landscape|portrait  --from 0 --to 300 (frames)
//            --out out  --ffmpeg /path/to/ffmpeg
//   node scripts/render.mjs --stills 8,30,60   PNG stills at those seconds, both cuts, into out/stills/
//
// Needs `npm run build` first (the page is served from dist/).
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    out: { type: 'string', default: 'out' },
    ffmpeg: { type: 'string', default: process.env.FFMPEG ?? 'ffmpeg' },
    preview: { type: 'boolean', default: false },
    stills: { type: 'string' },
  },
})

const outDir = join(root, args.out)
await mkdir(outDir, { recursive: true })

// A tiny static server for dist/, so fonts and modules load as they would on the web.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const dist = join(root, 'dist')
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '')
  try {
    const file = path === '' || path === '.' ? 'index.html' : path
    const body = await readFile(join(dist, file))
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

/** Start ffmpeg reading PNG frames from stdin. */
function encoder(outputs, fps) {
  const ff = spawn(
    args.ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-', ...outputs],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
  const done = new Promise((resolve, reject) =>
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))),
  )
  return { ff, done }
}

const h264 = (file, preview) => [
  '-c:v',
  'libx264',
  '-preset',
  preview ? 'veryfast' : 'slow',
  '-crf',
  '20',
  '-pix_fmt',
  'yuv420p',
  '-profile:v',
  'high',
  '-movflags',
  '+faststart',
  file,
]
const vp9 = (file) => [
  '-c:v',
  'libvpx-vp9',
  '-b:v',
  '0',
  '-crf',
  '34',
  '-row-mt',
  '1',
  '-deadline',
  'good',
  '-cpu-used',
  '2',
  '-pix_fmt',
  'yuv420p',
  file,
]

if (args.stills) {
  await mkdir(join(outDir, 'stills'), { recursive: true })
  for (const orientation of args.only ? [args.only] : ['landscape', 'portrait']) {
    const page = await browser.newPage()
    await page.goto(url)
    await page.waitForFunction(() => window.film !== undefined)
    await page.evaluate((o) => window.film.setup(o), { orientation })
    for (const t of args.stills.split(',').map(Number)) {
      const dataUrl = await page.evaluate(
        (n) => {
          window.film.frame(n)
          return window.film.png()
        },
        Math.round(t * 30),
      )
      await writeFile(
        join(outDir, 'stills', `${orientation}-${String(t).padStart(5, '0')}s.png`),
        Buffer.from(dataUrl.split(',')[1], 'base64'),
      )
    }
    await page.close()
  }
  await browser.close()
  server.close()
  process.exit()
}

// Last frame of the square's last hold.
const POSTER = 44 * 30 - 1

const cuts = args.preview ? ['landscape'] : args.only ? [args.only] : ['landscape', 'portrait']
const summary = []
for (const orientation of cuts) {
  const page = await browser.newPage()
  page.on('pageerror', (e) => {
    console.error(e)
    process.exitCode = 1
  })
  await page.goto(url)
  await page.waitForFunction(() => window.film !== undefined)
  const { width, height } = await page.evaluate((o) => window.film.setup(o), { orientation })
  const { frames, fps } = await page.evaluate(() => ({ frames: window.film.frames, fps: window.film.fps }))
  const from = Number(args.from ?? 0)
  const to = Math.min(frames, Number(args.to ?? (args.preview ? fps * 10 : frames)))
  const name = `sound-made-visible-${width}x${height}`
  const outputs = [...h264(join(outDir, `${name}.mp4`), args.preview)]
  if (orientation === 'landscape' && !args.preview) outputs.push(...vp9(join(outDir, `${name}.webm`)))
  const { ff, done } = encoder(outputs, fps)

  const hashes = []
  const started = Date.now()
  for (let i = from; i < to; i++) {
    const dataUrl = await page.evaluate((n) => {
      window.film.frame(n)
      return window.film.png()
    }, i)
    const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    hashes.push(`${createHash('sha256').update(png).digest('hex')}  ${String(i).padStart(5, '0')}`)
    // The poster: the square at its last resonance, the sand settled.
    if (i === POSTER) await writeFile(join(outDir, `${name}-poster.png`), png)
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    if ((i - from) % (fps * 10) === 0) console.log(`${orientation}: frame ${i}/${to} (${((Date.now() - started) / 1000).toFixed(0)} s)`)
  }
  ff.stdin.end()
  await done
  await writeFile(join(outDir, `${name}.frames.sha256`), `${hashes.join('\n')}\n`)
  // The poster again as lossless WebP: the same pixels at about a seventh of the size, for the web page.
  const poster = join(outDir, `${name}-poster.png`)
  if (from <= POSTER && to > POSTER) {
    await new Promise((resolve, reject) =>
      spawn(
        args.ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          poster,
          '-c:v',
          'libwebp',
          '-lossless',
          '1',
          '-compression_level',
          '6',
          poster.replace(/\.png$/, '.webp'),
        ],
        {
          stdio: 'inherit',
        },
      ).on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg (poster) exited with ${code}`)))),
    )
  }
  summary.push(`${name}: frames ${from}..${to - 1} in ${((Date.now() - started) / 1000).toFixed(0)} s`)
  await page.close()
}

// Captions: the same cues the frames show, from the same script.
const page = await browser.newPage()
await page.goto(url)
await page.waitForFunction(() => window.film !== undefined)
await writeFile(join(outDir, 'sound-made-visible.en.vtt'), await page.evaluate(() => window.film.vtt()))

await browser.close()
server.close()
console.log(summary.join('\n'))
