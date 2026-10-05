import { Pinecone } from '@pinecone-database/pinecone'
import { ChatGroq } from '@langchain/groq'

let pinecone = null
let index = null

const getPinecone = async () => {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
    index = pinecone.index(process.env.PINECONE_INDEX || 'nexthire-resumes')
  }
  return index
}

/**
 * Generate a simple embedding using Groq's text representation.
 * NOTE: In production use OpenAI/Cohere embeddings. For free-tier
 * we generate a hash-based pseudo-embedding from Groq's summary.
 * Replace with a real embedding model when available.
 */
const generateEmbedding = async (text) => {
  // Using a simple but effective TF-like approach for free tier
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
  const vocab = [...new Set(words)].slice(0, 1536)
  const vec = new Array(1536).fill(0)
  words.forEach(w => {
    const idx = vocab.indexOf(w)
    if (idx >= 0) vec[idx] += 1
  })
  // Normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / mag)
}

/**
 * Upsert a resume vector into Pinecone
 */
export const upsertResumeVector = async (candidateId, resumeText, metadata = {}) => {
  try {
    const idx = await getPinecone()
    const embedding = await generateEmbedding(resumeText)
    await idx.upsert([{
      id: candidateId.toString(),
      values: embedding,
      metadata: {
        name: metadata.name || '',
        email: metadata.email || '',
        skills: metadata.skills?.join(',') || '',
        score: metadata.score || 0,
        ...metadata,
      },
    }])
    return true
  } catch (err) {
    console.error('[Pinecone] upsert failed:', err.message)
    return false
  }
}

/**
 * Match a job description against stored resume vectors
 * Returns top-k matching candidate IDs
 */
export const matchJobToResumes = async (jobDescription, topK = 10) => {
  try {
    const idx = await getPinecone()
    const embedding = await generateEmbedding(jobDescription)
    const result = await idx.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    })
    return result.matches.map(m => ({
      candidateId: m.id,
      score: Math.round(m.score * 100),
      metadata: m.metadata,
    }))
  } catch (err) {
    console.error('[Pinecone] query failed:', err.message)
    return []
  }
}

/**
 * Delete a resume vector (on candidate deletion)
 */
export const deleteResumeVector = async (candidateId) => {
  try {
    const idx = await getPinecone()
    await idx.deleteOne(candidateId.toString())
  } catch (err) {
    console.error('[Pinecone] delete failed:', err.message)
  }
}
