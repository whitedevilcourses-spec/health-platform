import { loginSchema } from "@/server/validators/auth";
import { loginUser } from "@/server/services/auth-service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid login payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return loginUser(parsed.data);
}
