import { model, models, Schema, type InferSchemaType } from "mongoose";
import { USER_ROLES } from "@/server/types/domain";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "patient",
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    emailVerifiedAt: Date,
    otpVerifiedAt: Date,
    refreshTokenHash: {
      type: String,
      select: false,
    },
    profile: {
      gender: String,
      dateOfBirth: Date,
      locationLabel: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    authProviders: {
      googleId: String,
      appleId: String,
    },
  },
  {
    timestamps: true,
  }
);

export type UserDocument = InferSchemaType<typeof UserSchema> & { _id: Schema.Types.ObjectId };

export const UserModel = models.User || model("User", UserSchema);
