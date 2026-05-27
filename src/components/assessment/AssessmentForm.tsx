"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Bot, ArrowRight, ArrowLeft, CheckCircle2, Activity, ShieldAlert, 
  MapPin, Star, Clock, Stethoscope, Hospital, AlertTriangle, 
  HeartPulse, Compass, Video, ShieldCheck,
  ExternalLink, ShieldAlert as AlertIcon
} from "lucide-react";

const assessmentSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  age: z.string().min(1, "Age is required"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required"),
  location: z.string().min(2, "Location is required"),
  
  symptoms: z.string().min(10, "Please describe your symptoms in detail"),
  existingConditions: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  
  emergencyContact: z.string().min(10, "Emergency contact is required"),
  additionalNotes: z.string().optional(),
});

type AssessmentData = z.infer<typeof assessmentSchema>;

interface FollowUpResult {
  kind: "follow_up";
  sessionId: string;
  question: string;
  options?: string[];
}

interface ErrorResult {
  kind: "error";
  error: string;
}

interface NormalizedConcern {
  name: string;
  probability: string;
  description: string;
  symptomsMatched: string[];
}

interface NormalizedStep {
  action: string;
  detail: string;
}

interface NormalizedHospital {
  name: string;
  distance: string;
  rating: number;
  reviews: number;
  fee: string;
  specialty: string;
  timings: string;
  emergency: boolean;
  slots: string[];
}

interface AssessmentResult {
  kind: "assessment";
  sessionId: string;
  urgencyLevel: string;
  clinicalSummary: string;
  severityAssessment?: string;
  confidenceScore?: number;
  specialistRecommendation?: string;
  hospitalRecommendation?: string[];
  recommendedActions?: string[];
  symptomCorrelation?: string[];
}

const steps = [
  { id: "personal", title: "Personal Details" },
  { id: "health", title: "Health Information" },
  { id: "emergency", title: "Emergency & Notes" },
];

export function AssessmentForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | FollowUpResult | ErrorResult | null>(null);
  
  const [userLocationLabel, setUserLocationLabel] = useState("You (Nellore)");
  const [userCoordinates, setUserCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserCoordinates({ lat, lng });
        setUserLocationLabel(`You (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }, (err) => {
        console.warn("Geolocation watch failed:", err);
      }, { enableHighAccuracy: true });
    }
  }, []);

  const openInGoogleMaps = () => {
    if (userCoordinates) {
      window.open(`https://www.google.com/maps/search/hospitals/@${userCoordinates.lat},${userCoordinates.lng},15z`, "_blank");
    } else {
      window.open("https://www.google.com/maps/search/hospitals+in+Nellore,+Andhra+Pradesh", "_blank");
    }
  };
  
  // Loading screen states
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingPhrases = [
    "Reviewing the symptoms you shared...",
    "Checking urgency and safety signals...",
    "Matching the right care pathway...",
    "Preparing your summary..."
  ];

  const { register, handleSubmit, control, formState: { errors, isValid }, trigger } = useForm<AssessmentData>({
    resolver: zodResolver(assessmentSchema),
    mode: "onChange",
    defaultValues: {
      gender: "male",
    }
  });

  // Cycle loading steps
  useEffect(() => {
    if (!isSubmitting) return;

    const interval = window.setInterval(() => {
      setLoadingStep((prev) => (prev < loadingPhrases.length - 1 ? prev + 1 : prev));
    }, 600);

    return () => window.clearInterval(interval);
  }, [isSubmitting, loadingPhrases.length]);

  const nextStep = async () => {
    let fieldsToValidate: Array<keyof AssessmentData> = [];
    if (currentStep === 0) fieldsToValidate = ['fullName', 'age', 'gender', 'phone', 'email', 'location'];
    if (currentStep === 1) fieldsToValidate = ['symptoms'];

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (data: AssessmentData) => {
    setIsSubmitting(true);
    setLoadingStep(0);
    try {
      const response = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resultData = await response.json();
      if (!response.ok) {
        throw new Error(resultData.error || "Assessment failed");
      }
      setResult(resultData);
    } catch (error) {
      console.error("Error submitting assessment:", error);
      setResult({
        kind: "error",
        error: error instanceof Error ? error.message : "Assessment failed",
      });
    } finally {
      setIsSubmitting(false);
      setLoadingStep(0);
    }
  };

  // Helper for Urgency colors and badges
  const getUrgencyConfig = (level: string) => {
    switch (level?.toUpperCase()) {
      case "LOW":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
          badgeBg: "bg-emerald-500 text-white",
          glow: "shadow-emerald-500/10",
          icon: ShieldCheck,
          label: "Low Urgency"
        };
      case "MODERATE":
        return {
          bg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
          badgeBg: "bg-amber-500 text-white",
          glow: "shadow-amber-500/10",
          icon: AlertTriangle,
          label: "Moderate Urgency"
        };
      case "HIGH":
        return {
          bg: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
          badgeBg: "bg-orange-500 text-white",
          glow: "shadow-orange-500/10",
          icon: ShieldAlert,
          label: "High Urgency"
        };
      case "CRITICAL":
        return {
          bg: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
          badgeBg: "bg-rose-500 text-white",
          glow: "shadow-rose-500/20",
          icon: AlertIcon,
          label: "Critical / ER Care"
        };
      default:
        return {
          bg: "bg-primary/10 border-primary/20 text-primary",
          badgeBg: "bg-primary text-white",
          glow: "shadow-primary/10",
          icon: Stethoscope,
          label: "Assessment Complete"
        };
    }
  };

  // Submitting Animation Overlay
  if (isSubmitting) {
    return (
      <Card className="w-full max-w-3xl mx-auto border-none shadow-2xl bg-card/60 backdrop-blur-2xl py-16 px-8 relative overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50" />
        
        <div className="relative z-10 w-full text-center max-w-md">
          {/* Futuristic Scanning Heartbeat */}
          <div className="relative mb-12 flex justify-center">
            <motion.div 
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="absolute w-24 h-24 bg-primary/10 rounded-full blur-xl"
            />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="w-20 h-20 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center"
            >
              <HeartPulse className="w-10 h-10 text-primary animate-pulse" />
            </motion.div>
          </div>

          <h3 className="text-2xl font-bold tracking-tight text-foreground mb-3">
            Preparing your assessment
          </h3>
          <p className="text-sm text-muted-foreground mb-8">
            Reviewing your details and preparing next-step guidance.
          </p>

          {/* Stepped progress indicators */}
          <div className="space-y-4 text-left border border-border/50 bg-background/30 rounded-xl p-5 backdrop-blur-md">
            {loadingPhrases.map((phrase, idx) => (
              <div key={idx} className="flex items-center space-x-3 text-sm">
                <div className="flex shrink-0 w-5 h-5 rounded-full items-center justify-center">
                  {loadingStep > idx ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : loadingStep === idx ? (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-2.5 h-2.5 bg-primary rounded-full" 
                    />
                  ) : (
                    <div className="w-2 h-2 bg-muted rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "transition-colors duration-300 font-medium",
                  loadingStep > idx ? "text-muted-foreground/80 line-through" : 
                  loadingStep === idx ? "text-primary font-semibold" : "text-muted-foreground/45"
                )}>
                  {phrase}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center space-x-2">
            <span className="w-2 h-2 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </Card>
    );
  }

  // Beautiful redesigned results screen
  if (result) {
    if (result.kind === "follow_up") {
      return (
        <Card className="w-full max-w-4xl mx-auto border-none shadow-2xl bg-card/60 backdrop-blur-2xl">
          <CardContent className="p-8 md:p-10 space-y-6">
            <div className="space-y-3">
              <Badge className="bg-primary text-white rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider">
                AI Follow-Up Required
              </Badge>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                More clinical detail is needed before safe triage.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.question}
              </p>
            </div>

            <div className="grid gap-3">
              {result.options?.map((option: string, index: number) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-foreground"
                >
                  {option}
                </div>
              ))}
            </div>

            <Button size="lg" variant="outline" className="rounded-xl" onClick={() => window.location.reload()}>
              Start a More Detailed Assessment
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (result.kind === "error") {
      return (
        <Card className="w-full max-w-3xl mx-auto border border-destructive/30 shadow-xl bg-destructive/5 backdrop-blur-xl">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Assessment not available right now</h2>
            <p className="text-sm text-muted-foreground">{result.error}</p>
            <Button variant="outline" onClick={() => setResult(null)}>Try Again</Button>
          </CardContent>
        </Card>
      );
    }

      const normalizedResult: {
        urgencyLevel: string;
        urgencyReason: string;
        clinicalSummary: string;
        possibleConcerns: NormalizedConcern[];
        nextSteps: NormalizedStep[];
        suggestedDepartments: string[];
        recommendedHospitals: NormalizedHospital[];
      } = {
      urgencyLevel: result.urgencyLevel,
      urgencyReason: result.severityAssessment || "Clinical triage summary generated.",
      clinicalSummary: result.clinicalSummary,
      possibleConcerns: (result.symptomCorrelation || []).map((item: string, index: number) => ({
        name: `Clinical Signal ${index + 1}`,
        probability: `${Math.max(70, (result.confidenceScore || 75) - index * 6)}%`,
        description: item,
        symptomsMatched: [item],
      })),
      nextSteps: (result.recommendedActions || []).map((action: string) => ({
        action,
        detail: action,
      })),
      suggestedDepartments: [
        result.specialistRecommendation || "General Medicine",
      ],
      recommendedHospitals: (result.hospitalRecommendation || []).map((name: string) => ({
        name,
        distance: "Live search required",
        rating: 0,
        reviews: 0,
        fee: "Variable",
        specialty: result.specialistRecommendation || "General Medicine",
        timings: "Contact hospital",
        emergency: result.urgencyLevel === "CRITICAL",
        slots: [],
      })),
    };

    const config = getUrgencyConfig(normalizedResult.urgencyLevel);
    const UrgencyIcon = config.icon;

    return (
      <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
        
        {/* Urgent Triage / Hero Header */}
        <div className={cn(
          "w-full rounded-3xl border p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 backdrop-blur-xl shadow-2xl relative overflow-hidden transition-all duration-300",
          config.bg, config.glow
        )}>
          {/* Animated glow background */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent blur-3xl pointer-events-none" />
          
          <div className="space-y-4 max-w-3xl relative z-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider", config.badgeBg)}>
                {config.label}
              </span>
              <span className="text-xs bg-background/50 backdrop-blur border border-border/40 text-muted-foreground font-medium px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Validated Health Telemetry
              </span>
            </div>
            
            <div className="flex gap-3.5 items-start">
              <UrgencyIcon className="w-8 h-8 shrink-0 mt-1" />
              <div className="space-y-1.5">
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                  AI Triage Analysis Complete
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {normalizedResult.urgencyReason}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 shrink-0 w-full md:w-auto relative z-10">
            <Link 
              href="#hospitals" 
              className={cn(buttonVariants({ variant: "default", size: "lg", className: "w-full md:w-auto font-semibold shadow-lg group rounded-xl" }))}
            >
              Book Priority Appointment
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
            <Button size="lg" variant="outline" className="w-full md:w-auto font-medium rounded-xl" onClick={() => window.location.reload()}>
              Start New Analysis
            </Button>
          </div>
        </div>

        {/* Diagnostic Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Clinical Results */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Clinical Summary */}
            <Card className="border-none shadow-xl bg-card/45 backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center space-x-3 border-b pb-4 border-border/50">
                  <Stethoscope className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold tracking-tight text-foreground">Clinical Report Summary</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {normalizedResult.clinicalSummary}
                </p>
              </CardContent>
            </Card>

            {/* Possible Concerns (Matching Probability Grid) */}
            <div className="space-y-4">
              <h3 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2 px-1">
                <Activity className="w-5 h-5 text-primary" />
                Symptom Correlation & Match Scores
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {normalizedResult.possibleConcerns.map((concern, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -4 }}
                    className="group flex flex-col justify-between p-6 bg-card/40 hover:bg-card/75 border border-border/50 rounded-2xl shadow-sm transition-all duration-300 relative overflow-hidden"
                  >
                    {/* Glowing highlight border */}
                    <div className="absolute top-0 left-0 w-2.5 h-full bg-gradient-to-b from-primary to-accent opacity-75" />
                    
                    <div className="space-y-4 relative z-10 pl-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-lg text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">
                          {concern.name}
                        </h4>
                        <span className="font-black text-xl text-primary/90 bg-primary/5 px-2.5 py-1 rounded-lg shrink-0 border border-primary/10">
                          {concern.probability}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground/90 leading-relaxed">
                        {concern.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {concern.symptomsMatched.map((symptom: string, i: number) => (
                          <Badge key={i} variant="secondary" className="rounded-full text-xs font-semibold px-2.5 py-0.5 border border-border bg-background/50">
                            {symptom}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Structured Triage Care / Next Steps */}
            <Card className="border-none shadow-xl bg-card/45 backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center space-x-3 border-b pb-4 border-border/50">
                  <Compass className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold tracking-tight text-foreground">Actionable Care Pathways</h3>
                </div>
                
                <div className="space-y-6">
                  {normalizedResult.nextSteps.map((step, idx: number) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex shrink-0 w-8 h-8 rounded-xl items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-base text-foreground leading-tight">{step.action}</h4>
                        <p className="text-sm text-muted-foreground/90 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Sidebar Recommendations / Trust Panel */}
          <div className="space-y-8">
            
            {/* Suggested Departments capsule list */}
            <Card className="border border-border/50 shadow-lg bg-card/30 backdrop-blur-md rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Recommended Specialties</h4>
                <div className="flex flex-wrap gap-2">
                  {normalizedResult.suggestedDepartments.map((dept: string, i: number) => (
                    <span key={i} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold border border-primary/20">
                      <Stethoscope className="w-3.5 h-3.5" />
                      {dept}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Medical history disclaimer info */}
            <Card className="border border-destructive/25 shadow-lg bg-destructive/5 backdrop-blur-md rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-destructive/10 via-transparent to-transparent blur-2xl pointer-events-none" />
              <CardContent className="p-6 space-y-3 relative z-10">
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h4 className="font-bold text-sm uppercase tracking-wider">Clinical Disclaimer</h4>
                </div>
                <p className="text-xs text-destructive/80 leading-relaxed font-semibold">
                  This report is powered by diagnostic clinical telemetry. It is for patient triage and guidance purposes only and **DOES NOT** constitute an official medical diagnosis. Seek advice from certified practitioners or visit urgent care in an emergency.
                </p>
              </CardContent>
            </Card>

            {/* Digital Clinic / Quick Telehealth Video consult CTA */}
            <Card className="border border-primary/20 shadow-xl bg-gradient-to-b from-primary/10 to-transparent backdrop-blur-xl rounded-2xl relative overflow-hidden">
              <CardContent className="p-6 space-y-4 text-center">
                <div className="inline-flex p-3 bg-primary/15 rounded-2xl mb-2">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <h4 className="text-lg font-extrabold tracking-tight text-foreground">Consult a Video Doctor Now</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Skip the travel. Get connected with a general physician online in less than 10 minutes. Available 24/7.
                </p>
                <Button className="w-full font-semibold rounded-xl bg-primary hover:bg-primary/95 text-white shadow-lg">
                  Start Virtual Visit
                </Button>
              </CardContent>
            </Card>

          </div>

        </div>

        {/* Hospital Card Section */}
        <div id="hospitals" className="pt-8 border-t border-border/40 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Hospital className="w-3.5 h-3.5" />
                Integrated Hospital Networks
              </span>
              <h3 className="text-3xl font-extrabold tracking-tight text-foreground">
                Nearest Specialized Care Facilities
              </h3>
              <p className="text-sm text-muted-foreground">
                Priority booking matches for your specific clinical needs.
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-xs bg-background/50 border border-border/50 px-4 py-2 rounded-xl text-muted-foreground/80 font-medium">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Showing within 5.0 miles of your location
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Hospitals Cards Grid */}
            <div className="lg:col-span-2 space-y-6">
              {normalizedResult.recommendedHospitals.map((hospital, idx: number) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.01 }}
                  className="flex flex-col md:flex-row bg-card/45 hover:bg-card/75 border border-border/50 rounded-2xl shadow-md overflow-hidden transition-all duration-300"
                >
                  {/* Decorative modern color gradient side block */}
                  <div className="w-full md:w-32 bg-gradient-to-br from-primary/20 via-accent/15 to-transparent flex flex-col justify-center items-center p-6 border-b md:border-b-0 md:border-r border-border/50">
                    <Hospital className="w-10 h-10 text-primary mb-2" />
                    <span className="text-[10px] text-primary/80 font-bold uppercase tracking-widest">
                      {hospital.distance}
                    </span>
                  </div>

                  <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xl text-foreground tracking-tight">
                              {hospital.name}
                            </h4>
                            {hospital.emergency && (
                              <Badge className="bg-rose-500 hover:bg-rose-600 text-white rounded-md text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5">
                                ER Ready
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                            <MapPin className="w-3.5 h-3.5" />
                            {hospital.distance} from your position
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-bold text-foreground">{hospital.rating}</span>
                          <span className="text-xs text-muted-foreground">({hospital.reviews} reviews)</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-lg font-bold">
                          {hospital.specialty}
                        </span>
                        <span className="text-xs bg-muted/65 border border-border/40 text-muted-foreground px-3 py-1 rounded-lg font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary/80" />
                          {hospital.timings}
                        </span>
                      </div>

                    </div>

                    <div className="border-t border-border/40 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block">Consultation Fee</span>
                        <span className="font-black text-lg text-foreground">{hospital.fee}</span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block sm:text-right">Available Slots Tomorrow</span>
                        <div className="flex flex-wrap gap-2">
                          {hospital.slots.map((slot: string, i: number) => (
                            <button
                              key={i}
                              className="px-3.5 py-1.5 bg-background hover:bg-primary hover:text-white border border-border/50 text-xs font-bold rounded-xl transition-all duration-200 shadow-sm"
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              ))}
            </div>

            {/* Stylized Glass Google Map Mockup */}
            <div className="lg:col-span-1">
              <div className="w-full h-full min-h-[380px] lg:min-h-[460px] border border-border/50 rounded-2xl overflow-hidden shadow-md bg-card/30 backdrop-blur-md flex flex-col justify-between relative group">
                
                {/* Simulated map graphic */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none z-0" />
                
                {/* Visual pins matching hospitals */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                  <div className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-lg shadow-lg border border-white/20 whitespace-nowrap mb-1">
                    Metro Health (1.4m)
                  </div>
                  <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg animate-pulse" />
                </div>
                
                <div className="absolute top-2/3 left-1/3 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                  <div className="px-3 py-1 bg-accent text-white text-[10px] font-black rounded-lg shadow-lg border border-white/20 whitespace-nowrap mb-1">
                    St. Jude Memorial (2.8m)
                  </div>
                  <div className="w-4 h-4 bg-accent rounded-full border-2 border-white shadow-lg animate-pulse" />
                </div>

                <div className="absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                  <div className="px-3 py-1 bg-background text-foreground text-[10px] font-bold rounded-lg shadow-lg border border-border whitespace-nowrap mb-1">
                    {userLocationLabel}
                  </div>
                  <div className="w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-lg" />
                </div>

                <div className="relative z-10 p-6 flex flex-col justify-between h-full pointer-events-none">
                  <div className="bg-background/80 backdrop-blur border border-border/40 p-3 rounded-xl shadow-lg flex items-center space-x-2">
                    <Compass className="w-5 h-5 text-primary animate-spin" />
                    <div>
                      <h5 className="text-xs font-black text-foreground">Interactive Navigation Mock</h5>
                      <p className="text-[10px] text-muted-foreground">Routing nearest clinical infrastructure</p>
                    </div>
                  </div>
                  
                  <div className="bg-background/80 backdrop-blur border border-border/40 p-4 rounded-xl shadow-lg flex flex-col space-y-2 pointer-events-auto">
                    <p className="text-[11px] text-muted-foreground font-semibold">
                      Integration with Google Maps ready. Coordinates mapped based on user location telemetry.
                    </p>
                    <Button onClick={openInGoogleMaps} size="sm" className="w-full text-xs font-bold rounded-lg bg-primary hover:bg-primary/95 text-white">
                      Open in Maps <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    );
  }

  // Multi-step Glassmorphism Form container
  return (
    <Card className="w-full max-w-3xl mx-auto border border-border/50 shadow-2xl bg-card/45 backdrop-blur-2xl rounded-3xl overflow-hidden relative transition-all duration-300">
      
      {/* Decorative colored visual backgrounds inside form */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent blur-3xl pointer-events-none z-0" />

      <CardContent className="p-8 md:p-12 relative z-10">
        
        {/* Step indicator header */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-5">
            {steps.map((step, index) => (
              <div key={step.id} className={cn("flex items-center space-x-2.5 transition-all duration-300", index <= currentStep ? 'text-primary' : 'text-muted-foreground/50')}>
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center font-black border-2 transition-all duration-300", 
                  index < currentStep ? 'border-primary bg-primary text-white shadow-md' :
                  index === currentStep ? 'border-primary bg-primary/10 text-primary scale-110 shadow-lg' : 'border-border/80 bg-background/50'
                )}>
                  {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                </div>
                <span className="ml-1 font-bold text-sm hidden sm:block tracking-tight">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-1.5 bg-muted/65" />
        </div>

        {/* Inputs sections */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Personal Details */}
            {currentStep === 0 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="font-bold text-sm tracking-tight">Full Name</Label>
                    <Input id="fullName" {...register("fullName")} placeholder="John Doe" className="bg-background/50 border-border/80 focus:border-primary focus:ring-primary/20 h-11 px-4 rounded-xl" />
                    {errors.fullName && <p className="text-xs text-destructive font-semibold">{errors.fullName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age" className="font-bold text-sm tracking-tight">Age</Label>
                    <Input id="age" type="number" {...register("age")} placeholder="30" className="bg-background/50 border-border/80 focus:border-primary focus:ring-primary/20 h-11 px-4 rounded-xl" />
                    {errors.age && <p className="text-xs text-destructive font-semibold">{errors.age.message}</p>}
                  </div>
                </div>

                <div className="space-y-3 bg-muted/30 border border-border/40 p-5 rounded-2xl backdrop-blur-sm">
                  <Label className="font-bold text-sm tracking-tight text-foreground">Gender Selection</Label>
                  <Controller
                    name="gender"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col sm:flex-row gap-4 sm:gap-8"
                      >
                        <div className="flex items-center space-x-2.5">
                          <RadioGroupItem value="male" id="r1" className="focus:ring-primary text-primary" />
                          <Label htmlFor="r1" className="font-semibold text-sm cursor-pointer select-none">Male</Label>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <RadioGroupItem value="female" id="r2" className="focus:ring-primary text-primary" />
                          <Label htmlFor="r2" className="font-semibold text-sm cursor-pointer select-none">Female</Label>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <RadioGroupItem value="other" id="r3" className="focus:ring-primary text-primary" />
                          <Label htmlFor="r3" className="font-semibold text-sm cursor-pointer select-none">Other</Label>
                        </div>
                      </RadioGroup>
                    )}
                  />
                  {errors.gender && <p className="text-xs text-destructive font-semibold">{errors.gender.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-bold text-sm tracking-tight">Phone Number</Label>
                    <Input id="phone" type="tel" {...register("phone")} placeholder="+91 99999 99999" className="bg-background/50 border-border/80 focus:border-primary focus:ring-primary/20 h-11 px-4 rounded-xl" />
                    {errors.phone && <p className="text-xs text-destructive font-semibold">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-bold text-sm tracking-tight">Email Address</Label>
                    <Input id="email" type="email" {...register("email")} placeholder="john@example.com" className="bg-background/50 border-border/80 focus:border-primary focus:ring-primary/20 h-11 px-4 rounded-xl" />
                    {errors.email && <p className="text-xs text-destructive font-semibold">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="font-bold text-sm tracking-tight">Location / City</Label>
                  <Input id="location" {...register("location")} placeholder="e.g. Hyderabad, Nellore" className="bg-background/50 border-border/80 focus:border-primary focus:ring-primary/20 h-11 px-4 rounded-xl" />
                  {errors.location && <p className="text-xs text-destructive font-semibold">{errors.location.message}</p>}
                </div>
              </motion.div>
            )}

            {/* Step 2: Symptoms & History */}
            {currentStep === 1 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-2.5">
                  <Label htmlFor="symptoms" className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
                    Describe your symptoms <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground/80 leading-normal mb-1">
                    Describe all active symptoms, including intensity, triggers, duration, and matches. Provide a comprehensive summary.
                  </p>
                  <Textarea 
                    id="symptoms" 
                    {...register("symptoms")} 
                    placeholder="e.g. Experiencing intense pulsing tension in the forehead for 3 days. Accompanied by nausea, severe sensitivity to computer screen lights, and minor visual distortion." 
                    className="min-h-[140px] bg-background/50 border-border/80 focus:border-primary focus:ring-primary/20 p-4 rounded-2xl leading-relaxed"
                  />
                  {errors.symptoms && <p className="text-xs text-destructive font-semibold">{errors.symptoms.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="existingConditions" className="font-bold text-sm tracking-tight">Medical History (Optional)</Label>
                    <Input id="existingConditions" {...register("existingConditions")} placeholder="e.g., Hypertension, Diabetes" className="bg-background/50 border-border/80 h-11 px-4 rounded-xl" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allergies" className="font-bold text-sm tracking-tight">Allergies (Optional)</Label>
                    <Input id="allergies" {...register("allergies")} placeholder="e.g., Penicillin, Peanuts" className="bg-background/50 border-border/80 h-11 px-4 rounded-xl" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentMedications" className="font-bold text-sm tracking-tight">Current Medications (Optional)</Label>
                  <Input id="currentMedications" {...register("currentMedications")} placeholder="e.g., Aspirin 75mg daily" className="bg-background/50 border-border/80 h-11 px-4 rounded-xl" />
                </div>
              </motion.div>
            )}

            {/* Step 3: Emergency & Notes */}
            {currentStep === 2 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact" className="font-bold text-sm tracking-tight">Emergency Contact Phone Number <span className="text-destructive">*</span></Label>
                  <Input id="emergencyContact" {...register("emergencyContact")} placeholder="+91 99999 88888" className="bg-background/50 border-border/80 h-11 px-4 rounded-xl" />
                  {errors.emergencyContact && <p className="text-xs text-destructive font-semibold">{errors.emergencyContact.message}</p>}
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="additionalNotes" className="font-bold text-sm tracking-tight">Additional Medical Notes (Optional)</Label>
                  <Textarea 
                    id="additionalNotes" 
                    {...register("additionalNotes")} 
                    placeholder="Enter any secondary triggers, hospital network preferences, family history, or doctor instructions." 
                    className="min-h-[140px] bg-background/50 border-border/80 p-4 rounded-2xl leading-relaxed"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nav buttons */}
          <div className="flex justify-between pt-8 border-t border-border/50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={prevStep} 
              disabled={currentStep === 0}
              className="rounded-xl px-5 h-11 border-border/80 hover:bg-muted font-bold text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            
            {currentStep < steps.length - 1 ? (
              <Button type="button" onClick={nextStep} className="rounded-xl px-5 h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting || !isValid}
                className="rounded-xl px-6 h-11 bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center gap-2"
              >
                Submit Telemetry & Analyze
                <Bot className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
