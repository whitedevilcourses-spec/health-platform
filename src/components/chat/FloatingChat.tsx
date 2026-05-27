"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Bot, MessageSquare, X, Send, HeartPulse, User,
  AlertTriangle, CheckCircle2, Stethoscope, Clock,
  Hospital, Shield, ChevronDown, ChevronRight,
  Activity, Zap, ArrowUpRight, Sparkles,
} from "lucide-react";
import Link from "next/link";

/* ──────────────────────────────────────────────────
   TYPES
────────────────────────────────────────────────── */
interface QuestionData {
  type: "question";
  question_type: "chips" | "scale" | "yesno" | "multi";
  question: string;
  options?: string[];
  step_number: number;
  total_steps: number;
  insight?: string;
  symptom_context?: string;
  severity_preview?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  reportData?: ClinicalReport;
  questionData?: QuestionData;
  createdAt: string;
}

interface ClinicalReport {
  type: "report";
  triage_summary: string;
  symptom_clusters: { cluster: string; detail: string }[];
  clinical_considerations: string[];
  risk: {
    severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
    confidence: number;
    urgency_recommendation: string;
    emergency_risk: string;
  };
  specialists: { primary: string; secondary: string[] };
  immediate_actions: string[];
  emergency_signs: string[];
  recommended_hospitals: string[];
  followup_timeline: string;
  disclaimer: string;
}

/* ──────────────────────────────────────────────────
   SEVERITY CONFIG
────────────────────────────────────────────────── */
const SEVERITY_CONFIG = {
  CRITICAL: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-500",
    badge: "bg-rose-500 text-white animate-pulse",
    icon: AlertTriangle,
    label: "CRITICAL",
  },
  HIGH: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-500",
    badge: "bg-orange-500 text-white",
    icon: AlertTriangle,
    label: "HIGH",
  },
  MODERATE: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500 text-white",
    icon: Activity,
    label: "MODERATE",
  },
  LOW: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500 text-white",
    icon: CheckCircle2,
    label: "LOW",
  },
};

/* ──────────────────────────────────────────────────
   ANIMATED CONFIDENCE METER
────────────────────────────────────────────────── */
function ConfidenceMeter({ confidence, severity }: { confidence: number; severity: string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = setInterval(() => {
        start += 2;
        if (start >= confidence) { setDisplayed(confidence); clearInterval(step); }
        else setDisplayed(start);
      }, 20);
      return () => clearInterval(step);
    }, 400);
    return () => clearTimeout(timer);
  }, [confidence]);

  const color =
    severity === "CRITICAL" ? "from-rose-500 to-rose-600" :
    severity === "HIGH" ? "from-orange-500 to-amber-500" :
    severity === "MODERATE" ? "from-amber-400 to-amber-500" :
    "from-emerald-400 to-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">AI Confidence Score</span>
        <span className="text-xs font-black text-foreground">{displayed}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${displayed}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   COLLAPSIBLE SECTION
────────────────────────────────────────────────── */
function Section({
  icon: Icon, title, children, delay = 0, defaultOpen = true, accent
}: {
  icon: any; title: string; children: React.ReactNode; delay?: number; defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="border border-border/50 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", accent || "bg-primary/10")}>
            <Icon className={cn("w-3 h-3", accent ? "text-white" : "text-primary")} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">{title}</span>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────
   CLINICAL REPORT CARD
────────────────────────────────────────────────── */
function ClinicalReportCard({ report }: { report: ClinicalReport }) {
  const sev = SEVERITY_CONFIG[report.risk.severity] || SEVERITY_CONFIG.MODERATE;
  const SevIcon = sev.icon;

  return (
    <div className="space-y-2 w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("p-3.5 rounded-xl border space-y-3", sev.bg, sev.border)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", sev.bg, sev.border, "border")}>
              <SevIcon className={cn("w-4 h-4", sev.text)} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", sev.badge)}>
                  {sev.label} Severity
                </span>
                <span className="text-[9px] text-muted-foreground font-bold">AegisHealth AI · Clinical Report</span>
              </div>
            </div>
          </div>
          <span className="text-[9px] font-black text-muted-foreground/60 shrink-0">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <ConfidenceMeter confidence={report.risk.confidence} severity={report.risk.severity} />
        <p className="text-[11px] text-foreground/90 leading-relaxed font-medium">
          {report.triage_summary}
        </p>
      </motion.div>

      {/* Urgency */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-start gap-2 px-3.5 py-2.5 bg-muted/30 border border-border/40 rounded-xl"
      >
        <Clock className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Urgency Recommendation</span>
          <p className="text-[11px] font-bold text-foreground mt-0.5">{report.risk.urgency_recommendation}</p>
        </div>
      </motion.div>

      {/* Symptom Clusters */}
      <Section icon={Activity} title="Symptom Correlation Analysis" delay={0.12}>
        <div className="space-y-2.5">
          {report.symptom_clusters.map((sc, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[10px] font-black text-foreground">{sc.cluster}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pl-3">{sc.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Clinical Considerations */}
      <Section icon={Stethoscope} title="Possible Clinical Considerations" delay={0.18}>
        <div className="space-y-1.5">
          {report.clinical_considerations.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-foreground/90 leading-relaxed">{c}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Specialists */}
      <Section icon={Stethoscope} title="Recommended Specialists" delay={0.24}>
        <div className="space-y-2">
          <div>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block mb-1">Primary Recommendation</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black rounded-lg">
              {report.specialists.primary}
            </span>
          </div>
          {report.specialists.secondary.length > 0 && (
            <div>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block mb-1">Secondary</span>
              <div className="flex flex-wrap gap-1.5">
                {report.specialists.secondary.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 bg-muted/60 border border-border/50 text-muted-foreground text-[9px] font-bold rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link href="/doctors" className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline mt-1">
            Book a {report.specialists.primary} now <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </Section>

      {/* Immediate Actions */}
      <Section icon={Zap} title="Recommended Immediate Actions" delay={0.3}>
        <div className="space-y-1.5">
          {report.immediate_actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[8px] font-black text-primary">{i + 1}</span>
              </div>
              <p className="text-[10px] text-foreground/90 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Emergency Signs */}
      <Section
        icon={AlertTriangle}
        title="Emergency Warning Signs — Seek ER Immediately"
        delay={0.36}
        defaultOpen={report.risk.severity === "CRITICAL" || report.risk.severity === "HIGH"}
        accent="bg-rose-500"
      >
        <div className="space-y-1.5">
          {report.emergency_signs.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
              <p className="text-[10px] text-foreground/90 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Hospitals */}
      <Section icon={Hospital} title="Recommended Hospital Network" delay={0.42}>
        <div className="space-y-1.5">
          {report.recommended_hospitals.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <Hospital className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-foreground/90">{h}</p>
            </div>
          ))}
          <Link href="/hospitals" className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline mt-1">
            View & book hospital slots <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </Section>

      {/* Follow-up */}
      <Section icon={Clock} title="Follow-Up Timeline" delay={0.48}>
        <p className="text-[10px] text-foreground/90 leading-relaxed">{report.followup_timeline}</p>
      </Section>

      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.54 }}
        className="flex items-start gap-2 px-3 py-2.5 bg-muted/20 border border-border/30 rounded-xl"
      >
        <Shield className="w-3 h-3 text-muted-foreground/60 shrink-0 mt-0.5" />
        <p className="text-[9px] text-muted-foreground/70 leading-relaxed">{report.disclaimer}</p>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   ANALYZING OVERLAY
────────────────────────────────────────────────── */
function AnalyzingIndicator({ mode = "report" }: { mode?: "question" | "report" }) {
  const steps = [
    "Reviewing the symptoms you shared...",
    "Checking urgency and safety signals...",
    "Preparing next-step guidance...",
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (mode === "report") {
      const interval = setInterval(() => {
        setStep((s) => Math.min(s + 1, steps.length - 1));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [mode]);

  if (mode === "question") {
    return (
      <div className="flex items-center gap-2.5 py-2 px-0.5">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <span className="text-[10px] font-bold text-primary">Reviewing your response...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Preparing your assessment</span>
      </div>
      <div className="space-y-1.5 pl-1">
        {steps.map((s, i) => (
          <div key={i} className={cn("flex items-center gap-2 transition-all duration-300", i <= step ? "opacity-100" : "opacity-20")}>
            {i < step ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : i === step ? (
              <div className="w-3 h-3 rounded-full bg-primary/30 border border-primary animate-pulse shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-muted border border-border/30 shrink-0" />
            )}
            <span className={cn("text-[10px] font-medium", i < step ? "text-emerald-600 dark:text-emerald-400 line-through" : i === step ? "text-foreground font-bold" : "text-muted-foreground")}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   INTERACTIVE QUESTION CARD
   Renders chips / scale / yesno / multi-select UI
   for progressive symptom collection.
────────────────────────────────────────────────── */
function QuestionCard({
  questionData,
  onAnswer,
  isLocked,
  lockedAnswer,
}: {
  questionData: QuestionData;
  onAnswer: (answer: string) => void;
  isLocked: boolean;
  lockedAnswer?: string;
}) {
  const [scaleVal, setScaleVal] = useState(5);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const totalSteps = questionData.total_steps;
  const currentStep = questionData.step_number;

  /* ── Locked (answered) view ── */
  if (isLocked) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-border/40 bg-muted/20 overflow-hidden"
      >
        <div className="px-3.5 pt-2.5 flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={cn("h-1 rounded-full transition-all", i < currentStep ? "bg-primary w-5" : "bg-muted w-3")} />
          ))}
          <span className="text-[9px] text-muted-foreground font-bold ml-1">Step {currentStep}/{totalSteps}</span>
        </div>
        <div className="px-3.5 pb-3 pt-1.5">
          <p className="text-[10px] text-muted-foreground mb-1.5 leading-snug">{questionData.question}</p>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-bold text-foreground">{lockedAnswer}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Active question view ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-primary/20 bg-background overflow-hidden shadow-sm"
    >
      {/* Progress header */}
      <div className="bg-primary/5 border-b border-primary/10 px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i < currentStep ? "bg-primary w-6" : "bg-muted w-4"
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-black text-primary uppercase tracking-wider">
            Assessment · Step {currentStep} of {totalSteps}
          </span>
        </div>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {/* Question text */}
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-3 h-3 text-primary" />
          </div>
          <p className="text-[11px] font-semibold text-foreground leading-relaxed">{questionData.question}</p>
        </div>

        {/* ── CHIPS ── */}
        {questionData.question_type === "chips" && (
          <div className="flex flex-wrap gap-1.5 pl-8">
            {questionData.options?.map((opt) => (
              <motion.button
                key={opt}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onAnswer(opt)}
                className="px-3 py-1.5 bg-muted hover:bg-primary hover:text-white border border-border/60 hover:border-primary text-[10px] font-bold rounded-xl transition-all duration-150 text-foreground text-left"
              >
                {opt}
              </motion.button>
            ))}
          </div>
        )}

        {/* ── YES / NO ── */}
        {questionData.question_type === "yesno" && (
          <div className="flex gap-3 pl-8">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => onAnswer("Yes")}
              className="flex-1 py-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black rounded-xl transition-all"
            >
              ✓ Yes
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => onAnswer("No")}
              className="flex-1 py-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-700 dark:text-rose-400 text-[11px] font-black rounded-xl transition-all"
            >
              ✗ No
            </motion.button>
          </div>
        )}

        {/* ── SCALE ── */}
        {questionData.question_type === "scale" && (
          <div className="pl-8 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground font-bold">1 — Minimal</span>
              <div className={cn(
                "text-2xl font-black tabular-nums px-3 py-0.5 rounded-lg min-w-[3rem] text-center",
                scaleVal <= 3 ? "text-emerald-600 bg-emerald-500/10" :
                scaleVal <= 6 ? "text-amber-600 bg-amber-500/10" :
                "text-rose-600 bg-rose-500/10"
              )}>
                {scaleVal}
              </div>
              <span className="text-[9px] text-muted-foreground font-bold">10 — Severe</span>
            </div>
            <input
              type="range" min={1} max={10} step={1}
              value={scaleVal}
              onChange={(e) => setScaleVal(Number(e.target.value))}
              className="w-full h-2 rounded-full cursor-pointer appearance-none accent-primary"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${(scaleVal - 1) / 9 * 100}%, hsl(var(--muted)) ${(scaleVal - 1) / 9 * 100}%)`,
              }}
            />
            <div className="flex gap-0.5">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <div
                  key={n}
                  onClick={() => setScaleVal(n)}
                  className={cn(
                    "flex-1 h-1.5 rounded-full cursor-pointer transition-colors",
                    n <= scaleVal
                      ? n <= 3 ? "bg-emerald-500" : n <= 6 ? "bg-amber-500" : "bg-rose-500"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => onAnswer(`${scaleVal}/10`)}
              className="w-full py-2 bg-primary text-white text-[11px] font-black rounded-xl hover:bg-primary/90 transition-all"
            >
              Confirm — {scaleVal}/10 severity
            </motion.button>
          </div>
        )}

        {/* ── MULTI-SELECT ── */}
        {questionData.question_type === "multi" && (
          <div className="pl-8 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {questionData.options?.map((opt) => {
                const isSelected = multiSelected.includes(opt);
                return (
                  <motion.button
                    key={opt}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setMultiSelected((prev) =>
                        prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                      )
                    }
                    className={cn(
                      "px-2.5 py-1 border text-[10px] font-bold rounded-xl transition-all duration-150 text-left",
                      isSelected
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-muted/40 text-foreground border-border/60 hover:border-primary/50 hover:bg-muted"
                    )}
                  >
                    {isSelected && "✓ "}{opt}
                  </motion.button>
                );
              })}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() =>
                onAnswer(
                  multiSelected.length > 0
                    ? multiSelected.join(", ")
                    : "None of the listed symptoms"
                )
              }
              className="w-full py-2 bg-primary text-white text-[11px] font-black rounded-xl hover:bg-primary/90 transition-all"
            >
              {multiSelected.length > 0
                ? `Confirm ${multiSelected.length} symptom${multiSelected.length > 1 ? "s" : ""} selected →`
                : "None of the above — Continue →"}
            </motion.button>
          </div>
        )}

        {/* ── AI Clinical Context ── */}
        {questionData.insight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="ml-8 p-2.5 bg-primary/5 border border-primary/15 rounded-xl"
          >
            <div className="flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="text-[8px] font-black text-primary uppercase tracking-widest block mb-0.5">
                  Clinical Context
                </span>
                <p className="text-[9px] text-primary/80 leading-relaxed">{questionData.insight}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────
   MAIN FLOATING CHAT
────────────────────────────────────────────────── */
export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "session_default";
    let id = localStorage.getItem("chatSessionId");
    if (!id) {
      id = "session_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("chatSessionId", id);
    }
    return id;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  // Track which question messages have been answered (locked)
  const [lockedQuestions, setLockedQuestions] = useState<Set<string>>(new Set());
  const [lockedAnswers, setLockedAnswers] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi, I can help you organize your symptoms and suggest the right next step. Tell me what is bothering you, how long it has been happening, and anything that makes it better or worse.",
        createdAt: new Date().toISOString(),
      }]);
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      setUnreadCount((c) => c + 1);
    }
  }, [messages.length]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInputVal("");

    // Lock the most recent unanswered question card
    const lastQuestion = [...messages].reverse().find(
      (m) => m.questionData && !lockedQuestions.has(m.id)
    );
    if (lastQuestion) {
      setLockedQuestions((prev) => new Set([...prev, lastQuestion.id]));
      setLockedAnswers((prev) => ({ ...prev, [lastQuestion.id]: trimmed }));
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.content && !m.reportData)
        .map((m) => ({ role: m.role, content: m.content || "" }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, sessionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "I couldn't complete that assessment right now.");
      }

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.type === "chat"
          ? data.content
          : data.type === "question"
          ? data.question
          : undefined,
        reportData: data.type === "report" ? data : undefined,
        questionData: data.type === "question" ? data : undefined,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: error instanceof Error
          ? error.message
          : "I couldn't complete that assessment right now. Please try again in a moment.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const STARTER_CHIPS = [
    "Severe headache with nausea",
    "Chest tightness and shortness of breath",
    "High fever for 3 days",
    "Stomach pain after eating",
  ];
  const isInConversation = messages.some((m) => m.questionData);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-[380px] mb-4 shadow-2xl rounded-2xl overflow-hidden border border-border/50 bg-card/95 backdrop-blur-xl flex flex-col"
            style={{ maxHeight: "82vh" }}
          >
            {/* Header */}
            <div className="bg-primary px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-xs text-white tracking-tight">AegisHealth Triage Assistant</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[9px] text-white/70 font-bold uppercase tracking-wider">Symptom Review Active</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMessages([{
                      id: "welcome_reset",
                      role: "assistant",
                      content: "Session cleared. Tell me your current symptoms to begin again.",
                      createdAt: new Date().toISOString(),
                    }]);
                    setLockedQuestions(new Set());
                    setLockedAnswers({});
                  }}
                  className="text-[9px] text-white/50 hover:text-white/80 font-bold uppercase tracking-wider transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>

            {/* Notice bar */}
            <div className="bg-primary/5 border-b border-primary/10 px-3.5 py-1.5 flex items-center gap-1.5 shrink-0">
              <Shield className="w-3 h-3 text-primary" />
              <span className="text-[9px] text-primary font-bold">Triage support only. This does not replace a doctor or emergency care.</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/5">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    /* User bubble */
                    <div className="flex justify-end gap-2">
                      <div className="max-w-[85%] px-3.5 py-2.5 bg-primary text-white rounded-2xl rounded-tr-sm text-[11px] font-medium leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center shrink-0 mt-auto">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                    </div>
                  ) : msg.reportData ? (
                    /* Clinical report */
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <ClinicalReportCard report={msg.reportData} />
                      </div>
                    </div>
                  ) : msg.questionData ? (
                    /* Interactive question card */
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <QuestionCard
                          questionData={msg.questionData}
                          onAnswer={(answer) => handleSend(answer)}
                          isLocked={lockedQuestions.has(msg.id)}
                          lockedAnswer={lockedAnswers[msg.id]}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Regular chat bubble */
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <div className="max-w-[88%] px-3.5 py-2.5 bg-background border border-border/50 rounded-2xl rounded-tl-sm text-[11px] leading-relaxed text-foreground/90 shadow-sm font-medium">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator — question mode vs full report mode */}
              {loading && (() => {
                const isQuestionMode = messages.some((m) => m.questionData);
                return (
                  <div className="flex gap-2 items-start">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                    <div className={cn(
                      "px-3.5 bg-background border border-border/50 shadow-sm",
                      isQuestionMode ? "py-2 rounded-2xl rounded-tl-sm" : "flex-1 py-3 rounded-2xl rounded-tl-sm"
                    )}>
                      <AnalyzingIndicator mode={isQuestionMode ? "question" : "report"} />
                    </div>
                  </div>
                );
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Chips — hide during active question flow, show starters otherwise */}
            {!isInConversation && (
              <div className="px-3 py-2 border-t border-border/40 bg-muted/5 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest shrink-0 self-center mr-0.5">Quick:</span>
                {STARTER_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(chip)}
                    disabled={loading}
                    className="shrink-0 px-2.5 py-1 bg-background hover:bg-primary hover:text-white border border-border/60 text-[9px] font-bold rounded-lg transition-all duration-200 text-muted-foreground whitespace-nowrap disabled:opacity-40"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-2.5 bg-background border-t border-border/50 flex gap-2 items-center shrink-0">
              <Input
                ref={inputRef}
                placeholder="Describe your symptoms in detail..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(inputVal)}
                disabled={loading}
                className="flex-1 h-9 text-[11px] rounded-xl border-border/60 bg-muted/30 disabled:opacity-50"
              />
              <Button
                onClick={() => handleSend(inputVal)}
                disabled={loading || !inputVal.trim()}
                size="sm"
                className="h-9 px-3 rounded-xl shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center transition-all duration-300",
          isOpen
            ? "bg-zinc-800"
            : "bg-gradient-to-br from-primary via-primary to-accent"
        )}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageSquare className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg"
          >
            {unreadCount}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
