#!/usr/bin/env bun
// Płanetnik CLI — source code analysis tool

import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

// Placeholder — commands will be added in Step 8
const command = Command.make("planetnik", {}, () =>
  Effect.log("Płanetnik — source code analysis tool. Use --help for commands."),
)

const cli = Command.run(command, {
  name: "Płanetnik",
  version: "0.1.0",
})

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
