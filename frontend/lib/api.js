async function request(path, options) {
  return fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export async function api(path, options = {}) {
  let res = await request(path, options);

  // الـ access token بيخلص بعد 15 دقيقة: نجدده تلقائي مرة واحدة ونعيد الطلب
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await request('/auth/refreshToken', { method: 'POST' });
    if (refreshed.ok) res = await request(path, options);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'حصل خطأ');
    err.status = res.status;
    err.retryAfter = data.retryAfter;
    throw err;
  }
  return data;
}
