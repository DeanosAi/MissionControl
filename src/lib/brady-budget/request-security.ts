export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

