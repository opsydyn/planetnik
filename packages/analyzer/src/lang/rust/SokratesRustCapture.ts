import { join, resolve } from "node:path"

export const SOKRATES_RUST_REFERENCE = {
  engine: "sokrates-java",
  repository: "https://github.com/zeljkoobrenovic/sokrates",
  commit: "f400eb7235a755146e854a1bf4bd90cbe1ee5086",
  analyzer: "nl.obren.sokrates.sourcecode.lang.rust.RustAnalyzer",
} as const

export const SOKRATES_RUST_CAPTURE_CLASS = "planetnik.capture.SokratesRustCapture"
export const SOKRATES_CAPTURE_DOCKER_IMAGE =
  "maven:3.9.9-eclipse-temurin-17@sha256:f58d59b6273e785ac0a4477f6e9b5ba1d7731c75b906c0f7b34076f1851318cc"

export interface SokratesRustCapturePlanOptions {
  readonly sokratesRoot: string
  readonly fixturePath: string
  readonly outputPath: string
  readonly actualCommit?: string
  readonly javaExecutable?: string
  readonly javacExecutable?: string
  readonly mavenExecutable?: string
}

export interface SokratesRustCapturePlan {
  readonly sokratesRoot: string
  readonly fixturePath: string
  readonly outputPath: string
  readonly buildCommand: readonly string[]
  readonly harnessClassName: typeof SOKRATES_RUST_CAPTURE_CLASS
  readonly harnessMainClass: typeof SOKRATES_RUST_CAPTURE_CLASS
  readonly cliJarPath: string
  readonly javaExecutable: string
  readonly javacExecutable: string
  readonly mavenExecutable: string
}

export function buildSokratesRustCapturePlan(options: SokratesRustCapturePlanOptions): SokratesRustCapturePlan {
  const sokratesRoot = resolve(options.sokratesRoot)
  const fixturePath = resolve(options.fixturePath)
  const outputPath = resolve(options.outputPath)

  if (options.actualCommit !== undefined && options.actualCommit !== SOKRATES_RUST_REFERENCE.commit) {
    throw new Error(
      `Sokrates checkout must use the pinned Sokrates commit ${SOKRATES_RUST_REFERENCE.commit}; found ${options.actualCommit}`,
    )
  }

  const javaExecutable = options.javaExecutable ?? "java"
  const javacExecutable = options.javacExecutable ?? "javac"
  const mavenExecutable = options.mavenExecutable ?? "mvn"

  return {
    sokratesRoot,
    fixturePath,
    outputPath,
    buildCommand: [mavenExecutable, "-q", "-DskipTests", "package"],
    harnessClassName: SOKRATES_RUST_CAPTURE_CLASS,
    harnessMainClass: SOKRATES_RUST_CAPTURE_CLASS,
    cliJarPath: join(sokratesRoot, "cli", "target", "cli-1.0-jar-with-dependencies.jar"),
    javaExecutable,
    javacExecutable,
    mavenExecutable,
  }
}

export function formatMissingSokratesRustCapturePrerequisites(missing: readonly string[]): string {
  return [
    "Sokrates Rust runtime capture cannot run because required prerequisites are missing:",
    ...missing.map((item) => `- ${item}`),
    "Provide a Java 17+ and Maven-enabled checkout at the pinned commit, then retry.",
    `Reference: ${SOKRATES_RUST_REFERENCE.repository}@${SOKRATES_RUST_REFERENCE.commit}`,
  ].join("\n")
}
