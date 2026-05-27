"use client";

import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore-healthcare";

export type ClientProfileRole = "patient" | "doctor" | "admin" | "manager";

export interface ClientBootstrapInput {
  role: ClientProfileRole;
  fullName: string;
  phone?: string;
}

export interface ClientCompleteInput {
  role: "patient" | "doctor" | "manager";
  fullName: string;
  phone?: string;
  patientProfile?: {
    username: string;
    age: number;
    gender: string;
    bloodGroup: string;
    conditions: string[];
    allergies: string[];
    emergencyContact: string;
  };
  doctorProfile?: {
    specialty: string;
    subSpecialization?: string;
    degrees: string;
    yearsOfExperience: number;
    city: string;
    hospitalId?: string;
    hospitalName: string;
    fee: number;
    languages: string[];
    availableTimings: string[];
  };
  hospitalProfile?: {
    hospitalName: string;
    departments: string[];
    address: string;
    facilities: string[];
    emergencySupport: boolean;
  };
  existingHospitalId?: string | null;
}

function requireSignedInUser() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No authenticated Firebase user is available.");
  }
  return currentUser;
}

export async function bootstrapClientProfile(input: ClientBootstrapInput) {
  const currentUser = requireSignedInUser();
  const userRef = doc(db, COLLECTIONS.users, currentUser.uid);
  const existingUser = await getDoc(userRef);

  if (existingUser.exists()) {
    await setDoc(
      userRef,
      {
        fullName: input.fullName,
        phone: input.phone || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { uid: currentUser.uid, ...(existingUser.data() as Record<string, unknown>) };
  }

  await setDoc(
    userRef,
    {
      uid: currentUser.uid,
      email: currentUser.email || "",
      fullName: input.fullName,
      phone: input.phone || null,
      role: input.role,
      onboardingCompleted: input.role === "admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { uid: currentUser.uid, role: input.role };
}

export async function completeClientProfile(input: ClientCompleteInput) {
  const currentUser = requireSignedInUser();
  const userRef = doc(db, COLLECTIONS.users, currentUser.uid);

  await setDoc(
    userRef,
    {
      uid: currentUser.uid,
      email: currentUser.email || "",
      fullName: input.fullName,
      phone: input.phone || null,
      role: input.role,
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (input.role === "patient" && input.patientProfile) {
    await setDoc(
      doc(db, COLLECTIONS.patients, currentUser.uid),
      {
        userId: currentUser.uid,
        email: currentUser.email || "",
        fullName: input.fullName,
        ...input.patientProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      userRef,
      {
        age: input.patientProfile.age,
        gender: input.patientProfile.gender,
        bloodGroup: input.patientProfile.bloodGroup,
        emergencyContact: input.patientProfile.emergencyContact,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (input.role === "doctor" && input.doctorProfile) {
    await setDoc(
      doc(db, COLLECTIONS.doctors, currentUser.uid),
      {
        uid: currentUser.uid,
        email: currentUser.email || "",
        fullName: input.fullName,
        specialty: input.doctorProfile.specialty,
        subSpecialization: input.doctorProfile.subSpecialization || "",
        degrees: input.doctorProfile.degrees,
        yearsOfExperience: input.doctorProfile.yearsOfExperience,
        city: input.doctorProfile.city,
        hospitalId: input.doctorProfile.hospitalId || "",
        hospitalName: input.doctorProfile.hospitalName,
        fee: input.doctorProfile.fee,
        languages: input.doctorProfile.languages,
        availableTimings: input.doctorProfile.availableTimings,
        status: "online",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (input.role === "manager" && input.hospitalProfile) {
    const normalizedDepartments = input.hospitalProfile.departments.map((department) => department.trim()).filter(Boolean);
    const normalizedFacilities = input.hospitalProfile.facilities.map((facility) => facility.trim()).filter(Boolean);
    const derivedCity = input.hospitalProfile.address.split(",")[0]?.trim() || "";
    const derivedDescription =
      normalizedFacilities.length > 0
        ? `Facilities include ${normalizedFacilities.slice(0, 3).join(", ")}.`
        : normalizedDepartments.length > 0
          ? `${normalizedDepartments.join(", ")} departments are currently listed for this hospital.`
          : "";
    const hospitalRef = input.existingHospitalId
      ? doc(db, COLLECTIONS.hospitals, input.existingHospitalId)
      : doc(collection(db, COLLECTIONS.hospitals));

    await setDoc(
      hospitalRef,
      {
        name: input.hospitalProfile.hospitalName,
        description: derivedDescription,
        departments: normalizedDepartments,
        address: input.hospitalProfile.address,
        facilities: normalizedFacilities,
        emergencySupport: input.hospitalProfile.emergencySupport,
        insuranceSupported: false,
        consultationFee: 0,
        rating: 0,
        reviewCount: 0,
        availableSlots: [],
        availableTimings: "",
        primaryDoctorId: "",
        primaryDoctorName: "",
        verified: false,
        verificationStatus: "pending",
        managerId: currentUser.uid,
        city: derivedCity,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      userRef,
      {
        hospitalId: hospitalRef.id,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { hospitalId: hospitalRef.id };
  }

  return { uid: currentUser.uid };
}
