#!/usr/bin/env bun
// Płanetnik CLI — source code analysis tool

import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { exportConventionsCommand } from "./commands/exportConventions.js"
import { extractGitHistoryCommand } from "./commands/extractGitHistory.js"
import { generateReportsCommand } from "./commands/generateReports.js"
import { initCommand } from "./commands/init.js"
import { initConventionsCommand } from "./commands/initConventions.js"
import { updateConfigCommand } from "./commands/updateConfig.js"

const command = Command.make("planetnik", {}, () =>
  Effect.log("Płanetnik — source code analysis tool. Use --help for available commands."),
).pipe(
  Command.withSubcommands([
    initCommand,
    generateReportsCommand,
    extractGitHistoryCommand,
    updateConfigCommand,
    exportConventionsCommand,
    initConventionsCommand,
  ]),
)

const cli = Command.run(command, {
  name: "Płanetnik",
  version: "0.1.0",
})

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
