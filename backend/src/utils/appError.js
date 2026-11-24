const httpStatusText = require("./httpStatusText");


class AppError extends Error {
  constructor(message, statusCode, extra = {}) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? httpStatusText.FAIL : httpStatusText.ERROR;
    this.extra = extra; // بيانات إضافية للرد زي retryAfter
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
