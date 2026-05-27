export const USER_ROLES = [
  "patient",
  "doctor",
  "hospital_manager",
  "admin",
  "emergency_operator",
  "support_staff",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "locked",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type AIProvider = "openai" | "gemini" | "rules";

export interface Coordinates {
  lat: number;
  lng: number;
}
