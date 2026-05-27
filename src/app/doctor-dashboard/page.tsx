"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  User, Video, Phone, ShieldCheck, HeartPulse, Activity,
  TrendingUp, Award, Clock, CheckCircle2,
  X, Stethoscope, Send, MapPin, PhoneOff, Laptop
} from "lucide-react";
import { VideoCallRoom } from "@/components/VideoCallRoom";
import { db, rtdb } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { doc, onSnapshot, collection, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getRoleHome, useCurrentUserProfile } from "@/lib/current-user";
import { useFeedback } from "@/components/providers/feedback-provider";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: profileLoading } = useCurrentUserProfile();
  const { showFeedback } = useFeedback();
  const [onlineState, setOnlineState] = useState<"online" | "busy" | "offline">("online");
  const [activeConsultation, setActiveConsultation] = useState<any | null>(null);
  const [prescriptionText, setPrescriptionText] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [consultSuccess, setConsultSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Real doctor data from RTD
  const [doctorProfile, setDoctorProfile] = useState<any>(null);

  // Patient appointment queue
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);

  // Incoming video call requests from patients
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCallRequest, setActiveCallRequest] = useState<any | null>(null);

  const confirmedAppointments = appointments.filter((appointment) => appointment.status === "confirmed");
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const totalRevenue = appointments.reduce((sum, appointment) => sum + Number(appointment.fee || doctorProfile?.fee || 0), 0);

  // Effect 1: doctor profile + incoming calls listener
  useEffect(() => {
    if (profileLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!profile) {
      router.replace("/onboarding");
      return;
    }
    if (profile.role !== "doctor") {
      router.replace(getRoleHome(profile.role));
      return;
    }
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }

    const profileUnsub = onSnapshot(doc(db, "doctors", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const nextDoctorProfile = snapshot.data();
        setDoctorProfile(nextDoctorProfile);
        setOnlineState(nextDoctorProfile.status || "online");
      }
    });

    const callUnsub = onValue(ref(rtdb, "callRequests"), (snap) => {
      const data = snap.val();
      const calls: any[] = [];
      if (data) {
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (val.doctorId === user.uid && val.status === "pending") {
            calls.push({ id: key, ...val });
          }
        });
      }
      setIncomingCalls(calls);
    });

    return () => {
      profileUnsub();
      callUnsub();
    };
  }, [profileLoading, profile, user, router]);

  // Effect 2: Appointments listener — re-runs when doctorProfile loads
  useEffect(() => {
    if (!user?.uid) return;

    setLoadingQueue(true);
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("doctorId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
      const list: any[] = snapshot.docs.map((item) => {
        const val = item.data() as Record<string, any>;
        return {
          id: item.id,
          name: val.patientName || "Anonymous Patient",
          age: val.patientAge || null,
          gender: val.patientGender || "Not specified",
          urgency:
            String(val.notes || "").toLowerCase().includes("severe") ||
            String(val.notes || "").toLowerCase().includes("acute") ||
            String(val.notes || "").toLowerCase().includes("emergency")
              ? "HIGH"
              : "MODERATE",
          symptom: val.notes || "Scheduled consultation.",
          time: val.timeSlot || "",
          status: val.status || "confirmed",
          createdAt: val.createdAt,
          ...val,
        };
      }).sort((left: any, right: any) => {
        const leftValue = left.createdAt && typeof left.createdAt === "object" && "seconds" in left.createdAt
          ? Number(left.createdAt.seconds)
          : 0;
        const rightValue = right.createdAt && typeof right.createdAt === "object" && "seconds" in right.createdAt
          ? Number(right.createdAt.seconds)
          : 0;
        return rightValue - leftValue;
      });
      setAppointments(list);
      setLoadingQueue(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Write status change to Firestore so discovery and dashboards stay aligned
  const updateStatus = async (status: "online" | "busy" | "offline") => {
    setOnlineState(status);
    if (user?.uid) {
      await updateDoc(doc(db, "doctors", user.uid), {
        status,
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleStartConsult = (patient: any) => {
    setActiveConsultation(patient);
    setConsultSuccess(false);
  };

  const handleFinishConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConsultation) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "appointments", activeConsultation.id), {
        status: "completed",
        clinicalNotes,
        prescription: prescriptionText,
        completedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      // Fire and forget the email so we don't block the UI if SMTP is slow
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeConsultation.patientEmail,
          subject: "Verified Digital Prescription Record",
          type: "prescription",
          html: `
            <div style="padding: 12px 0;">
              <p style="font-size: 15px; font-weight: bold; margin: 0 0 12px 0; color: #0f172a;">Digital Medical Record & Prescriptions</p>
              <p style="font-size: 13px; color: #4b5563; margin-bottom: 16px;">Your telehealth session with <strong>${doctorProfile?.name || "your doctor"}</strong> has concluded. Here is your compiled, E2E-shielded clinical prescription record:</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 9px; color: #94a3b8; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">Clinical Diagnostics Notes</span>
                <p style="font-size: 12px; color: #334155; margin: 0; font-weight: 600;">${clinicalNotes}</p>
              </div>
              <div style="background-color: #e0f2fe; border: 1px solid #bae6fd; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 9px; color: #0284c7; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">Rx Guidelines</span>
                <p style="font-size: 13px; color: #0369a1; font-family: monospace; font-weight: bold; margin: 0;">${prescriptionText}</p>
              </div>
            </div>
          `,
        }),
      }).then(async (emailRes) => {
        const emailData = await emailRes.json();
        if (emailRes.ok && emailData.previewUrl) {
          showFeedback({
            tone: "success",
            title: "Prescription dispatched",
            message: `The digital prescription and consultation summary were emailed to ${activeConsultation.patientEmail}.`,
            primaryAction: {
              label: "Open preview inbox",
              onClick: () => {
                window.open(emailData.previewUrl, "_blank", "noopener,noreferrer");
              },
            },
            secondaryAction: {
              label: "Done",
              variant: "outline",
            },
          });
        }
      }).catch((emailErr) => {
        console.error("Prescription email failed:", emailErr);
      });

      setConsultSuccess(true);
    } catch (err) {
      console.error("Firestore update error:", err);
      showFeedback({
        tone: "error",
        title: "Consultation could not be completed",
        message: "We could not finalize the clinical consultation record.",
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptCall = async (call: any) => {
    await update(ref(rtdb, `callRequests/${call.id}`), {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });
    setActiveCallRequest(call);
    // Mark as busy while on call
    await updateStatus("busy");
  };

  const rejectCall = async (call: any) => {
    await update(ref(rtdb, `callRequests/${call.id}`), {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    });
  };

  const endCall = async () => {
    if (activeCallRequest) {
      await update(ref(rtdb, `callRequests/${activeCallRequest.id}`), {
        status: "ended",
        endedAt: new Date().toISOString(),
      });
      setActiveCallRequest(null);
      // Back to online after call ends
      await updateStatus("online");
    }
  };

  const getUrgencyBadgeColor = (level: string) => {
    switch (level) {
      case "CRITICAL": return "bg-rose-500 text-white animate-pulse";
      case "HIGH": return "bg-orange-500 text-white";
      default: return "bg-amber-500 text-white";
    }
  };

  const displayName = doctorProfile?.fullName || doctorProfile?.name || "Doctor";
  const displaySpecialty = doctorProfile?.specialty || "";
  const hasIncomingCall = incomingCalls.length > 0 && !activeConsultation && !activeCallRequest;

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 md:px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto relative z-10 max-w-6xl space-y-8">

        {/* Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card/65 backdrop-blur-xl border border-border/50 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex gap-4 items-center">
            <div className="p-3.5 bg-primary/10 rounded-2xl shrink-0 relative">
              <Stethoscope className="w-8 h-8 text-primary animate-pulse" />
              {incomingCalls.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 border-2 border-background rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white font-black">{incomingCalls.length}</span>
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                  Doctor Clinical Dashboard
                </h1>
                {profileLoading ? (
                  <Badge className="bg-muted text-muted-foreground animate-pulse border-border font-bold uppercase text-[9px] px-2 py-0.5 rounded-lg">
                    Loading profile...
                  </Badge>
                ) : (
                  <Badge className="bg-primary/10 border border-primary/20 text-primary font-bold uppercase text-[9px] px-2 py-0.5 rounded-lg shadow-sm">
                    {displayName}{displaySpecialty ? ` (${displaySpecialty})` : ""}
                  </Badge>
                )}
              </div>
              {doctorProfile && (
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary/80" />
                  {doctorProfile.hospitalName || doctorProfile.hospital || "Hospital pending"} • {doctorProfile.city || "Location pending"}
                </p>
              )}
            </div>
          </div>

          {/* Status selector — writes to Firestore in real time */}
          <div className="space-y-1.5 shrink-0 select-none">
            <Label className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Platform Online Status</Label>
            <div className="flex gap-2 bg-muted/40 p-1 border border-border/60 rounded-xl">
              {[
                { id: "online", label: "Online", color: "bg-emerald-500" },
                { id: "busy", label: "Busy", color: "bg-amber-500" },
                { id: "offline", label: "Offline", color: "bg-muted-foreground" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => updateStatus(st.id as any)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-300",
                    onlineState === st.id ? "bg-background shadow text-foreground" : "text-muted-foreground/80 hover:text-foreground"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", st.color, onlineState === st.id && "animate-pulse")} />
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telemetries */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Confirmed Queue</span>
              <span className="text-2xl font-black text-foreground">
                {confirmedAppointments.length}{" "}
                <span className="text-xs font-bold text-muted-foreground/80">patients</span>
              </span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
              <TrendingUp className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Captured Revenue</span>
              <span className="text-2xl font-black text-foreground">
                ${totalRevenue.toLocaleString()}{" "}
                <span className="text-xs font-bold text-emerald-500">live</span>
              </span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Completed Consults</span>
              <span className="text-2xl font-black text-foreground">
                {completedAppointments.length}{" "}
                <span className="text-xs font-bold text-muted-foreground/80">
                  sessions closed
                </span>
              </span>
            </div>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Patient queue */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xl font-black tracking-tight text-foreground">Live Patient Queue</h3>
              <div className="flex items-center gap-2">
                {incomingCalls.length > 0 && (
                  <Badge className="bg-rose-500/10 border border-rose-500/30 text-rose-500 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <Phone className="w-3 h-3" />
                    {incomingCalls.length} Incoming Call{incomingCalls.length > 1 ? "s" : ""}
                  </Badge>
                )}
                <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[9px] tracking-wider px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </Badge>
              </div>
            </div>

            {loadingQueue ? (
              <Card className="p-8 border border-border/40 text-center animate-pulse text-muted-foreground text-xs font-bold bg-card/30 rounded-2xl">
                Syncing your Firestore appointment queue...
              </Card>
            ) : confirmedAppointments.length === 0 ? (
              <Card className="p-12 border border-dashed border-border/60 bg-card/15 rounded-3xl text-center max-w-md mx-auto space-y-4">
                <div className="inline-flex p-4 bg-primary/10 text-primary rounded-full relative">
                  <User className="w-8 h-8 text-primary" />
                  <span className="absolute top-1 right-1 h-3 w-3 bg-emerald-400 border border-background rounded-full animate-ping" />
                  <span className="absolute top-1 right-1 h-3 w-3 bg-emerald-500 border border-background rounded-full" />
                </div>
                <h4 className="font-extrabold text-foreground tracking-tight">Queue Empty & Available</h4>
                <p className="text-xs text-muted-foreground leading-normal font-semibold">
                  Patient bookings appear here instantly without refresh.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {confirmedAppointments.map((patient) => (
                    <Card key={patient.id} className="border border-border/50 bg-card/45 hover:bg-card/75 rounded-2xl shadow-sm transition-all duration-200">
                      <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-base text-foreground tracking-tight leading-none truncate">
                                {patient.name}
                              </h4>
                              <span className="text-[10px] text-muted-foreground font-semibold">({patient.age}yo)</span>
                              <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider", getUrgencyBadgeColor(patient.urgency))}>
                                {patient.urgency}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-semibold leading-relaxed truncate max-w-[300px] sm:max-w-md">
                              Symptom: {patient.symptom}
                            </p>
                          </div>
                        </div>

                          <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-border/40 pt-4 sm:pt-0 gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/80">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span>Slot: {patient.time}</span>
                            </div>
                            <Button
                              onClick={() => handleStartConsult(patient)}
                              size="sm"
                              className={cn(
                                "rounded-xl text-xs font-bold flex items-center gap-1.5",
                                patient.consultationType === "in_person"
                                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                                  : "bg-primary hover:bg-primary/95 text-white"
                              )}
                            >
                              {patient.consultationType === "in_person" ? (
                                <User className="w-3.5 h-3.5" />
                              ) : (
                                <Video className="w-3.5 h-3.5" />
                              )}
                              Start Consult
                            </Button>
                          </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>

          {/* Revenue chart */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-xl font-black tracking-tight text-foreground px-1">Practice Overview</h3>

            <Card className="border border-border/50 bg-card/45 rounded-2xl p-6 space-y-6">
              <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                <h4 className="font-bold text-sm text-foreground">Profile Visibility</h4>
                <p className="text-xs text-muted-foreground font-semibold mt-2">
                  Status: <span className="text-foreground">{onlineState}</span>
                </p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">
                  Specialty: <span className="text-foreground">{displaySpecialty || "Not completed"}</span>
                </p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">
                  Hospital: <span className="text-foreground">{doctorProfile?.hospitalName || "Not linked yet"}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                <h4 className="font-bold text-sm text-foreground">Consultation Economics</h4>
                <p className="text-xs text-muted-foreground font-semibold mt-2">
                  Fee per consult: <span className="text-foreground">${doctorProfile?.fee || 0}</span>
                </p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">
                  Reviews: <span className="text-foreground">{doctorProfile?.reviewCount || 0}</span>
                </p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">
                  Rating: <span className="text-foreground">{doctorProfile?.rating || 0}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground font-semibold leading-relaxed">
                This panel is now derived from your persisted doctor profile and booked appointments instead of demo analytics. As more real consultations happen, the queue, revenue, and review numbers will update live.
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ─── Incoming call modal — auto-shows when patient requests a call ─── */}
      <AnimatePresence>
        {hasIncomingCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-sm bg-card border border-border/80 shadow-2xl rounded-3xl p-8 space-y-6 text-center"
            >
              <div className="inline-flex p-5 bg-primary/10 rounded-full relative">
                <Phone className="w-10 h-10 text-primary" />
                <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              </div>

              <div>
                <h3 className="text-xl font-black text-foreground">Incoming Patient Call</h3>
                <p className="text-sm text-muted-foreground mt-1 font-semibold">
                  {incomingCalls[0].patientName || incomingCalls[0].patientEmail} wants to consult you
                </p>
                {incomingCalls.length > 1 && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    +{incomingCalls.length - 1} more waiting
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center justify-center gap-2"
                  onClick={() => rejectCall(incomingCalls[0])}
                >
                  <PhoneOff className="w-4 h-4" /> Decline
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-2"
                  onClick={() => acceptCall(incomingCalls[0])}
                >
                  <Phone className="w-4 h-4" /> Accept
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Active call room — REAL WebRTC (patient-initiated call accepted by doctor) ─── */}
      <AnimatePresence>
        {activeCallRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-3xl p-4 sm:p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <div>
                  <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold uppercase text-[9px] tracking-wider animate-pulse">
                    ● Live Call
                  </Badge>
                  <h3 className="text-xl font-black text-foreground tracking-tight mt-1">
                    {activeCallRequest.patientName || activeCallRequest.patientEmail}
                  </h3>
                </div>
                <button
                  onClick={endCall}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* REAL WebRTC video room */}
              <VideoCallRoom
                callId={activeCallRequest.id}
                role="callee"
                remoteName={activeCallRequest.patientName || "Patient"}
                onEnd={endCall}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Consultation overlay (booked appointment) ─── */}
      <AnimatePresence>
        {activeConsultation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-3xl p-6 sm:p-10 relative overflow-hidden"
            >
              <button
                onClick={() => { setActiveConsultation(null); setPrescriptionText(""); setClinicalNotes(""); }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>

              {consultSuccess ? (
                <div className="text-center space-y-6 py-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full mb-2">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Prescription Dispatched!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Digital prescription synced to {activeConsultation.name}&apos;s patient portal securely.
                  </p>
                  <Button
                    className="rounded-xl"
                    onClick={() => { setActiveConsultation(null); setPrescriptionText(""); setClinicalNotes(""); }}
                  >
                    Finish Session
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleFinishConsult} className="space-y-6">
                  <div className="space-y-2">
                    <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest">
                      {activeConsultation.consultationType === "in_person" ? "In-Person Consultation" : "Virtual Consultation"}
                    </Badge>
                    <h3 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                      {activeConsultation.consultationType === "in_person" ? "Clinic Room" : "Virtual Triage Room"}
                    </h3>
                    <p className="text-xs text-muted-foreground font-semibold">
                      Patient: {activeConsultation.name} ({activeConsultation.age}yo)
                    </p>
                  </div>

                  {activeConsultation.consultationType !== "in_person" ? (
                    <div className="h-44 w-full bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col justify-between p-4 relative overflow-hidden text-white">
                      <div className="flex justify-between items-center relative z-10 w-full">
                        <span className="text-[8px] bg-red-500 text-white font-extrabold tracking-widest px-1.5 py-0.5 rounded uppercase">Secure Video Link</span>
                        <span className="text-[8px] text-white/80 font-bold bg-zinc-800/80 border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Laptop className="w-3 h-3 text-primary animate-pulse" /> E2E Encrypted
                        </span>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 pointer-events-none">
                        <div className="w-12 h-12 bg-primary/20 rounded-full border border-primary flex items-center justify-center animate-pulse">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-[10px] font-bold text-white/85">Patient connected via video consult</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col justify-center items-center p-4 text-center">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-3">
                        <User className="w-6 h-6 text-amber-600" />
                      </div>
                      <h4 className="font-extrabold text-foreground tracking-tight">Patient is in the clinic</h4>
                      <p className="text-xs text-muted-foreground font-semibold mt-1">
                        Record clinical notes and prescribe medications below.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="clinicalNote" className="font-bold text-xs tracking-tight">Clinical Diagnostics Notes</Label>
                      <textarea
                        id="clinicalNote"
                        required
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Detail diagnostic findings..."
                        className="w-full bg-background border border-border/80 p-3 rounded-xl text-xs leading-relaxed min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prescNote" className="font-bold text-xs tracking-tight">Digital Prescription Builder</Label>
                      <textarea
                        id="prescNote"
                        required
                        value={prescriptionText}
                        onChange={(e) => setPrescriptionText(e.target.value)}
                        placeholder="e.g. Aspirin 75mg once daily after meal"
                        className="w-full bg-background border border-border/80 p-3 rounded-xl text-xs leading-relaxed min-h-[60px]"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-4">
                    <span className="text-[10px] text-muted-foreground/80 font-semibold max-w-[250px] leading-relaxed">
                      Completing uploads encrypted records to the patient&apos;s Aegis dashboard.
                    </span>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl px-5 h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center gap-2 shrink-0"
                    >
                      {loading ? "Compiling..." : (
                        <>
                          Compile & Dispatch
                          <Send className="w-4 h-4 text-white" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
