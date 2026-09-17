import { GoogleGenAI } from '@google/genai'

import { env } from '../../../config/env.js'
import type { ProcurementProject } from '../adapters/procurement-source.adapter.js'
import {
  buildSystemPrompt,
  parseTorAnalysis,
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

export async function analyzeTorWithGemini(
  markdown: string,
  project: ProcurementProject,
  client: GeminiClient = new GoogleGenAI(),
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
      systemInstruction: buildSystemPrompt(),
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
