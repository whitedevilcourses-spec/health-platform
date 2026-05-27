import { signupSchema } from "@/server/validators/auth";
import { signupUser } from "@/server/services/auth-service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid signup payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return signupUser(parsed.data);
}
