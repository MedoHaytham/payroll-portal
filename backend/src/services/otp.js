const crypto = require('crypto');
const { sql, getPool } = require('../db');

const TTL_MIN = 5;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SEC = 60;

const hashCode = (nid, code) =>
  crypto.createHmac('sha256', process.env.OTP_SECRET).update(`${nid}:${code}`).digest('hex');

// بيرجع { code } أو { cooldown: ثواني }
async function createOtp(nationalId, channel) {
  const pool = await getPool();

  const last = await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .query(`SELECT TOP 1 DATEDIFF(SECOND, created_at, SYSUTCDATETIME()) AS age
            FROM dbo.Otps WHERE national_id = @nid ORDER BY id DESC`);
  const age = last.recordset[0]?.age;
  if (age != null && age < COOLDOWN_SEC) return { cooldown: COOLDOWN_SEC - age };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  // أي كود قديم يبطل
  await pool.request().input('nid', sql.VarChar(14), nationalId)
    .query('UPDATE dbo.Otps SET used = 1 WHERE national_id = @nid AND used = 0');

  await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .input('channel', sql.VarChar(10), channel)
    .input('hash', sql.VarChar(64), hashCode(nationalId, code))
    .input('ttl', sql.Int, TTL_MIN)
    .query(`INSERT INTO dbo.Otps (national_id, channel, code_hash, expires_at)
            VALUES (@nid, @channel, @hash, DATEADD(MINUTE, @ttl, SYSUTCDATETIME()))`);

  return { code };
}

async function verifyOtp(nationalId, code) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('nid', sql.VarChar(14), nationalId)
    .query(`SELECT TOP 1 id, code_hash, attempts,
                   CASE WHEN expires_at > SYSUTCDATETIME() THEN 1 ELSE 0 END AS valid
            FROM dbo.Otps WHERE national_id = @nid AND used = 0 ORDER BY id DESC`);

  const row = r.recordset[0];
  if (!row || !row.valid || row.attempts >= MAX_ATTEMPTS) return false;

  // نزود المحاولات الأول عشان التخمين مايعدّيش
  await pool.request().input('id', sql.Int, row.id)
    .query('UPDATE dbo.Otps SET attempts = attempts + 1 WHERE id = @id');

  const given = Buffer.from(hashCode(nationalId, String(code)));
  const expected = Buffer.from(row.code_hash);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;

  await pool.request().input('id', sql.Int, row.id)
    .query('UPDATE dbo.Otps SET used = 1 WHERE id = @id');
  return true;
}

module.exports = { createOtp, verifyOtp };
