import { connectToDatabase } from "@/server/db/mongoose";
import { getAuthenticatedUser } from "@/server/auth/session";

export async function GET() {
  await connectToDatabase();
  const user = await getAuthenticatedUser();

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      profile: user.profile || null,
    },
  });
}
