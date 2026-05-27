import { z } from "zod";
import { USER_ROLES } from "@/server/types/domain";

export const signupSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().min(8).max(20).optional(),
  role: z.enum(USER_ROLES).default("patient"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
