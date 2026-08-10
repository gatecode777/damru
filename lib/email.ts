import nodemailer from "nodemailer";
import { getSettings } from "@/lib/getSettings";

// Build transporter dynamically using DB settings (fallback to env vars)
async function getTransporter() {
  const settings = await getSettings();

  const smtpUser = settings.smtpUser || process.env.SMTP_USER || "";
  const smtpPass = settings.smtpPass || process.env.SMTP_PASS || "";
  const smtpHost = settings.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = settings.smtpPort || Number(process.env.SMTP_PORT) || 587;
  const smtpSecure = settings.smtpSecure ?? (process.env.SMTP_SECURE === "true");
  const fromName = settings.smtpFromName || settings.siteName || "Damru By Namo";

  const transporter = nodemailer.createTransport({
    host:   smtpHost,
    port:   smtpPort,
    secure: smtpSecure,
    auth:   { user: smtpUser, pass: smtpPass },
  });

  return { transporter, smtpUser, fromName, siteName: settings.siteName };
}

export async function sendOtpEmail(to: string, otp: string, name?: string) {
  const { transporter, smtpUser, fromName, siteName } = await getTransporter();

  await transporter.sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to,
    subject: `Your OTP for ${siteName}`,
    html: `
      <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #e67e22, #d4691a); padding: 32px 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 1.8rem; letter-spacing: 2px;">${siteName}</h1>
        </div>
        <div style="padding: 36px 40px;">
          <h2 style="color: #111; font-size: 1.3rem; margin: 0 0 12px;">
            ${name ? `Hi ${name}, ` : ""}Your OTP is here
          </h2>
          <p style="color: #666; font-size: 0.9rem; line-height: 1.6; margin: 0 0 28px;">
            Use the code below to verify your identity. This code expires in <strong>10 minutes</strong>.
          </p>
          <div style="background: #fff7ed; border: 2px dashed #e67e22; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <span style="font-size: 2.8rem; font-weight: 800; color: #e67e22; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 0.8rem; text-align: center; margin: 0;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 40px; text-align: center;">
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">© ${new Date().getFullYear()} ${siteName}, Jaipur</p>
        </div>
      </div>
    `,
  });
}

/**
 * Generic reward-notification email — used for events that AREN'T a "+amount
 * added" credit (e.g. an expiry warning, where sendRewardEmail's "+" framing
 * would misleadingly imply Damru was just received rather than about to be
 * lost). Reuses the same transporter/branding, just without the amount badge.
 */
export async function sendNotificationEmail(to: string, notification: { title: string; message: string }, name?: string) {
  const { transporter, smtpUser, fromName, siteName } = await getTransporter();

  await transporter.sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to,
    subject: `${notification.title} — ${siteName}`,
    html: `
      <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #e67e22, #d4691a); padding: 32px 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 1.8rem; letter-spacing: 2px;">${siteName}</h1>
        </div>
        <div style="padding: 36px 40px;">
          <h2 style="color: #111; font-size: 1.3rem; margin: 0 0 12px;">
            ${name ? `Hi ${name}, ` : ""}${notification.title}
          </h2>
          <p style="color: #666; font-size: 0.9rem; line-height: 1.6; margin: 0;">${notification.message}</p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 40px; text-align: center;">
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">© ${new Date().getFullYear()} ${siteName}, Jaipur</p>
        </div>
      </div>
    `,
  });
}

export async function sendRewardEmail(
  to: string,
  reward: { title: string; amount: number; description?: string },
  name?: string
) {
  const { transporter, smtpUser, fromName, siteName } = await getTransporter();

  await transporter.sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to,
    subject: `${reward.title} — ${siteName}`,
    html: `
      <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #e67e22, #d4691a); padding: 32px 40px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 1.8rem; letter-spacing: 2px;">${siteName}</h1>
        </div>
        <div style="padding: 36px 40px;">
          <h2 style="color: #111; font-size: 1.3rem; margin: 0 0 12px;">
            ${name ? `Hi ${name}, ` : ""}${reward.title}
          </h2>
          <div style="background: #fff7ed; border: 2px dashed #e67e22; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 2.2rem; font-weight: 800; color: #e67e22;">+${reward.amount} Damru</span>
          </div>
          ${reward.description ? `<p style="color: #666; font-size: 0.9rem; line-height: 1.6; margin: 0;">${reward.description}</p>` : ""}
        </div>
        <div style="background: #f9f9f9; padding: 16px 40px; text-align: center;">
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">© ${new Date().getFullYear()} ${siteName}, Jaipur</p>
        </div>
      </div>
    `,
  });
}