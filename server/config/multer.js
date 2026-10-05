import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Store uploads in /server/uploads/resumes (auto-create if missing)
const uploadDir = './uploads/resumes'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, unique + path.extname(file.originalname))
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.txt']
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowed.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'), false)
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
})
