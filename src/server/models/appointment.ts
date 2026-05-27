import { model, models, Schema, type InferSchemaType } from "mongoose";
import { APPOINTMENT_STATUSES } from "@/server/types/domain";

const AppointmentSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      index: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },
    externalDoctorId: String,
    externalHospitalId: String,
    externalDoctorName: String,
    externalHospitalName: String,
    scheduledDate: { type: String, required: true, index: true },
    timeSlot: { type: String, required: true },
    slotKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: "confirmed",
      index: true,
    },
    consultationType: {
      type: String,
      enum: ["video", "in_person", "callback"],
      default: "video",
    },
    notes: String,
    triageSessionId: {
      type: Schema.Types.ObjectId,
      ref: "AISession",
    },
    bookedFor: {
      patientName: String,
      patientEmail: String,
      patientPhone: String,
      department: String,
    },
    payment: {
      provider: String,
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
      },
      transactionId: String,
      amount: Number,
      currency: { type: String, default: "INR" },
    },
    holdExpiresAt: Date,
  },
  {
    timestamps: true,
  }
);

AppointmentSchema.index(
  { slotKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["locked", "confirmed", "pending"] },
    },
  }
);

export type AppointmentDocument = InferSchemaType<typeof AppointmentSchema> & {
  _id: Schema.Types.ObjectId;
};

export const AppointmentModel =
  models.Appointment || model("Appointment", AppointmentSchema);
