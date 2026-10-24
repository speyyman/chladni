#!/usr/bin/env node
// End to end: renders stretches of the film through the real pipeline (Chromium canvas -> PNG -> ffmpeg).
// The sand is a simulation, so a frame is rebuilt by replaying from the start of its plate's part. This
// checks that (1) the same stretch rendered twice is identical byte for byte, (2) a stretch started
// part-way through matches the same frames rendered as part of a longer run, and (3) the video probes
// as H.264 at the right size. Run after `npm run build`.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('..', import.meta.url))
const render = (out, ...extra) =>
  execFileSync(process.execPath, ['scripts/render.mjs', '--out', out, ...extra], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
const lines = (file) => readFileSync(file, 'utf8').trim().split('\n')
const name = 'sound-made-visible-1920x1080'

render('out-e2e/a', '--only', 'landscape', '--from', '400', '--to', '440')
render('out-e2e/b', '--only', 'landscape', '--from', '400', '--to', '440')
render('out-e2e/c', '--only', 'landscape', '--from', '420', '--to', '440')
const a = lines(`${root}out-e2e/a/${name}.frames.sha256`)
const b = lines(`${root}out-e2e/b/${name}.frames.sha256`)
const c = lines(`${root}out-e2e/c/${name}.frames.sha256`)
assert.equal(a.length, 40)
assert.deepEqual(a, b, 'two renders differ')
console.log('ok 40 frames identical across two renders')
assert.deepEqual(c, a.slice(20), 'a stretch started part-way differs from the same frames in a longer run')
console.log('ok frames 420-439 are the same whether rendering starts at 400 or at 420')

const probe = JSON.parse(
  execFileSync(
    process.env.FFPROBE ?? 'ffprobe',
    ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', `${root}out-e2e/a/${name}.mp4`],
    {
      encoding: 'utf8',
    },
  ),
).streams[0]
assert.equal(probe.codec_name, 'h264')
assert.equal(probe.width, 1920)
assert.equal(probe.height, 1080)
assert.equal(Number(probe.nb_read_frames), 40)
console.log(`ok ${probe.codec_name} ${probe.width}x${probe.height}, ${probe.nb_read_frames} frames`)
assert.match(readFileSync(`${root}out-e2e/a/sound-made-visible.en.vtt`, 'utf8'), /^WEBVTT\n\n1\n00:00:00\.500 --> /)
console.log('ok captions')
rmSync(`${root}out-e2e`, { recursive: true, force: true })
