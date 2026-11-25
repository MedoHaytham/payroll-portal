const crypto = require('crypto');
const { sql, getPool } = require('../db');
const AppError = require('../utils/appError');

const TTL_MIN = 5;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SEC = 60;


// أكواد sp_getapplock: 0/1 = اتاخد، -1 = timeout (طلب تاني ماسك الـ lock)،
// -2 = اتلغى، -3 = deadlock victim، -999 = خطأ في الباراميترز أو الاستدعاء
const LOCK_ERRORS = { '-2': 'canceled', '-3': 'deadlock victim', '-999': 'parameter validation or call error' };

// بيرجّع rc. نفس الـ lock مستخدم في createOtp و verifyOtp، فالعمليتين لنفس الرقم القومي متسلسلتين.
async function acquireLock(tx, nationalId, timeoutMs) {
  const r = await new sql.Request(tx)
    .input('res', sql.NVarChar(255), `otp:${nationalId}`)
    .input('t', sql.Int, timeoutMs)
    .query(`DECLARE @rc INT;
            EXEC @rc = sp_getapplock @Resource = @res, @LockMode = 'Exclusive',
                                     @LockOwner = 'Transaction', @LockTimeout = @t;
            SELECT @rc AS rc;`);
  return r.recordset[0].rc;
}

const lockFailure = (rc) =>
  new Error(`sp_getapplock failed (rc=${rc}: ${LOCK_ERRORS[rc] || 'unknown'})`);

const hashCode = (nid, code) =>
  crypto.createHmac('sha256', process.env.OTP_SECRET).update(`${nid}:${code}`).digest('hex');

// بيرجع { code } أو { cooldown: ثواني } (لازم يستنى) أو { busy: true } (طلب تاني شغال دلوقتي)
// كل العملية (فحص الـ cooldown + إبطال القديم + إنشاء الجديد) جوه Transaction واحدة،
// ومعاها applock على الرقم القومي: طلب واحد بس يقدر ينشئ كود لنفس الشخص في نفس اللحظة.
async function createOtp(nationalId, channel) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // LockTimeout = 0: لو طلب تاني شغال دلوقتي لنفس الرقم القومي نرفض فوراً.
    // ده مش cooldown: ممكن الطلب التاني يخلص بعد لحظات.
    const rc = await acquireLock(tx, nationalId, 0);
    if (rc === -1) {
      await tx.rollback();
      return { busy: true };
    }
    if (rc < 0) throw lockFailure(rc); // أي كود سالب تاني = خطأ حقيقي، يتسجل ويترجع 500

    const last = await new sql.Request(tx)
      .input('nid', sql.VarChar(14), nationalId)
      .query(`SELECT TOP 1 DATEDIFF(SECOND, created_at, SYSUTCDATETIME()) AS age
              FROM dbo.Otps WHERE national_id = @nid ORDER BY id DESC`);
    const age = last.recordset[0]?.age;
    if (age != null && age < COOLDOWN_SEC) {
      await tx.rollback();
      return { cooldown: COOLDOWN_SEC - age };
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

    // أي كود قديم يبطل
    await new sql.Request(tx)
      .input('nid', sql.VarChar(14), nationalId)
      .query('UPDATE dbo.Otps SET used = 1 WHERE national_id = @nid AND used = 0');

    await new sql.Request(tx)
      .input('nid', sql.VarChar(14), nationalId)
      .input('channel', sql.VarChar(10), channel)
      .input('hash', sql.VarChar(64), hashCode(nationalId, code))
      .input('ttl', sql.Int, TTL_MIN)
      .query(`INSERT INTO dbo.Otps (national_id, channel, code_hash, expires_at)
              VALUES (@nid, @channel, @hash, DATEADD(MINUTE, @ttl, SYSUTCDATETIME()))`);

    await tx.commit();
    return { code };
  } catch (err) {
    try { await tx.rollback(); } catch { /* الـ transaction خلصت أصلاً */ }
    throw err;
  }
}

// التحقق + استهلاك الكود في Transaction واحدة (بنفس الـ applock بتاع createOtp).
// - كود غلط: Commit عشان زيادة المحاولات تفضل ثابتة (مش Rollback).
// - خطأ في الداتابيز: Rollback للكل، فالكود يفضل صالح ويقدر يعيد المحاولة.
async function verifyOtp(nationalId, code) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // بنستنى لحد 3 ثواني (العملية بتاخد ملي ثانية)، ولو لسه مشغول نرجّع busy مش "كود غلط"
    const rc = await acquireLock(tx, nationalId, 3000);
    if (rc === -1) {
      throw new AppError('الطلب شغال دلوقتي، جرّب بعد لحظة', 429, { retryAfter: 2 });
    }
    if (rc < 0) throw lockFailure(rc);

    // الفحص والزيادة في UPDATE واحد (الشروط جوه الـ WHERE)
    const claim = await new sql.Request(tx)
      .input('nid', sql.VarChar(14), nationalId)
      .input('max', sql.Int, MAX_ATTEMPTS)
      .query(`UPDATE dbo.Otps
              SET attempts = attempts + 1
              OUTPUT inserted.id, inserted.code_hash
              WHERE id = (SELECT TOP 1 id FROM dbo.Otps
                          WHERE national_id = @nid AND used = 0 ORDER BY id DESC)
                AND used = 0
                AND attempts < @max
                AND expires_at > SYSUTCDATETIME()`);

    const row = claim.recordset[0];
    if (!row) {
      await tx.commit();
      return false;
    }

    const given = Buffer.from(hashCode(nationalId, String(code)));
    const expected = Buffer.from(row.code_hash);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      await tx.commit(); // مهم: Commit عشان المحاولة الغلط تتحسب
      return false;
    }

    const consumed = await new sql.Request(tx)
      .input('id', sql.Int, row.id)
      .query('UPDATE dbo.Otps SET used = 1 WHERE id = @id AND used = 0');

    await tx.commit();
    return consumed.rowsAffected[0] === 1;
  } catch (err) {
    try { await tx.rollback(); } catch { /* الـ transaction خلصت أصلاً */ }
    throw err;
  }
}

module.exports = { createOtp, verifyOtp };
