/**
 * cloudinary.mcp.js
 *
 * MCP tools for file storage via Cloudinary (with local fallback).
 * Wraps cloudinary.service for agent consumption.
 */

import { MCPTool, mcpRegistry } from './base.mcp.js'
import { uploadFile, getFileUrl, deleteFile } from '../services/cloudinary.service.js'

// ── uploadResume ──────────────────────────────────────────────────────────────

class UploadResumeTool extends MCPTool {
  constructor() {
    super({
      name: 'cloudinary.uploadResume',
      description: 'Upload a resume file to Cloudinary (or local fallback). Returns publicId and URL.',
      parameters: {
        filePath: 'String — absolute path to the file on disk',
        folder: 'String — destination folder (default: "resumes")',
      },
    })
  }

  async _execute({ filePath, folder = 'resumes' }) {
    if (!filePath) throw new Error('filePath is required')
    return uploadFile(filePath, folder)
  }
}

// ── getFileUrl ─────────────────────────────────────────────────────────────────

class GetFileUrlTool extends MCPTool {
  constructor() {
    super({
      name: 'cloudinary.getFileUrl',
      description: 'Get the URL for a stored file by its public ID',
      parameters: {
        publicId: 'String — Cloudinary public_id or local path',
      },
    })
  }

  async _execute({ publicId }) {
    if (!publicId) throw new Error('publicId is required')
    return { url: getFileUrl(publicId) }
  }
}

// ── deleteFile ─────────────────────────────────────────────────────────────────

class DeleteFileTool extends MCPTool {
  constructor() {
    super({
      name: 'cloudinary.deleteFile',
      description: 'Delete a file from Cloudinary or local storage',
      parameters: {
        publicId: 'String — Cloudinary public_id or local path',
      },
    })
  }

  async _execute({ publicId }) {
    if (!publicId) throw new Error('publicId is required')
    await deleteFile(publicId)
    return { deleted: true, publicId }
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

export function registerCloudinaryTools() {
  mcpRegistry.register(new UploadResumeTool())
  mcpRegistry.register(new GetFileUrlTool())
  mcpRegistry.register(new DeleteFileTool())
}

export default { registerCloudinaryTools }
