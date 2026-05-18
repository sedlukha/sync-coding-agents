import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliEntry = resolve(__dirname, "..", "src", "index.ts")

test("CLI runs against an empty directory without crashing", (t) => {
  const tmp = resolve(__dirname, "fixtures-empty")
  const result = spawnSync("npx", ["tsx", cliEntry, tmp], {
    encoding: "utf8",
  })
  assert.equal(result.status, 0, `stderr: ${result.stderr}`)
})
