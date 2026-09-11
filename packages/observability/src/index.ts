const secretKey = /token|secret|password|authorization|cookie|connection|string|body|email|recipient/i;
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[bounded]';
  if (typeof value === 'string') return value.replace(/postgres(?:ql)?:\/\/\S+|Bearer\s+\S+|ya29\.[\w.-]+/gi, '[redacted]');
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redact(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? '[redacted]' : redact(item, depth + 1)]));
  return value;
}
export function safeEvent(event: string, fields: Record<string, unknown>) { return { event, fields: redact(fields), at: new Date().toISOString() }; }
