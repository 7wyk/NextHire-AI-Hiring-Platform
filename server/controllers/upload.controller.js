import fs from 'fs'
import { uploadFile, getFileUrl } from '../services/cloudinary.service.js'
import Candidate from '../models/Candidate.js'
import logger from '../config/logger.js'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload/resume
// multipart/form-data  |  field: "resume"  |  PDF / DOC / DOCX / TXT (max 5 MB)
//
// Optional body fields:
//   candidateId  – link uploaded file to an existing Candidate document
//
// Returns:
//   { publicId, url, candidateId? }
// ─────────────────────────────────────────────────────────────────────────────
export const uploadResume = async (req, res) => {
  const filePath = req.file?.path

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Resume file is required (PDF, DOC, DOCX or TXT)' })
    }

    // 1. Upload to Cloudinary (or local fallback)
    const { publicId, url } = await uploadFile(filePath, 'resumes')

    // 2. If a candidateId was provided, persist the URL
    let candidate = null
    if (req.body.candidateId) {
      candidate = await Candidate.findByIdAndUpdate(
        req.body.candidateId,
        {
          resumeUrl:      url,
          resumePublicId: publicId,
        },
        { new: true, select: '_id name email resumeUrl resumePublicId' },
      )
    }

    // 3. Clean up temp file from disk
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)

    logger.info('[Upload] Resume uploaded', {
      publicId,
      uploadedBy: req.user._id,
      candidateId: req.body.candidateId || null,
    })

    return res.status(201).json({
      message:  'Resume uploaded successfully',
      publicId,
      url,
      ...(candidate && { candidate }),
    })
  } catch (err) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    logger.error('[Upload] Resume upload failed', { error: err.message })
    return res.status(500).json({ message: err.message || 'Upload failed' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/upload/resume/:candidateId/url
// Get the resume URL for a candidate.
// Returns: { url }
// ─────────────────────────────────────────────────────────────────────────────
export const getResumeUrl = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId)
      .select('resumePublicId resumeUrl name')

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' })
    }
    if (!candidate.resumeUrl && !candidate.resumePublicId) {
      return res.status(404).json({ message: 'No resume found for this candidate' })
    }

    // If stored as Cloudinary publicId, regenerate URL; otherwise return stored URL
    const url = candidate.resumePublicId
      ? getFileUrl(candidate.resumePublicId)
      : candidate.resumeUrl

    return res.json({
      url,
      candidate: candidate.name,
    })
  } catch (err) {
    logger.error('[Upload] URL generation failed', { error: err.message })
    return res.status(500).json({ message: err.message })
  }
}
