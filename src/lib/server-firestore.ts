import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  COLLECTIONS,
  type DoctorRecord,
  type HospitalRecord,
} from "@/lib/firestore-healthcare";

export async function searchHospitalsFromFirestore(filters: {
  search?: string;
  department?: string;
  location?: string;
  emergency?: boolean;
  insurance?: boolean;
  maxFee?: number | null;
  minRating?: number | null;
}): Promise<HospitalRecord[]> {
  const snapshot = await adminDb.collection(COLLECTIONS.hospitals).get();
  const searchLower = filters.search?.toLowerCase();
  const departmentLower = filters.department?.toLowerCase();
  const locationLower = filters.location?.toLowerCase();

  return snapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as Omit<HospitalRecord, "id">) }))
    .filter((hospital) => {
      const name = String(hospital.name || "").toLowerCase();
      const address = String(hospital.address || "").toLowerCase();
      const city = String(hospital.city || "").toLowerCase();
      const description = String(hospital.description || "").toLowerCase();
      const departments = Array.isArray(hospital.departments) ? hospital.departments : [];
      const specialties = Array.isArray(hospital.specialties) ? hospital.specialties : [];

      if (
        searchLower &&
        !name.includes(searchLower) &&
        !address.includes(searchLower) &&
        !city.includes(searchLower) &&
        !description.includes(searchLower) &&
        !departments.some((dept) => String(dept).toLowerCase().includes(searchLower)) &&
        !specialties.some((spec) => String(spec).toLowerCase().includes(searchLower))
      ) {
        return false;
      }

      if (departmentLower) {
        const matches = departments.some((dept) =>
          String(dept).toLowerCase().includes(departmentLower)
        );
        if (!matches) return false;
      }

      if (locationLower && !address.includes(locationLower) && !city.includes(locationLower)) {
        return false;
      }

      if (filters.emergency && !hospital.emergencySupport) {
        return false;
      }

      if (filters.insurance && !hospital.insuranceSupported) {
        return false;
      }

      if (typeof filters.maxFee === "number" && Number(hospital.consultationFee || 0) > filters.maxFee) {
        return false;
      }

      if (typeof filters.minRating === "number" && Number(hospital.rating || 0) < filters.minRating) {
        return false;
      }

      return true;
    })
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
}

export async function searchDoctorsFromFirestore(filters: {
  search?: string;
  specialty?: string;
  status?: string;
  hospitalId?: string;
  maxFee?: number | null;
}): Promise<DoctorRecord[]> {
  const snapshot = await adminDb.collection(COLLECTIONS.doctors).get();
  const searchLower = filters.search?.toLowerCase();
  const specialtyLower = filters.specialty?.toLowerCase();

  return snapshot.docs
    .map((item) => ({ uid: item.id, ...(item.data() as Omit<DoctorRecord, "uid">) }))
    .filter((doctor) => {
      const fullName = String(doctor.fullName || "").toLowerCase();
      const specialty = String(doctor.specialty || "").toLowerCase();
      const city = String(doctor.city || "").toLowerCase();
      if (
        searchLower &&
        !fullName.includes(searchLower) &&
        !specialty.includes(searchLower) &&
        !city.includes(searchLower)
      ) {
        return false;
      }
      if (specialtyLower && !specialty.includes(specialtyLower)) {
        return false;
      }
      if (filters.status && doctor.status !== filters.status) {
        return false;
      }
      if (filters.hospitalId && doctor.hospitalId !== filters.hospitalId) {
        return false;
      }
      if (typeof filters.maxFee === "number" && Number(doctor.fee || 0) > filters.maxFee) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
}

export async function createNotification(input: {
  type: string;
  title: string;
  text: string;
  targetUserIds: string[];
  metadata?: Record<string, unknown>;
}) {
  await adminDb.collection(COLLECTIONS.notifications).add({
    ...input,
    readBy: [],
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function toIsoDate(value: Timestamp | Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return value.toISOString();
}
