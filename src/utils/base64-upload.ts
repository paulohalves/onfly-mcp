import { Buffer } from 'node:buffer';

function stripBase64PayloadWhitespace(payload: string): string {
  return payload.replace(/\s/g, '');
}

/** Decodes a base64 string, stripping an optional `data:*;base64,` prefix (RFC 2397). */
export function decodeBase64ToBuffer(input: string): Buffer {
  const trimmed = input.trim();
  const comma = trimmed.indexOf(',');
  if (trimmed.toLowerCase().startsWith('data:') && comma !== -1) {
    return Buffer.from(stripBase64PayloadWhitespace(trimmed.slice(comma + 1)), 'base64');
  }
  return Buffer.from(stripBase64PayloadWhitespace(trimmed), 'base64');
}

/**
 * Web app API expects `files[].file` as a full data URL (same shape as browser file uploads).
 * Normalises whitespace inside the base64 payload (multi-line pastes).
 */
export function toOnflyWebAttachmentDataUrl(input: string, contentType: string): string {
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith('data:')) {
    const comma = trimmed.indexOf(',');
    if (comma === -1) {
      return trimmed;
    }
    const header = trimmed.slice(0, comma + 1);
    const payload = stripBase64PayloadWhitespace(trimmed.slice(comma + 1));
    return `${header}${payload}`;
  }
  return `data:${contentType};base64,${stripBase64PayloadWhitespace(trimmed)}`;
}
