const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');

exports.verifyToken = (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) return next(new AppError('غير مصرح، سجّل الدخول أولاً', 401));

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY);
    req.user = { nationalId: decoded.id };
    next();
  } catch {
    next(new AppError('الجلسة انتهت، سجّل الدخول من جديد', 401));
  }
};
