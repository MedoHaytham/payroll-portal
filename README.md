# Payroll Portal (Next.js + Express + SQL Server)

## 1) الداتابيز
شغّل `backend/sql/schema.sql` على SQL Server (SSMS أو Azure Data Studio).

## 2) الباك إند
```bash
cd backend
cp .env.example .env        # عدّل بيانات الداتابيز + الأسرار التلاتة (كل واحد 32+ حرف)
npm install
npm run import -- /path/to/egyptian_government_payroll_200_employees.xlsx
npm run dev                 # http://localhost:5000
```

## هيكل الباك إند
```
src/
  controllers/authController.js   # التسجيل (OTP) + login + refresh + logout
  routes/authRoutes.js            # /api/auth/*
  routes/me.js                    # /api/me (محمي بـ verifyToken)
  middleware/verifyToken.js
  services/otp.js, notify.js
  utils/appError.js, asyncWrapper.js, httpStatusText.js
```
الجلسة: `accessToken` (15 دقيقة) و `refreshToken` (7 أيام) في httpOnly cookies،
وهاش الـ refresh token متخزن في `Users.refresh_token_hash`. لو الداتابيز قديمة شغّل `backend/sql/add-refresh-token.sql`.

## 3) الفرونت إند
```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
```
(لو الـ API على بورت/سيرفر تاني: `API_URL=http://host:5000 npm run dev`)

## الفلو
- `/register`: رقم قومي ← اختيار وسيلة الكود (واتساب أو إيميل) ← إدخال الكود + الباسورد.
  الوسائل بتتجاب من عمودي `mobile` و `email` في جدول Employees (مش من المستخدم)، وبتظهر مخفية جزئياً.
- `/login`: رقم قومي + باسورد، والتوكن بيتخزن في httpOnly cookie.
- `/dashboard`: بيعرض صف الموظف اللي سجّل بس. الرقم القومي بيتاخد من التوكن مش من الـ URL.

## مهم: بيانات التواصل
عمودا Mobile number و E-mail Address فاضيين في ملف الإكسيل. املاهم الأول وشغّل `npm run import` تاني
(بيعمل تحديث للموجودين). من غيرهم التسجيل هيقف برسالة "مفيش وسيلة تواصل مسجلة".

## إعداد الـ OTP
- `OTP_DEV_MODE=true` بيخلي الواتساب بس يطبع الكود في console السيرفر (الإيميل دايماً بيتبعت فعلياً).
- إيميل: SendGrid (`SENDGRID_PASSWORD` = الـ API key، و`EMAIL_FROM` لازم يكون Sender متحقق منه في SendGrid).
- واتساب: WhatsApp Cloud API من Meta، وبيحتاج Template من نوع Authentication معتمد (اسمه في `WA_TEMPLATE_NAME`).
- الكود 6 أرقام، صالح 5 دقائق، 5 محاولات بس، وإعادة الإرسال بعد 60 ثانية.
- لو الداتابيز متعملة قبل كده، شغّل `backend/sql/add-otps.sql` بس.

## قبل الإنتاج
OTP_DEV_MODE=false، HTTPS إجباري (الكوكي secure)، JWT_SECRET عشوائي طويل، DB user بصلاحيات محدودة (مش sa)، وبلاش الداتا الحقيقية في بيئة تجريبية.
