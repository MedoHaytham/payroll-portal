'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nationalId: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api('/auth/login', { method: 'POST', body: form });
      router.push('/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="card auth">
      <h1>تسجيل الدخول</h1>
      <form onSubmit={onSubmit}>
        <label>الرقم القومي</label>
        <input inputMode="numeric" value={form.nationalId} required
          onChange={(e) => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, '') })} />
        <label>الباسورد</label>
        <input type="password" value={form.password} required
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button disabled={loading}>{loading ? '...' : 'دخول'}</button>
      </form>
      <p className="hint">معندكش حساب؟ <Link href="/register">سجّل دلوقتي</Link></p>
    </div>
  );
}
