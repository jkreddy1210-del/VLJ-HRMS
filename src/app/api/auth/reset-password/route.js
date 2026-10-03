import { prisma } from "@/lib/prisma";

import { hashPassword } from "@/lib/auth-server";

import { createAuditLog } from "@/lib/audit";



export async function POST(request) {

  try {

    const { token, password } = await request.json();



    if (!token || !password || password.length < 6) {

      return Response.json({ error: "Valid token and password (min 6 chars) required" }, { status: 400 });

    }



    const resetToken = await prisma.passwordResetToken.findUnique({

      where: { token },

      include: { employee: true },

    });



    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {

      return Response.json({ error: "Invalid or expired reset token" }, { status: 400 });

    }



    const passwordHash = await hashPassword(password);



    await prisma.$transaction([

      prisma.employee.update({

        where: { id: resetToken.employeeId },

        data: { passwordHash },

      }),

      prisma.passwordResetToken.update({

        where: { id: resetToken.id },

        data: { usedAt: new Date() },

      }),

    ]);



    await createAuditLog({

      employeeId: resetToken.employeeId,

      moduleName: "Authentication",

      actionType: "UPDATE",

      newValue: { action: "Password Reset Completed" },

    });



    return Response.json({ message: "Password updated successfully" });

  } catch (error) {

    console.error("Reset password error:", error);

    return Response.json({ error: "Reset failed" }, { status: 500 });

  }

}

