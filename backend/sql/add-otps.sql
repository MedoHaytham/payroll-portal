-- لو الداتابيز اتعملت قبل كده، شغّل الملف ده بس
USE PayrollPortal;
GO
CREATE TABLE dbo.Otps (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  national_id VARCHAR(14) NOT NULL,
  channel     VARCHAR(10) NOT NULL,          -- email | whatsapp
  code_hash   VARCHAR(64) NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  used        BIT NOT NULL DEFAULT 0,
  created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  expires_at  DATETIME2 NOT NULL
);
CREATE INDEX IX_Otps_national_id ON dbo.Otps(national_id, id DESC);
GO
