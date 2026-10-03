import { prisma } from "@/lib/prisma";

import { requireAuth } from "@/lib/auth-server";



export async function PATCH(request, { params }) {

  const { user, error } = await requireAuth(request);

  if (error) return error;



  const id = parseInt(params.id, 10);



  await prisma.notification.updateMany({

    where: { id, employeeId: user.id },

    data: { isRead: true },

  });



  return Response.json({ success: true });

}

