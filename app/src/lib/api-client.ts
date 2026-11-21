export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      'X-BoatCore-Client': 'web',
      ...(options.method && options.method !== 'GET'
        ? { 'Idempotency-Key': crypto.randomUUID() }
        : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({ error: 'Unexpected server response' }));
  if (!response.ok)
    throw Object.assign(new Error(data.error || 'Request failed'), { status: response.status });
  return data;
}
export const inr = (value: string | number = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value));
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
