import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

const SOURCE_VIDEO_PATTERN = /^movie(?:-\d+)?\.mp4$/
const OUTPUT_FILE_NAME = process.argv[3] ?? "movie-loop.mp4"
const targetArg = process.argv[2] ?? "public"
const targetDir = resolve(process.cwd(), targetArg)
const outputPath = join(targetDir, OUTPUT_FILE_NAME)

if (!existsSync(targetDir)) {
  throw new Error(`Target directory does not exist: ${targetDir}`)
}

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" })
if (ffmpegCheck.status !== 0) {
  throw new Error("ffmpeg is required to concatenate background video clips")
}

function getSortOrder(fileName: string) {
  if (fileName === "movie.mp4") return 1
  const match = fileName.match(/^movie-(\d+)\.mp4$/)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

const sourceFiles = readdirSync(targetDir)
  .filter((file) => SOURCE_VIDEO_PATTERN.test(file))
  .sort((left, right) => getSortOrder(left) - getSortOrder(right))

if (sourceFiles.length === 0) {
  throw new Error(`No background clips found in ${targetDir}`)
}

const tempDir = mkdtempSync(join(tmpdir(), "planetnik-video-concat-"))
const concatListPath = join(tempDir, "concat.txt")

try {
  const concatFileContents = sourceFiles
    .map((file) => {
      const absolutePath = join(targetDir, file)
      const escapedPath = absolutePath.replace(/'/g, "'\\''")
      return `file '${escapedPath}'`
    })
    .join("\n")

  writeFileSync(concatListPath, concatFileContents, "utf-8")

  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
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
    { stdio: "inherit" },
  )

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed while building ${outputPath}`)
  }

  const sizeBytes = statSync(outputPath).size
  console.log(
    `Built ${basename(outputPath)} from ${sourceFiles.length} clip(s): ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`,
  )
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
