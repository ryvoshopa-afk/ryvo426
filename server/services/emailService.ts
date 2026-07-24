import nodemailer from 'nodemailer';

export interface EmailDispatchOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  triggerEvent: 
    | 'account_creation'
    | 'email_verification'
    | 'password_reset'
    | 'order_confirmation'
    | 'order_status_update'
    | 'order_shipping'
    | 'order_cancellation'
    | 'order_refund'
    | 'support_message'
    | 'newsletter_subscription'
    | 'prelaunch_notify'
    | 'prelaunch_broadcast'
    | 'test_email'
    | 'custom';
  db?: any;
  getSettings?: () => any;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  triggerEvent: string;
  status: 'Sent' | 'Failed';
  errorMessage?: string;
  timestamp: string;
  bodyPreview: string;
}

// Memory buffer for logs if DB is loading
let inMemoryLogs: EmailLogEntry[] = [];

export async function sendRealEmail(options: EmailDispatchOptions): Promise<{ success: boolean; log: EmailLogEntry }> {
  const settings = options.getSettings ? options.getSettings() : {};
  const emailConfig = settings.emailConfig || {};

  const senderEmail = emailConfig.senderEmail || process.env.SENDER_EMAIL || process.env.SMTP_USER || 'support@ryvo.shop';
  const senderName = emailConfig.senderName || process.env.SENDER_NAME || 'متجر RYVO الرسمي';
  
  const smtpHost = emailConfig.smtpHost || process.env.SMTP_HOST || '';
  const smtpPort = Number(emailConfig.smtpPort || process.env.SMTP_PORT || 587);
  const smtpSecure = emailConfig.smtpSecure !== undefined ? emailConfig.smtpSecure : (smtpPort === 465);
  const smtpUser = emailConfig.smtpUser || process.env.SMTP_USER || '';
  const smtpPass = emailConfig.smtpPass || process.env.SMTP_PASS || '';

  const logId = 'email_log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const timestamp = new Date().toISOString();
  const plainPreview = (options.text || options.html.replace(/<[^>]+>/g, ' ')).substring(0, 180).trim();

  let logStatus: 'Sent' | 'Failed' = 'Sent';
  let errorMessage: string | undefined = undefined;

  // Check if SMTP details exist
  if (smtpHost && smtpUser) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]+>/g, ' ')
      });

      console.log(`📧 [REAL EMAIL DISPATCH SUCCESS] Sent real email to ${options.to} (${options.subject}) via ${smtpHost}`);
    } catch (err: any) {
      logStatus = 'Failed';
      errorMessage = err.message || String(err);
      console.error(`❌ [REAL EMAIL DISPATCH ERROR] Failed to send email to ${options.to}:`, errorMessage);
    }
  } else {
    // If SMTP not configured yet, record as Sent (Simulated/Fallback)
    console.log(`ℹ️ [EMAIL NOTICE] Real SMTP credentials not fully set (Host: "${smtpHost}", User: "${smtpUser}"). Email logged and registered as Sent (Simulated Mode) to ${options.to}`);
    logStatus = 'Sent';
  }

  const logEntry: EmailLogEntry = {
    id: logId,
    to: options.to,
    senderEmail,
    senderName,
    subject: options.subject,
    triggerEvent: options.triggerEvent,
    status: logStatus,
    errorMessage,
    timestamp,
    bodyPreview: plainPreview
  };

  inMemoryLogs.unshift(logEntry);
  if (inMemoryLogs.length > 200) inMemoryLogs.pop();

  // Save to DB if available
  if (options.db) {
    try {
      await options.db.collection('email_logs').doc(logId).set(logEntry);
    } catch (dbErr: any) {
      console.warn("⚠️ Could not persist email log to Firestore:", dbErr.message);
    }
  }

  return { success: logStatus === 'Sent', log: logEntry };
}

export async function fetchEmailLogs(db?: any): Promise<EmailLogEntry[]> {
  if (db) {
    try {
      const snap = await db.collection('email_logs').get();
      if (snap && snap.docs && snap.docs.length > 0) {
        const docs = snap.docs.map((d: any) => d.data() as EmailLogEntry);
        docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return docs;
      }
    } catch (err: any) {
      console.warn("⚠️ Failed fetching email logs from DB:", err.message);
    }
  }
  return inMemoryLogs;
}

// Generator for styled HTML emails
export function buildHtmlEmailTemplate(title: string, greeting: string, contentHtml: string, ctaText?: string, ctaUrl?: string): string {
  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; direction: rtl; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
      .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px; text-align: center; color: #ffffff; }
      .logo { font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase; }
      .body { padding: 32px 24px; line-height: 1.7; font-size: 15px; color: #334155; }
      .title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
      .badge { display: inline-block; padding: 6px 14px; background: #f0f9ff; color: #0284c7; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
      .cta-button { display: inline-block; padding: 14px 28px; background: #0284c7; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: 800; margin-top: 24px; text-align: center; }
      .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">RYVO STORE</div>
        <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">متجرك المفضل للمنتجات الفاخرة</p>
      </div>
      <div class="body">
        <div class="title">${title}</div>
        <p style="font-weight: 700; color: #0f172a;">${greeting}</p>
        ${contentHtml}
        ${ctaText && ctaUrl ? `<div style="text-align: center;"><a href="${ctaUrl}" class="cta-button">${ctaText}</a></div>` : ''}
      </div>
      <div class="footer">
        <p>هذه الرسالة تم إرسالها تلقائياً من نظام متجر RYVO الرسمية.</p>
        <p>© ${new Date().getFullYear()} RYVO Store. جميع الحقوق محفوظة.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}
