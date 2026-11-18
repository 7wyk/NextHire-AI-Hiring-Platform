/**
 * recomputeCandidateTotals.js
 *
 * Controlled migration for Phase 2(D): recalculate every stored
 * `Candidate.totalScore` from that row's actual component scores using the one
 * shared formula.
 *
 * Guarantees:
 *   - Only `totalScore` is ever written. IDs, ownership, applications,
 *     component scores and assessment results are untouched.
 *   - A JSON backup of every row's previous total is written before any change,
 *     and `--restore <file>` puts those totals back.
 *   - Idempotent: rows already matching the formula are skipped, so running it
 *     twice changes nothing the second time.
 *   - Missing component scores stay zero (they are never invented).
 *
 * Usage (from server/):
 *   node scripts/recomputeCandidateTotals.js            # dry run, writes a report only
 *   node scripts/recomputeCandidateTotals.js --apply    # writes totalScore
 *   node scripts/recomputeCandidateTotals.js --restore backups/candidate-totals-XXX.json
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Candidate from '../models/Candidate.js'
import { weightedTotal, SCORE_WEIGHTS } from '../services/candidateProfile.service.js'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const restoreIdx = args.indexOf('--restore')
const restoreFile = restoreIdx >= 0 ? args[restoreIdx + 1] : null

const BACKUP_DIR = path.resolve('backups')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

const fieldSnapshot = (doc) => ({
  _id: String(doc._id),
  email: doc.email,
  job: String(doc.job || ''),
  resumeScore: Number(doc.resumeScore) || 0,
  codeScore: Number(doc.codeScore) || 0,
  interviewScore: Number(doc.interviewScore) || 0,
})

const main = async () => {
  await connectDB()

  // ── Restore mode ─────────────────────────────────────────────────────────
  if (restoreFile) {
    const payload = JSON.parse(fs.readFileSync(restoreFile, 'utf8'))
    let restored = 0
    for (const row of payload.rows || []) {
      const result = await Candidate.updateOne(
        { _id: row._id },
        { $set: { totalScore: row.stored } }
      )
      restored += result.modifiedCount || 0
    }
    console.log(`Restored totalScore on ${restored} candidate row(s) from ${restoreFile}`)
    await mongoose.disconnect()
    return
  }

  // ── Recompute mode ───────────────────────────────────────────────────────
  const docs = await Candidate.find({})
    .select('_id email job resumeScore codeScore interviewScore totalScore')
    .lean()

  const rows = docs.map(doc => {
    const expected = weightedTotal(doc)
    const stored = Number(doc.totalScore) || 0
    return {
      ...fieldSnapshot(doc),
      stored,
      expected,
      changed: stored !== expected,
    }
  })

  const changes = rows.filter(row => row.changed)

  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const reportPath = path.join(
    BACKUP_DIR,
    `candidate-totals-${stamp}${apply ? '' : '-dry-run'}.json`
  )
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        formula: SCORE_WEIGHTS,
        mode: apply ? 'apply' : 'dry-run',
        rows,
      },
      null,
      2
    )
  )

  console.log(`Formula: resume ${SCORE_WEIGHTS.resume} / code ${SCORE_WEIGHTS.code} / interview ${SCORE_WEIGHTS.interview}`)
  console.log(`Candidates scanned: ${rows.length} — needing change: ${changes.length}`)
  for (const row of changes) {
    console.log(`  ${row.email || row._id} (job ${row.job}): ${row.stored} → ${row.expected}`)
  }
  console.log(`Report/backup written: ${reportPath}`)

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to persist these totals.')
    await mongoose.disconnect()
    return
  }

  for (const row of changes) {
    await Candidate.updateOne({ _id: row._id }, { $set: { totalScore: row.expected } })
  }

  // Verify: every row now equals the formula result
  const after = await Candidate.find({}).select('_id resumeScore codeScore interviewScore totalScore').lean()
  const mismatched = after.filter(doc => Number(doc.totalScore) !== weightedTotal(doc))
  console.log(`\nApplied. Rows updated: ${changes.length}. Rows still mismatched: ${mismatched.length}`)
  if (mismatched.length > 0) {
    console.error('Mismatch after migration:', mismatched.map(m => String(m._id)))
    process.exitCode = 1
  }

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('[recomputeCandidateTotals] failed:', err.message)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
