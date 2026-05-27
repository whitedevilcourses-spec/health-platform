import { SignJWT, jwtVerify } from "jose";

const ACCESS_COOKIE_NAME = "healthcare_access_token";
const REFRESH_COOKIE_NAME = "healthcare_refresh_token";
const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return encoder.encode(secret);
}

export const authCookies = {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME,
};

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  type: "access" | "refresh";
}

export async function signAccessToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function signRefreshToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const result = await jwtVerify(token, getSecret());
  return result.payload as unknown as TokenPayload;
}
