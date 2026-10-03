import { prisma } from "@/lib/prisma";
import { requireAuth, canManageEmployees } from "@/lib/auth-server";
import { createBank, listBanks } from "@/lib/banks";

export async function GET(request) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const banks = await listBanks(prisma);
    return Response.json({ banks });
  } catch (err) {
    console.error("List banks error:", err);
    return Response.json({ error: "Failed to load banks" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageEmployees(user)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await createBank(prisma, body.bankName);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ bank: result.bank, alreadyExists: Boolean(result.alreadyExists) }, { status: 201 });
  } catch (err) {
    console.error("Create bank error:", err);
    return Response.json({ error: err.message || "Failed to add bank" }, { status: 400 });
  }
}
