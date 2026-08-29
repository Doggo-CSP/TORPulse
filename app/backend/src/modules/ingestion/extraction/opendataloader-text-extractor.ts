import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { convert } from '@opendataloader/pdf'

import type { DownloadDocument } from '../adapters/procurement-source.adapter.js'

const MIN_USEFUL_TEXT_LENGTH = 200
const MAX_EXTRACTED_TEXT_CHARACTERS = 300_000

export class OcrRequiredError extends Error {
  public constructor() {
    super(
      'OpenDataLoader extracted too little text. The TOR may be scanned and require an OCR/hybrid backend.',
    )
    this.name = 'OcrRequiredError'
  }
}

export async function extractDocumentsToMarkdown(documents: DownloadDocument[]): Promise<string> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'doggo-tor-'))
  const inputDirectory = path.join(workspace, 'input')
  const outputDirectory = path.join(workspace, 'output')

  try {
    const inputPaths: string[] = []
    await mkdir(inputDirectory, { recursive: true })
    await mkdir(outputDirectory, { recursive: true })

    for (const [index, document] of documents.entries()) {
      const inputPath = path.join(inputDirectory, `tor-${index + 1}.pdf`)
      await writeFile(inputPath, document.content)
      inputPaths.push(inputPath)
    }

    await convert(inputPaths, {
      outputDir: outputDirectory,
      format: 'markdown',
      quiet: true,
      readingOrder: 'xycut',
      imageOutput: 'off',
      markdownPageSeparator: '\n\n--- PAGE %page-number% ---\n\n',
    })

    const markdownPaths = await findMarkdownFiles(outputDirectory)
    if (markdownPaths.length === 0) {
      throw new Error('OpenDataLoader did not produce Markdown output')
    }

    const sections = await Promise.all(
      markdownPaths.sort().map(async (markdownPath, index) => {
        const text = await readFile(markdownPath, 'utf8')
        const sourceName = documents[index]?.fileName ?? path.basename(markdownPath)
        return `# Source document: ${sourceName}\n\n${text.trim()}`
      }),
    )

    const markdown = sections.join('\n\n--- DOCUMENT BOUNDARY ---\n\n').trim()
    const meaningfulText = markdown
      .replace(/^# Source document:.*$/gm, '')
      .replace(/^--- PAGE \d+ ---$/gm, '')
      .replace(/^--- DOCUMENT BOUNDARY ---$/gm, '')
      .replace(/\s/gu, '')

    if (meaningfulText.length < MIN_USEFUL_TEXT_LENGTH) {
      throw new OcrRequiredError()
    }

    return markdown.slice(0, MAX_EXTRACTED_TEXT_CHARACTERS)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

async function findMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(entryPath)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files
}
