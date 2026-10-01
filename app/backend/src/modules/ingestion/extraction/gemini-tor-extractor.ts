import { GoogleGenAI } from '@google/genai'

import { env } from '../../../config/env.js'
import type { ProcurementProject } from '../adapters/procurement-source.adapter.js'
import {
  buildSystemPrompt,
  parseTorAnalysis,
  type ClassifierCategory,
  type TorAnalysis,
} from './deepseek-tor-extractor.js'

interface GeminiClient {
  models: {
    generateContent(request: {
      model: string
      contents: string
      config: {
        systemInstruction: string
        responseMimeType: string
        maxOutputTokens: number
      }
    }): Promise<{ text?: string }>
  }
}

function createGeminiClient(): GeminiClient {
  if (env.GOOGLE_API_KEY) {
    return new GoogleGenAI({ vertexai: true, apiKey: env.GOOGLE_API_KEY })
  }

  if (!env.GOOGLE_CLOUD_PROJECT) {
    throw new Error(
      'GOOGLE_API_KEY or GOOGLE_CLOUD_PROJECT is required to analyze TOR documents with Gemini',
    )
  }

  return new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  })
}

export async function analyzeTorWithGemini(
  markdown: string,
  project: ProcurementProject,
  categories: ClassifierCategory[],
  client: GeminiClient = createGeminiClient(),
): Promise<TorAnalysis> {
  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [
      `Central eGP project ID: ${project.externalId}`,
      `Fallback title: ${project.title}`,
      '',
      '<tor_document>',
      markdown,
      '</tor_document>',
    ].join('\n'),
    config: {
      systemInstruction: buildSystemPrompt(categories),
      responseMimeType: 'application/json',
      maxOutputTokens: 8_000,
    },
  })

  const content = response.text
  if (!content) {
    throw new Error('Gemini returned an empty TOR analysis')
  }

  return parseTorAnalysis(content)
}
