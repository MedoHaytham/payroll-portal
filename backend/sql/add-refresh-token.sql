-- لو الداتابيز اتعملت قبل كده، شغّل الملف ده
USE PayrollPortal;
GO
ALTER TABLE dbo.Users ADD refresh_token_hash VARCHAR(64) NULL;
GO
