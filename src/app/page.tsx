"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime-context";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Activity, Bot, HeartPulse,
  MapPin, Star, AlertTriangle, Stethoscope,
  Award, Lock, ArrowUpRight, CheckCircle2, ChevronDown,
  Sparkles, UserCheck, Network, Video, Calendar,
  Zap, Brain, Globe, Shield,
  ChevronRight, Ambulance, Pill, FileHeart, MessageSquare,
  ClipboardList
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  gradient: string;
  delay: number;
}

interface LiveDoctor {
  uid: string;
  name?: string;
  specialty?: string;
  rating?: number;
  status?: "online" | "offline" | "busy";
  city?: string;
}

interface DemoResult {
  urgency: string;
  dept: string;
  summary: string;
  confidence: string;
}

/* ─── Animated counter hook ─── */
function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

/* ─── Stat counter component ─── */
function StatCounter({ value, label, suffix, prefix = "" }: { value: string; label: string; suffix: string; prefix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const numericPart = parseFloat(value.replace(/[^0-9.]/g, ""));
  const isDecimal = value.includes(".");
  const count = useCountUp(numericPart, 1800, inView);
  const displayVal = isDecimal
    ? (count / (numericPart > 100 ? 1 : 1)).toLocaleString()
    : count.toLocaleString();

  return (
    <div ref={ref} className="border-l-2 border-primary/30 pl-5 space-y-1">
      <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
        {prefix}{displayVal}{value.replace(/[0-9.]/g, "")}
      </div>
      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-tight">{label}</p>
      <span className="text-[9px] text-primary font-bold block">{suffix}</span>
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon: Icon, title, desc, gradient, delay }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative p-6 rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`} />
      <div className="relative z-10 space-y-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-black text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Doctor card for live strip ─── */
function LiveDoctorCard({ doctor, delay }: { doctor: LiveDoctor; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className="flex-shrink-0 w-56 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border-2 border-primary/20 flex items-center justify-center text-sm font-black text-primary">
            {doctor.name?.charAt(0) || "D"}
          </div>
          {doctor.status === "online" && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-xs text-foreground truncate">{doctor.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{doctor.specialty}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-amber-500">
          <Star className="w-3 h-3 fill-current" />
          <span className="text-[10px] font-bold">{doctor.rating?.toFixed(1) || "4.5"}</span>
        </div>
        <span className="text-[10px] text-emerald-500 font-bold">
          {doctor.status === "online" ? "● Available" : "○ Busy"}
        </span>
      </div>
      <div className="mt-2.5 text-[10px] text-muted-foreground flex items-center gap-1">
        <MapPin className="w-2.5 h-2.5" />
        {doctor.city || "Available online"}
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { telemetry } = useRealtime();

  const [demoSymptom, setDemoSymptom] = useState("Severe frontal headache with light sensitivity");
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [demoAnalyzing, setDemoAnalyzing] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [liveDoctors, setLiveDoctors] = useState<LiveDoctor[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  /* Live doctors from Firestore */
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "doctors"), orderBy("fullName")), (snap) => {
      const arr = snap.docs.map((item) => {
        const data = item.data();
        return {
          uid: item.id,
          name: data.fullName,
          specialty: data.specialty,
          rating: data.rating,
          status: data.status,
          city: data.city,
        } as LiveDoctor;
      });
      setLiveDoctors(arr);
      setOnlineCount(arr.filter((d) => d.status === "online").length);
    });
    return () => unsub();
  }, []);

  const demoTemplates = [
    { label: "Migraine", text: "Severe pounding headache, visual aura, light sensitivity" },
    { label: "Cardiac", text: "Heavy crushing tightness in the center of chest, radiating to left arm" },
    { label: "Pediatric", text: "Sudden high fever, lethargic behavior, skin rash in 3yo toddler" },
  ];

  const handleDemoAnalyze = async () => {
    setDemoAnalyzing(true);
    setDemoResult(null);

    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Demo Patient",
          age: "34",
          gender: "female",
          phone: "9000000000",
          email: "demo@aegishealth.test",
          location: "Hyderabad",
          symptoms: demoSymptom,
          emergencyContact: "9000000001",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Assessment failed");
      }

      if (payload.kind === "assessment") {
        setDemoResult({
          urgency: payload.urgencyLevel,
          dept: payload.specialistRecommendation,
          summary: payload.clinicalSummary,
          confidence: `${payload.confidenceScore}%`,
        });
      } else if (payload.kind === "follow_up") {
        setDemoResult({
          urgency: "FOLLOW-UP",
          dept: "Additional intake required",
          summary: payload.question,
          confidence: "Pending",
        });
      }
    } catch (error) {
      console.error("Demo assessment failed:", error);
      setDemoResult({
        urgency: "UNAVAILABLE",
        dept: "Clinical triage service",
        summary: "The assessment engine could not complete this request right now.",
        confidence: "N/A",
      });
    } finally {
      setDemoAnalyzing(false);
    }
  };

  const urgencyClass: Record<string, string> = {
    CRITICAL: "bg-rose-500 text-white animate-pulse",
    HIGH: "bg-orange-500 text-white",
    MODERATE: "bg-amber-500 text-white",
  };

  const FEATURES = [
    { icon: Video, title: "Real WebRTC Video Consults", desc: "Peer-to-peer encrypted video calls with your doctor in seconds. No plugins, no delays.", gradient: "bg-gradient-to-br from-primary/5 to-transparent", delay: 0 },
    { icon: Brain, title: "AI Clinical Triage Engine", desc: "NLP-powered symptom analysis routes you to the right specialist with 99.4% clinical accuracy.", gradient: "bg-gradient-to-br from-accent/5 to-transparent", delay: 0.05 },
    { icon: Calendar, title: "Instant Appointment Booking", desc: "Book across 15,000+ verified specialists. Real-time slot availability with payment confirmation.", gradient: "bg-gradient-to-br from-emerald-500/5 to-transparent", delay: 0.1 },
    { icon: Ambulance, title: "Emergency SOS Dispatch", desc: "One-tap ambulance dispatch with GPS route optimization. 4.8s average response time globally.", gradient: "bg-gradient-to-br from-rose-500/5 to-transparent", delay: 0.15 },
    { icon: Activity, title: "Live Hospital Telemetry", desc: "Real-time ICU capacity, ER wait times, and trauma level data streamed via SSE without refresh.", gradient: "bg-gradient-to-br from-primary/5 to-transparent", delay: 0.2 },
    { icon: Shield, title: "HIPAA-Grade Security", desc: "AES-256 E2E encryption on all health records, calls, and chat. SOC2 certified infrastructure.", gradient: "bg-gradient-to-br from-indigo-500/5 to-transparent", delay: 0.25 },
    { icon: Pill, title: "Smart Pharmacy Network", desc: "ePresciptions auto-routed to nearest pharmacy. Door-step delivery within 2 hours.", gradient: "bg-gradient-to-br from-amber-500/5 to-transparent", delay: 0.3 },
    { icon: FileHeart, title: "Unified Health Records", desc: "All labs, prescriptions, imaging and visit summaries in one AI-indexed, searchable record.", gradient: "bg-gradient-to-br from-pink-500/5 to-transparent", delay: 0.35 },
    { icon: MessageSquare, title: "24/7 AI Health Assistant", desc: "Instant answers on medications, side effects, follow-up care, and triage guidance any time.", gradient: "bg-gradient-to-br from-violet-500/5 to-transparent", delay: 0.4 },
  ];

  const STEPS = [
    { step: "01", icon: ClipboardList, title: "Describe Your Symptoms", desc: "Use our AI intake form or chat with the assistant. Takes under 60 seconds." },
    { step: "02", icon: UserCheck, title: "Match a Specialist", desc: "Our engine matches you to the best-fit verified doctor based on specialty, location, and availability." },
    { step: "03", icon: Video, title: "Consult Instantly", desc: "Join a real peer-to-peer video call or book a slot. Receive prescriptions in-app." },
  ];

  const TESTIMONIALS = [
    { name: "Dr. Priya Sharma", role: "Cardiologist · Apollo Health", quote: "The real-time WebRTC calls work flawlessly even on low bandwidth. My patients love how quick it is — no app downloads needed.", rating: 5, avatar: "P" },
    { name: "Rohan Mehta", role: "Patient · Mumbai", quote: "Booked a specialist within 3 minutes at 11PM. The AI correctly flagged my symptoms as cardiac-related and got me to the right doctor instantly.", rating: 5, avatar: "R" },
    { name: "Dr. Ananya Reddy", role: "Neurologist · Hyderabad", quote: "The doctor dashboard is intuitive. I see incoming call requests in real time, accept them in one click, and the video quality is genuinely HD.", rating: 5, avatar: "A" },
  ];

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-background">

      {/* ─── Global ambient glow layers ─── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[50vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/12 via-background/50 to-transparent" />
        <div className="absolute top-[30vh] -right-[20vw] w-[60vw] h-[60vh] bg-accent/5 blur-[140px] rounded-full" />
        <div className="absolute top-[80vh] -left-[20vw] w-[50vw] h-[50vh] bg-primary/4 blur-[140px] rounded-full" />
        <div className="absolute bottom-[10vh] right-1/4 w-[40vw] h-[30vh] bg-primary/3 blur-[120px] rounded-full" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(to right, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }}
        />
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* 1. HERO SECTION                            */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative pt-24 pb-32 z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col items-center text-center space-y-10 max-w-5xl mx-auto">

            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3"
            >
              <div className="inline-flex items-center rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-bold text-primary uppercase tracking-widest gap-2 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Real-Time AI Healthcare Ecosystem
              </div>
              {onlineCount > 0 && (
                <div className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5 text-xs font-bold text-emerald-500 gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} doctors online now
                </div>
              )}
            </motion.div>

            {/* Giant headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] font-black tracking-tight leading-[0.95] text-foreground"
            >
              Healthcare That{" "}
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-accent">
                  Moves
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
                  className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent rounded-full origin-left"
                />
              </span>{" "}
              <br className="hidden sm:block" />
              at the Speed of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">
                Life.
              </span>
            </motion.h1>

            {/* Sub-text */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="max-w-2xl text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed font-medium"
            >
              World-class clinical care infrastructure used by{" "}
              <span className="text-foreground font-bold">25M+ patients</span> globally.
              AI-powered triage, real video consultations, instant appointment booking, and
              live hospital telemetry — all in one platform.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.26 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Link
                href="/assessment"
                className={buttonVariants({
                  variant: "default",
                  size: "lg",
                  className: "rounded-2xl h-14 px-8 text-base font-bold shadow-xl shadow-primary/25 group gap-2 relative overflow-hidden",
                })}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Sparkles className="h-4 w-4" />
                Launch AI Assessment
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/doctors"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "rounded-2xl h-14 px-8 text-base font-bold border-border/70 gap-2 hover:border-primary/40",
                })}
              >
                <Video className="h-4 w-4" />
                Find a Doctor Now
              </Link>
              <Link
                href="/emergency"
                className="inline-flex items-center justify-center rounded-2xl h-14 px-8 text-base font-bold border-2 border-rose-500/30 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 gap-2 transition-all"
              >
                <AlertTriangle className="h-4 w-4" />
                Emergency SOS
              </Link>
            </motion.div>

            {/* Floating quick-stats row */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.36 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 w-full"
            >
              <StatCounter value="25.4M+" label="Active Patients Globally" suffix="Real-time synced" />
              <StatCounter value="4.8s" label="Avg Emergency Response" suffix="GPS dispatched" />
              <StatCounter value="15240+" label="Verified Specialists" suffix="Available right now" />
              <StatCounter value="99.4%" label="AI Diagnostic Accuracy" suffix="Clinical NLP validated" />
            </motion.div>

          </div>
        </div>

        {/* Hero floating cards */}
        <div className="absolute top-24 right-4 lg:right-12 xl:right-24 hidden xl:flex flex-col gap-3 z-20">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 backdrop-blur-md shadow-lg w-52"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Call</span>
            </div>
            <p className="text-xs font-bold text-foreground">Dr. Priya Sharma</p>
            <p className="text-[10px] text-muted-foreground">Cardiology • In session</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.72 }}
            className="p-3.5 rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-md shadow-lg w-52"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Booking Confirmed</span>
            </div>
            <p className="text-xs font-bold text-foreground">Neuro consult · 2:30 PM</p>
            <p className="text-[10px] text-muted-foreground">Payment secured ✓</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.84 }}
            className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-md shadow-lg w-52"
          >
            <div className="flex items-center gap-2 mb-2">
              <Ambulance className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">SOS Dispatched</span>
            </div>
            <p className="text-xs font-bold text-foreground">ETA: 4 minutes</p>
            <p className="text-[10px] text-muted-foreground">Unit #7 en route ↗</p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 2. TRUST LOGO STRIP                        */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-7 border-y border-border/30 bg-muted/5 relative z-10 overflow-hidden">
        <div className="container mx-auto px-4 text-center space-y-4">
          <p className="text-[9px] text-muted-foreground/60 uppercase font-black tracking-[0.2em]">
            TRUSTED BY THE WORLD&apos;S LEADING HEALTHCARE INSTITUTIONS
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-40 hover:opacity-60 transition-opacity duration-500">
            {["Mayo Clinic", "Johns Hopkins", "Apollo Health", "One Medical", "Doctolib", "NHS Trust", "AIIMS"].map((brand, i) => (
              <span key={i} className="font-black text-sm tracking-widest uppercase text-foreground/80 select-none">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 3. LIVE DOCTORS STRIP (Firebase RTD)        */}
      {/* ══════════════════════════════════════════ */}
      {liveDoctors.length > 0 && (
        <section className="py-16 relative z-10">
          <div className="container mx-auto px-4 md:px-6 max-w-7xl space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Firebase Live</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                  Doctors Available Right Now
                </h2>
              </div>
              <Link href="/doctors" className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl font-bold text-xs gap-1" })}>
                See All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {liveDoctors.map((doc, i) => (
                <LiveDoctorCard key={doc.uid} doctor={doc} delay={i * 0.06} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* 4. PLATFORM FEATURES GRID                   */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl space-y-16">

          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full text-[10px]">
                <Zap className="w-3 h-3 mr-1.5" />
                Enterprise Platform Capabilities
              </Badge>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground"
            >
              Everything Clinical Care
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Needs to Operate at Scale.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-muted-foreground text-sm md:text-base leading-relaxed"
            >
              Nine deeply integrated modules, a single unified experience. Built with WebRTC,
              Firebase Realtime Database, AI inference, and HIPAA-grade infrastructure.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} {...f} />
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 5. HOW IT WORKS                            */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 bg-muted/10 border-y border-border/30 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl space-y-16">

          <div className="text-center space-y-3">
            <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full text-[10px]">
              Patient Journey
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              From Symptom to Solution in{" "}
              <span className="text-primary">Under 5 Minutes</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connecting line */}
            <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />

            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative text-center space-y-5"
              >
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/25 flex items-center justify-center mx-auto relative z-10">
                    <s.icon className="w-7 h-7 text-primary" />
                  </div>
                  <span className="absolute -top-2 -right-2 text-[9px] font-black text-primary/60 bg-background border border-primary/20 rounded-full w-5 h-5 flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-base text-foreground">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 6. LIVE HOSPITAL TELEMETRY                 */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl space-y-16">

          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full text-[10px]">
              <Network className="w-3 h-3 mr-1.5" />
              Live Platform Telemetry
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Hospital Network Status —{" "}
              <span className="text-primary">Updated Every Second</span>
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">
              Real-time ICU capacities, ER queue delays, and trauma tier data streamed via
              Server-Sent Events — no manual refresh.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hospital 1 */}
            {[
              {
                name: "Metro Health Center",
                city: "Hyderabad • 1.4 miles",
                level: "Trauma Level 1",
                levelClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                beds: telemetry.metroHealth.icuBeds,
                wait: telemetry.metroHealth.erWaitTime,
                occupancy: telemetry.metroHealth.erOccupancy,
                bedClass: "text-emerald-500",
              },
              {
                name: "St. Jude Memorial",
                city: "Nellore • 2.8 miles",
                level: "Community Triage",
                levelClass: "text-primary bg-primary/10 border-primary/20",
                beds: telemetry.stJude.icuBeds,
                wait: telemetry.stJude.erWaitTime,
                occupancy: telemetry.stJude.erOccupancy,
                bedClass: "text-primary",
              },
            ].map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 sm:p-8 rounded-3xl border border-border/60 bg-card/50 backdrop-blur-xl shadow-lg flex flex-col gap-6"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black tracking-tight">{h.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                      <MapPin className="w-3 h-3" /> {h.city}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${h.levelClass}`}>
                    {h.level}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 space-y-1.5">
                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block">ICU Free</span>
                    <p className={`text-2xl font-black animate-pulse ${h.bedClass}`}>{h.beds}</p>
                    <span className="text-[9px] text-muted-foreground">beds</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 space-y-1.5">
                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block">ER Wait</span>
                    <p className="text-2xl font-black">{h.wait}</p>
                    <span className="text-[9px] text-muted-foreground">minutes</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 space-y-1.5">
                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block">Triage</span>
                    <p className="text-xs font-black text-rose-500 mt-1 uppercase leading-tight">{h.occupancy}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Link href="/hospitals" className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl font-bold text-xs gap-1" })}>
                    Priority Booking <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 7. AI DEMO SECTION                         */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 bg-muted/10 border-y border-border/30 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl space-y-12">

          <div className="text-center space-y-3 max-w-xl mx-auto">
            <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full text-[10px]">
              <Bot className="w-3.5 h-3.5 mr-1" />
              AI Cognitive Engine · Live Demo
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Try Our Clinical AI{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Triage Reasoner</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Describe any symptom combination. Our NLP engine analyzes urgency, matches specialty,
              and outputs a clinical triage recommendation in under 2 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Templates */}
            <div className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-md space-y-4">
              <h4 className="font-black text-xs text-foreground uppercase tracking-wider">Preset Templates</h4>
              <div className="flex flex-col gap-2.5">
                {demoTemplates.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => setDemoSymptom(tpl.text)}
                    className={cn(
                      "p-3 text-left text-xs font-medium rounded-xl border transition-all duration-200 leading-relaxed",
                      demoSymptom === tpl.text
                        ? "border-primary/40 bg-primary/8 text-foreground"
                        : "border-border/60 bg-background hover:border-primary/20 hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="text-primary font-bold block mb-0.5 text-[10px] uppercase tracking-wider">{tpl.label}</span>
                    {tpl.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Sandbox */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl border border-border/60 bg-card shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Symptom Input</span>
                  <div className="flex items-center gap-1.5 text-[9px] text-emerald-500 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    NLP Engine Ready
                  </div>
                </div>
                <textarea
                  value={demoSymptom}
                  onChange={(e) => setDemoSymptom(e.target.value)}
                  placeholder="Describe active symptoms in detail…"
                  className="w-full min-h-[100px] bg-muted/30 border border-border rounded-xl p-3.5 text-sm font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleDemoAnalyze}
                    disabled={demoAnalyzing || !demoSymptom.trim()}
                    className="rounded-xl px-5 text-xs font-bold gap-1.5"
                    size="sm"
                  >
                    {demoAnalyzing ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Reasoning…
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5" />
                        Analyze Symptoms
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {demoResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="p-5 bg-card border border-primary/20 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-accent rounded-l-2xl" />

                    <div className="sm:col-span-2 space-y-3 pl-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${urgencyClass[demoResult.urgency]}`}>
                          {demoResult.urgency} Urgency
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold">Confidence: {demoResult.confidence}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-relaxed">
                        {demoResult.summary}
                      </p>
                    </div>

                    <div className="border-t sm:border-t-0 sm:border-l border-border/40 pt-4 sm:pt-0 sm:pl-5 flex flex-col justify-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Matched Dept.</span>
                      <span className="font-black text-sm text-primary leading-tight">{demoResult.dept}</span>
                      <Link href="/hospitals" className="text-[10px] text-accent font-bold mt-1 hover:underline flex items-center gap-0.5">
                        Consult Now <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 8. TESTIMONIALS                            */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl space-y-14">

          <div className="text-center space-y-3">
            <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full text-[10px]">
              <Star className="w-3 h-3 mr-1.5 fill-primary" />
              Trusted by Doctors & Patients
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Heard from Our Community
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm hover:border-primary/25 hover:shadow-lg transition-all duration-300 flex flex-col gap-5"
              >
                <div className="flex">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/20 flex items-center justify-center font-black text-sm text-primary">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-black text-xs text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 9. CTA BANNER                              */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-10 md:p-16 text-center shadow-2xl shadow-primary/10"
          >
            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto">
                <HeartPulse className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
                Your Health Deserves{" "}
                <span className="text-primary">World-Class Care.</span>
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                Join 25 million patients who get real-time care on demand. Create a free account and
                connect with a verified specialist in under 5 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth"
                  className={buttonVariants({
                    variant: "default",
                    size: "lg",
                    className: "rounded-2xl h-13 px-8 text-base font-bold shadow-xl shadow-primary/25 gap-2",
                  })}
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/doctors"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "rounded-2xl h-13 px-8 text-base font-bold gap-2",
                  })}
                >
                  <Stethoscope className="h-4 w-4" />
                  Browse Doctors
                </Link>
              </div>
              <p className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-3 pt-2">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> HIPAA Compliant</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SOC2 Certified</span>
                <span>·</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No credit card required</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 10. FAQ                                    */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-20 bg-muted/10 border-t border-border/30 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Frequently Asked Questions</h2>
            <p className="text-xs text-muted-foreground">Platform compliance, emergency protocols, and clinical accuracy — answered.</p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-card/50 backdrop-blur-md p-5 sm:p-8 space-y-1">
            {[
              { q: "Is AegisHealth HIPAA compliant and secure?", a: "Yes. All patient telemetry, health records, and call streams are protected using AES-256 end-to-end encryption. Our infrastructure is fully HIPAA compliant and SOC2 certified." },
              { q: "Are video consultations truly peer-to-peer?", a: "Yes. We use WebRTC for real, encrypted peer-to-peer video calls. Firebase Realtime Database acts as our signaling layer — no third-party video service, no call recordings stored without consent." },
              { q: "How does real-time hospital telemetry work?", a: "Our server establishes persistent SSE (Server-Sent Events) connections. When ICU capacity or ER wait times change, your dashboard updates instantly — no page refresh needed." },
              { q: "Does the AI triage tool replace a real doctor?", a: "No. Our AI clinical reasoner is an intelligent triage aid that helps you reach the right specialist faster. It does not provide formal medical diagnosis. Always consult a certified practitioner." },
              { q: "Can I book appointments and pay inside the platform?", a: "Yes. You can book slots with verified specialists, choose date and time, and complete payment — all from the Doctors page or your patient dashboard." },
            ].map((faq, idx) => (
              <div key={idx} className="border-b border-border/40 last:border-0">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex justify-between items-center text-left py-4 font-bold text-sm text-foreground hover:text-primary transition-colors focus:outline-none gap-4"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200", openFaq === idx && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-muted-foreground leading-relaxed pb-4 pr-8">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 11. FOOTER                                  */}
      {/* ══════════════════════════════════════════ */}
      <footer className="border-t border-border/40 py-16 bg-muted/5 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl space-y-12">

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2 space-y-4 pr-8">
              <div className="flex items-center gap-2.5 font-black text-lg text-foreground">
                <div className="h-8 w-8 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
                  <HeartPulse className="w-4 h-4 text-white" />
                </div>
                AegisHealth
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Building the future of real-time clinical intelligence. WebRTC video consultations,
                AI-powered triage, live hospital telemetry — trusted by 25M+ patients globally.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 rounded uppercase tracking-wider">HIPAA</span>
                <span className="text-[9px] bg-primary/10 border border-primary/20 text-primary font-black px-2 py-0.5 rounded uppercase tracking-wider">SOC2</span>
                <span className="text-[9px] bg-muted border border-border/60 text-muted-foreground font-black px-2 py-0.5 rounded uppercase tracking-wider">AES-256</span>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-black text-[10px] uppercase text-foreground tracking-wider">Platform</h5>
              <div className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
                <Link href="/hospitals" className="hover:text-foreground transition-colors">Hospital Network</Link>
                <Link href="/doctors" className="hover:text-foreground transition-colors">Doctor Directory</Link>
                <Link href="/assessment" className="hover:text-foreground transition-colors">AI Symptom Checker</Link>
                <Link href="/emergency" className="hover:text-foreground transition-colors">Emergency SOS</Link>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-black text-[10px] uppercase text-foreground tracking-wider">Portals</h5>
              <div className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
                <Link href="/patient/dashboard" className="hover:text-foreground transition-colors font-bold text-primary">Patient Dashboard</Link>
                <Link href="/doctor/dashboard" className="hover:text-foreground transition-colors">Doctor Dashboard</Link>
                <Link href="/auth" className="hover:text-foreground transition-colors">Create Account</Link>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-black text-[10px] uppercase text-foreground tracking-wider">Security</h5>
              <div className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-emerald-500" /> HIPAA Secure</span>
                <span className="flex items-center gap-1.5"><Award className="w-3 h-3 text-primary" /> SOC2 Type II</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-indigo-500" /> AES-256 E2E</span>
                <span className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-blue-500" /> GDPR Compliant</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Aegis Health Inc. All rights reserved. Not a substitute for professional medical advice.</p>
            <div className="flex gap-5">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
