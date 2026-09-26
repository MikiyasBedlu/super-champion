'use client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Every browser call goes through here, so errors always arrive in the same shape. */
export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown; networkMessage?: string } = {}): Promise<T> {
  const { method = 'GET', body, networkMessage = 'No connection. Check your internet and try again.' } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(networkMessage, 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> } & T;
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Try again.', res.status, data.fields ?? {});
  return data;
}
