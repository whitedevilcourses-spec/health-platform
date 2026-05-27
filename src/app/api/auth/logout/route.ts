import { NextResponse } from "next/server";
import { clearSession } from "@/server/auth/session";

export async function POST() {
  return clearSession(NextResponse.json({ success: true }));
}
