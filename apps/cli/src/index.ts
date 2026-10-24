#!/usr/bin/env bun

// Płanetnik CLI — source code analysis tool

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { Effect, Layer } from "effect"
import { Command } from "effect/cli"
import { analyzeLandscapeCommand, LandscapeRepoWorkerLive } from "./commands/analyzeLandscape.js"
import { analyzeRemoteCommand } from "./commands/analyzeRemote.js"
import { exportConventionsCommand } from "./commands/exportConventions.js"
import { extractFilesCommand } from "./commands/extractFiles.js"
import { extractGitHistoryCommand } from "./commands/extractGitHistory.js"
import { extractGitSubHistoryCommand } from "./commands/extractGitSubHistory.js"
import { generateReportsCommand } from "./commands/generateReports.js"
import { initCommand } from "./commands/init.js"
import { initConventionsCommand } from "./commands/initConventions.js"
import { updateConfigCommand } from "./commands/updateConfig.js"
import { updateLandscapeCommand } from "./commands/updateLandscape.js"
import { CliConfig } from "./config.js"
import { PlanetnikLoggerLayer } from "./logger.js"

const command = Command.make("planetnik", {}, () =>
  Effect.log("Płanetnik — source code analysis tool. Use --help for available commands."),
).pipe(
  Command.withSubcommands([
    initCommand,
    generateReportsCommand,
    analyzeRemoteCommand,
    analyzeLandscapeCommand,
    extractGitHistoryCommand,
    extractGitSubHistoryCommand,
    extractFilesCommand,
    updateConfigCommand,
    updateLandscapeCommand,
    exportConventionsCommand,
    initConventionsCommand,
  ]),
)

const cli = Command.runWith(command, {
  version: "0.1.0",
})

const AppLayer = Layer.mergeAll(NodeServices.layer, PlanetnikLoggerLayer, CliConfig.layer, LandscapeRepoWorkerLive)

cli(process.argv.slice(2)).pipe(Effect.provide(AppLayer), NodeRuntime.runMain)
