import { z } from "zod";

export const assessmentSchema = z.object({
  sessionId: z.string().optional(),
  patientId: z.string().optional(),
  fullName: z.string().min(2),
  age: z.string().min(1),
  gender: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email(),
  location: z.string().min(2),
  symptoms: z.string().min(5),
  existingConditions: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  emergencyContact: z.string().min(8),
  additionalNotes: z.string().optional(),
});
