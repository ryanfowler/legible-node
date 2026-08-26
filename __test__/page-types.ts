import { ExtractedPage } from '../index.js'
import type { MarkdownOptions } from '../index.js'

declare const page: ExtractedPage

const markdownOptions: MarkdownOptions = {
  links: false,
  images: false,
  maxLineWidth: 80,
}

const metadata = page.metadata
const metrics = page.metrics
const diagnostics = page.diagnostics
const metadataDiagnostics = page.metadataDiagnostics
const structuredData: unknown[] | null = page.structuredData
const markdown = page.markdown(markdownOptions)
const text = page.text()
const html = page.html()

void metadata
void metrics
void diagnostics
void metadataDiagnostics
void structuredData
void markdown
void text
void html

// @ts-expect-error ExtractedPage values come from extraction and are not user-constructible.
new ExtractedPage()
