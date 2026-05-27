import { HospitalModel } from "@/server/models/hospital";

export async function searchHospitals(filter: Record<string, unknown>) {
  return HospitalModel.find(filter).sort({ rating: -1, createdAt: -1 }).lean();
}

export async function findHospitalById(id: string) {
  return HospitalModel.findById(id).lean();
}
