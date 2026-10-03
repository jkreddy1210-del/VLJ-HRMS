import { getAuthUser, unauthorizedResponse } from "@/lib/auth-server";

export async function GET(request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();
  return Response.json({ user });
}
