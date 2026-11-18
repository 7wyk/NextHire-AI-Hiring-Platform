/**
 * sandbox.service.js
 *
 * Runs untrusted JavaScript in a **separate OS process** with an empty
 * environment, a throwaway working directory and a hard timeout.
 *
 * Why not `vm` in the API process: `node:vm` is not a security boundary — code
 * in it can reach the host realm and, from there, the API's environment and
 * credentials. Isolating the process (plus disabled string code generation in
 * the child) removes that path.
 *
 * When Judge0 is configured, callers prefer it for every language; this module
 * is the JavaScript runtime for installations without Judge0.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExecutionUnavailableError } from './judge0.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNNER_PATH = path.join(__dirname, '..', 'sandbox', 'js-runner.mjs')

const DEFAULT_TIMEOUT_MS = 5000
const MAX_OUTPUT_BYTES = 64 * 1024

export const SUPPORTED_LOCAL_LANGUAGES = ['javascript']

/**
 * Execute candidate JavaScript against one input.
 *
 * @returns {Promise<{ output: string }>}  candidate's program output
 * @throws  {ExecutionUnavailableError}    when the sandbox itself cannot run,
 *                                         so callers never grade it as wrong.
 */
export const runJavaScript = async ({ code, input = '', timeoutMs = DEFAULT_TIMEOUT_MS }) => {
  let dir
  let filePath

  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexthire-js-'))
    filePath = path.join(dir, 'submission.mjs')
    await fs.writeFile(filePath, String(code ?? ''), 'utf8')
  } catch (err) {
    throw new ExecutionUnavailableError('Could not prepare the execution sandbox', {
      reason: 'sandbox_unavailable',
      cause: err,
    })
  }

  const finish = async () => {
    try { await fs.rm(dir, { recursive: true, force: true }) } catch { /* best effort */ }
  }

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const child = spawn(process.execPath, [RUNNER_PATH, filePath, JSON.stringify(input ?? '')], {
      cwd: dir,
      env: {},                  // no API keys, no DB URI, no JWT secret
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,       // hard kill
    })

    const settle = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
      finish()
    }

    child.stdout.on('data', chunk => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString()
    })

    child.on('error', (err) => {
      settle(reject, new ExecutionUnavailableError('The execution sandbox could not start', {
        reason: 'sandbox_unavailable',
        cause: err,
      }))
    })

    child.on('close', (code, signal) => {
      if (settled) return

      if (signal === 'SIGTERM' && !stdout.trim()) {
        return settle(reject, new ExecutionUnavailableError(
          'Execution timed out before producing a result',
          { reason: 'timeout' }
        ))
      }

      let parsed = null
      try { parsed = JSON.parse(stdout) } catch { /* no structured output */ }

      if (!parsed) {
        return settle(reject, new ExecutionUnavailableError(
          `The execution sandbox produced no result${stderr ? `: ${stderr.slice(0, 200)}` : ''}`,
          { reason: 'sandbox_failed' }
        ))
      }

      // A runtime error in candidate code is a legitimate failure, not an
      // infrastructure problem: surface it as an error result to be graded.
      if (!parsed.ok) {
        return settle(resolve, { output: '', error: parsed.error || 'Execution error' })
      }

      return settle(resolve, {
        output: parsed.result === null ? '' : String(parsed.result),
        error: null,
      })
    })
  })
}
