const PII_KEY_FRAGMENTS = [
  'cpf',
  'rg_number',
  'rgNumber',
  'passport',
  'keyPix',
  'typeKeyPix',
  'password',
  'client_secret',
  'token',
] as const;

function isPiiKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PII_KEY_FRAGMENTS.some((f) => lower === f || lower.endsWith(`.${f}`));
}

export function filterPII<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((item) => filterPII(item)) as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isPiiKey(key)) {
      out[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      out[key] = filterPII(value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
