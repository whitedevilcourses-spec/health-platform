"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS, telemetryDoc, type UserRole } from "@/lib/firestore-healthcare";

interface TelemetryDetails {
  icuBeds: number;
  erWaitTime: number;
  erOccupancy: string;
}

interface TelemetryState {
  metroHealth: TelemetryDetails;
  stJude: TelemetryDetails;
}

interface NotificationDetails {
  id: string;
  type: string;
  text: string;
  time: string;
}

interface AmbulanceState {
  lat: number;
  lng: number;
  status: string;
  eta: string;
}

interface RealtimeContextType {
  telemetry: TelemetryState;
  notifications: NotificationDetails[];
  ambulance: AmbulanceState;
  sosTriggered: boolean;
  triggerSos: () => void;
  clearSos: () => void;
  onlineRole: "patient" | "doctor" | "admin" | "manager";
  setOnlineRole: (role: "patient" | "doctor" | "admin" | "manager") => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [sosTriggered, setSosTriggered] = useState(false);
  const [onlineRole, setOnlineRoleState] = useState<"patient" | "doctor" | "admin" | "manager">("patient");

  const setOnlineRole = (role: "patient" | "doctor" | "admin" | "manager") => {
    setOnlineRoleState(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("onlineRole", role);
    }
  };
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    metroHealth: { icuBeds: 10, erWaitTime: 15, erOccupancy: "Moderate" },
    stJude: { icuBeds: 4, erWaitTime: 8, erOccupancy: "Low" },
  });
  const [notifications, setNotifications] = useState<NotificationDetails[]>([
    { id: "init", type: "info", text: "Your care updates will appear here.", time: "Just now" }
  ]);
  const [ambulance, setAmbulance] = useState<AmbulanceState>({
    lat: 0,
    lng: 0,
    status: "Idle",
    eta: "Unavailable",
  });

  const triggerSos = () => {
    setSosTriggered(true);
  };

  const clearSos = () => {
    setSosTriggered(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem("onlineRole");
    if (saved === "patient" || saved === "doctor" || saved === "admin" || saved === "manager") {
      setOnlineRoleState(saved);
    }
  }, []);

  useEffect(() => {
    const telemetryUnsub = onSnapshot(
      telemetryDoc(),
      (snapshot) => {
        const payload = snapshot.data();
        if (!payload) return;

        if (payload.telemetry) {
          setTelemetry(payload.telemetry as TelemetryState);
        }

        if (payload.ambulance) {
          setAmbulance({
            ...(payload.ambulance as AmbulanceState),
            status: sosTriggered ? String((payload.ambulance as AmbulanceState).status || "En-route") : "Idle",
            eta: sosTriggered ? String((payload.ambulance as AmbulanceState).eta || "Pending") : "Standby",
          });
        }
      },
      (error) => {
        console.warn("Firestore telemetry listener error:", error);
      }
    );

    let notificationsUnsub: () => void = () => {};
    const authUnsub = onAuthStateChanged(auth, (user) => {
      notificationsUnsub();

      if (!user) {
        setNotifications([
          { id: "init", type: "info", text: "Sign in to see appointment and care updates.", time: "Now" },
        ]);
        return;
      }

      notificationsUnsub = onSnapshot(
        query(
          collection(db, COLLECTIONS.notifications),
          where("targetUserIds", "array-contains", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        ),
        (snapshot) => {
          setNotifications(
            snapshot.docs.map((item) => {
              const data = item.data() as Record<string, unknown>;
              return {
                id: item.id,
                type: String(data.type || "info"),
                text: String(data.text || ""),
                time: typeof data.createdAt === "string" ? data.createdAt : "Live",
              };
            })
          );
        },
        (error) => {
          if ((error as { code?: string }).code !== "permission-denied") {
            console.warn("Firestore notifications listener error:", error);
          }
          setNotifications([]);
        }
      );
    });

    return () => {
      telemetryUnsub();
      authUnsub();
      notificationsUnsub();
    };
  }, [sosTriggered]);

  return (
    <RealtimeContext.Provider
      value={{
        telemetry,
        notifications,
        ambulance,
        sosTriggered,
        triggerSos,
        clearSos,
        onlineRole,
        setOnlineRole,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}
