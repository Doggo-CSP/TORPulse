// Output encoding helpers for the two "dangerous contexts" the backend writes untrusted text
// into (ASVS V1.3.3, V1.3.11): HTML email bodies and email header fields.

// TOR text comes from source documents and the LLM, so it is escaped before going into HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Email header values (subject, display names) must be a single line: CR, LF and other control
// characters would let text inject extra headers or recipients (SMTP header injection). Length is
// capped so a huge TOR title cannot produce an oversized header.
export function headerSafe(value: string, maxLength = 200): string {
  // eslint-disable-next-line no-control-regex
  const singleLine = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine
}
