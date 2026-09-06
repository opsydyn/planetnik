import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import {
  buildSokratesRustCapturePlan,
  formatMissingSokratesRustCapturePrerequisites,
  SOKRATES_CAPTURE_DOCKER_IMAGE,
  SOKRATES_RUST_REFERENCE,
  type SokratesRustCapturePlan,
} from "../src/lang/rust/SokratesRustCapture.js"
import { SOKRATES_RUST_METRIC_POLICY } from "../src/lang/rust/SokratesRustMetricPolicy.js"

interface ProcessResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

interface RustFixture {
  readonly fixtureVersion: number
  readonly id: string
  readonly source: {
    readonly relativePath: string
    readonly language: string
    readonly content: string
  }
  readonly reference: Record<string, unknown>
}

interface RuntimeUnit {
  readonly shortName: string
  readonly startLine: number
  readonly endLine: number
  readonly linesOfCode: number
  readonly mcCabeIndex: number
  readonly numberOfParameters: number
  readonly numberOfLiterals?: number
  readonly numberOfStatements?: number
  readonly numberOfExpressions?: number
}

interface RuntimeCapture {
  readonly units: readonly RuntimeUnit[]
  readonly dependencyPaths: readonly string[]
}

export interface CaptureArguments {
  readonly sokratesRoot: string
  readonly fixturePath: string
  readonly outputPath: string
  readonly javaExecutable?: string
  readonly javacExecutable?: string
  readonly mavenExecutable?: string
  readonly docker?: boolean
}

const decoder = new TextDecoder()
const analyzerRoot = resolve(import.meta.dir, "..")
const repositoryRoot = resolve(analyzerRoot, "../..")
const defaultFixturePath = resolve(analyzerRoot, "src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1.json")

function run(command: readonly string[], cwd: string): ProcessResult {
  let result: ReturnType<typeof Bun.spawnSync>
  try {
    result = Bun.spawnSync([...command], { cwd, stdout: "pipe", stderr: "pipe" })
  } catch (error) {
    throw new Error(
      `Could not execute ${command[0] ?? "command"}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const stdout = decoder.decode(result.stdout)
  const stderr = decoder.decode(result.stderr)
  if (result.exitCode !== 0) {
    const details = (stderr || stdout).trim()
    throw new Error(`Command failed (${result.exitCode}): ${command.join(" ")}${details ? `\n${details}` : ""}`)
  }

  return { stdout, stderr, exitCode: result.exitCode }
}

function executableAvailable(executable: string, versionArguments: readonly string[]): boolean {
  if (executable.includes("/") && !existsSync(executable)) {
    return false
  }

  if (!executable.includes("/") && !Bun.which(executable)) {
    return false
  }

  try {
    return Bun.spawnSync([executable, ...versionArguments], { stdout: "ignore", stderr: "ignore" }).exitCode === 0
  } catch {
    return false
  }
}

function readHeadCommit(sokratesRoot: string): string | undefined {
  try {
    return run(["git", "rev-parse", "HEAD"], sokratesRoot).stdout.trim() || undefined
  } catch {
    return undefined
  }
}

function readFixture(fixturePath: string): RustFixture {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as RustFixture
  if (
    fixture.fixtureVersion !== 1 ||
    fixture.source.language !== "rust" ||
    typeof fixture.source.content !== "string" ||
    typeof fixture.source.relativePath !== "string"
  ) {
    throw new Error(`Unsupported Rust capture fixture: ${fixturePath}`)
  }
  return fixture
}

function validateRuntimeCapture(value: unknown, path: string): RuntimeCapture {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Java capture at ${path} is not an object`)
  }

  const candidate = value as { readonly units?: unknown; readonly dependencyPaths?: unknown }
  if (!Array.isArray(candidate.units) || !Array.isArray(candidate.dependencyPaths)) {
    throw new Error(`Java capture at ${path} is missing units or dependencyPaths`)
  }

  for (const [index, unit] of candidate.units.entries()) {
    if (
      typeof unit !== "object" ||
      unit === null ||
      typeof (unit as { shortName?: unknown }).shortName !== "string" ||
      typeof (unit as { startLine?: unknown }).startLine !== "number" ||
      typeof (unit as { endLine?: unknown }).endLine !== "number" ||
      typeof (unit as { linesOfCode?: unknown }).linesOfCode !== "number" ||
      typeof (unit as { mcCabeIndex?: unknown }).mcCabeIndex !== "number" ||
      typeof (unit as { numberOfParameters?: unknown }).numberOfParameters !== "number"
    ) {
      throw new Error(`Java capture at ${path} has an invalid unit at index ${index}`)
    }
  }

  if (candidate.dependencyPaths.some((dependency) => typeof dependency !== "string")) {
    throw new Error(`Java capture at ${path} has a non-string dependency path`)
  }

  return {
    units: candidate.units as RuntimeUnit[],
    dependencyPaths: candidate.dependencyPaths as string[],
  }
}

function normalizeRustUnitName(shortName: string): string {
  const match = /^fn\s+(.+?)\(\)$/.exec(shortName.trim())
  return match?.[1] ?? shortName.trim()
}

function dockerRun(plan: SokratesRustCapturePlan, temporaryRoot: string, command: readonly string[]): ProcessResult {
  return run(
    [
      "docker",
      "run",
      "--rm",
      "-v",
      `${plan.sokratesRoot}:/workspace/sokrates`,
      "-v",
      `${temporaryRoot}:/workspace/capture`,
      SOKRATES_CAPTURE_DOCKER_IMAGE,
      ...command,
    ],
    temporaryRoot,
  )
}

function buildSokrates(plan: SokratesRustCapturePlan, docker: boolean): void {
  if (!docker) {
    run(plan.buildCommand, plan.sokratesRoot)
    return
  }

  run(
    [
      "docker",
      "run",
      "--rm",
      "-v",
      `${plan.sokratesRoot}:/workspace/sokrates`,
      "-w",
      "/workspace/sokrates",
      SOKRATES_CAPTURE_DOCKER_IMAGE,
      "mvn",
      "-q",
      "-DskipTests",
      "package",
    ],
    plan.sokratesRoot,
  )
}

function javaVersion(plan: SokratesRustCapturePlan, docker: boolean, temporaryRoot: string): string {
  const version = docker
    ? run(["docker", "run", "--rm", SOKRATES_CAPTURE_DOCKER_IMAGE, "java", "-version"], temporaryRoot)
    : run([plan.javaExecutable, "-version"], plan.sokratesRoot)
  return (version.stderr || version.stdout).split(/\r?\n/)[0]?.trim() ?? "unknown"
}

function captureRuntime(
  plan: SokratesRustCapturePlan,
  fixture: RustFixture,
  docker: boolean,
): { capture: RuntimeCapture; java: string } {
  const temporaryBase = docker ? repositoryRoot : tmpdir()
  const temporaryRoot = mkdtempSync(join(temporaryBase, ".tmp-sokrates-rust-capture-"))

  try {
    const sourcePath = join(temporaryRoot, fixture.source.relativePath)
    mkdirSync(dirname(sourcePath), { recursive: true })
    writeFileSync(sourcePath, fixture.source.content, "utf8")

    const harnessSourcePath = join(temporaryRoot, "SokratesRustCapture.java")
    writeFileSync(harnessSourcePath, readFileSync(join(import.meta.dir, "SokratesRustCapture.java"), "utf8"), "utf8")

    const harnessClassesPath = join(temporaryRoot, "classes")
    mkdirSync(harnessClassesPath, { recursive: true })
    const compileCommand = [
      docker ? "javac" : plan.javacExecutable,
      "-cp",
      docker ? "/workspace/sokrates/cli/target/cli-1.0-jar-with-dependencies.jar" : plan.cliJarPath,
      "-d",
      docker ? "/workspace/capture/classes" : harnessClassesPath,
      docker ? "/workspace/capture/SokratesRustCapture.java" : harnessSourcePath,
    ]
    if (docker) {
      dockerRun(plan, temporaryRoot, compileCommand)
    } else {
      run(compileCommand, temporaryRoot)
    }

    const rawCapturePath = join(temporaryRoot, "runtime-capture.json")
    const classpathSeparator = process.platform === "win32" ? ";" : ":"
    const containerSourcePath = `/workspace/capture/${fixture.source.relativePath.replace(/\\/g, "/")}`
    const runCommand = [
      docker ? "java" : plan.javaExecutable,
      "-cp",
      docker
        ? "/workspace/capture/classes:/workspace/sokrates/cli/target/cli-1.0-jar-with-dependencies.jar"
        : `${harnessClassesPath}${classpathSeparator}${plan.cliJarPath}`,
      plan.harnessMainClass,
      docker ? containerSourcePath : sourcePath,
      docker ? "/workspace/capture/runtime-capture.json" : rawCapturePath,
    ]
    if (docker) {
      dockerRun(plan, temporaryRoot, runCommand)
    } else {
      run(runCommand, temporaryRoot)
    }

    const capture = validateRuntimeCapture(JSON.parse(readFileSync(rawCapturePath, "utf8")), rawCapturePath)
    return { capture, java: javaVersion(plan, docker, temporaryRoot) }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

function buildFixture(fixture: RustFixture, capture: RuntimeCapture, java: string, docker: boolean): RustFixture {
  return {
    ...fixture,
    reference: {
      ...fixture.reference,
      engine: SOKRATES_RUST_REFERENCE.engine,
      repository: SOKRATES_RUST_REFERENCE.repository,
      commit: SOKRATES_RUST_REFERENCE.commit,
      analyzer: SOKRATES_RUST_REFERENCE.analyzer,
      captureMethod: "runtime-executed-java-harness",
      runtimeExecuted: true,
      sourcePathSemantics: SOKRATES_RUST_METRIC_POLICY.authoritativeSourcePathSemantics,
      notes:
        "Captured by running the pinned Sokrates RustAnalyzer through a disposable Java harness against the source's real file extension.",
      runtime: docker ? { java, dockerImage: SOKRATES_CAPTURE_DOCKER_IMAGE } : { java },
      metricPolicy: SOKRATES_RUST_METRIC_POLICY,
      units: capture.units,
      normalizedSnapshot: {
        unitNames: capture.units.map((unit) => normalizeRustUnitName(unit.shortName)),
        dependencyPaths: capture.dependencyPaths,
      },
    },
  }
}

export function captureSokratesRust(options: CaptureArguments): void {
  const sokratesRoot = resolve(options.sokratesRoot)
  const fixturePath = resolve(options.fixturePath)
  const docker = options.docker === true
  const actualCommit = existsSync(sokratesRoot) ? readHeadCommit(sokratesRoot) : undefined
  const missing: string[] = []

  if (!existsSync(sokratesRoot)) {
    missing.push(`Sokrates checkout not found at ${sokratesRoot}`)
  } else if (!actualCommit) {
    missing.push(`Sokrates checkout at ${sokratesRoot} is not a readable Git worktree`)
  } else if (actualCommit !== SOKRATES_RUST_REFERENCE.commit) {
    missing.push(`Sokrates checkout is at ${actualCommit}; expected pinned commit ${SOKRATES_RUST_REFERENCE.commit}`)
  }

  if (docker) {
    if (!executableAvailable("docker", ["version", "--format", "{{.Server.Version}}"])) {
      missing.push("Docker is not available or its daemon is not reachable")
    }
  } else {
    if (!executableAvailable(options.javaExecutable ?? "java", ["-version"])) {
      missing.push(
        `Java executable '${options.javaExecutable ?? "java"}' was not found or is not runnable (JDK 17+ required)`,
      )
    }
    if (!executableAvailable(options.javacExecutable ?? "javac", ["-version"])) {
      missing.push(`javac executable '${options.javacExecutable ?? "javac"}' was not found or is not runnable`)
    }
    if (!executableAvailable(options.mavenExecutable ?? "mvn", ["--version"])) {
      missing.push(`Maven executable '${options.mavenExecutable ?? "mvn"}' was not found or is not runnable`)
    }
  }
  if (!existsSync(fixturePath)) {
    missing.push(`Rust capture fixture not found at ${fixturePath}`)
  }

  if (missing.length > 0) {
    throw new Error(formatMissingSokratesRustCapturePrerequisites(missing))
  }

  const fixture = readFixture(fixturePath)

  let plan: SokratesRustCapturePlan
  try {
    plan = buildSokratesRustCapturePlan({
      sokratesRoot,
      fixturePath: options.fixturePath,
      outputPath: options.outputPath,
      actualCommit,
      javaExecutable: options.javaExecutable,
      javacExecutable: options.javacExecutable,
      mavenExecutable: options.mavenExecutable,
    })
  } catch (error) {
    throw new Error(
      formatMissingSokratesRustCapturePrerequisites([error instanceof Error ? error.message : String(error)]),
    )
  }

  buildSokrates(plan, docker)
  if (!existsSync(plan.cliJarPath)) {
    throw new Error(
      formatMissingSokratesRustCapturePrerequisites([`Sokrates build completed without producing ${plan.cliJarPath}`]),
    )
  }

  const runtime = captureRuntime(plan, fixture, docker)
  const output = buildFixture(fixture, runtime.capture, runtime.java, docker)
  mkdirSync(dirname(plan.outputPath), { recursive: true })
  writeFileSync(plan.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8")
  console.log(
    JSON.stringify(
      {
        captureVersion: 1,
        runtimeExecuted: true,
        commit: SOKRATES_RUST_REFERENCE.commit,
        units: runtime.capture.units.length,
        dependencies: runtime.capture.dependencyPaths.length,
        executionMode: docker ? "docker" : "local",
        outputPath: plan.outputPath,
      },
      null,
      2,
    ),
  )
}

function parseArguments(args: readonly string[]): CaptureArguments {
  let sokratesRoot: string | undefined
  let fixturePath = defaultFixturePath
  let outputPath: string | undefined
  let javaExecutable: string | undefined
  let javacExecutable: string | undefined
  let mavenExecutable: string | undefined
  let docker = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--sokrates-root") {
      sokratesRoot = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--fixture") {
      fixturePath = args[index + 1] ?? ""
      index += 1
      continue
    }
    if (argument === "--output") {
      outputPath = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--java") {
      javaExecutable = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--javac") {
      javacExecutable = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--maven") {
      mavenExecutable = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--docker") {
      docker = true
      continue
    }
    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: bun run packages/analyzer/scripts/capture-sokrates-rust.ts --sokrates-root <path> --output <path> [--fixture <path>] [--docker] [--java <path>] [--javac <path>] [--maven <path>]",
      )
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  const resolvedSokratesRoot = sokratesRoot ?? process.env.SOKRATES_ROOT
  if (!resolvedSokratesRoot) {
    throw new Error("--sokrates-root is required (or set SOKRATES_ROOT)")
  }
  if (!outputPath) {
    throw new Error("--output is required; the historical fixture is never overwritten implicitly")
  }

  return {
    sokratesRoot: resolvedSokratesRoot,
    fixturePath,
    outputPath,
    javaExecutable,
    javacExecutable,
    mavenExecutable,
    docker,
  }
}

if (import.meta.main) {
  try {
    captureSokratesRust(parseArguments(Bun.argv.slice(2)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
