const pug = require('pug');
const htmlToText = require('html-to-text');
const axios = require('axios');
const AppError = require('./appError');

module.exports = class Email {
  constructor(user, code) {
    this.to = user.email;
    this.from = `${process.env.EMAIL_FROM_NAME || 'بوابة المرتبات'} <${process.env.EMAIL_FROM}>`;
    this.code = code;
  }

  // Send actual email
  async send(template, subject) {
    // 1) Render html template
    const html = pug.renderFile(`${__dirname}/../views/emails/${template}.pug`, {
      code: this.code,
      subject
    });

    // 2) Parse from address to separate name and email
    let fromEmail = process.env.EMAIL_FROM;
    let fromName = 'بوابة المرتبات';
    const fromMatch = this.from.match(/(.+)\s*<(.+)>/);
    if (fromMatch) {
      fromName = fromMatch[1].trim();
      fromEmail = fromMatch[2].trim();
    }

    // 3) Send email (SendGrid)
    try {
      const res = await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: this.to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [
            { type: 'text/plain', value: htmlToText.convert(html) },
            { type: 'text/html', value: html }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_PASSWORD}`,
            'Content-Type': 'application/json'
          }
        }
      );
      // 202 = SendGrid استلم الطلب (مش معناه إنه وصل لصندوق الوارد)
      console.log(`SendGrid accepted email (${res.status}) -> ${this.to}`);
    } catch (err) {
      console.error('SendGrid email error:', err.response?.status, JSON.stringify(err.response?.data) || err.message);
      throw new AppError('تعذر إرسال الإيميل، جرّب وسيلة تانية أو حاول بعد شوية', 502);
    }
  }

  async sendOtp() {
    await this.send('otpEmail', 'كود التحقق - بوابة المرتبات');
  }
};
