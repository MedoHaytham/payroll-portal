const express = require('express');
const { sql, getPool } = require('../db');
const { verifyToken } = require('../middleware/verifyToken');
const AppError = require('../utils/appError');
const asyncWrapper = require('../utils/asyncWrapper');

const router = express.Router();

// الرقم القومي بييجي من التوكن فقط، مش من الـ request،
// فالمستخدم مايقدرش يطلب داتا حد تاني.
router.get('/', verifyToken, asyncWrapper(async (req, res, next) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('nid', sql.VarChar(14), req.user.nationalId)
    .query('SELECT * FROM dbo.Employees WHERE national_id = @nid');

  if (!result.recordset.length) return next(new AppError('مفيش بيانات', 404));
  res.json(result.recordset[0]);
}));

module.exports = router;
