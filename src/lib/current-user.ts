"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore-healthcare";

export type AppRole =
  | "patient"
  | "doctor"
  | "admin"
  | "manager"
  | "hospital_manager"
  | "emergency_operator"
  | "support_staff";

export interface CurrentUserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: AppRole;
  onboardingCompleted?: boolean;
  phone?: string | null;
  hospitalId?: string | null;
  profileImageUrl?: string | null;
  age?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: string | null;
}

export function getRoleHome(role?: AppRole | null) {
  if (role === "doctor") return "/doctor/dashboard";
  if (role === "admin" || role === "manager" || role === "hospital_manager") return "/admin/dashboard";
  return "/patient/dashboard";
}

export function getRoleProfileRoute(role?: AppRole | null) {
  if (role === "doctor") return "/doctor/profile";
  if (role === "admin" || role === "manager") return "/onboarding";
  return "/patient/profile";
}

export function useCurrentUserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProfile = onSnapshot(
        doc(db, COLLECTIONS.users, nextUser.uid),
        (snapshot) => {
          setProfile(
            snapshot.exists()
              ? ({ uid: snapshot.id, ...snapshot.data() } as CurrentUserProfile)
              : null
          );
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribeAuth();
    };
  }, []);

  return { user, profile, loading };
}
