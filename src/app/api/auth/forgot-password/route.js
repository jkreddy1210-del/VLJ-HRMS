import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { isValidEmail, AUTH_MESSAGES } from "@/lib/auth-validation";
import { sendPasswordResetEmail, isEmailConfigured } from "@/lib/email";

export async function POST(request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return Response.json({ error: AUTH_MESSAGES.emailRequired, field: "email" }, { status: 400 });
    }

    if (!isValidEmail(normalizedEmail)) {
      return Response.json({ error: AUTH_MESSAGES.emailRequired, field: "email" }, { status: 400 });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        email: normalizedEmail,
        status: "Active",
      },
    });

    if (!employee) {
      return Response.json(
        { error: AUTH_MESSAGES.emailRequired, field: "email" },
        { status: 400 }
      );
    }

    const successMessage = "A password reset link has been sent to your email.";

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        employeeId: employee.id,
        token,
        expiresAt,
      },
    });

    const appUrl = process.env.APP_URL || "https://hrms.varlakshmijewellery.co.in";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    if (!isEmailConfigured()) {
      console.error("[Password Reset] SMTP not configured — set SMTP_PASS in .env");
      return Response.json(
        { error: "Email service is not configured. Contact your administrator." },
        { status: 503 }
      );
    }

    try {
      await sendPasswordResetEmail({
        to: employee.email,
        resetUrl,
        employeeName: employee.fullName,
      });
    } catch (mailErr) {
      console.error("[Password Reset] Email send failed:", mailErr);
      return Response.json(
        { error: "Failed to send reset email. Please try again later." },
        { status: 500 }
      );
    }

    await createAuditLog({
      employeeId: employee.id,
      moduleName: "Authentication",
      actionType: "CREATE",
      newValue: { action: "Password Reset Requested", email: employee.email },
    });

    return Response.json({ message: successMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return Response.json({ error: "Request failed" }, { status: 500 });
  }
}
