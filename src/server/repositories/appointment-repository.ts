import { AppointmentModel } from "@/server/models/appointment";

export async function listAppointmentsByEmail(email: string) {
  return AppointmentModel.find({ "bookedFor.patientEmail": email.toLowerCase() })
    .sort({ createdAt: -1 })
    .lean();
}

export async function createAppointmentRecord(data: Parameters<typeof AppointmentModel.create>[0]) {
  return AppointmentModel.create(data);
}
