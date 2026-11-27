import nodemailer from 'nodemailer';

export function checkMailerConfiguration() {
  const smtpUrl = process.env.SMTP_URL;
  const resendApiKey = process.env.RESEND_API_KEY;
  const mailerServiceUrl = process.env.MAILER_SERVICE_URL;
  const isProd = process.env.NODE_ENV === 'production';

  if (!smtpUrl && !resendApiKey && !mailerServiceUrl) {
    if (isProd) {
      // Email delivery is optional for application startup: missing mail config must not
      // take down login or other routes that do not send email.
      console.warn('[MAILER NOTICE] No email provider configured in production. Email-dependent actions will not deliver messages.');
    } else {
      console.info('[MAILER NOTICE] No email provider configured in development. Links will be printed to server console.');
    }
  }
}

export function hasMailerConfiguration(): boolean {
  return Boolean(process.env.SMTP_URL || process.env.RESEND_API_KEY || process.env.MAILER_SERVICE_URL);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<boolean> {
  const smtpUrl = process.env.SMTP_URL;
  const resendApiKey = process.env.RESEND_API_KEY;
  const mailerServiceUrl = process.env.MAILER_SERVICE_URL;
  const mailerServiceToken = process.env.MAILER_SERVICE_TOKEN;
  const isProd = process.env.NODE_ENV === 'production';

  if (!smtpUrl && !resendApiKey && !mailerServiceUrl) {
    if (isProd) {
      console.error('[MAILER ERROR] No email provider configured in production (SMTP_URL, RESEND_API_KEY, or MAILER_SERVICE_URL required).');
      return false;
    } else {
      // Development fallback: log link to console
      console.info(`[MAILER DEV FALLBACK] Email to [REDACTED] | Subject: ${subject}`);
      if (text) {
        console.info(`[MAILER DEV CONTENT] ${text}`);
      }
      return true;
    }
  }

  try {
    if (smtpUrl) {
      const transporter = nodemailer.createTransport(smtpUrl);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@thapar.edu',
        to,
        subject,
        text,
        html,
      });
      return true;
    }

    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'noreply@thapar.edu',
          to: [to],
          subject,
          html: html || text,
          text,
        }),
      });
      if (!res.ok) {
        console.error('[MAILER RESEND ERROR] Provider rejected an email with status', res.status);
        return false;
      }
      return true;
    }

    if (mailerServiceUrl) {
      const res = await fetch(mailerServiceUrl, {
        method: 'POST',
        headers: {
          'Authorization': mailerServiceToken ? `Bearer ${mailerServiceToken}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, subject, html, text }),
      });
      if (!res.ok) {
        console.error('[MAILER SERVICE ERROR] Provider rejected an email with status', res.status);
        return false;
      }
      return true;
    }
    return false;
  } catch (err: any) {
    console.error('[MAILER ERROR] Email dispatch failed:', err?.message || err);
    return false;
  }
}
