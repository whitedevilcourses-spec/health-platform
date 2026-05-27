import { UserModel } from "@/server/models/user";

export async function findUserByEmail(email: string) {
  return UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash +refreshTokenHash");
}

export async function createUser(data: {
  email: string;
  fullName: string;
  passwordHash: string;
  phone?: string;
  role: string;
}) {
  return UserModel.create({
    email: data.email.toLowerCase(),
    fullName: data.fullName,
    passwordHash: data.passwordHash,
    phone: data.phone,
    role: data.role,
  });
}
