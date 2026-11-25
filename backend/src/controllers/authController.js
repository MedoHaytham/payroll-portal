const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../db');
const { createOtp, verifyOtp } = require('../services/otp');
const notify = require('../services/notify');
const Email = require('../utils/email');
const AppError = require('../utils/appError');
const asyncWrapper = require('../utils/asyncWrapper');
const httpStatus = require('../utils/httpStatusText');

const ID_LEN = parseInt(process.env.NATIONAL_ID_LENGTH || '14', 10);
const idRegex = new RegExp(`^\\d{${ID_LEN}}$`);
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// ---------------- helpers ----------------
const signToken = (id, type) => {
  if (type === 'refresh') {
    return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET_KEY, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    });
  }

  if(type === 'access') {
    return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET_KEY, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    });
  }
};

const cookieBase = (req) => ({
  httpOnly: true,
  secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  sameSite: 'lax',
});

const createSendToken = async (nationalId, statusCode, req, res, message) => {
  const accessToken = signToken(nationalId, 'access');
  const refreshToken = signToken(nationalId, 'refresh');

  // بنخزن هاش الـ refresh token بس، مش التوكن نفسه
  const pool = await getPool();
  await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .input('rt', sql.VarChar(64), sha256(refreshToken))
    .query('UPDATE dbo.Users SET refresh_token_hash = @rt WHERE national_id = @nid');

  res.cookie('accessToken', accessToken, {
    ...cookieBase(req),
    expires: new Date(Date.now() + 15 * 60 * 1000),
  });
  res.cookie('refreshToken', refreshToken, {
    ...cookieBase(req),
    expires: new Date(Date.now() + Number(process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
  });

  res.status(statusCode).json({ status: httpStatus.SUCCESS, message });
};

// وسائل التواصل المسجلة للموظف (من جدول Employees فقط، مش من المستخدم)
async function loadContact(nationalId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .query(`SELECT e.mobile, e.email, CASE WHEN u.id IS NULL THEN 0 ELSE 1 END AS registered
            FROM dbo.Employees e LEFT JOIN dbo.Users u ON u.national_id = e.national_id
            WHERE e.national_id = @nid`);
  const row = r.recordset[0];
  if (!row) return null;
  const phone = notify.toIntlPhone(row.mobile);
  const email = row.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email) ? row.email.trim() : null;
  return { registered: !!row.registered, phone, email };
}

const assertNationalId = (nationalId) => {
  if (!idRegex.test(String(nationalId || ''))) {
    throw new AppError(`الرقم القومي لازم يكون ${ID_LEN} رقم`, 400);
  }
};

// ---------------- التسجيل (3 خطوات) ----------------

// 1) الرقم القومي -> الوسائل المتاحة (مخفية جزئياً)
exports.registerOptions = asyncWrapper(async (req, res, next) => {
  const { nationalId } = req.body || {};
  assertNationalId(nationalId);

  const c = await loadContact(nationalId);
  if (!c) return next(new AppError('الرقم القومي غير مسجل في كشف المرتبات', 404));
  if (c.registered) return next(new AppError('الحساب ده متسجل قبل كده، سجّل دخول', 409));

  const channels = [];
  if (c.phone) channels.push({ type: 'whatsapp', masked: notify.maskPhone(c.phone) });
  if (c.email) channels.push({ type: 'email', masked: notify.maskEmail(c.email) });
  if (!channels.length) {
    return next(new AppError('مفيش رقم موبايل أو إيميل مسجل لحضرتك، تواصل مع شؤون العاملين', 422));
  }

  res.status(200).json({ status: httpStatus.SUCCESS, channels });
});

// 2) اختيار الوسيلة -> إرسال الكود
exports.sendOtp = asyncWrapper(async (req, res, next) => {
  const { nationalId, channel } = req.body || {};
  assertNationalId(nationalId);
  if (!['whatsapp', 'email'].includes(channel)) return next(new AppError('بيانات غير صحيحة', 400));

  const c = await loadContact(nationalId);
  if (!c || c.registered) return next(new AppError('بيانات غير صحيحة', 400));

  const dest = channel === 'whatsapp' ? c.phone : c.email;
  if (!dest) return next(new AppError('الوسيلة دي غير متاحة', 400));

  const otp = await createOtp(nationalId, channel);
  if (otp.busy) {
    return next(new AppError('طلب الكود شغال بالفعل، استنى لحظة وحاول تاني', 429, { retryAfter: 3 }));
  }
  if (otp.cooldown) {
    return next(new AppError(`استنى ${otp.cooldown} ثانية قبل ما تطلب كود جديد`, 429, { retryAfter: otp.cooldown }));
  }

  if (channel === 'whatsapp') await notify.sendWhatsAppOtp(dest, otp.code);
  else await new Email({ email: dest }, otp.code).sendOtp();

  res.status(200).json({ status: httpStatus.SUCCESS, message: 'تم إرسال الكود' });
});

// 3) الكود + الباسورد -> إنشاء الحساب
exports.register = asyncWrapper(async (req, res, next) => {
  const { nationalId, code, password } = req.body || {};
  assertNationalId(nationalId);
  if (!/^\d{6}$/.test(String(code || ''))) return next(new AppError('بيانات غير صحيحة', 400));
  if (typeof password !== 'string' || password.length < 8) {
    return next(new AppError('الباسورد لازم يكون 8 حروف على الأقل', 400));
  }

  const c = await loadContact(nationalId);
  if (!c || c.registered) return next(new AppError('بيانات غير صحيحة', 400));

  if (!(await verifyOtp(nationalId, code))) {
    return next(new AppError('الكود غلط أو منتهي، اطلب كود جديد', 400));
  }

  const pool = await getPool();
  const hash = await bcrypt.hash(password, 12);
  await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .input('hash', sql.VarChar(100), hash)
    .query('INSERT INTO dbo.Users (national_id, password_hash) VALUES (@nid, @hash)');

  await createSendToken(nationalId, 201, req, res, 'تم التسجيل بنجاح');
});

// ---------------- الدخول والجلسة ----------------

exports.login = asyncWrapper(async (req, res, next) => {
  const { nationalId, password } = req.body || {};

  if (!idRegex.test(String(nationalId || '')) || typeof password !== 'string' || !password) {
    return next(new AppError('الرقم القومي أو الباسورد غلط', 400));
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .query('SELECT password_hash FROM dbo.Users WHERE national_id = @nid');

  const user = result.recordset[0];
  const correct = user && (await bcrypt.compare(password, user.password_hash));
  if (!correct) return next(new AppError('الرقم القومي أو الباسورد غلط', 401));

  await createSendToken(nationalId, 200, req, res, 'تم تسجيل الدخول');
});

exports.refreshAccessToken = asyncWrapper(async (req, res, next) => {
  const token = req.cookies?.refreshToken;
  if (!token) return next(new AppError('No refresh token provided', 401));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET_KEY);
  } catch {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  const pool = await getPool();
  const r = await pool
    .request()
    .input('nid', sql.VarChar(14), decoded.id)
    .query('SELECT refresh_token_hash FROM dbo.Users WHERE national_id = @nid');

  const stored = r.recordset[0]?.refresh_token_hash;
  if (!stored || stored !== sha256(token)) {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  await createSendToken(decoded.id, 200, req, res, 'تم تجديد الجلسة');
});

exports.logout = asyncWrapper(async (req, res, next) => {
  // نلغي الـ refresh token في الداتابيز لو الكوكي صالح
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET_KEY);
      const pool = await getPool();
      await pool
        .request()
        .input('nid', sql.VarChar(14), decoded.id)
        .query('UPDATE dbo.Users SET refresh_token_hash = NULL WHERE national_id = @nid');
    } catch { /* كوكي منتهي أو غلط، نكمل ونمسح الكوكيز */ }
  }

  res.clearCookie('accessToken', cookieBase(req));
  res.clearCookie('refreshToken', cookieBase(req));
  res.status(200).json({ status: httpStatus.SUCCESS });
});
