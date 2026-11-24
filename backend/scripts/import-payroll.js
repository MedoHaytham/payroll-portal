// الاستخدام: npm run import -- ../egyptian_government_payroll_200_employees.xlsx
require('dotenv').config();
const XLSX = require('xlsx');
const { sql, getPool } = require('../src/db');

// اسم العمود الإنجليزي (اللي بين الأقواس في الهيدر) -> اسم العمود في الداتابيز
const MAP = {
  'Employee Code': ['employee_code', 'str'],
  'National ID': ['national_id', 'str'],
  'Social Insurance Number': ['social_insurance_no', 'str'],
  'Employee Name': ['employee_name', 'str'],
  'GFMIS Code': ['gfmis_code', 'str'],
  'Employment Status': ['employment_status', 'str'],
  'Functional / Basic Salary': ['basic_salary', 'num'],
  'Complementary / Variable Salary': ['variable_salary', 'num'],
  'Periodic Allowances': ['periodic_allowances', 'num'],
  'Special Allowances': ['special_allowances', 'num'],
  'Incentives & Bonuses': ['incentives_bonuses', 'num'],
  'Taxable Allowances': ['taxable_allowances', 'num'],
  'Exempt Allowances': ['exempt_allowances', 'num'],
  'Gross Earnings': ['gross_earnings', 'num'],
  'Social Insurance Base': ['insurance_base', 'num'],
  'Employee Social Insurance Share': ['employee_insurance_share', 'num'],
  'Income Tax': ['income_tax', 'num'],
  'Universal Health Insurance': ['health_insurance', 'num'],
  'Martyrs Fund Deduction': ['martyrs_fund', 'num'],
  'Disability Support Fund': ['disability_fund', 'num'],
  'Penalties & Disciplinary Deductions': ['penalties', 'num'],
  'Union & Club Fees': ['union_fees', 'num'],
  'Alimony / Court Ordered Deductions': ['alimony', 'num'],
  'Loans / Advances Deductions': ['loans', 'num'],
  'Total Deductions': ['total_deductions', 'num'],
  'Net Salary': ['net_salary', 'num'],
  'Bank Account / Meza Card Number': ['bank_account', 'str'],
  'Bank Code': ['bank_code', 'str'],
  'Mobile number': ['mobile', 'str'],
  'E-mail Address': ['email', 'str'],
};

function englishName(header) {
  const m = String(header).match(/\(([^()]*)\)\s*$/);
  return (m ? m[1] : String(header)).trim();
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('حدد مسار ملف الإكسيل');

  const wb = XLSX.readFile(file, { raw: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

  const pool = await getPool();
  const cols = Object.values(MAP).map(([c]) => c);
  const sets = cols.filter((c) => c !== 'national_id').map((c) => `${c} = @${c}`).join(', ');
  let done = 0;

  for (const row of rows) {
    const rec = {};
    for (const [header, value] of Object.entries(row)) {
      const spec = MAP[englishName(header)];
      if (spec) rec[spec[0]] = value;
    }

    const req = pool.request();
    for (const [col, type] of Object.values(MAP)) {
      const v = rec[col];
      if (type === 'num') req.input(col, sql.Decimal(12, 2), v == null ? null : Number(v));
      else req.input(col, sql.NVarChar(150), v == null ? null : String(v).trim());
    }

    // MERGE عشان تقدر تشغل الاستيراد أكتر من مرة بدون تكرار
    await req.query(`
      MERGE dbo.Employees AS t
      USING (SELECT @national_id AS national_id) AS s ON t.national_id = s.national_id
      WHEN MATCHED THEN UPDATE SET ${sets}
      WHEN NOT MATCHED THEN INSERT (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')});
    `);
    done++;
  }

  console.log(`تم استيراد ${done} موظف`);
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
