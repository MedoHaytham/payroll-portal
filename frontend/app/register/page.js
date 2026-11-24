'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

const LABELS = { whatsapp: 'واتساب', email: 'الإيميل' };

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: رقم قومي، 2: اختيار الوسيلة، 3: كود + باسورد
  const [nationalId, setNationalId] = useState('');
  const [channels, setChannels] = useState([]);
  const [channel, setChannel] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function run(fn) {
    setError(''); setLoading(true);
    try { await fn(); } catch (err) {
      setError(err.message);
      if (err.retryAfter) setWait(err.retryAfter);
    } finally { setLoading(false); }
  }

  const getOptions = (e) => { e.preventDefault(); run(async () => {
    const { channels } = await api('/auth/register/options', { method: 'POST', body: { nationalId } });
    setChannels(channels); setChannel(channels[0].type); setStep(2);
  }); };

  const sendOtp = (e) => { e?.preventDefault(); run(async () => {
    await api('/auth/register/send-otp', { method: 'POST', body: { nationalId, channel } });
    setStep(3); setWait(60);
  }); };

  const verify = (e) => { e.preventDefault();
    if (password !== confirm) return setError('الباسوردين مش متطابقين');
    run(async () => {
      await api('/auth/register/verify', { method: 'POST', body: { nationalId, code, password } });
      router.push('/dashboard');
    });
  };

  return (
    <div className="card auth">
      <h1>إنشاء حساب</h1>

      {step === 1 && (
        <form onSubmit={getOptions}>
          <label>الرقم القومي</label>
          <input inputMode="numeric" value={nationalId} required
            onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))} />
          {error && <div className="error">{error}</div>}
          <button disabled={loading}>{loading ? '...' : 'التالي'}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={sendOtp}>
          <label>اختار وسيلة استلام كود التحقق</label>
          {channels.map((c) => (
            <label key={c.type} className="radio">
              <input type="radio" name="ch" checked={channel === c.type} onChange={() => setChannel(c.type)} />
              <span>{LABELS[c.type]} <bdi className="masked">{c.masked}</bdi></span>
            </label>
          ))}
          {error && <div className="error">{error}</div>}
          <button disabled={loading}>{loading ? '...' : 'ابعت الكود'}</button>
          <p className="hint"><button type="button" className="link" onClick={() => setStep(1)}>رجوع</button></p>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={verify}>
          <p className="hint" style={{ marginTop: 0 }}>الكود اتبعت على {LABELS[channel]}</p>
          <label>كود التحقق (6 أرقام)</label>
          <input inputMode="numeric" maxLength={6} value={code} required autoComplete="one-time-code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <label>الباسورد (8 حروف على الأقل)</label>
          <input type="password" minLength={8} value={password} required onChange={(e) => setPassword(e.target.value)} />
          <label>تأكيد الباسورد</label>
          <input type="password" value={confirm} required onChange={(e) => setConfirm(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button disabled={loading}>{loading ? '...' : 'تسجيل'}</button>
          <p className="hint">
            {wait > 0 ? `إعادة الإرسال بعد ${wait} ثانية` :
              <button type="button" className="link" onClick={sendOtp}>إعادة إرسال الكود</button>}
            {' · '}
            <button type="button" className="link" onClick={() => setStep(2)}>تغيير الوسيلة</button>
          </p>
        </form>
      )}

      <p className="hint">عندك حساب؟ <Link href="/login">سجّل دخول</Link></p>
    </div>
  );
}
