"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { db, rtdb } from "@/lib/firebase";
import { ref, onValue, push, set, update } from "firebase/database";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { VideoCallRoom } from "@/components/VideoCallRoom";
import { useCurrentUserProfile } from "@/lib/current-user";
import { useFeedback } from "@/components/providers/feedback-provider";
import {
  Search, Star, Video, CalendarCheck, ShieldCheck,
  MapPin, Stethoscope, Heart, X, Phone,
  PhoneOff, CreditCard, CheckCircle2, Receipt,
  Building2, Wifi, Award
} from "lucide-react";

type DoctorDirectoryRecord = {
  uid: string;
  fullName?: string;
  name: string;
  specialty: string;
  hospital?: string;
  hospitalName?: string;
  hospitalId?: string;
  city?: string;
  fee?: number;
  rating?: number;
  reviewCount?: number;
  reviews?: number;
  status?: "online" | "offline" | "busy";
  yearsOfExperience?: number;
  experience?: string;
  availableTimings?: string[];
  isDemo?: boolean;
};

type SlotRecord = {
  id?: string;
  time?: string;
  display?: string;
  status?: "available" | "locked" | "booked";
};

type AppointmentConfirmation = {
  id: string;
  doctorName: string;
  hospitalName: string;
  date: string;
  timeSlot: string;
  consultationType?: string;
};

type DoctorCallRecord = DoctorDirectoryRecord & {
  callId?: string;
};

const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(timeValue: string) {
  const match = timeValue.trim().match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const period = match[3].toUpperCase();
  const normalizedHours = period === "AM"
    ? hours % 12
    : (hours % 12) + 12;
  return normalizedHours * 60 + minutes;
}

function toTwentyFourHour(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function toTwelveHour(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours < 12 ? "AM" : "PM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function parseAvailabilityEntry(entry: string) {
  const match = entry
    .trim()
    .match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:-(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?\s+(\d{1,2}(?::\d{2})?(?:AM|PM))-(\d{1,2}(?::\d{2})?(?:AM|PM))$/i);

  if (!match) return null;

  const [, startDayLabel, endDayLabel, startTimeLabel, endTimeLabel] = match;
  const startDay = DAY_INDEX[startDayLabel.slice(0, 3)];
  const endDay = endDayLabel ? DAY_INDEX[endDayLabel.slice(0, 3)] : startDay;
  const startMinutes = toMinutes(startTimeLabel.toUpperCase());
  const endMinutes = toMinutes(endTimeLabel.toUpperCase());

  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    return null;
  }

  const days: number[] = [];
  if (startDay <= endDay) {
    for (let day = startDay; day <= endDay; day += 1) {
      days.push(day);
    }
  } else {
    for (let day = startDay; day <= 6; day += 1) {
      days.push(day);
    }
    for (let day = 0; day <= endDay; day += 1) {
      days.push(day);
    }
  }

  return { days, startMinutes, endMinutes };
}

function deriveSlotsFromTimings(availableTimings: string[] | undefined, dateIso: string): SlotRecord[] {
  if (!Array.isArray(availableTimings) || availableTimings.length === 0) {
    return [];
  }

  const [year, month, day] = dateIso.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const dayOfWeek = selectedDate.getDay();
  const slots = new Map<string, SlotRecord>();

  for (const entry of availableTimings) {
    const parsed = parseAvailabilityEntry(entry);
    if (!parsed || !parsed.days.includes(dayOfWeek)) continue;

    for (let cursor = parsed.startMinutes; cursor + 30 <= parsed.endMinutes; cursor += 30) {
      const time = toTwentyFourHour(cursor);
      slots.set(time, {
        id: time,
        time,
        display: toTwelveHour(cursor),
        status: "available",
      });
    }
  }

  return Array.from(slots.values()).sort((left, right) => (left.time || "").localeCompare(right.time || ""));
}

function findNextBookableDate(availableTimings: string[] | undefined, fallbackDate: string) {
  if (!Array.isArray(availableTimings) || availableTimings.length === 0) {
    return fallbackDate;
  }

  const baseDate = new Date(`${fallbackDate}T00:00:00`);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(baseDate);
    candidate.setDate(baseDate.getDate() + offset);
    const candidateIso = candidate.toISOString().split("T")[0];
    if (deriveSlotsFromTimings(availableTimings, candidateIso).length > 0) {
      return candidateIso;
    }
  }

  return fallbackDate;
}

function getTomorrowDateIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

export default function DoctorsPage() {
  const router = useRouter();
  const { user, profile, loading: profileLoading } = useCurrentUserProfile();
  const { showFeedback } = useFeedback();
  /* ─── Filter state ─── */
  const [searchTerm,   setSearchTerm]   = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [onlineOnly,   setOnlineOnly]   = useState(false);
  const [maxFee,       setMaxFee]       = useState(100);

  /* ─── Live Firestore doctors ─── */
  const [rtdDoctors, setRtdDoctors] = useState<DoctorDirectoryRecord[]>([]);
  const [rtdLoading, setRtdLoading] = useState(true);

  /* ─── Favourites ─── */
  const [savedIds, setSavedIds] = useState<string[]>([]);

  /* ─── Booking modal ─── */
  const [bookingDoctor, setBookingDoctor] = useState<DoctorDirectoryRecord | null>(null);
  const [bookDate,      setBookDate]      = useState(getTomorrowDateIso);
  const [minBookDate] = useState(getTomorrowDateIso);
  const [bookSlot,      setBookSlot]      = useState<string>("");
  const [consultType,   setConsultType]   = useState<"video" | "in-person">("in-person");
  const [patientName,   setPatientName]   = useState("");
  const [patientEmail,  setPatientEmail]  = useState("");
  const [patientPhone,  setPatientPhone]  = useState("");
  const [patientNotes,  setPatientNotes]  = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<AppointmentConfirmation | null>(null);

  /* ─── Real-time slot management ─── */
  const [availableSlots,  setAvailableSlots]  = useState<SlotRecord[]>([]);
  const [slotsLoading,    setSlotsLoading]    = useState(false);
  const [slotLockError,   setSlotLockError]   = useState<string>("");

  /* ─── Video call state ─── */
  const [callDoctor,    setCallDoctor]    = useState<DoctorCallRecord | null>(null);
  const [callStatus,    setCallStatus]    = useState<"pending"|"accepted"|"rejected"|"ended"|null>(null);
  const [callId,        setCallId]        = useState<string | null>(null);
  const callListenerRef = useRef<(() => void) | null>(null);

  /* ─── Load Firestore doctors in real-time ─── */
  useEffect(() => {
    if (!profileLoading && profile && !profile.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    const unsub = onSnapshot(query(collection(db, "doctors"), orderBy("fullName")), (snap) => {
      const list: DoctorDirectoryRecord[] = snap.docs.map((item) => {
        const data = item.data();
        return {
          uid: item.id,
          ...data,
          specialty: String(data.specialty || ""),
          name: String(data.fullName || "Registered Physician"),
          hospital: data.hospitalName,
          experience: data.yearsOfExperience ? `${data.yearsOfExperience} yrs` : "",
          reviews: data.reviewCount || 0,
          isDemo: false,
        };
      });
      list.sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (b.status === "online" && a.status !== "online") return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
      setRtdDoctors(list);
      setRtdLoading(false);
    });
    return () => unsub();
  }, [profile, profileLoading, router]);

  /* Cleanup call listener on unmount */
  useEffect(() => () => { callListenerRef.current?.(); }, []);

  useEffect(() => {
    if (!bookingDoctor) return;

    let cancelled = false;
    const fallbackSlots = deriveSlotsFromTimings(bookingDoctor.availableTimings, bookDate);

    const loadSlots = async () => {
      setSlotsLoading(true);
      setSlotLockError("");
      try {
        const response = await fetch(
          `/api/slots?doctorId=${encodeURIComponent(bookingDoctor.uid)}&date=${encodeURIComponent(bookDate)}`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load appointment slots.");
        }

        const nextSlots = Array.isArray(payload.slots)
          ? (payload.slots as SlotRecord[]).filter((slot) => slot.status === "available")
          : [];

        if (cancelled) return;

        setAvailableSlots(nextSlots.length > 0 ? nextSlots : fallbackSlots);
        setBookSlot((currentSlot) => {
          const activeSlots = nextSlots.length > 0 ? nextSlots : fallbackSlots;
          const stillExists = activeSlots.some((slot) => (slot.display || slot.time || slot.id) === currentSlot);
          return stillExists ? currentSlot : "";
        });
        if (nextSlots.length === 0 && fallbackSlots.length === 0 && payload.message) {
          setSlotLockError(payload.message);
        }
      } catch (error) {
        if (cancelled) return;
        setAvailableSlots(fallbackSlots);
        setBookSlot("");
        if (fallbackSlots.length === 0) {
          setSlotLockError(error instanceof Error ? error.message : "Unable to load appointment slots.");
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    };

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [bookDate, bookingDoctor]);

  /* Merged + filtered doctor list */
  const allDoctors = [...rtdDoctors];
  const filtered = allDoctors.filter((d) => {
    if (d.uid === user?.uid) return false;
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q);
    const matchDept   = !selectedDept || d.specialty === selectedDept;
    const matchOnline = !onlineOnly   || d.status === "online";
    const matchFee    = typeof d.fee !== "number" || d.fee <= maxFee;
    return matchSearch && matchDept && matchOnline && matchFee;
  });
  const slotOptions = availableSlots.length
    ? availableSlots
        .map((slot) => slot.display || slot.time || slot.id)
        .filter((slot): slot is string => Boolean(slot))
    : [];
  const specialtyOptions = Array.from(
    new Set(rtdDoctors.map((doctor) => doctor.specialty).filter(Boolean))
  ).sort();
  const canPatientBook = profile?.role === "patient";

  const closeBooking = () => {
    setBookingDoctor(null);
    setBookingSuccess(null);
    setAvailableSlots([]);
    setBookSlot("");
    setSlotLockError("");
    setPatientNotes("");
    setBookDate(getTomorrowDateIso());
  };

  /* ─── Handlers ─── */
  const toggleSave = (id: string) =>
    setSavedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const openBooking = (doc: DoctorDirectoryRecord) => {
    const savedEmail = typeof window !== "undefined" ? localStorage.getItem("patientEmail") || "" : "";
    const initialBookDate = findNextBookableDate(doc.availableTimings, getTomorrowDateIso());
    setBookingDoctor(doc);
    setBookingSuccess(null);
    setBookDate(initialBookDate);
    setBookSlot("");
    setPatientNotes("");
    setConsultType("in-person");
    setSlotLockError("");
    setAvailableSlots([]);
    setPatientName(profile?.fullName || patientName);
    setPatientEmail(profile?.email || savedEmail || patientEmail);
    setPatientPhone(profile?.phone || patientPhone);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor) return;
    setBookingLoading(true);

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim(),
          patientPhone: patientPhone.trim(),
          doctorId: bookingDoctor.uid,
          doctorName: bookingDoctor.name || "Consulting Physician",
          hospitalId: bookingDoctor.hospitalId || bookingDoctor.uid,
          hospitalName: bookingDoctor.hospital || bookingDoctor.hospitalName || "Healthcare Facility",
          department: bookingDoctor.specialty || "General Medicine",
          date: bookDate,
          timeSlot: bookSlot,
          consultationType: consultType,
          notes: patientNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("patientEmail", patientEmail);
        setBookingSuccess(data);
      } else {
        showFeedback({
          tone: "error",
          title: "Booking failed",
          message: data.error || "We could not confirm this appointment.",
        });
      }
    } catch {
      showFeedback({
        tone: "error",
        title: "Something went wrong",
        message: "Please try booking again in a moment.",
      });
    } finally {
      setBookingLoading(false);
    }
  };

  /* ─── Video call initiation (RTD doctors only) ─── */
  const initiateCall = async (doctor: DoctorDirectoryRecord) => {
    if (profile?.role !== "patient") {
      showFeedback({
        tone: "warning",
        title: "Patient access required",
        message: "Only patient accounts can start direct doctor calls.",
      });
      return;
    }

    const callPatientEmail = (profile.email || localStorage.getItem("patientEmail") || patientEmail).trim().toLowerCase();
    const patientNameForCall = profile.fullName?.trim() || patientName.trim() || callPatientEmail.split("@")[0] || "Patient";
    if (!callPatientEmail) {
      showFeedback({
        tone: "warning",
        title: "Email required",
        message: "Your patient email is missing. Please reopen your account profile and try again.",
      });
      return;
    }
    const newRef = push(ref(rtdb, "callRequests"));
    await set(newRef, {
      patientId: user?.uid || null,
      patientEmail: callPatientEmail,
      patientName: patientNameForCall,
      doctorId: doctor.uid,
      doctorName: doctor.name || doctor.fullName || "Doctor",
      doctorSpecialty: doctor.specialty || "",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    setCallDoctor({ ...doctor, callId: newRef.key });
    setCallId(newRef.key!);
    setCallStatus("pending");

    callListenerRef.current?.();
    const unsub = onValue(ref(rtdb, `callRequests/${newRef.key}`), (snap) => {
      const val = snap.val();
      if (!val) return;
      if (val.status === "accepted") setCallStatus("accepted");
      else if (val.status === "rejected") {
        setCallStatus("rejected");
        setTimeout(() => { setCallDoctor(null); setCallStatus(null); setCallId(null); }, 3500);
      } else if (val.status === "ended") {
        setCallStatus("ended");
        setTimeout(() => { setCallDoctor(null); setCallStatus(null); setCallId(null); }, 2000);
      }
    });
    callListenerRef.current = unsub;
  };

  const endCall = async () => {
    if (callId) {
      await update(ref(rtdb, `callRequests/${callId}`), { status: "ended", endedAt: new Date().toISOString() });
    }
    callListenerRef.current?.();
    callListenerRef.current = null;
    setCallDoctor(null); setCallStatus(null); setCallId(null);
  };

  /* ─── Status badge ─── */
  const statusBadge = (status?: string) => {
    if (status === "online") return (
      <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available
      </span>
    );
    if (status === "busy") return (
      <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> In Consult
      </span>
    );
    return (
      <span className="flex items-center gap-1 bg-muted border border-border text-muted-foreground font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
        Offline
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 relative overflow-hidden">
      {/* Decorative backgrounds */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 blur-[130px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 py-12 relative z-10 space-y-12">

        {/* ─── Hero header ─── */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
              <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
              Verified Specialist Network
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight text-foreground leading-none"
          >
            Find Your{" "}
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              Perfect Doctor
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-base text-muted-foreground font-semibold leading-relaxed"
          >
            Browse live specialist profiles from Firestore, see who&apos;s online right now, start a real video call, or book a confirmed appointment in seconds.
          </motion.p>

          {/* Live stats strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap justify-center gap-6 pt-2 text-xs font-bold text-muted-foreground"
          >
            {[
              { icon: <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />, label: `${allDoctors.filter(d => d.status === "online").length} Available Now` },
              { icon: <Wifi className="w-3.5 h-3.5 text-primary" />, label: "Real-time WebRTC Calls" },
              { icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />, label: "HIPAA Compliant" },
              { icon: <Award className="w-3.5 h-3.5 text-amber-500" />, label: "Avg 4.8 ★ Rating" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {s.icon}
                <span>{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {!rtdLoading && filtered.length === 0 && (
          <Card className="border border-border/50 bg-card/70 backdrop-blur-xl rounded-3xl shadow-lg">
            <CardContent className="p-8 text-center space-y-2">
              <h2 className="text-xl font-bold text-foreground">No live doctors found</h2>
              <p className="text-sm text-muted-foreground">
                Firestore does not currently contain doctor profiles matching these filters.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ─── Live RTD doctors section ─── */}
        {rtdDoctors.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight text-foreground">Registered Doctors</h2>
              <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live from Firebase
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((doc, idx) => (
                <DoctorCard
                  key={doc.uid}
                  doc={doc}
                  idx={idx}
                  savedIds={savedIds}
                  toggleSave={toggleSave}
                  statusBadge={statusBadge}
                  onBook={canPatientBook ? openBooking : undefined}
                  onCall={canPatientBook ? initiateCall : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Filter toolbar ─── */}
        <Card className="border border-border/50 bg-card/65 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
            <div className="lg:col-span-1 space-y-2">
              <Label className="font-bold text-sm tracking-tight">Search</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Name, specialty, city…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background/50 border-border/80 pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-sm tracking-tight">Specialty</Label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-background/50 border border-border/80 h-11 px-3.5 rounded-xl text-sm font-medium"
              >
                <option value="">All Specialties</option>
                {specialtyOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-sm tracking-tight flex justify-between">
                <span>Max Fee</span>
                <span className="text-primary font-black">${maxFee}</span>
              </Label>
              <div className="pt-2">
                <input
                  type="range" min="20" max="200" step="5"
                  value={maxFee} onChange={(e) => setMaxFee(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pb-3 select-none">
              <input
                type="checkbox" id="onlineOnly"
                checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <label htmlFor="onlineOnly" className="text-xs font-bold text-muted-foreground cursor-pointer">
                Available Now Only
              </label>
            </div>
          </div>
        </Card>

        {/* ─── All doctors grid ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              {rtdDoctors.length > 0 ? "All Specialists" : "Specialist Directory"}
            </h2>
            <span className="text-xs text-muted-foreground font-semibold">{filtered.length} results</span>
          </div>

          {filtered.length === 0 ? (
            <Card className="p-16 text-center border-dashed border-border/60 rounded-3xl space-y-4">
              <div className="inline-flex p-4 bg-muted/65 rounded-full">
                <Stethoscope className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-extrabold text-foreground">No doctors match your filters</h3>
              <Button variant="outline" className="rounded-xl text-xs font-bold"
                onClick={() => { setSearchTerm(""); setSelectedDept(""); setOnlineOnly(false); setMaxFee(200); }}>
                Clear Filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((doc, idx) => (
                <DoctorCard
                  key={doc.uid}
                  doc={doc}
                  idx={idx}
                  savedIds={savedIds}
                  toggleSave={toggleSave}
                  statusBadge={statusBadge}
                  onBook={canPatientBook ? openBooking : undefined}
                  onCall={canPatientBook ? initiateCall : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          BOOKING MODAL
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {bookingDoctor && canPatientBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-card border border-border/80 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden my-auto"
            >
              <button
                onClick={closeBooking}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {bookingSuccess ? (
                /* ─── Success receipt ─── */
                <div className="text-center space-y-5 py-2 animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Appointment Confirmed!</h3>
                    <p className="text-xs text-muted-foreground mt-1">Appointment ID: {bookingSuccess.id}</p>
                  </div>

                  <Card className="border border-dashed border-border/80 bg-muted/20 rounded-2xl p-4 text-left space-y-2 text-xs font-semibold text-muted-foreground">
                    <div className="flex justify-between items-center border-b border-dashed border-border/60 pb-2 mb-1">
                      <span className="font-extrabold text-foreground flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5 text-primary" /> Booking Summary</span>
                      <Badge className="bg-emerald-500 text-white text-[8px] font-black">CONFIRMED</Badge>
                    </div>
                    {[
                      ["Doctor",    bookingSuccess.doctorName],
                      ["Specialty", bookingDoctor?.specialty],
                      ["Hospital",  bookingSuccess.hospitalName],
                      ["Date",      bookingSuccess.date],
                      ["Time",      bookingSuccess.timeSlot],
                      ["Type",      bookingSuccess.consultationType?.toUpperCase()],
                      ["Fee",       `$${bookingDoctor?.fee}.00`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground/70">{k}:</span>
                        <span className="text-foreground font-bold text-right max-w-[55%] truncate">{v}</span>
                      </div>
                    ))}
                  </Card>

                  <div className="flex gap-3">
                    <Button className="flex-1 rounded-xl font-bold text-xs"
                      onClick={closeBooking}>
                      Done
                    </Button>
                    <Link href="/patient/dashboard"
                      className={cn(buttonVariants({ variant: "outline", className: "flex-1 rounded-xl font-bold text-xs" }))}>
                      View Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                /* ─── Booking form ─── */
                <form onSubmit={handleBook} className="space-y-5">
                  {/* Doctor preview */}
                  <div className="flex gap-3 items-start">
                    <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
                      <Stethoscope className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase text-[8px] tracking-widest mb-1">Book Appointment</Badge>
                      <h3 className="text-xl font-black text-foreground tracking-tight leading-tight">{bookingDoctor.name}</h3>
                      <p className="text-xs text-muted-foreground font-semibold">
                        {bookingDoctor.specialty}
                        {bookingDoctor.hospital ? ` · ${bookingDoctor.hospital}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Consult type */}
                  <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 border border-border/40 rounded-xl">
                    {(["in-person", "video"] as const).map((t) => (
                      <button key={t} type="button"
                        onClick={() => setConsultType(t)}
                        className={cn("py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                          consultType === t ? "bg-background shadow text-foreground" : "text-muted-foreground/80 hover:text-foreground"
                        )}
                      >
                        {t === "video" ? <Video className="w-3.5 h-3.5 text-primary" /> : <Building2 className="w-3.5 h-3.5" />}
                        {t === "video" ? "Video Call" : "In-Person"}
                      </button>
                    ))}
                  </div>

                  {/* Date & slot */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs tracking-tight">Date</Label>
                      <input
                        type="date"
                        required
                        value={bookDate}
                        min={minBookDate}
                        onChange={(e) => setBookDate(e.target.value)}
                        className="w-full bg-background/50 border border-border/80 h-10 px-3 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs tracking-tight">Time Slot</Label>
                      <select
                        required value={bookSlot}
                        onChange={(e) => setBookSlot(e.target.value)}
                        className="w-full bg-background/50 border border-border/80 h-10 px-3 rounded-xl text-xs font-medium"
                        disabled={slotsLoading || slotOptions.length === 0}
                      >
                        <option value="">
                          {slotsLoading
                            ? "Loading live slots..."
                            : slotOptions.length > 0
                              ? "Select a time"
                              : "No slots available"}
                        </option>
                        {slotOptions.map((slot: string) => <option key={slot}>{slot}</option>)}
                      </select>
                    </div>
                  </div>
                  {slotLockError ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
                      {slotLockError}
                    </div>
                  ) : null}

                  {/* Patient details */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs tracking-tight">Full Name</Label>
                        <Input required value={patientName} onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Enter your full name" className="bg-background/50 border-border/80 h-10 rounded-xl text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs tracking-tight">Email</Label>
                        <Input required type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)}
                          placeholder="Enter your email address" className="bg-background/50 border-border/80 h-10 rounded-xl text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs tracking-tight">Phone</Label>
                      <Input required type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="Enter your contact number" className="bg-background/50 border-border/80 h-10 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs tracking-tight">Symptoms / Notes</Label>
                      <textarea value={patientNotes} onChange={(e) => setPatientNotes(e.target.value)}
                        placeholder="Briefly describe your symptoms…"
                        className="w-full bg-background/50 border border-border/80 p-3 rounded-xl text-xs leading-relaxed min-h-[60px] resize-none" />
                    </div>
                  </div>

                  {/* Payment summary */}
                  <Card className="border border-primary/20 bg-primary/[0.02] rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-foreground">
                        <CreditCard className="w-4 h-4 text-primary" /> Consultation Fee
                      </span>
                      <span className="font-black text-xl text-foreground">
                        {typeof bookingDoctor.fee === "number" && bookingDoctor.fee > 0 ? `$${bookingDoctor.fee}` : "Quoted on booking"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-1 font-semibold">
                      Secure payment · Instant confirmation · Free cancellation 24h before
                    </p>
                  </Card>

                  <Button
                    type="submit"
                    disabled={bookingLoading || slotsLoading || !bookSlot}
                    className="w-full rounded-xl h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/15 flex items-center justify-center gap-2"
                  >
                    {bookingLoading
                      ? <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Confirming booking…</>
                      : <><CheckCircle2 className="w-4 h-4" /> Confirm & Book {typeof bookingDoctor.fee === "number" && bookingDoctor.fee > 0 ? `· $${bookingDoctor.fee}` : ""}</>
                    }
                  </Button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          VIDEO CALL MODAL
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {callDoctor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.93, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 20 }}
              className="w-full max-w-xl bg-card border border-border/80 shadow-2xl rounded-3xl p-5 sm:p-6 space-y-4"
            >
              {/* Pending */}
              {callStatus === "pending" && (
                <div className="text-center space-y-5 py-4">
                  <div className="relative inline-flex">
                    <div className="p-5 bg-primary/10 rounded-full">
                      <Phone className="w-10 h-10 text-primary" />
                    </div>
                    <span className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Calling {callDoctor.name}…</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-semibold">{callDoctor.specialty} · Waiting for doctor to accept</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl font-bold text-rose-500 border-rose-500/30 hover:bg-rose-500/10 flex items-center justify-center gap-2"
                    onClick={endCall}
                  >
                    <PhoneOff className="w-4 h-4" /> Cancel Call
                  </Button>
                </div>
              )}

              {/* Accepted — real WebRTC video */}
              {callStatus === "accepted" && callId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold uppercase text-[8px] tracking-wider animate-pulse">
                      ● Connected · WebRTC
                    </Badge>
                    <span className="text-xs font-bold text-muted-foreground">{callDoctor.name}</span>
                  </div>
                  <VideoCallRoom
                    callId={callId}
                    role="caller"
                    remoteName={callDoctor.name}
                    remoteSpecialty={callDoctor.specialty}
                    onEnd={endCall}
                  />
                </div>
              )}

              {/* Rejected */}
              {callStatus === "rejected" && (
                <div className="text-center space-y-5 py-4">
                  <div className="p-5 bg-rose-500/10 rounded-full inline-flex">
                    <PhoneOff className="w-10 h-10 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Call Declined</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-semibold">{callDoctor.name} is unavailable. Try booking an appointment instead.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl text-xs font-bold"
                      onClick={() => { setCallDoctor(null); setCallStatus(null); }}>Close</Button>
                    {canPatientBook && (
                      <Button className="flex-1 rounded-xl text-xs font-bold"
                        onClick={() => { setCallDoctor(null); setCallStatus(null); openBooking(callDoctor); }}>Book Instead</Button>
                    )}
                  </div>
                </div>
              )}

              {/* Ended */}
              {callStatus === "ended" && (
                <div className="text-center space-y-4 py-4">
                  <h3 className="text-xl font-black text-foreground">Call Ended</h3>
                  <p className="text-xs text-muted-foreground font-semibold">Your consultation session has ended.</p>
                  <Button className="w-full rounded-xl font-bold"
                    onClick={() => { setCallDoctor(null); setCallStatus(null); }}>Close</Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── DoctorCard sub-component ─── */
function DoctorCard({
  doc, idx, savedIds, toggleSave, statusBadge, onBook, onCall
}: {
  doc: DoctorDirectoryRecord; idx: number;
  savedIds: string[];
  toggleSave: (id: string) => void;
  statusBadge: (s?: string) => React.ReactNode;
  onBook?: (d: DoctorDirectoryRecord) => void;
  onCall?: (d: DoctorDirectoryRecord) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      whileHover={{ y: -3 }}
      className="group relative bg-card/50 hover:bg-card/85 border border-border/50 hover:border-border/80 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-cyan-400 to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Demo badge */}
      {doc.isDemo && (
        <div className="absolute top-3 right-3">
          <span className="text-[8px] text-muted-foreground/60 font-bold bg-muted/60 px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/40">Demo</span>
        </div>
      )}

      <div className="p-6 space-y-4 flex-1">
        {/* Header */}
        <div className="flex gap-3 items-start">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-400/10 border border-border/60 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-primary" />
            </div>
            {doc.status === "online" && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-card rounded-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-base text-foreground tracking-tight leading-tight truncate">
              {doc.name || "Registered Physician"}
            </h3>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">
              {doc.specialty || "General Medicine"}
              {doc.experience ? ` · ${doc.experience}` : ""}
            </p>
          </div>
        </div>

        {statusBadge(doc.status)}

        {/* Details */}
        <div className="space-y-1.5 text-[11px] font-semibold text-muted-foreground">
          {(doc.hospital || doc.name) && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-primary/70 shrink-0" />
              <span className="truncate">{doc.hospital || "Private Clinic"}</span>
            </div>
          )}
          {doc.city && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
              <span>{doc.city}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            <span className="font-bold text-foreground">{doc.rating?.toFixed?.(1) ?? "4.5"}</span>
            <span>({doc.reviews ?? 0} reviews)</span>
          </div>
        </div>
      </div>

      {/* Footer action row */}
      <div className="border-t border-border/40 p-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold block">Fee</span>
          <span className="font-black text-lg text-foreground">
            {doc.fee ? `$${doc.fee}` : "Contact"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save */}
          <button
            onClick={() => toggleSave(doc.uid)}
            className={cn(
              "p-2.5 rounded-xl border text-muted-foreground transition-all duration-200",
              savedIds.includes(doc.uid)
                ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                : "bg-background border-border/80 hover:bg-muted"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", savedIds.includes(doc.uid) && "fill-rose-500")} />
          </button>

          {/* Book */}
          {onBook && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-xs font-bold border-border/80"
              onClick={() => onBook(doc)}
            >
              <CalendarCheck className="w-3.5 h-3.5 mr-1 text-primary" /> Book
            </Button>
          )}

          {/* Call — only for online RTD doctors */}
          {doc.status === "online" && onCall && (
            <Button
              size="sm"
              className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white shadow-md shadow-primary/15"
              onClick={() => onCall(doc)}
            >
              <Video className="w-3.5 h-3.5 mr-1" /> Call
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
