import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const COLLECTIONS = {
  users: "users",
  patients: "patients",
  doctors: "doctors",
  hospitals: "hospitals",
  departments: "departments",
  appointments: "appointments",
  slots: "slots",
  aiSessions: "aiSessions",
  chatMessages: "chatMessages",
  notifications: "notifications",
  reports: "reports",
  prescriptions: "prescriptions",
  emergencyRequests: "emergencyRequests",
  payments: "payments",
  reviews: "reviews",
  messages: "messages",
  telemetry: "telemetry",
} as const;

export type UserRole =
  | "patient"
  | "doctor"
  | "hospital_manager"
  | "admin"
  | "emergency_operator"
  | "support_staff";

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
}

export interface DoctorRecord {
  uid: string;
  fullName: string;
  specialty: string;
  hospitalId?: string;
  hospitalName?: string;
  city?: string;
  fee?: number;
  yearsOfExperience?: number;
  status?: "online" | "offline" | "busy";
  rating?: number;
  reviewCount?: number;
  createdAt?: Timestamp | string | null;
}

export interface HospitalRecord {
  id: string;
  name: string;
  description?: string;
  city?: string;
  address?: string;
  specialties?: string[];
  emergencySupport?: boolean;
  insuranceSupported?: boolean;
  consultationFee?: number;
  rating?: number;
  reviewCount?: number;
  departments?: string[];
  geohash?: string;
  coordinates?: { lat: number; lng: number };
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  patientEmail: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  department: string;
  date: string;
  timeSlot: string;
  slotKey: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  consultationType: "video" | "in_person" | "callback";
  notes?: string;
  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
}

export function listenToDoctors(
  callback: (doctors: DoctorRecord[]) => void,
  options?: { specialty?: string; onlineOnly?: boolean }
) {
  const clauses = [];
  if (options?.specialty) {
    clauses.push(where("specialty", "==", options.specialty));
  }
  if (options?.onlineOnly) {
    clauses.push(where("status", "==", "online"));
  }
  const q = query(collection(db, COLLECTIONS.doctors), ...clauses, orderBy("fullName"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((item) => item.data() as DoctorRecord));
  });
}

export function listenToHospitals(callback: (hospitals: HospitalRecord[]) => void) {
  const q = query(collection(db, COLLECTIONS.hospitals), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<HospitalRecord, "id">),
      }))
    );
  });
}

export function listenToAppointmentsForPatient(
  email: string,
  callback: (appointments: AppointmentRecord[]) => void
) {
  const q = query(
    collection(db, COLLECTIONS.appointments),
    where("patientEmail", "==", email.toLowerCase()),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<AppointmentRecord, "id">),
      }))
    );
  });
}

export function listenToDoctorAppointments(
  doctorId: string,
  callback: (appointments: AppointmentRecord[]) => void
) {
  const q = query(
    collection(db, COLLECTIONS.appointments),
    where("doctorId", "==", doctorId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<AppointmentRecord, "id">),
      }))
    );
  });
}

export function listenToNotifications(
  uid: string,
  role: UserRole,
  callback: (items: Array<Record<string, unknown>>) => void
) {
  const q = query(
    collection(db, COLLECTIONS.notifications),
    where("targetUserIds", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), role })));
  });
}

export function telemetryDoc(firestore: Firestore = db) {
  return doc(firestore, COLLECTIONS.telemetry, "live");
}

export function userDoc(uid: string, firestore: Firestore = db) {
  return doc(firestore, COLLECTIONS.users, uid);
}

export function doctorDoc(uid: string, firestore: Firestore = db) {
  return doc(firestore, COLLECTIONS.doctors, uid);
}

export function hospitalDoc(id: string, firestore: Firestore = db) {
  return doc(firestore, COLLECTIONS.hospitals, id);
}

export function slotDoc(slotKey: string, firestore: Firestore = db) {
  return doc(firestore, COLLECTIONS.slots, slotKey);
}

export function notificationDoc(id: string, firestore: Firestore = db) {
  return doc(firestore, COLLECTIONS.notifications, id);
}
