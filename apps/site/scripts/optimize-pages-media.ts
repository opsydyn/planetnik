import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs"
import { basename, extname, join, resolve } from "node:path"

const VIDEO_PATTERN = /^movie(?:-(?:\d+|loop))?\.mp4$/
const AUDIO_PATTERN = /^Lightningcore\.mp3$/

const targetArg = process.argv[2] ?? "dist"
const targetDir = resolve(process.cwd(), targetArg)

if (!existsSync(targetDir)) {
  throw new Error(`Target directory does not exist: ${targetDir}`)
}

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" })
if (ffmpegCheck.status !== 0) {
  throw new Error("ffmpeg is required to optimize Pages media assets")
}

const files = readdirSync(targetDir)
const videoFiles = files.filter((file) => VIDEO_PATTERN.test(file)).sort()
const audioFiles = files.filter((file) => AUDIO_PATTERN.test(file)).sort()

type OptimizationResult = {
  file: string
  beforeBytes: number
  afterBytes: number
  changed: boolean
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function runFfmpeg(args: string[], inputPath: string) {
  const result = spawnSync("ffmpeg", args, {
    stdio: "inherit",
  })

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${inputPath}`)
  }
}

function replaceIfSmaller(inputPath: string, outputPath: string): OptimizationResult {
  const beforeBytes = statSync(inputPath).size
  const afterBytes = statSync(outputPath).size

  if (afterBytes < beforeBytes) {
    renameSync(outputPath, inputPath)
    return {
      file: basename(inputPath),
      beforeBytes,
      afterBytes,
      changed: true,
    }
  }

  rmSync(outputPath, { force: true })
  return {
    file: basename(inputPath),
    beforeBytes,
    afterBytes: beforeBytes,
    changed: false,
  }
}

function optimizeVideo(fileName: string): OptimizationResult {
  const inputPath = join(targetDir, fileName)
  const outputPath = join(targetDir, `${fileName.replace(/\.mp4$/, "")}.optimized${extname(fileName)}`)

  runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map_metadata",
      "-1",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "30",
      "-maxrate",
      "3M",
      "-bufsize",
      "6M",
      "-profile:v",
      "main",
      "-level",
      "4.0",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "scale=min(1280\\,iw):-2:force_original_aspect_ratio=decrease",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    inputPath,
  )

  return replaceIfSmaller(inputPath, outputPath)
}

function optimizeAudio(fileName: string): OptimizationResult {
  const inputPath = join(targetDir, fileName)
  const outputPath = join(targetDir, `${fileName.replace(/\.mp3$/, "")}.optimized${extname(fileName)}`)

  runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-vn",
      "-map_metadata",
      "-1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      outputPath,
    ],
    inputPath,
  )

  return replaceIfSmaller(inputPath, outputPath)
}

const results = [...videoFiles.map(optimizeVideo), ...audioFiles.map(optimizeAudio)]

const totalBefore = results.reduce((sum, result) => sum + result.beforeBytes, 0)
const totalAfter = results.reduce((sum, result) => sum + result.afterBytes, 0)

console.log(`Optimized ${results.length} GitHub Pages media asset(s) in ${targetDir}`)
for (const result of results) {
  const delta = result.beforeBytes - result.afterBytes
  console.log(
    `${result.changed ? "✓" : "-"} ${result.file}: ${formatMegabytes(result.beforeBytes)} -> ${formatMegabytes(result.afterBytes)}${result.changed ? ` (saved ${formatMegabytes(delta)})` : " (kept original)"}`,
  )
}
console.log(`Total: ${formatMegabytes(totalBefore)} -> ${formatMegabytes(totalAfter)}`)
