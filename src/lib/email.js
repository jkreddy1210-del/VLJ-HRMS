import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "varlakshmijewellery@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM =
  process.env.SMTP_FROM || `VLJ HRMS <${process.env.SMTP_USER || "varlakshmijewellery@gmail.com"}>`;

export function isEmailConfigured() {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail({ to, resetUrl, employeeName }) {
  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_PASS in server .env");
  }

  const transporter = createTransporter();
  const greeting = employeeName ? `Hi ${employeeName},` : "Hi,";

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "VLJ HRMS — Reset your password",
    text: `${greeting}

We received a request to reset your VLJ HRMS password.

Open this link (valid for 1 hour):
${resetUrl}

If you did not request this, you can ignore this email.

— VLJ HRMS`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #2c2419;">
        <p>${greeting}</p>
        <p>We received a request to reset your <strong>VLJ HRMS</strong> password.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background:#b8956a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
            Reset Password
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">This link expires in 1 hour.</p>
        <p style="font-size: 13px; color: #666; word-break: break-all;">${resetUrl}</p>
        <p style="font-size: 13px; color: #666;">If you did not request this, you can ignore this email.</p>
        <p style="margin-top: 24px; font-size: 13px; color: #999;">— VLJ HRMS</p>
      </div>
    `,
  });
}
