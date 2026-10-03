import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { syncLeaveBalances } from "@/lib/leave-balance-server";

export async function PATCH(request, { params }) {
  const user = await getAuthUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id, 10);
  const body = await request.json();
  const { action, level } = body;

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true, leaveType: true },
  });
  if (!leave) return Response.json({ error: "Not found" }, { status: 404 });

  const isSuperAdmin =
    user.permissions.includes("Full System Access") ||
    user.permissions.includes("Approve Any Leave");
  const isAdmin = user.permissions.includes("Leave Approval") && user.role === "admin";
  const isManager = user.permissions.includes("View Team Leave Requests") || level === "manager";
  const isHR = user.permissions.includes("Final Leave Approval") || user.role === "hr";

  const updateData = {};

  if (action === "approve") {
    if (isSuperAdmin || isAdmin) {
      updateData.managerStatus = "Approved";
      updateData.hrStatus = "Approved";
      updateData.finalStatus = "Approved";
    } else if (isManager && leave.managerStatus === "Pending") {
      updateData.managerStatus = "Approved";
    } else if (isHR && leave.managerStatus === "Approved") {
      updateData.hrStatus = "Approved";
      updateData.finalStatus = "Approved";
    } else {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (action === "reject") {
    if (!isSuperAdmin && !isAdmin && !isManager && !isHR) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    updateData.managerStatus = action === "reject" ? "Rejected" : leave.managerStatus;
    updateData.hrStatus = "Rejected";
    updateData.finalStatus = "Rejected";
  } else {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  updateData.updatedBy = user.id;

  const year = new Date().getFullYear();

  if (updateData.finalStatus === "Approved" && leave.finalStatus !== "Approved") {
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        year,
      },
    });
    if (!balance) {
      return Response.json({ error: "Leave balance not found for employee" }, { status: 400 });
    }

    const approvedAgg = await prisma.leaveRequest.aggregate({
      where: {
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        finalStatus: "Approved",
        fromDate: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
      },
      _sum: { totalDays: true },
    });

    const usedAfter = Number(approvedAgg._sum.totalDays || 0) + Number(leave.totalDays);
    if (usedAfter > Number(balance.totalLeave)) {
      return Response.json(
        { error: `Insufficient ${leave.leaveType.leaveName} balance to approve this request` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: updateData,
  });

  if (
    updateData.finalStatus === "Approved" ||
    updateData.finalStatus === "Rejected"
  ) {
    await syncLeaveBalances(prisma, leave.employeeId, year);
  }

  await createAuditLog({
    userId: user.id,
    moduleName: "Leave Management",
    actionType: action === "approve" ? "APPROVE" : "REJECT",
    oldValue: { status: leave.finalStatus },
    newValue: { status: updateData.finalStatus },
  });

  if (leave.employeeId) {
    await createNotification({
      employeeId: leave.employeeId,
      title: action === "approve" ? "Leave Approved" : "Leave Rejected",
      message: `Your ${leave.leaveType.leaveName} request has been ${action === "approve" ? "approved" : "rejected"}.`,
      module: "Leave Management",
    });
  }

  return Response.json({ success: true, leave: updated });
}
