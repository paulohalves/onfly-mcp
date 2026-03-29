export function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined | Array<string | number>,
): void {
  if (value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      params.append(key, String(v));
    }
    return;
  }
  params.set(key, String(value));
}
