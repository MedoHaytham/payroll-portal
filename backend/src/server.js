require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const AppError = require('./utils/appError');
const httpStatusText = require('./utils/httpStatusText');

for (const key of ['ACCESS_TOKEN_SECRET_KEY', 'REFRESH_TOKEN_SECRET_KEY', 'OTP_SECRET']) {
  if (!process.env[key] || process.env[key].length < 32) {
    console.error(`${key} لازم يكون 32 حرف على الأقل`);
    process.exit(1);
  }
}

const app = express();
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// حماية من تخمين الباسوردات والأكواد
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: (req) => req.path === '/refreshToken',
  message: { status: 'fail', message: 'محاولات كتير، جرّب بعد شوية' },
});

app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/me', require('./routes/me'));

// Handling unhandled routes (404)
app.all('*', (req, res, next) => next(new AppError(`المسار ${req.originalUrl} غير موجود`, 404)));

// global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) console.error(err);
  res.status(statusCode).json({
    status: statusCode >= 500 ? httpStatusText.ERROR : httpStatusText.FAIL,
    message: err.isOperational ? err.message : 'حصل خطأ في السيرفر',
    ...(err.extra || {}),
  });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
