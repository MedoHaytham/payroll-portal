'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

const money = (v) => (v == null ? '—' : Number(v).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج.م');

const SECTIONS = [
  { title: 'البيانات الوظيفية', fields: [
    ['employee_name', 'الاسم'], ['national_id', 'الرقم القومي'], ['employee_code', 'كود الموظف'],
    ['social_insurance_no', 'رقم التأمين الاجتماعي'], ['gfmis_code', 'كود الجهة الإدارية'],
    ['employment_status', 'حالة العمل'], ['mobile', 'الموبايل'], ['email', 'الإيميل'],
  ] },
  { title: 'الاستحقاقات', money: true, fields: [
    ['basic_salary', 'الأجر الأساسي'], ['variable_salary', 'الأجر المتغير'], ['periodic_allowances', 'العلاوات الدورية'],
    ['special_allowances', 'العلاوات الخاصة'], ['incentives_bonuses', 'الحوافز والمكافآت'],
    ['taxable_allowances', 'البدلات الخاضعة'], ['exempt_allowances', 'البدلات المعفاة'], ['gross_earnings', 'إجمالي الاستحقاقات'],
  ] },
  { title: 'الاستقطاعات', money: true, fields: [
    ['insurance_base', 'أجر الاشتراك التأميني'], ['employee_insurance_share', 'حصة العامل في التأمينات'],
    ['income_tax', 'ضريبة كسب العمل'], ['health_insurance', 'التأمين الصحي الشامل'],
    ['martyrs_fund', 'صندوق تكريم الشهداء'], ['disability_fund', 'صندوق دعم ذوي الإعاقة'],
    ['penalties', 'الجزاءات والخصومات'], ['union_fees', 'اشتراكات النقابات والنوادي'],
    ['alimony', 'النفقة الشرعية'], ['loans', 'أقساط السلف والقروض'], ['total_deductions', 'إجمالي الاستقطاعات'],
  ] },
  { title: 'الحساب البنكي', fields: [['bank_account', 'رقم الحساب / كارت ميزة'], ['bank_code', 'كود البنك']] },
];

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/me').then(setData).catch((err) => {
      if (err.status === 401) router.replace('/login');
      else setError(err.message);
    });
  }, [router]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!data) return <div className="container">جاري التحميل...</div>;

  return (
    <div className="container">
      <div className="topbar">
        <h1>أهلاً، {data.employee_name}</h1>
        <button className="link" onClick={logout}>تسجيل الخروج</button>
      </div>

      <div className="net">
        <div className="k">صافي المرتب</div>
        <div className="v">{money(data.net_salary)}</div>
      </div>

      {SECTIONS.map((s) => (
        <div className="card" key={s.title}>
          <h2>{s.title}</h2>
          <div className="grid">
            {s.fields.map(([key, label]) => (
              <div className="item" key={key}>
                <div className="k">{label}</div>
                <div className="v">{s.money ? money(data[key]) : data[key] ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
