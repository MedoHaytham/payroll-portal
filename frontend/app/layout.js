import './globals.css';

export const metadata = { title: 'بوابة المرتبات' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
