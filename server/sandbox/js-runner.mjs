/**
 * js-runner.mjs
 *
 * Executes ONE candidate submission against ONE test-case input.
 *
 * Never imported by the API: spawned as a separate Node process with an empty
 * environment, a throwaway working directory and a hard wall-clock limit.
 *
 * Isolation matters here, and `node:vm` alone is NOT one. Passing a plain
 * host object to `vm.createContext` leaves `this.constructor.constructor` on
 * the host realm, so `Function('return process')()` escapes and reads the
 * runner's environment:
 *
 *   vm.createContext({ console, result })            → escape succeeded
 *   vm.createContext(vm.constants.DONT_CONTEXTIFY)   → escape blocked
 *
 * This file therefore:
 *   - creates a genuine new realm (DONT_CONTEXTIFY) and fails closed on Node
 *     versions that cannot provide one;
 *   - injects NO host objects or functions (console is defined in-realm);
 *   - disables string code generation, which blocks eval/Function;
 *   - runs the submission in strict mode so `this` is undefined.
 *
 * Usage: node js-runner.mjs <path-to-submission> <json-input>
 * Output: a single JSON object on stdout — { ok, result } or { ok:false, error }
 */

import vm from 'node:vm'
import fs from 'node:fs'

const [filePath, rawInput] = process.argv.slice(2)

const emit = (payload) => {
  process.stdout.write(JSON.stringify(payload))
}

try {
  if (!filePath) throw new Error('No submission file provided')

  if (!vm.constants || vm.constants.DONT_CONTEXTIFY === undefined) {
    // Fail closed: never execute untrusted code with weaker isolation.
    throw new Error('This Node.js version cannot provide an isolated execution context')
  }

  const source = fs.readFileSync(filePath, 'utf8')

  // argv carries the input JSON-encoded (safe transport). Decode it to the
  // original string, then interpret it as a value when it is valid JSON — the
  // same rule the previous in-process executor used: "[1,2]" becomes an array,
  // "root=[...]" stays a string.
  let inputText
  try {
    inputText = JSON.parse(rawInput ?? '""')
  } catch {
    inputText = rawInput ?? ''
  }

  let parsedInput
  try {
    parsedInput = JSON.parse(String(inputText))
  } catch {
    parsedInput = inputText
  }

  const context = vm.createContext(vm.constants.DONT_CONTEXTIFY, {
    codeGeneration: { strings: false, wasm: false },
  })

  // Everything the candidate can touch is defined inside the new realm.
  vm.runInContext(
    `
    globalThis.console = {
      log: function () {}, error: function () {}, warn: function () {}, info: function () {}
    };
    globalThis.result = undefined;
    `,
    context,
    { timeout: 1000 }
  )

  const wrapped = `
"use strict";
${source}
;
if (typeof solution === 'function') {
  globalThis.result = solution(${JSON.stringify(parsedInput)});
} else {
  globalThis.result = '__NEXTHIRE_NO_SOLUTION__';
}
`

  vm.runInContext(wrapped, context, { timeout: 3000, displayErrors: true })

  const value = vm.runInContext(
    'typeof result === "undefined" || result === null ? null : String(result)',
    context,
    { timeout: 1000 }
  )

  emit({ ok: true, result: value })
} catch (err) {
  emit({ ok: false, error: String(err?.message || err).slice(0, 500) })
}
