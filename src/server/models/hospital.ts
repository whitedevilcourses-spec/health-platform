import { model, models, Schema, type InferSchemaType } from "mongoose";

const HospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,
    specialties: [{ type: String, index: true }],
    departments: [{ type: String, index: true }],
    consultationFee: { type: Number, default: 0, index: true },
    rating: { type: Number, default: 0, index: true },
    emergencySupport: { type: Boolean, default: false, index: true },
    insuranceSupported: { type: Boolean, default: false },
    address: {
      line1: String,
      city: { type: String, index: true },
      state: String,
      country: String,
      postalCode: String,
      formatted: { type: String, index: true },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    telemetry: {
      icuBedsAvailable: { type: Number, default: 0 },
      erWaitMinutes: { type: Number, default: 0 },
      emergencyQueueDepth: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

HospitalSchema.index({ location: "2dsphere" });

export type HospitalDocument = InferSchemaType<typeof HospitalSchema> & { _id: Schema.Types.ObjectId };

export const HospitalModel = models.Hospital || model("Hospital", HospitalSchema);
