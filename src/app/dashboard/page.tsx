"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/lib/realtime-context";
import { db, rtdb } from "@/lib/firebase";
import { ref, onValue, push, set, update } from "firebase/database";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Calendar, Clock, Video, Hospital, User, FileText,
  HeartPulse, Activity, ShieldCheck, Brain, Award,
  TrendingUp, Download, Stethoscope, MapPin, Star, Phone,
  PhoneOff, Search, CheckCircle2, MessageSquare
} from "lucide-react";
import { VideoCallRoom } from "@/components/VideoCallRoom";
import { getRoleHome, useCurrentUserProfile } from "@/lib/current-user";
import { useFeedback } from "@/components/providers/feedback-provider";

export default function DashboardPage() {
  const router = useRouter();
  const { notifications } = useRealtime();
  const { user, profile, loading: profileLoading } = useCurrentUserProfile();
  const { showFeedback } = useFeedback();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [activeTab, setActiveTab] = useState<"appointments" | "records" | "analytics" | "doctors">("appointments");
  const [loading, setLoading] = useState(false);

  // Real-time doctor matching
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");

  // Video call state
  const [activeCallRequest, setActiveCallRequest] = useState<any | null>(null);
  const [callStatus, setCallStatus] = useState<"pending" | "accepted" | "rejected" | "ended" | null>(null);
  const callListenerRef = useRef<(() => void) | null>(null);

  // Rating state — shown after call ends
  const [ratingDoctor, setRatingDoctor] = useState<any | null>(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Load email from localStorage and start appointments listener
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
    if (profile.role !== "patient") {
      router.replace(getRoleHome(profile.role));
      return;
    }
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }

    const savedEmail = localStorage.getItem("patientEmail") || "";
    const fallbackEmail = profile.email || "";
    const activeEmail = savedEmail || fallbackEmail;
    if (activeEmail) {
      setEmailInput(activeEmail);
      subscribeToBookings(activeEmail);
      localStorage.setItem("patientEmail", activeEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile, user, router]);

  // Real-time doctors listener from Firestore
  useEffect(() => {
    if (!profile || profile.role !== "patient") return;
    setDoctorsLoading(true);
    const unsubscribe = onSnapshot(query(collection(db, "doctors"), orderBy("fullName")), (snap) => {
      const list: any[] = snap.docs.map((item) => {
        const data = item.data();
        return {
          uid: item.id,
          ...data,
          name: data.fullName,
          experience: data.yearsOfExperience ? `${data.yearsOfExperience} yrs` : "",
          reviews: data.reviewCount || 0,
          hospital: data.hospitalName,
        };
      }).filter((doctor) => doctor.uid !== user?.uid);
      list.sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (b.status === "online" && a.status !== "online") return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
      setDoctors(list);
      setDoctorsLoading(false);
    });
    return () => unsubscribe();
  }, [profile, user?.uid]);

  /* removed old init effect and folded into guarded flow */

  // Cleanup call listener on unmount
  useEffect(() => {
    return () => {
      if (callListenerRef.current) callListenerRef.current();
    };
  }, []);

  const subscribeToBookings = (email: string) => {
    if (!email) return;
    setLoading(true);
    localStorage.setItem("patientEmail", email);

    const appointmentsQuery = query(collection(db, "appointments"), where("patientEmail", "==", email.toLowerCase()));
    const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
      const nextAppointments: any[] = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left: any, right: any) => {
          const leftValue = left.createdAt && typeof left.createdAt === "object" && "seconds" in left.createdAt
            ? Number(left.createdAt.seconds)
            : 0;
          const rightValue = right.createdAt && typeof right.createdAt === "object" && "seconds" in right.createdAt
            ? Number(right.createdAt.seconds)
            : 0;
          return rightValue - leftValue;
        });
      setAppointments(nextAppointments);
      setLoading(false);
    }, (err) => {
      console.error("Firestore appointments error:", err);
      setLoading(false);
    });
    return unsubscribe;
  };

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    subscribeToBookings(emailInput);
  };

  // Initiate a video call request to a doctor via RTD
  const initiateCall = async (doctor: any) => {
    if (profile?.role !== "patient") {
      showFeedback({
        tone: "warning",
        title: "Patient access required",
        message: "Only patient accounts can start direct doctor calls.",
      });
      return;
    }

    const patientEmail = (profile.email || localStorage.getItem("patientEmail") || "").trim().toLowerCase();
    const patientName = profile.fullName?.trim() || patientEmail.split("@")[0] || "Patient";
    if (!patientEmail) {
      showFeedback({
        tone: "warning",
        title: "Email required",
        message: "Your patient email is missing. Please reopen your account profile and try again.",
      });
      return;
    }
    const callsRef = ref(rtdb, "callRequests");
    const newCallRef = push(callsRef);

    await set(newCallRef, {
      patientId: user?.uid || null,
      patientEmail,
      patientName,
      doctorId: doctor.uid,
      doctorName: doctor.name || doctor.fullName || "Doctor",
      doctorSpecialty: doctor.specialty || "",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    setActiveCallRequest({ ...doctor, callId: newCallRef.key });
    setCallStatus("pending");

    // Clean up any previous listener
    if (callListenerRef.current) callListenerRef.current();

    // Listen for doctor's response in real-time
    const callRef = ref(rtdb, `callRequests/${newCallRef.key}`);
    const unsubscribe = onValue(callRef, (snap) => {
      const val = snap.val();
      if (!val) return;
      if (val.status === "accepted") {
        setCallStatus("accepted");
      } else if (val.status === "rejected") {
        setCallStatus("rejected");
        setTimeout(() => {
          setActiveCallRequest(null);
          setCallStatus(null);
        }, 3000);
      } else if (val.status === "ended") {
        setCallStatus("ended");
        // Show rating modal instead of auto-dismiss
      }
    });
    callListenerRef.current = unsubscribe;
  };

  // Cancel / end call from patient side — trigger rating flow
  const endCallFromPatient = async () => {
    if (activeCallRequest?.callId) {
      await update(ref(rtdb, `callRequests/${activeCallRequest.callId}`), {
        status: "ended",
        endedAt: new Date().toISOString(),
      });
    }
    if (callListenerRef.current) {
      callListenerRef.current();
      callListenerRef.current = null;
    }
    // Move doctor info to rating modal, keep overlay open
    if (callStatus === "accepted" || callStatus === "ended") {
      setRatingDoctor(activeCallRequest);
      setSelectedStar(0);
      setRatingComment("");
      setRatingSubmitted(false);
    }
    setActiveCallRequest(null);
    setCallStatus(null);
  };

  // Submit star rating through the Firestore-backed review pipeline
  const submitRating = async () => {
    if (!ratingDoctor || selectedStar === 0) return;
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: ratingDoctor.uid,
          rating: selectedStar,
          comment: ratingComment.trim(),
          patientEmail: localStorage.getItem("patientEmail") || profile?.email || "Anonymous",
          patientId: user?.uid || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review");
      }
      setRatingSubmitted(true);
      setTimeout(() => setRatingDoctor(null), 2200);
    } catch (error) {
      showFeedback({
        tone: "error",
        title: "Review submission failed",
        message: error instanceof Error ? error.message : "We could not submit your review.",
      });
    }
  };

  // Filter doctors by city input
  const filteredDoctors = cityFilter
    ? doctors.filter((d) => d.city?.toLowerCase().includes(cityFilter.toLowerCase()))
    : doctors;
  const activeAppointments = appointments.filter((appointment) => appointment.status === "confirmed");
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const healthProfileSignals = [
    profile?.bloodGroup,
    profile?.gender,
    profile?.age ? String(profile.age) : null,
    profile?.emergencyContact,
  ].filter(Boolean).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return (
          <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case "busy":
        return (
          <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            In Consult
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-muted border border-border text-muted-foreground font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
            Offline
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 md:px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto relative z-10 max-w-6xl space-y-8">

        {/* Dashboard Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card/65 backdrop-blur-xl border border-border/50 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex gap-4 items-center">
            <div className="p-3.5 bg-primary/10 rounded-2xl shrink-0">
              <User className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                  Patient Medical Portal
                </h1>
                <Badge className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 font-extrabold uppercase text-[9px] tracking-wider px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-semibold">
                Manage consultations, view doctors in real-time, and start instant video calls.
              </p>
            </div>
          </div>

          <form onSubmit={handleFetch} className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1.5 shrink-0">
              <Label htmlFor="dashboardEmail" className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Retrieve Booking Records</Label>
              <Input
                id="dashboardEmail"
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="patient@aegis.com"
                className="bg-background/50 border-border/80 h-10 px-3.5 rounded-xl text-xs w-60"
              />
            </div>
            <Button type="submit" className="rounded-xl h-10 px-4 text-xs font-bold">
              Access History
            </Button>
          </form>
        </div>

        {/* Live Patient Signals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Upcoming Appointments</span>
              <span className="text-2xl font-black text-foreground">{activeAppointments.length}</span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Completed Consults</span>
              <span className="text-2xl font-black text-foreground">{completedAppointments.length}</span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Emergency Contact</span>
              <span className="text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/20 block mt-1">
                {profile?.emergencyContact || "Not added"}
              </span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-accent/10 text-accent rounded-xl shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Profile Readiness</span>
              <span className="text-2xl font-black text-foreground">{healthProfileSignals} <span className="text-xs font-bold text-emerald-500">/ 4 safety fields</span></span>
            </div>
          </Card>
        </div>

        {/* Tabs layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border border-border/50 bg-card/45 backdrop-blur-md rounded-2xl p-4">
              <div className="flex flex-col gap-2">
                {[
                  { id: "appointments", label: `Appointments (${appointments.length})`, icon: Calendar },
                  { id: "records", label: "Medical Records", icon: FileText },
                  { id: "analytics", label: "Health Analytics", icon: TrendingUp },
                  { id: "doctors", label: `Find Doctors (${doctors.length})`, icon: Stethoscope },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 text-left",
                      activeTab === id ? "bg-primary text-white shadow-md shadow-primary/10" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                    {id === "doctors" && doctors.filter(d => d.status === "online").length > 0 && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl p-6 text-center space-y-4">
              <div className="inline-flex p-3.5 bg-primary/15 rounded-full mb-1">
                <Brain className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <h4 className="font-extrabold text-sm text-foreground">AI Health Advisor</h4>
              <p className="text-xs text-muted-foreground leading-normal font-semibold">
                Analyze symptoms dynamically using advanced clinical model intelligence.
              </p>
              <Link
                href="/assessment"
                className={cn(buttonVariants({ size: "sm", className: "w-full text-xs font-bold rounded-lg bg-primary hover:bg-primary/95 text-white" }))}
              >
                Start Symptom Check
              </Link>
            </Card>
          </div>

          {/* Main panel */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">

              {/* Appointments Tab */}
              {activeTab === "appointments" && (
                <motion.div key="appointments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <h3 className="text-xl font-black tracking-tight text-foreground px-1">Scheduled Consultations</h3>

                  {loading ? (
                    <Card className="p-8 rounded-2xl border border-border/40 text-center animate-pulse text-muted-foreground text-xs font-bold">
                      Loading consultation records...
                    </Card>
                  ) : appointments.length === 0 ? (
                    <Card className="p-12 border border-border/40 bg-card/30 rounded-3xl text-center max-w-sm mx-auto space-y-4">
                      <div className="inline-flex p-4 bg-muted/65 rounded-full">
                        <Calendar className="w-8 h-8 text-muted-foreground/80" />
                      </div>
                      <h4 className="font-extrabold text-foreground tracking-tight">No Consultations Scheduled</h4>
                      <p className="text-xs text-muted-foreground leading-normal font-semibold">
                        Enter your email above to fetch history, or find a doctor below.
                      </p>
                      <Button variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setActiveTab("doctors")}>
                        Find a Doctor
                      </Button>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {appointments.map((appointment) => (
                        <Card key={appointment.id} className="border border-border/50 bg-card/45 hover:bg-card/75 rounded-2xl shadow-sm transition-all duration-200">
                          <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="flex gap-4">
                              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                                <Hospital className="w-6 h-6 text-primary" />
                              </div>
                              <div className="space-y-1.5 min-w-0">
                                <h4 className="font-bold text-base text-foreground tracking-tight leading-tight truncate">
                                  {appointment.hospitalName}
                                </h4>
                                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                                  {appointment.doctorName} ({appointment.department})
                                </p>
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                  <Badge className="bg-primary/15 border-primary/20 text-primary font-bold text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5">
                                    {appointment.consultationType}
                                  </Badge>
                                  <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5">
                                    {appointment.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-border/40 pt-4 sm:pt-0 gap-2 shrink-0">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                <Calendar className="w-3.5 h-3.5 text-primary/85" />
                                <span>{appointment.date}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/80">
                                <Clock className="w-3.5 h-3.5 text-primary/75" />
                                <span>{appointment.timeSlot}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Medical Records Tab */}
              {activeTab === "records" && (
                <motion.div key="records" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black tracking-tight text-foreground px-1">Prescriptions & Diagnostics</h3>
                    <Button size="sm" className="rounded-lg text-xs font-bold">Upload Record</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {completedAppointments.map((app) => (
                      <Card key={app.id} className="border border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] rounded-2xl shadow-sm p-6 flex flex-col justify-between gap-4 col-span-1 sm:col-span-2">
                        <div className="flex gap-3 items-start">
                          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                            <FileText className="w-5 h-5 animate-pulse" />
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex justify-between items-start flex-wrap gap-2">
                              <h4 className="font-extrabold text-sm text-foreground tracking-tight">Verified Digital Prescription</h4>
                              <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider rounded">Dispatched</Badge>
                            </div>
                            <p className="text-xs font-bold text-primary">{app.hospitalName} — {app.doctorName}</p>
                            <div className="text-[11px] text-muted-foreground font-semibold bg-muted/30 p-2 rounded-lg border border-border/40">
                              <span className="text-[9px] text-muted-foreground/60 uppercase block font-black mb-1">Clinical Notes</span>
                              {app.clinicalNotes || app.notes || "Clinical notes will appear here after the consultation is completed."}
                            </div>
                            <div className="text-xs bg-primary/[0.03] p-3 border border-primary/20 rounded-xl text-foreground font-mono leading-relaxed mt-2">
                              <span className="text-[9px] text-primary/80 uppercase block font-black mb-1">Rx Prescription</span>
                              {app.prescription || "Prescription will be uploaded by the treating doctor."}
                            </div>
                            <span className="text-[9px] text-muted-foreground/80 font-bold block pt-1">
                              Issued: {app.completedAt ? new Date(app.completedAt).toLocaleString() : ""}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {completedAppointments.length === 0 && (
                      <Card className="border border-border/50 bg-card/45 rounded-2xl p-6 text-sm text-muted-foreground font-semibold">
                        Completed consultations will surface prescriptions, clinical notes, and discharge instructions here once a doctor closes the encounter in the platform.
                      </Card>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Analytics Tab */}
              {activeTab === "analytics" && (
                <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <h3 className="text-xl font-black tracking-tight text-foreground px-1">Health Profile & Care Activity</h3>

                  <Card className="border border-border/50 bg-card/45 rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Blood Group</span>
                        <span className="text-3xl font-black text-foreground">{profile?.bloodGroup || "NA"}</span>
                        <p className="text-xs text-muted-foreground font-semibold mt-2">Pulled from your patient profile.</p>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Age & Gender</span>
                        <span className="text-3xl font-black text-foreground">{profile?.age || "--"}</span>
                        <p className="text-xs text-muted-foreground font-semibold mt-2">{profile?.gender || "Gender not recorded yet."}</p>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Doctor Network</span>
                        <span className="text-3xl font-black text-foreground">{doctors.length}</span>
                        <p className="text-xs text-muted-foreground font-semibold mt-2">Searchable verified doctor profiles available right now.</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-5 text-sm text-muted-foreground font-semibold leading-relaxed">
                      This section now shows only persisted patient profile and care activity data. Device telemetry and long-term vitals trends will appear once you connect actual sources instead of placeholder measurements.
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* ─── Find Doctors Tab (real-time RTD) ─── */}
              {activeTab === "doctors" && (
                <motion.div key="doctors" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="flex justify-between items-center flex-wrap gap-3 px-1">
                    <h3 className="text-xl font-black tracking-tight text-foreground">Matched Doctors</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Filter by city..."
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                          className="pl-8 h-9 text-xs rounded-xl border-border/80 bg-background/50 w-40"
                        />
                      </div>
                      <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Updates
                      </Badge>
                    </div>
                  </div>

                  {doctorsLoading ? (
                    <Card className="p-8 rounded-2xl border border-border/40 text-center animate-pulse text-muted-foreground text-xs font-bold">
                      Loading available doctors...
                    </Card>
                  ) : filteredDoctors.length === 0 ? (
                    <Card className="p-12 border border-dashed border-border/60 bg-card/15 rounded-3xl text-center max-w-md mx-auto space-y-4">
                      <div className="inline-flex p-4 bg-primary/10 rounded-full">
                        <Stethoscope className="w-8 h-8 text-primary/60" />
                      </div>
                      <h4 className="font-extrabold text-foreground tracking-tight">No Doctors Found</h4>
                      <p className="text-xs text-muted-foreground leading-normal font-semibold">
                        {cityFilter ? `No registered doctors in "${cityFilter}". Try a different city or clear the filter.` : "No doctors have registered yet. Check back soon."}
                      </p>
                      {cityFilter && (
                        <Button variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setCityFilter("")}>
                          Clear Filter
                        </Button>
                      )}
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredDoctors.map((doctor) => (
                        <motion.div
                          key={doctor.uid}
                          whileHover={{ y: -2 }}
                          className="bg-card/45 hover:bg-card/75 border border-border/50 rounded-2xl shadow-sm p-5 flex flex-col justify-between gap-4 transition-all duration-200 relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-accent opacity-40" />

                          <div className="flex justify-between items-start gap-3">
                            <div className="flex gap-3 items-start min-w-0">
                              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                                <Stethoscope className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-sm text-foreground tracking-tight leading-tight truncate">
                                  {doctor.name}
                                </h4>
                                <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                                  {doctor.specialty} • {doctor.experience}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(doctor.status)}
                          </div>

                          <div className="space-y-1 text-[11px] text-muted-foreground font-semibold">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
                              <span className="truncate">{doctor.hospital}{doctor.city ? `, ${doctor.city}` : ""}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                              <span className="font-bold text-foreground">{doctor.rating}</span>
                              <span>({doctor.reviews} reviews)</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-border/40">
                            <div>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold block">Fee</span>
                              <span className="font-black text-base text-foreground">${doctor.fee}</span>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href="/hospitals"
                                className={cn(buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl text-xs font-bold border-border/80" }))}
                              >
                                <Calendar className="w-3.5 h-3.5 mr-1 text-primary" /> Book
                              </Link>
                              {doctor.status === "online" && (
                                <Button
                                  size="sm"
                                  className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white flex items-center gap-1.5 shadow-md shadow-primary/10"
                                  onClick={() => initiateCall(doctor)}
                                >
                                  <Video className="w-3.5 h-3.5" /> Call
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ─── Video Call Status Modal ─── */}
      <AnimatePresence>
        {activeCallRequest && (
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
              className="w-full max-w-md bg-card border border-border/80 shadow-2xl rounded-3xl p-8 space-y-6"
            >
              {/* Pending — waiting for doctor */}
              {callStatus === "pending" && (
                <div className="text-center space-y-5">
                  <div className="inline-flex p-5 bg-primary/10 rounded-full relative">
                    <Phone className="w-10 h-10 text-primary" />
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Calling {activeCallRequest.name}...</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-semibold">Waiting for the doctor to accept your call</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-rose-500 border-rose-500/30 hover:bg-rose-500/10 font-bold flex items-center justify-center gap-2"
                    onClick={endCallFromPatient}
                  >
                    <PhoneOff className="w-4 h-4" /> Cancel Call
                  </Button>
                </div>
              )}

              {/* Accepted — REAL WebRTC video room */}
              {callStatus === "accepted" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold uppercase text-[9px] tracking-wider animate-pulse">
                      ● Connected
                    </Badge>
                    <span className="text-xs font-bold text-muted-foreground">{activeCallRequest.name}</span>
                  </div>
                  <VideoCallRoom
                    callId={activeCallRequest.callId}
                    role="caller"
                    remoteName={activeCallRequest.name}
                    remoteSpecialty={activeCallRequest.specialty}
                    onEnd={endCallFromPatient}
                  />
                </div>
              )}

              {/* Rejected */}
              {callStatus === "rejected" && (
                <div className="text-center space-y-5">
                  <div className="inline-flex p-5 bg-rose-500/10 rounded-full">
                    <PhoneOff className="w-10 h-10 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Call Declined</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-semibold">
                      {activeCallRequest.name} is unavailable right now. Please try booking an appointment.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl text-xs font-bold" onClick={() => { setActiveCallRequest(null); setCallStatus(null); }}>
                      Close
                    </Button>
                    <Link href="/hospitals" className={cn(buttonVariants({ className: "flex-1 rounded-xl text-xs font-bold" }))}>
                      Book Appointment
                    </Link>
                  </div>
                </div>
              )}

              {/* Ended — show rating prompt inside the same modal */}
              {callStatus === "ended" && (
                <div className="text-center space-y-5">
                  <div className="inline-flex p-4 bg-primary/10 rounded-full">
                    <Star className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Rate Your Consultation</h3>
                    <p className="text-xs text-muted-foreground mt-1">How was your call with {activeCallRequest?.name}?</p>
                  </div>
                  <div className="flex justify-center gap-2 py-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHoverStar(star)}
                        onMouseLeave={() => setHoverStar(0)}
                        onClick={() => setSelectedStar(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "w-9 h-9 transition-colors",
                            star <= (hoverStar || selectedStar)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Leave a comment (optional)..."
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    className="w-full min-h-[72px] text-xs p-3 rounded-xl border border-border bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl text-xs font-bold" onClick={() => { setActiveCallRequest(null); setCallStatus(null); }}>
                      Skip
                    </Button>
                    <Button
                      className="flex-1 rounded-xl text-xs font-bold"
                      disabled={selectedStar === 0}
                      onClick={() => {
                        // move to rating modal
                        setRatingDoctor({ ...activeCallRequest });
                        setRatingSubmitted(false);
                        setActiveCallRequest(null);
                        setCallStatus(null);
                      }}
                    >
                      Submit Rating
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Post-call Rating Modal ─── */}
      <AnimatePresence>
        {ratingDoctor && (
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
              {ratingSubmitted ? (
                <>
                  <div className="inline-flex p-4 bg-emerald-500/10 rounded-full">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Thank You! 🎉</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your rating helps improve care quality for everyone.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border-2 border-primary/20 flex items-center justify-center text-xl font-black text-primary mx-auto">
                      {ratingDoctor?.name?.charAt(0) || "D"}
                    </div>
                    <h3 className="text-lg font-black text-foreground pt-2">Rate {ratingDoctor?.name}</h3>
                    <p className="text-xs text-muted-foreground">{ratingDoctor?.specialty}</p>
                  </div>

                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHoverStar(star)}
                        onMouseLeave={() => setHoverStar(0)}
                        onClick={() => setSelectedStar(star)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={cn(
                            "w-10 h-10 transition-colors duration-150",
                            star <= (hoverStar || selectedStar)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/25"
                          )}
                        />
                      </button>
                    ))}
                  </div>

                  {selectedStar > 0 && (
                    <p className="text-xs font-bold text-primary">
                      {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][selectedStar]} experience
                    </p>
                  )}

                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground" />
                    <textarea
                      placeholder="Share your experience (optional)..."
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      className="w-full min-h-[80px] text-xs pl-8 pr-3 pt-3 pb-3 rounded-xl border border-border bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl text-xs font-bold"
                      onClick={() => setRatingDoctor(null)}
                    >
                      Skip
                    </Button>
                    <Button
                      className="flex-1 rounded-xl text-xs font-bold gap-1.5"
                      disabled={selectedStar === 0}
                      onClick={submitRating}
                    >
                      <Star className="w-3.5 h-3.5" />
                      Submit
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
