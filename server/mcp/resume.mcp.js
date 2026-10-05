/**
 * resume.mcp.js
 *
 * MCP tools for resume processing.
 * Wraps parser.service and ai.service for agent consumption.
 */

import { MCPTool, mcpRegistry } from './base.mcp.js'
import { extractTextFromFile } from '../services/parser.service.js'
import { screenResumeWithAI } from '../services/ai.service.js'

// ── extractResume ─────────────────────────────────────────────────────────────

class ExtractResumeTool extends MCPTool {
  constructor() {
    super({
      name: 'resume.extract',
      description: 'Extract plain text from an uploaded resume file (PDF, TXT, DOC)',
      parameters: {
        filePath: 'String — absolute path to the uploaded file on disk',
      },
    })
  }

  async _execute({ filePath }) {
    if (!filePath) throw new Error('filePath is required')
    const text = await extractTextFromFile(filePath)
    if (!text || text.length < 30) {
      throw new Error('Could not extract readable text from the file')
    }
    return {
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      characters: text.length,
    }
  }
}

// ── analyzeResume ─────────────────────────────────────────────────────────────

class AnalyzeResumeTool extends MCPTool {
  constructor() {
    super({
      name: 'resume.analyze',
      description: 'AI-screen a resume against a job description using Groq LLM',
      parameters: {
        resumeText: 'String — extracted resume text',
        jobDescription: 'String — job title + description + required skills',
      },
    })
  }

  async _execute({ resumeText, jobDescription }) {
    if (!resumeText) throw new Error('resumeText is required')
    if (!jobDescription) throw new Error('jobDescription is required')
    return screenResumeWithAI(resumeText, jobDescription)
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

export function registerResumeTools() {
  mcpRegistry.register(new ExtractResumeTool())
  mcpRegistry.register(new AnalyzeResumeTool())
}

export default { registerResumeTools }
