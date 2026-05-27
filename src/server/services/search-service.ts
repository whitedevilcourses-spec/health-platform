import { connectToDatabase } from "@/server/db/mongoose";
import { searchDoctors } from "@/server/repositories/doctor-repository";
import { searchHospitals } from "@/server/repositories/hospital-repository";

export async function queryHospitals(searchParams: URLSearchParams) {
  await connectToDatabase();

  const search = searchParams.get("search")?.trim();
  const department = searchParams.get("department")?.trim();
  const location = searchParams.get("location")?.trim();
  const emergencySupport = searchParams.get("emergency") === "true";
  const insuranceSupported = searchParams.get("insurance") === "true";
  const maxFee = searchParams.get("maxFee");
  const minRating = searchParams.get("minRating");

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { "address.formatted": { $regex: search, $options: "i" } },
      { departments: { $elemMatch: { $regex: search, $options: "i" } } },
      { specialties: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  if (department) {
    filter.departments = { $elemMatch: { $regex: department, $options: "i" } };
  }

  if (location) {
    filter["address.formatted"] = { $regex: location, $options: "i" };
  }

  if (emergencySupport) {
    filter.emergencySupport = true;
  }

  if (insuranceSupported) {
    filter.insuranceSupported = true;
  }

  if (maxFee || minRating) {
    filter.consultationFee = maxFee ? { $lte: Number(maxFee) } : undefined;
    filter.rating = minRating ? { $gte: Number(minRating) } : undefined;
  }

  return searchHospitals(filter);
}

export async function queryDoctors(searchParams: URLSearchParams) {
  await connectToDatabase();

  const specialty = searchParams.get("specialty")?.trim();
  const status = searchParams.get("status")?.trim();
  const hospitalId = searchParams.get("hospitalId")?.trim();

  const filter: Record<string, unknown> = {};
  if (specialty) {
    filter.specialty = { $regex: specialty, $options: "i" };
  }
  if (status) {
    filter.status = status;
  }
  if (hospitalId) {
    filter.hospitalId = hospitalId;
  }

  return searchDoctors(filter);
}
