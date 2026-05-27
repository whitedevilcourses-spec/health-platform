import mongoose from "mongoose";
import { connectToDatabase } from "@/server/db/mongoose";
import { createAppointmentRecord, listAppointmentsByEmail } from "@/server/repositories/appointment-repository";
import { findHospitalById } from "@/server/repositories/hospital-repository";
import { DoctorProfileModel } from "@/server/models/doctor-profile";

function asObjectId(id?: string) {
  return id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

export async function bookAppointment(input: {
  patientId?: string;
  triageSessionId?: string;
  doctorId?: string;
  hospitalId?: string;
  doctorName?: string;
  hospitalName?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  department: string;
  date: string;
  timeSlot: string;
  consultationType: "video" | "in_person" | "callback";
  notes?: string;
  paymentProvider?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
}) {
  await connectToDatabase();

  const hospitalObjectId = asObjectId(input.hospitalId);
  const doctorObjectId = asObjectId(input.doctorId);

  const [hospital, doctor] = await Promise.all([
    hospitalObjectId ? findHospitalById(hospitalObjectId.toString()) : Promise.resolve(null),
    doctorObjectId ? DoctorProfileModel.findById(doctorObjectId).lean() : Promise.resolve(null),
  ]);

  const resolvedHospitalName = hospital?.name || input.hospitalName || "Healthcare Facility";
  const resolvedDoctorName = input.doctorName || doctor?.specialty || "Consulting Physician";

  const slotKey = `${input.doctorId || resolvedDoctorName}:${input.date}:${input.timeSlot}`;

  try {
    const appointment = await createAppointmentRecord({
      patientId: asObjectId(input.patientId),
      doctorId: doctorObjectId,
      hospitalId: hospitalObjectId,
      externalDoctorId: doctorObjectId ? undefined : input.doctorId,
      externalHospitalId: hospitalObjectId ? undefined : input.hospitalId,
      externalDoctorName: doctorObjectId ? undefined : resolvedDoctorName,
      externalHospitalName: hospitalObjectId ? undefined : resolvedHospitalName,
      triageSessionId: input.triageSessionId
        ? asObjectId(input.triageSessionId)
        : undefined,
      scheduledDate: input.date,
      timeSlot: input.timeSlot,
      slotKey,
      consultationType: input.consultationType,
      notes: input.notes,
      bookedFor: {
        patientName: input.patientName,
        patientEmail: input.patientEmail.toLowerCase(),
        patientPhone: input.patientPhone,
        department: input.department,
      },
      payment: {
        provider: input.paymentProvider || "manual",
        status: input.paymentAmount ? "paid" : "pending",
        amount: input.paymentAmount || hospital?.consultationFee || 0,
        currency: input.paymentCurrency || "INR",
      },
    });

    return {
      id: appointment._id.toString(),
      status: appointment.status,
      doctorId: input.doctorId || doctorObjectId?.toString() || null,
      doctorName: resolvedDoctorName,
      hospitalId: input.hospitalId || hospitalObjectId?.toString() || null,
      hospitalName: resolvedHospitalName,
      date: appointment.scheduledDate,
      timeSlot: appointment.timeSlot,
      consultationType: appointment.consultationType,
      paymentStatus: appointment.payment.status,
      createdAt: appointment.createdAt,
    };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const bookingError = new Error("This slot has already been booked. Please choose another slot.");
      (bookingError as Error & { status?: number }).status = 409;
      throw bookingError;
    }

    throw error;
  }
}

export async function getAppointmentHistory(email: string) {
  await connectToDatabase();
  return listAppointmentsByEmail(email);
}
