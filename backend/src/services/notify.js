// OTP_DEV_MODE=true: الواتساب بس بيطبع الكود في الـ console (لحد ما تجهز Meta).
const WA_DEV = process.env.OTP_DEV_MODE === 'true';

// 010xxxxxxxx / 10xxxxxxxx / +2010xxxxxxxx -> 2010xxxxxxxx (الإكسيل ممكن يشيل الصفر الأول)
function toIntlPhone(raw) {
  let d = String(raw || '').replace(/\.0+$/, '').replace(/\D/g, '');
  if (d.startsWith('0020')) d = d.slice(2);
  if (d.startsWith('20') && d.length === 12) return d;
  if (d.startsWith('0') && d.length === 11) return '20' + d.slice(1);
  if (d.startsWith('1') && d.length === 10) return '20' + d;
  return null;
}

function maskPhone(intl) {
  return '*'.repeat(intl.length - 3) + intl.slice(-3);
}

function maskEmail(email) {
  const [user, domain] = email.split('@');
  return `${user[0]}${'*'.repeat(Math.max(user.length - 1, 2))}@${domain}`;
}

// WhatsApp Cloud API (Meta) - لازم Template من نوع Authentication معتمد
async function sendWhatsAppOtp(intlPhone, code) {
  if (WA_DEV) return console.log(`[DEV] whatsapp OTP to ${intlPhone}: ${code}`);
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: intlPhone,
        type: 'template',
        template: {
          name: process.env.WA_TEMPLATE_NAME,
          language: { code: process.env.WA_TEMPLATE_LANG || 'ar' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
}

module.exports = { toIntlPhone, maskPhone, maskEmail, sendWhatsAppOtp };
