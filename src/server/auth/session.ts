import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookies, signAccessToken, signRefreshToken, verifyToken } from "@/server/auth/token";
import { UserModel } from "@/server/models/user";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const baseCookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function persistSession(response: NextResponse, user: {
  id: string;
  email: string;
  role: string;
}) {
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = await signRefreshToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  response.cookies.set(authCookies.access, accessToken, {
    ...baseCookieConfig,
    maxAge: 60 * 15,
  });
  response.cookies.set(authCookies.refresh, refreshToken, {
    ...baseCookieConfig,
    maxAge: 60 * 60 * 24 * 30,
  });

  const refreshTokenHash = await hashPassword(refreshToken);
  await UserModel.findByIdAndUpdate(user.id, { refreshTokenHash });

  return response;
}

export async function clearSession(response: NextResponse) {
  response.cookies.set(authCookies.access, "", {
    ...baseCookieConfig,
    expires: new Date(0),
  });
  response.cookies.set(authCookies.refresh, "", {
    ...baseCookieConfig,
    expires: new Date(0),
  });
  return response;
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const access = cookieStore.get(authCookies.access)?.value;
  const refresh = cookieStore.get(authCookies.refresh)?.value;

  if (!access && !refresh) {
    return null;
  }

  try {
    if (access) {
      const payload = await verifyToken(access);
      const user = await UserModel.findById(payload.sub).lean();
      return user;
    }
  } catch {
    // Fall through to refresh token rotation.
  }

  if (!refresh) {
    return null;
  }

  try {
    const payload = await verifyToken(refresh);
    const user = await UserModel.findById(payload.sub).select("+refreshTokenHash").lean();
    if (!user?.refreshTokenHash) {
      return null;
    }

    const valid = await verifyPassword(refresh, user.refreshTokenHash);
    return valid ? user : null;
  } catch {
    return null;
  }
}
