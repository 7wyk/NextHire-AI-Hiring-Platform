import axios from 'axios'

// ─── Judge0 CE via RapidAPI ───────────────────────────────────────────────────
// Sign up free: https://rapidapi.com/judge0-official/api/judge0-ce
// Free plan: 50 submissions/day
// Set JUDGE0_API_KEY in your .env
const JUDGE0_URL    = process.env.JUDGE0_URL    || 'https://judge0-ce.p.rapidapi.com'
const JUDGE0_KEY    = process.env.JUDGE0_API_KEY || ''
const JUDGE0_HOST   = 'judge0-ce.p.rapidapi.com'

// Judge0 CE language IDs
// Full list: GET /languages on the Judge0 API
export const LANGUAGES = {
  javascript: { id: 63,  name: 'JavaScript (Node.js 12.14.0)' },
  python:     { id: 71,  name: 'Python 3 (3.8.1)'             },
  java:       { id: 62,  name: 'Java (OpenJDK 13.0.1)'        },
  cpp:        { id: 54,  name: 'C++ (GCC 9.2.0)'              },
  c:          { id: 50,  name: 'C (GCC 9.2.0)'                },
  typescript: { id: 74,  name: 'TypeScript (3.7.4)'           },
  go:         { id: 60,  name: 'Go (1.13.5)'                  },
  rust:       { id: 73,  name: 'Rust (1.40.0)'                },
  ruby:       { id: 72,  name: 'Ruby (2.7.0)'                 },
  csharp:     { id: 51,  name: 'C# (Mono 6.6.0.161)'          },
  php:        { id: 68,  name: 'PHP (7.4.1)'                  },
  swift:      { id: 83,  name: 'Swift (5.2.3)'                },
  kotlin:     { id: 78,  name: 'Kotlin (1.3.70)'              },
  r:          { id: 80,  name: 'R (4.0.0)'                    },
}

// Judge0 status IDs
// 1=Queued, 2=Processing, 3=Accepted, 4=Wrong Answer,
// 5=TLE, 6=Compilation Error, 7-12=Runtime Errors, 13=Internal Error
const STATUS_MAP = {
  3:  'Accepted',
  4:  'Wrong Answer',
  5:  'Time Limit Exceeded',
  6:  'Compilation Error',
  7:  'Runtime Error (SIGSEGV)',
  8:  'Runtime Error (SIGXFSZ)',
  9:  'Runtime Error (SIGFPE)',
  10: 'Runtime Error (SIGABRT)',
  11: 'Runtime Error (NZEC)',
  12: 'Runtime Error (Other)',
  13: 'Internal Error',
  14: 'Exec Format Error',
}

// Shared axios headers for all Judge0 requests
const judge0Headers = () => ({
  'Content-Type':      'application/json',
  'X-RapidAPI-Key':    JUDGE0_KEY,
  'X-RapidAPI-Host':   JUDGE0_HOST,
})

// ─── Submit to Judge0 ─────────────────────────────────────────────────────────
// Returns a token string
const submitToJudge0 = async ({ source_code, language_id, stdin }) => {
  const response = await axios.post(
    `${JUDGE0_URL}/submissions`,
    {
      source_code,
      language_id,
      stdin:        stdin || '',
      // Return plain text (not base64)
      base64_encoded: false,
    },
    {
      headers: judge0Headers(),
      params:  { base64_encoded: false, wait: false },
    }
  )
  return response.data.token
}

// ─── Poll Judge0 until result is ready ───────────────────────────────────────
// Retries up to maxAttempts every intervalMs milliseconds
const pollResult = async (token, maxAttempts = 10, intervalMs = 1500) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await axios.get(
      `${JUDGE0_URL}/submissions/${token}`,
      {
        headers: judge0Headers(),
        params:  { base64_encoded: false },
      }
    )

    const data = response.data
    const statusId = data.status?.id

    // Status < 3 means still queued or processing — keep polling
    if (statusId < 3) {
      await new Promise(r => setTimeout(r, intervalMs))
      continue
    }

    return data  // Done (accepted, error, TLE, etc.)
  }

  throw new Error('Judge0 polling timeout — execution took too long')
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: execute a single code run and return normalised result
// ─────────────────────────────────────────────────────────────────────────────
export const executeCode = async ({ code, languageKey, stdin = '' }) => {
  const lang = LANGUAGES[languageKey]
  if (!lang) throw new Error(`Unsupported language: ${languageKey}`)

  if (!JUDGE0_KEY) throw new Error('JUDGE0_API_KEY is not set in environment variables')

  try {
    // Step 1: Submit
    const token = await submitToJudge0({
      source_code: code,
      language_id: lang.id,
      stdin,
    })

    // Step 2: Poll for result
    const result = await pollResult(token)

    const statusId     = result.status?.id   ?? 0
    const statusDesc   = STATUS_MAP[statusId] ?? result.status?.description ?? 'Unknown'
    const accepted     = statusId === 3       // 3 = Accepted

    const stdout        = (result.stdout        || '').trim()
    const stderr        = (result.stderr        || '').trim()
    const compileOutput = (result.compile_output || '').trim()

    // Time is in seconds (string like "0.012"), memory in KB (integer)
    const time   = result.time   ? `${result.time}s`      : null
    const memory = result.memory ? `${result.memory} KB`  : null

    return {
      token,
      statusId,
      status:        statusDesc,
      accepted,
      stdout,
      stderr,
      compileOutput,
      time,
      memory,
    }
  } catch (err) {
    // Surface clean errors for 4xx from Judge0
    if (err.response?.status === 401) throw new Error('Invalid Judge0 API key')
    if (err.response?.status === 429) throw new Error('Judge0 rate limit reached — try again later')
    throw new Error(`Code execution failed: ${err.message}`)
  }
}
