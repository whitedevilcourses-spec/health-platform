import { NextResponse } from "next/server";
import { connectToDatabase } from "@/server/db/mongoose";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createUser, findUserByEmail } from "@/server/repositories/user-repository";
import { persistSession } from "@/server/auth/session";

export async function signupUser(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
}) {
  await connectToDatabase();

  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    phone: input.phone,
    role: input.role,
  });

  const response = NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  }, { status: 201 });

  // The cookie helper will overwrite the persisted hash immediately after token creation.
  return persistSession(response, {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });
}

export async function loginUser(input: { email: string; password: string }) {
  await connectToDatabase();

  const user = await findUserByEmail(input.email);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });

  return persistSession(response, {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });
}
