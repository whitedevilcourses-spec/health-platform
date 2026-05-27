import { model, models, Schema, type InferSchemaType } from "mongoose";

const AISessionSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    patientSnapshot: {
      fullName: String,
      age: String,
      gender: String,
      email: String,
      phone: String,
      location: String,
      existingConditions: String,
      allergies: String,
      currentMedications: String,
    },
    symptomSummary: {
      type: String,
      required: true,
      index: true,
    },
    conversation: [
      {
        role: {
          type: String,
          enum: ["system", "assistant", "user"],
          required: true,
        },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    provider: {
      type: String,
      enum: ["openai", "gemini", "rules"],
      default: "rules",
    },
    triageResult: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ["collecting", "triaged"],
      default: "collecting",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export type AISessionDocument = InferSchemaType<typeof AISessionSchema> & {
  _id: Schema.Types.ObjectId;
};

export const AISessionModel = models.AISession || model("AISession", AISessionSchema);
