import { describe, expect, test } from "bun:test"
import { NamedSourceCodeAspect } from "../../../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../../../aspects/SourceFile.js"
import { DependencyUtils } from "../../../dependencies/DependencyUtils.js"
import { RustAnalyzer } from "../../RustAnalyzer.js"

describe("RustAnalyzer dependency extraction", () => {
  test("extracts grouped, aliased, and relative use declarations", () => {
    const analyzer = new RustAnalyzer()

    const taskFile = new SourceFile(
      "tokio/src/task/local.rs",
      ["use crate::sync::{oneshot, mpsc::Sender as MpscSender};", "use super::util::helper;", "pub fn local() {}"].join(
        "\n",
      ),
    )
    taskFile.linesOfCode = 3
    const taskComponent = new NamedSourceCodeAspect("task")
    taskComponent.filtering = "primary"
    taskFile.logicalComponents.push(taskComponent)

    const oneshotFile = new SourceFile("tokio/src/sync/oneshot.rs", "pub struct Receiver;")
    oneshotFile.linesOfCode = 1
    const syncComponent = new NamedSourceCodeAspect("sync")
    syncComponent.filtering = "primary"
    oneshotFile.logicalComponents.push(syncComponent)

    const mpscFile = new SourceFile("tokio/src/sync/mpsc.rs", "pub struct Sender;")
    mpscFile.linesOfCode = 1
    mpscFile.logicalComponents.push(syncComponent)

    const utilFile = new SourceFile("tokio/src/task/util.rs", "pub fn helper() {}")
    utilFile.linesOfCode = 1
    const supportComponent = new NamedSourceCodeAspect("support")
    supportComponent.filtering = "primary"
    utilFile.logicalComponents.push(supportComponent)

    const analysis = analyzer.extractDependencies([taskFile, oneshotFile, mpscFile, utilFile])

    expect(analysis.dependencies).toHaveLength(3)
    expect(analysis.dependencies.map((dependency) => dependency.to.anchor).sort()).toEqual([
      "tokio::sync::mpsc",
      "tokio::sync::oneshot",
      "tokio::task::util",
    ])

    const componentDependencies = DependencyUtils.getComponentDependencies(analysis.dependencies, "primary")

    expect(componentDependencies).toHaveLength(2)
    expect(
      componentDependencies.map((dependency) => `${dependency.fromComponent}->${dependency.toComponent}`).sort(),
    ).toEqual(["task->support", "task->sync"])
  })

  test("ignores unresolved external imports while keeping internal crate dependencies", () => {
    const analyzer = new RustAnalyzer()

    const localFile = new SourceFile(
      "tokio/src/task/local.rs",
      ["use std::time::Duration;", "use tokio::sync::oneshot::Receiver;", "pub fn local() {}"].join("\n"),
    )

    const oneshotFile = new SourceFile("tokio/src/sync/oneshot.rs", "pub struct Receiver;")

    const libFile = new SourceFile("tokio/src/lib.rs", "pub mod sync; pub mod task;")

    const analysis = analyzer.extractDependencies([localFile, oneshotFile, libFile])

    expect(analysis.dependencies).toHaveLength(1)
    expect(analysis.dependencies[0]?.to.anchor).toBe("tokio::sync::oneshot")
    expect(analysis.dependencies[0]?.fromFiles[0]?.codeFragment).toContain("use tokio::sync::oneshot::Receiver;")
  })
})
