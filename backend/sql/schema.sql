IF DB_ID('PayrollPortal') IS NULL CREATE DATABASE PayrollPortal;
GO
USE PayrollPortal;
GO

-- بيانات الموظفين (بتتملي من ملف الإكسيل)
CREATE TABLE dbo.Employees (
  national_id               VARCHAR(14)   NOT NULL PRIMARY KEY,
  employee_code             VARCHAR(20)   NOT NULL,
  social_insurance_no       VARCHAR(20)   NOT NULL,
  employee_name             NVARCHAR(150) NOT NULL,
  gfmis_code                VARCHAR(20)   NULL,
  employment_status         NVARCHAR(50)  NULL,
  basic_salary              DECIMAL(12,2) NULL,
  variable_salary           DECIMAL(12,2) NULL,
  periodic_allowances       DECIMAL(12,2) NULL,
  special_allowances        DECIMAL(12,2) NULL,
  incentives_bonuses        DECIMAL(12,2) NULL,
  taxable_allowances        DECIMAL(12,2) NULL,
  exempt_allowances         DECIMAL(12,2) NULL,
  gross_earnings            DECIMAL(12,2) NULL,
  insurance_base            DECIMAL(12,2) NULL,
  employee_insurance_share  DECIMAL(12,2) NULL,
  income_tax                DECIMAL(12,2) NULL,
  health_insurance          DECIMAL(12,2) NULL,
  martyrs_fund              DECIMAL(12,2) NULL,
  disability_fund           DECIMAL(12,2) NULL,
  penalties                 DECIMAL(12,2) NULL,
  union_fees                DECIMAL(12,2) NULL,
  alimony                   DECIMAL(12,2) NULL,
  loans                     DECIMAL(12,2) NULL,
  total_deductions          DECIMAL(12,2) NULL,
  net_salary                DECIMAL(12,2) NULL,
  bank_account              VARCHAR(30)   NULL,
  bank_code                 VARCHAR(20)   NULL,
  mobile                    VARCHAR(20)   NULL,
  email                     NVARCHAR(150) NULL
);
GO

-- حسابات الدخول
CREATE TABLE dbo.Users (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  national_id    VARCHAR(14)  NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  refresh_token_hash VARCHAR(64) NULL,
  created_at     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Users_Employees FOREIGN KEY (national_id) REFERENCES dbo.Employees(national_id)
);
GO

-- أكواد التحقق (OTP)
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
