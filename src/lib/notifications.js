import { prisma } from "@/lib/prisma";



export async function createNotification({ employeeId, userId, title, message, module }) {

  return prisma.notification.create({

    data: { employeeId: employeeId ?? userId, title, message, module },

  });

}



export async function notifyUsers(employeeIds, payload) {

  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];

  if (!uniqueIds.length) return;

  await prisma.notification.createMany({

    data: uniqueIds.map((employeeId) => ({

      employeeId,

      title: payload.title,

      message: payload.message,

      module: payload.module,

    })),

  });

}



export async function getUsersByRole(roleName) {

  const employees = await prisma.employee.findMany({

    where: { status: "Active", role: { roleName } },

    select: { id: true },

  });

  return employees.map((e) => e.id);

}

export function getNotificationHref(module) {
  const key = String(module || "").toLowerCase();
  if (key.includes("leave")) return "/leaves";
  if (key.includes("employee")) return "/employees";
  if (key.includes("attendance")) return "/attendance";
  return null;
}

