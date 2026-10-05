import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

/**
 * Extract plain text from an uploaded file.
 * Supports: PDF, TXT. DOC/DOCX falls back to raw buffer read.
 */
export const extractTextFromFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  const buffer = fs.readFileSync(filePath)

  if (ext === '.pdf') {
    const parsed = await pdfParse(buffer)
    return parsed.text.trim()
  }

  if (ext === '.txt') {
    return buffer.toString('utf-8').trim()
  }

  // For .doc/.docx – basic text extraction (no external libs needed for demo)
  return buffer.toString('utf-8', 0, 5000).replace(/[^\x20-\x7E\n]/g, ' ').trim()
}
