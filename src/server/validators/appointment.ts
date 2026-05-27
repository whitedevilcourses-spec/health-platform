import { z } from "zod";

export const appointmentSchema = z.object({
  patientId: z.string().optional(),
  triageSessionId: z.string().optional(),
  doctorId: z.string().optional(),
  hospitalId: z.string().optional(),
  doctorName: z.string().optional(),
  hospitalName: z.string().optional(),
  patientName: z.string().min(2),
  patientEmail: z.string().email(),
  patientPhone: z.string().min(8),
  department: z.string().min(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().min(4),
  consultationType: z.enum(["video", "in_person", "callback"]).default("video"),
  notes: z.string().optional(),
  paymentProvider: z.string().optional(),
  paymentAmount: z.number().nonnegative().optional(),
  paymentCurrency: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.doctorId && !data.doctorName) {
    ctx.addIssue({
      code: "custom",
      path: ["doctorId"],
      message: "Doctor reference is required.",
    });
  }

  if (!data.hospitalId && !data.hospitalName) {
    ctx.addIssue({
      code: "custom",
      path: ["hospitalId"],
      message: "Hospital reference is required.",
    });
  }
});
