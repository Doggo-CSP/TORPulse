// Links built from data the app does not control (TOR source URLs from e-GP, stored file URLs)
// are only rendered when they use http(s). A javascript:, data: or other scheme is dropped, so a
// poisoned upstream record cannot turn a link into script execution (ASVS V1.2.2).
export function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
