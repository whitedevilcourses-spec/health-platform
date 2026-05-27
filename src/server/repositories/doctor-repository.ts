import { DoctorProfileModel } from "@/server/models/doctor-profile";

export async function searchDoctors(filter: Record<string, unknown>) {
  return DoctorProfileModel.find(filter)
    .populate("userId", "fullName email profile")
    .populate("hospitalId", "name slug address rating emergencySupport")
    .sort({ status: -1, rating: -1, createdAt: -1 })
    .lean();
}
