/**
 * cloudinary.service.js
 *
 * File storage service with Cloudinary integration + local fallback.
 *
 * If CLOUDINARY_CLOUD_NAME is set → uploads to Cloudinary.
 * If not → serves files from local /uploads/ directory.
 *
 * Both modes return the same shape: { publicId, url }
 */

import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'
import logger from '../config/logger.js'

// ── State ────────────────────────────────────────────────────────────────────
let configured = false

const init = () => {
  if (configured) return
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env

  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key:    CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    })
    configured = true
    logger.info('[Cloudinary] Configured successfully')
  } else {
    logger.warn('[Cloudinary] Credentials not set — using local file storage fallback')
  }
}

/**
 * Check if Cloudinary is available
 */
export const isCloudinaryReady = () => {
  init()
  return configured
}

/**
 * Upload a file (PDF, image, etc.)
 *
 * @param {string} filePath   - Absolute path to local temp file
 * @param {string} folder     - Cloudinary folder (e.g. 'resumes', 'avatars')
 * @returns {{ publicId: string, url: string }}
 */
export const uploadFile = async (filePath, folder = 'uploads') => {
  init()

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('File not found at path: ' + filePath)
  }

  // ── Cloudinary mode ────────────────────────────────────────────────────
  if (configured) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder:        `nexthire/${folder}`,
        resource_type: 'auto',          // auto-detect PDF, images, etc.
        access_mode:   'authenticated',  // not publicly listable
      })

      logger.info('[Cloudinary] File uploaded', {
        publicId: result.public_id,
        bytes:    result.bytes,
      })

      return {
        publicId: result.public_id,
        url:      result.secure_url,
      }
    } catch (err) {
      logger.error('[Cloudinary] Upload failed, falling back to local', { error: err.message })
      // Fall through to local storage
    }
  }

  // ── Local fallback ─────────────────────────────────────────────────────
  const uploadsDir = path.resolve('uploads', folder)
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  const filename = `${Date.now()}-${path.basename(filePath)}`
  const destPath = path.join(uploadsDir, filename)
  fs.copyFileSync(filePath, destPath)

  const localUrl = `/uploads/${folder}/${filename}`

  logger.info('[Storage] File saved locally', { path: localUrl })

  return {
    publicId: localUrl,   // use path as identifier in local mode
    url:      localUrl,
  }
}

/**
 * Get a file URL (Cloudinary optimized URL or local path)
 *
 * @param {string} publicId - Cloudinary public_id or local path
 * @returns {string}
 */
export const getFileUrl = (publicId) => {
  if (!publicId) return ''

  // Local path starts with /
  if (publicId.startsWith('/')) return publicId

  // Cloudinary URL
  if (configured) {
    return cloudinary.url(publicId, {
      secure: true,
      resource_type: 'auto',
    })
  }

  return publicId
}

/**
 * Delete a file from Cloudinary or local storage
 *
 * @param {string} publicId - Cloudinary public_id or local path
 */
export const deleteFile = async (publicId) => {
  if (!publicId) return

  init()

  // Local file
  if (publicId.startsWith('/')) {
    const fullPath = path.resolve('.' + publicId)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      logger.info('[Storage] Local file deleted', { path: publicId })
    }
    return
  }

  // Cloudinary file
  if (configured) {
    try {
      await cloudinary.uploader.destroy(publicId)
      logger.info('[Cloudinary] File deleted', { publicId })
    } catch (err) {
      logger.error('[Cloudinary] Delete failed', { publicId, error: err.message })
    }
  }
}

export default { uploadFile, getFileUrl, deleteFile, isCloudinaryReady }
