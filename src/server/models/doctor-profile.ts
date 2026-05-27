import { model, models, Schema, type InferSchemaType } from "mongoose";

const DoctorProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },
    specialty: { type: String, required: true, index: true },
    subspecialties: [String],
    bio: String,
    yearsOfExperience: Number,
    consultationFee: { type: Number, default: 0, index: true },
    languages: [String],
    rating: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: ["online", "offline", "busy"],
      default: "offline",
      index: true,
    },
    availability: {
      workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "17:00" },
      slotDurationMinutes: { type: Number, default: 30 },
      breakStart: String,
      breakEnd: String,
    },
  },
  {
    timestamps: true,
  }
);

export type DoctorProfileDocument = InferSchemaType<typeof DoctorProfileSchema> & {
  _id: Schema.Types.ObjectId;
};

export const DoctorProfileModel =
  models.DoctorProfile || model("DoctorProfile", DoctorProfileSchema);
