/**
 * codingExecution.service.js
 *
 * Decides HOW candidate code runs and refuses to run what cannot be run.
 *
 *   javascript  → isolated child process (sandbox.service.js), no Judge0 needed
 *   everything else → Judge0 only, and only when it is configured
 *
 * There is deliberately no cross-language fallback: executing Python through a
 * JavaScript interpreter produced silent wrong answers scored as real zeros.
 */

import {
  executeCode,
  ExecutionUnavailableError,
  isJudge0Configured,
  isLanguageSupported,
  LANGUAGES,
} from './judge0.service.js'
import { runJavaScript } from './sandbox.service.js'

export const JS_LANGUAGE = 'javascript'

export const languageLabel = (language) => LANGUAGES[language]?.name || language

/**
 * Throw before grading anything if a requested language cannot execute.
 * @throws {ExecutionUnavailableError}
 */
export const assertExecutable = (languages = []) => {
  for (const language of new Set(languages)) {
    if (language === JS_LANGUAGE) continue

    if (!isLanguageSupported(language)) {
      throw new ExecutionUnavailableError(`Unsupported programming language: ${language}`, {
        reason: 'unsupported_language',
      })
    }
    if (!isJudge0Configured()) {
      throw new ExecutionUnavailableError(
        `${languageLabel(language)} execution requires Judge0, which is not configured on this server.`,
        { reason: 'not_configured' }
      )
    }
  }
}

/**
 * Run one test case through the correct runtime.
 *
 * @returns {Promise<{output: string, error: string|null}>} the candidate's output
 *          (`error` is set for a runtime/compile error in *their* code, which is
 *          graded as a failure, not as an infrastructure problem)
 * @throws  {ExecutionUnavailableError} when the runtime itself is unusable
 */
export const runTestCase = async ({ code, language, input }) => {
  if (language === JS_LANGUAGE) {
    const result = await runJavaScript({ code, input })
    return { output: result.output ?? '', error: result.error || null }
  }

  if (!isJudge0Configured()) {
    throw new ExecutionUnavailableError(
      `${languageLabel(language)} execution requires Judge0, which is not configured on this server.`,
      { reason: 'not_configured' }
    )
  }

  const execution = await executeCode({ code, languageKey: language, stdin: input })
  return {
    output: (execution.stdout || '').trim(),
    error: execution.compileOutput || execution.stderr || null,
  }
}

/** The language a candidate used for a given answer. */
export const answerLanguage = (answer) =>
  answer?.language ? String(answer.language) : JS_LANGUAGE
