/**
 * reconcileApplicantCounts.js
 *
 * `job.applicantCount` is a cached counter. Resume screening used to increment
 * it even when nobody applied (BE-08), so it can drift above the real number of
 * applications.
 *
 * The Application collection is authoritative. This script reports every
 * mismatch and, with --apply, rewrites the counter from an aggregation.
 *
 *   node scripts/reconcileApplicantCounts.js           # dry run (default)
 *   node scripts/reconcileApplicantCounts.js --apply   # write the counts
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Job from '../models/Job.js'
import Application from '../models/Application.js'

const apply = process.argv.includes('--apply')

const run = async () => {
  await connectDB()

  const [jobs, grouped] = await Promise.all([
    Job.find({}).select('_id title applicantCount').lean(),
    Application.aggregate([{ $group: { _id: '$job', count: { $sum: 1 } } }]),
  ])

  const counts = new Map(grouped.map((row) => [String(row._id), row.count]))

  const mismatches = []
  for (const job of jobs) {
    const actual = counts.get(String(job._id)) || 0
    const stored = Number(job.applicantCount) || 0
    if (actual !== stored) {
      mismatches.push({ job, actual, stored })
    }
  }

  console.log(`Scanned ${jobs.length} job(s). Mismatches: ${mismatches.length}`)

  for (const { job, actual, stored } of mismatches) {
    console.log(
      `  ${job.title || '(untitled)'} [${job._id}] stored=${stored} actual=${actual}`
    )
  }

  if (mismatches.length === 0) {
    console.log('No changes needed.')
    await mongoose.disconnect()
    return
  }

  if (!apply) {
    console.log('\nDry run — re-run with --apply to write the reconciled counts.')
    await mongoose.disconnect()
    return
  }

  for (const { job, actual } of mismatches) {
    await Job.updateOne({ _id: job._id }, { $set: { applicantCount: actual } })
  }
  console.log(`\nUpdated ${mismatches.length} job counter(s).`)

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error('Reconciliation failed:', err.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
