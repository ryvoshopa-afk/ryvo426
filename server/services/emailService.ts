import { Resend } from 'resend';

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
    | 'admin_notification'
    | 'bulk_email'
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

// Primary default admin email & Resend credentials
export const PRIMARY_ADMIN_EMAIL = 'ryvo.shopa@gmail.com';
export const DEFAULT_RESEND_API_KEY = 're_STwDkaCe_CU2mJyDXRejPaU4RZdwvN9h7';

export async function sendRealEmail(options: EmailDispatchOptions): Promise<{ success: boolean; log: EmailLogEntry }> {
  const settings = options.getSettings ? options.getSettings() : {};
  const emailConfig = settings.emailConfig || {};

  const senderEmail = emailConfig.senderEmail || process.env.SENDER_EMAIL || PRIMARY_ADMIN_EMAIL;
  const senderName = emailConfig.senderName || process.env.SENDER_NAME || 'متجر RYVO الرسمي';
  const resendApiKey = emailConfig.resendApiKey || process.env.RESEND_API_KEY || DEFAULT_RESEND_API_KEY;

  const logId = 'email_log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const timestamp = new Date().toISOString();
  const plainPreview = (options.text || options.html.replace(/<[^>]+>/g, ' ')).substring(0, 180).trim();

  let logStatus: 'Sent' | 'Failed' = 'Sent';
  let errorMessage: string | undefined = undefined;

  // Primary: Use Resend API for instant delivery without port/timeout blocks
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);

      // Try primary custom domain sender first
      let fromField = `${senderName} <${senderEmail}>`;
      
      let resendResponse = await resend.emails.send({
        from: fromField,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]+>/g, ' '),
        replyTo: PRIMARY_ADMIN_EMAIL
      });

      // Handle unverified domain on Resend free accounts cleanly
      if (resendResponse.error) {
        const errStr = JSON.stringify(resendResponse.error).toLowerCase();
        if (errStr.includes('domain') || errStr.includes('verify') || errStr.includes('validation')) {
          console.warn("⚠️ Resend domain unverified for custom sender, retrying with onboarding@resend.dev...");
          resendResponse = await resend.emails.send({
            from: `${senderName} <onboarding@resend.dev>`,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]+>/g, ' '),
            replyTo: PRIMARY_ADMIN_EMAIL
          });
        }
      }

      if (resendResponse.error) {
        throw new Error(resendResponse.error.message || 'Resend API dispatch failed');
      }

      console.log(`📧 [RESEND DISPATCH SUCCESS] Sent email to ${options.to} (${options.subject}) - ID: ${resendResponse.data?.id}`);
    } catch (err: any) {
      logStatus = 'Failed';
      errorMessage = err.message || String(err);
      console.error(`❌ [RESEND DISPATCH ERROR] Failed to send email to ${options.to}:`, errorMessage);
    }
  } else {
    console.log(`ℹ️ [EMAIL LOGGED] No Resend API key available. Email logged in simulated mode for ${options.to}`);
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

/**
 * Modern Dark Theme HTML Email Template with RYVO Logo Header
 */
export function buildHtmlEmailTemplate(
  title: string,
  greeting: string,
  contentHtml: string,
  ctaText?: string,
  ctaUrl?: string,
  badgeText?: string
): string {
  const currentYear = new Date().getFullYear();
  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body {
        font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Tahoma, Roboto, sans-serif;
        background-color: #090d16;
        color: #f1f5f9;
        margin: 0;
        padding: 24px 12px;
        direction: rtl;
        -webkit-font-smoothing: antialiased;
      }
      .email-wrapper {
        max-width: 620px;
        margin: 0 auto;
        background-color: #111827;
        border-radius: 20px;
        border: 1px solid #1f293d;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.08);
      }
      .email-header {
        background: linear-gradient(135deg, #0b101d 0%, #172033 100%);
        padding: 36px 28px 28px;
        text-align: center;
        border-bottom: 1px solid #1e293b;
        position: relative;
      }
      .logo-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: linear-gradient(135deg, #0284c7 0%, #6366f1 100%);
        color: #ffffff;
        font-size: 26px;
        font-weight: 900;
        margin-bottom: 12px;
        box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
      }
      .brand-title {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: 3px;
        color: #38bdf8;
        text-transform: uppercase;
        margin: 0;
        text-shadow: 0 0 20px rgba(56, 189, 248, 0.3);
      }
      .brand-slogan {
        margin: 6px 0 0;
        font-size: 13px;
        font-weight: 600;
        color: #94a3b8;
        letter-spacing: 0.5px;
      }
      .email-body {
        padding: 36px 30px;
        line-height: 1.8;
        font-size: 15px;
        color: #e2e8f0;
      }
      .header-badge {
        display: inline-block;
        padding: 6px 16px;
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 18px;
      }
      .main-title {
        font-size: 22px;
        font-weight: 800;
        color: #f8fafc;
        margin: 0 0 16px;
      }
      .greeting {
        font-size: 16px;
        font-weight: 700;
        color: #38bdf8;
        margin-bottom: 16px;
      }
      .content-box {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: 14px;
        padding: 20px;
        margin: 20px 0;
        color: #e2e8f0;
      }
      .cta-wrapper {
        text-align: center;
        margin-top: 32px;
        margin-bottom: 12px;
      }
      .cta-button {
        display: inline-block;
        padding: 14px 34px;
        background: linear-gradient(135deg, #0284c7 0%, #4338ca 100%);
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 12px;
        font-weight: 800;
        font-size: 15px;
        box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4);
        transition: all 0.2s ease;
      }
      .email-footer {
        background-color: #0b0f19;
        padding: 26px 24px;
        text-align: center;
        font-size: 12px;
        color: #64748b;
        border-top: 1px solid #1e293b;
      }
      .footer-links {
        margin-bottom: 12px;
      }
      .footer-links a {
        color: #38bdf8;
        text-decoration: none;
        margin: 0 8px;
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <!-- Header with RYVO Logo -->
      <div class="email-header">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <div class="logo-badge">R</div>
        </div>
        <h1 class="brand-title">RYVO STORE</h1>
        <p class="brand-slogan">المتجر الرسمي للمنتجات الفاخرة والرقمية</p>
      </div>

      <!-- Main Body -->
      <div class="email-body">
        ${badgeText ? `<div class="header-badge">${badgeText}</div>` : ''}
        <h2 class="main-title">${title}</h2>
        ${greeting ? `<p class="greeting">${greeting}</p>` : ''}
        <div>${contentHtml}</div>
        ${ctaText && ctaUrl ? `
          <div class="cta-wrapper">
            <a href="${ctaUrl}" target="_blank" class="cta-button">${ctaText}</a>
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <div class="footer-links">
          <a href="https://ryvo.shop">الموقع الرسمي</a> |
          <a href="https://ryvo.shop/support">الدعم الفني</a> |
          <a href="mailto:${PRIMARY_ADMIN_EMAIL}">${PRIMARY_ADMIN_EMAIL}</a>
        </div>
        <p style="margin: 4px 0;">تم إرسال هذه الرسالة تلقائياً عبر نظام متجر RYVO المعتمد.</p>
        <p style="margin: 4px 0;">© ${currentYear} RYVO Store. جميع الحقوق محفوظة.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Automated Order Status Emails Handler
 */
export async function sendCustomerOrderStatusEmail(
  order: any,
  newStatus: string,
  trackingNumber?: string,
  db?: any,
  getSettings?: () => any
) {
  if (!order || !order.user_email) return;

  const statusConfig: Record<string, { title: string; badge: string; text: string; trigger: any }> = {
    pending: {
      title: `تأكيد استلام الطلب #${order.id}`,
      badge: 'تم استلام الطلب 📥',
      text: 'شكراً لشرائك من متجر RYVO! تم استلام طلبك بنجاح وهو الآن قيد المراجعة والمعالجة من فريقنا.',
      trigger: 'order_confirmation'
    },
    processing: {
      title: `جاري تجهيز طلبك #${order.id}`,
      badge: 'جاري التجهيز ⚙️',
      text: 'نود إعلامك بأنه تم البدء بتجهيز طلبك وتعبئة المنتجات بعناية تامة في مستودعاتنا.',
      trigger: 'order_status_update'
    },
    shipped: {
      title: `تم شحن طلبك #${order.id}`,
      badge: 'تم الشحن 🚚',
      text: 'بشرى سارة! تم تسليم شحنتك لشركة الشحن وهي في طريقها إليك الآن.',
      trigger: 'order_shipping'
    },
    delivered: {
      title: `تم تسليم الطلب #${order.id}`,
      badge: 'تم التسليم بنجاح 🎁',
      text: 'نتمنى أن تكون سعيداً بمشترياتك! تم تسليم طلبك بنجاح.',
      trigger: 'order_status_update'
    },
    cancelled: {
      title: `إلغاء الطلب #${order.id}`,
      badge: 'تم إلغاء الطلب ❌',
      text: 'تم إلغاء هذا الطلب. إذا كان لديك أي استفسار يسعدنا تواصلك مع فريق الدعم الفني.',
      trigger: 'order_cancellation'
    },
    refunded: {
      title: `استرداد المبلغ للطلب #${order.id}`,
      badge: 'تم استرداد المبلغ 💳',
      text: 'تمت معالجة استرداد المبلغ الخاص بطلبك بنجاح.',
      trigger: 'order_refund'
    }
  };

  const cfg = statusConfig[newStatus] || {
    title: `تحديث حالة الطلب #${order.id}`,
    badge: `حالة جديدة: ${newStatus}`,
    text: `تم تحديث حالة طلبك إلى: ${newStatus}`,
    trigger: 'order_status_update'
  };

  const itemsHtml = (order.items || []).map((it: any) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #334155; font-size:13px;">
      <span>• ${it.name} [x${it.quantity}]</span>
      <span style="font-weight:700; color:#38bdf8;">${it.price * it.quantity} ر.س</span>
    </div>
  `).join('');

  const bodyContent = `
    <p>${cfg.text}</p>
    <div class="content-box">
      <div style="font-size:14px; font-weight:800; color:#38bdf8; margin-bottom:10px;">ملخص تفاصيل الطلب:</div>
      <div style="margin-bottom:8px;"><strong>رقم الطلب:</strong> #${order.id}</div>
      <div style="margin-bottom:8px;"><strong>تاريخ الطلب:</strong> ${order.date || new Date().toLocaleDateString('ar-SA')}</div>
      <div style="margin-bottom:8px;"><strong>إجمالي المبلغ:</strong> <span style="color:#38bdf8; font-weight:900;">${order.total} ر.س</span></div>
      <div style="margin-bottom:8px;"><strong>طريقة الدفع:</strong> ${order.payment_method === 'cod' ? 'الدفع عند الاستلام' : (order.payment_method || 'بطاقة إلكترونية')}</div>
      ${order.address ? `<div style="margin-bottom:8px;"><strong>عنوان التوصيل:</strong> ${order.address} (${order.phone || ''})</div>` : ''}
      ${trackingNumber || order.tracking_number ? `
        <div style="margin-top:14px; background:#0f172a; padding:12px; border-radius:10px; border:1px solid #0284c7; text-align:center;">
          <span style="color:#94a3b8; font-size:12px; display:block;">📦 رقم تتبع الشحنة:</span>
          <strong style="color:#38bdf8; font-size:18px; font-family:monospace;">${trackingNumber || order.tracking_number}</strong>
        </div>
      ` : ''}
      <div style="margin-top:14px; font-size:13px; color:#cbd5e1;">
        <strong style="display:block; margin-bottom:6px;">المنتجات المطلوب توصيلها:</strong>
        ${itemsHtml}
      </div>
    </div>
  `;

  return sendRealEmail({
    to: order.user_email.toLowerCase().trim(),
    subject: `${cfg.title} - متجر RYVO`,
    html: buildHtmlEmailTemplate(
      cfg.title,
      `مرحباً ${order.customer_name || 'عزيزي العميل'}،`,
      bodyContent,
      `متابعة تفاصيل الطلب`,
      `https://ryvo.shop/account/orders`,
      cfg.badge
    ),
    triggerEvent: cfg.trigger,
    db,
    getSettings
  });
}

/**
 * Instant Admin Notification Email on New Orders
 */
export async function sendAdminNewOrderNotification(
  order: any,
  db?: any,
  getSettings?: () => any
) {
  const adminEmail = PRIMARY_ADMIN_EMAIL;

  const itemsList = (order.items || []).map((it: any) => `
    <li style="margin-bottom:6px;">${it.name} (الكمية: ${it.quantity}) - ${it.price * it.quantity} ر.س</li>
  `).join('');

  const bodyContent = `
    <p>لقد قام عميل بإنشاء طلب شراء جديد في المتجر الآن!</p>
    <div class="content-box">
      <div style="font-size:15px; font-weight:800; color:#38bdf8; margin-bottom:12px;">بيانات الطلب الجديد:</div>
      <p style="margin:4px 0;"><strong>رقم الطلب:</strong> #${order.id}</p>
      <p style="margin:4px 0;"><strong>اسم العميل:</strong> ${order.customer_name || 'غير محدد'}</p>
      <p style="margin:4px 0;"><strong>بريد العميل:</strong> ${order.user_email}</p>
      <p style="margin:4px 0;"><strong>رقم الهاتف:</strong> ${order.phone || 'غير مدخل'}</p>
      <p style="margin:4px 0;"><strong>إجمالي الطلب:</strong> <span style="color:#38bdf8; font-weight:900; font-size:16px;">${order.total} ر.س</span></p>
      <p style="margin:4px 0;"><strong>طريقة الدفع:</strong> ${order.payment_method}</p>
      <p style="margin:4px 0;"><strong>عنوان التوصيل:</strong> ${order.address || 'غير مدخل'}</p>
      
      <div style="margin-top:14px; border-top:1px solid #334155; padding-top:10px;">
        <strong>قائمة المنتجات المطلوبة:</strong>
        <ul style="padding-right:20px; margin-top:6px; color:#e2e8f0;">
          ${itemsList}
        </ul>
      </div>
    </div>
  `;

  return sendRealEmail({
    to: adminEmail,
    subject: `🚨 طلب جديد في متجر RYVO: #${order.id} بقيمة (${order.total} ر.س)`,
    html: buildHtmlEmailTemplate(
      `إشعار طلب شراء جديد #${order.id}`,
      `تنبيه الإدارة،`,
      bodyContent,
      `عرض الطلب في لوحة التحكم`,
      `https://ryvo.shop/admin`,
      'طلب جديد 🛒'
    ),
    triggerEvent: 'admin_notification',
    db,
    getSettings
  });
}

/**
 * Instant Admin Notification Email on Tech Support Requests
 */
export async function sendAdminSupportRequestNotification(
  clientEmail: string,
  clientName: string,
  messageContent: string,
  sessionId?: string,
  db?: any,
  getSettings?: () => any
) {
  const adminEmail = PRIMARY_ADMIN_EMAIL;

  const bodyContent = `
    <p>قام عميل بطلب تحدث أو استفسار دعم فني جديد في المتجر!</p>
    <div class="content-box">
      <div style="font-size:15px; font-weight:800; color:#38bdf8; margin-bottom:10px;">تفاصيل طلب الدعم الفني:</div>
      <p style="margin:4px 0;"><strong>اسم العميل:</strong> ${clientName || 'عميل المتجر'}</p>
      <p style="margin:4px 0;"><strong>بريد العميل:</strong> ${clientEmail}</p>
      ${sessionId ? `<p style="margin:4px 0;"><strong>معرف الجلسة:</strong> <code>${sessionId}</code></p>` : ''}
      <div style="margin-top:12px; padding:12px; background:#0f172a; border-radius:10px; border-right:4px solid #38bdf8; color:#f1f5f9;">
        <strong>محتوى الرسالة / الاستفسار:</strong>
        <p style="margin:6px 0 0; font-style:italic;">"${messageContent}"</p>
      </div>
    </div>
  `;

  return sendRealEmail({
    to: adminEmail,
    subject: `💬 طلب دعم فني جديد من العميل: ${clientName || clientEmail}`,
    html: buildHtmlEmailTemplate(
      `تنبيه دعم فني جديد`,
      `عزيزي المدير،`,
      bodyContent,
      `الرد على العميل عبر لوحة التحكم`,
      `https://ryvo.shop/admin`,
      'دعم فني 💬'
    ),
    triggerEvent: 'support_message',
    db,
    getSettings
  });
}

/**
 * Safe Bulk Email Dispatcher with Rate-Limiting & Batch Processing
 */
export async function sendBulkNewsletterEmails(options: {
  subject: string;
  title: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  recipients: string[];
  db?: any;
  getSettings?: () => any;
}): Promise<{ total: number; successCount: number; failCount: number; failedEmails: string[] }> {
  // Deduplicate and sanitize recipient list
  const uniqueRecipients = Array.from(new Set(
    options.recipients
      .map(e => (e || '').toLowerCase().trim())
      .filter(e => e && e.includes('@'))
  ));

  let successCount = 0;
  let failCount = 0;
  const failedEmails: string[] = [];

  const batchSize = 10;
  const delayMs = 250; // Delay between batches to protect SMTP server from blocking

  for (let i = 0; i < uniqueRecipients.length; i += batchSize) {
    const chunk = uniqueRecipients.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (email) => {
        try {
          const res = await sendRealEmail({
            to: email,
            subject: options.subject,
            html: buildHtmlEmailTemplate(
              options.title,
              `عزيزي المشترك،`,
              options.contentHtml,
              options.ctaText || 'تصفح العروض الآن 🛍️',
              options.ctaUrl || 'https://ryvo.shop',
              'نشرة بريدية 📢'
            ),
            triggerEvent: 'bulk_email',
            db: options.db,
            getSettings: options.getSettings
          });

          if (res.success) {
            successCount++;
          } else {
            failCount++;
            failedEmails.push(email);
          }
        } catch (err) {
          failCount++;
          failedEmails.push(email);
        }
      })
    );

    // Wait before sending next batch
    if (i + batchSize < uniqueRecipients.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    total: uniqueRecipients.length,
    successCount,
    failCount,
    failedEmails
  };
}

