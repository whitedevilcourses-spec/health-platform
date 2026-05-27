"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Search, MapPin, Star, Clock, Stethoscope, Hospital, ShieldAlert,
  ShieldCheck, Video, CheckCircle2, X, AlertCircle, Sparkles, CreditCard, Receipt
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getRoleHome, useCurrentUserProfile } from "@/lib/current-user";
import { useFeedback } from "@/components/providers/feedback-provider";

type HospitalDiscoveryRecord = {
  _id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  departments: string[];
  emergencySupport: boolean;
  insuranceSupported: boolean;
  consultationFee: number | null;
  rating: number;
  reviewCount: number;
  availableTimings: string;
  availableSlots: string[];
  primaryDoctorId: string;
  primaryDoctorName: string;
  verified: boolean;
  verificationStatus: string;
  facilities: string[];
  distanceLabel: string;
};

type BookingReceiptRecord = {
  id: string;
  patientName: string;
  patientPhone: string;
  hospitalName: string;
  doctorName: string;
  timeSlot: string;
  consultationType: string;
};

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeHospitalRecord(id: string, rawData: Record<string, unknown>): HospitalDiscoveryRecord {
  const departments = asStringArray(rawData.departments);
  const facilities = asStringArray(rawData.facilities);
  const availableSlots = asStringArray(rawData.slots).length > 0
    ? asStringArray(rawData.slots)
    : asStringArray(rawData.availableSlots);
  const consultationFee = toNumberOrNull(rawData.consultationFee);
  const city = typeof rawData.city === "string" ? rawData.city : "";
  const address = typeof rawData.address === "string" ? rawData.address : city;
  const description =
    typeof rawData.description === "string" && rawData.description.trim()
      ? rawData.description.trim()
      : facilities.length > 0
        ? `Facilities include ${facilities.slice(0, 3).join(", ")}.`
        : departments.length > 0
          ? `${departments.join(", ")} departments are currently listed for this hospital.`
          : "This hospital profile is live and waiting for additional operational details.";

  return {
    _id: id,
    name: typeof rawData.name === "string" && rawData.name.trim() ? rawData.name.trim() : "Hospital profile",
    description,
    address,
    city,
    departments,
    emergencySupport: rawData.emergencySupport === true || rawData.emergency === true,
    insuranceSupported: rawData.insuranceSupported === true,
    consultationFee,
    rating: typeof rawData.rating === "number" ? rawData.rating : 0,
    reviewCount:
      typeof rawData.reviewCount === "number"
        ? rawData.reviewCount
        : typeof rawData.reviewsCount === "number"
          ? rawData.reviewsCount
          : 0,
    availableTimings:
      typeof rawData.availableTimings === "string" ? rawData.availableTimings : "",
    availableSlots,
    primaryDoctorId:
      typeof rawData.primaryDoctorId === "string" ? rawData.primaryDoctorId : "",
    primaryDoctorName:
      typeof rawData.primaryDoctorName === "string" ? rawData.primaryDoctorName : "",
    verified: rawData.verified === true || rawData.verificationStatus === "verified",
    verificationStatus:
      typeof rawData.verificationStatus === "string" ? rawData.verificationStatus : "pending",
    facilities,
    distanceLabel:
      typeof rawData.distance === "string" && rawData.distance.trim()
        ? rawData.distance.trim()
        : city,
  };
}

export default function HospitalsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useCurrentUserProfile();
  const { showFeedback } = useFeedback();
  const [rawHospitals, setRawHospitals] = useState<HospitalDiscoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [insuranceOnly, setInsuranceOnly] = useState(false);
  const [maxFee, setMaxFee] = useState<number>(100);

  // Booking Modal States
  const [selectedHospital, setSelectedHospital] = useState<HospitalDiscoveryRecord | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [consultType, setConsultType] = useState<"video" | "in-person">("in-person");
  
  // Patient details
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const patientNotes = "";

  // Stripe details
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("342");
  
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<BookingReceiptRecord | null>(null);
  const canPatientBook = profile?.role === "patient";

  useEffect(() => {
    if (profileLoading || !profile) return;
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
    }
  }, [profile, profileLoading, router]);

  // Subscribe to raw hospitals collection in Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "hospitals"), orderBy("name")), (snapshot) => {
      const list = snapshot.docs.map((item) =>
        normalizeHospitalRecord(item.id, item.data() as Record<string, unknown>)
      );
      setRawHospitals(list);
      setLoading(false);
    }, (err) => {
      console.error("Firestore hospitals listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hospitals = useMemo(() => {
    let filtered = [...rawHospitals];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h => 
        h.name?.toLowerCase().includes(term) ||
        h.description?.toLowerCase().includes(term) ||
        h.address?.toLowerCase().includes(term) ||
        h.departments?.some((d: string) => d.toLowerCase().includes(term))
      );
    }

    if (selectedDept) {
      filtered = filtered.filter(h => h.departments?.includes(selectedDept));
    }

    if (emergencyOnly) {
      filtered = filtered.filter(h => h.emergencySupport === true);
    }

    if (insuranceOnly) {
      filtered = filtered.filter(h => h.insuranceSupported === true);
    }

    if (maxFee) {
      filtered = filtered.filter(
        (hospital) => hospital.consultationFee == null || hospital.consultationFee <= maxFee
      );
    }

    return filtered;
  }, [rawHospitals, searchTerm, selectedDept, emergencyOnly, insuranceOnly, maxFee]);

  const handleOpenBooking = (hospital: HospitalDiscoveryRecord, slot: string) => {
    if (!canPatientBook) {
      showFeedback({
        tone: "warning",
        title: "Patient booking only",
        message: `Only patient accounts can book appointments from hospital discovery. Your ${profile?.role || "current"} portal has its own dedicated workflow.`,
        primaryAction: profile?.role
          ? {
              label: "Go to my dashboard",
              onClick: () => router.push(getRoleHome(profile.role)),
            }
          : undefined,
        secondaryAction: {
          label: "Stay here",
          variant: "outline",
        },
      });
      return;
    }
    setSelectedHospital(hospital);
    setSelectedSlot(slot);
    setBookingSuccess(null);
    // Pre-fill from localstorage if patient has entered it previously
    const savedEmail = localStorage.getItem("patientEmail") || "";
    setPatientEmail(savedEmail);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !patientEmail || !patientPhone || !selectedHospital || !selectedSlot) return;

    setBookingLoading(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientEmail,
          patientPhone,
          hospitalId: selectedHospital._id,
          hospitalName: selectedHospital.name,
          doctorId: selectedHospital.primaryDoctorId || selectedHospital._id,
          doctorName: selectedHospital.primaryDoctorName || selectedHospital.departments?.[0] || "Assigned clinician",
          department: selectedHospital.departments?.[0] || "General Medicine",
          date: new Date().toISOString().split("T")[0],
          timeSlot: selectedSlot,
          consultationType: consultType,
          notes: patientNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {

        // Dispatch receipt email via Nodemailer
        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: patientEmail,
              subject: "Booking Receipt",
              type: "invoice",
              html: `
                  <div style="padding: 12px 0;">
                    <p style="font-size: 15px; font-weight: bold; margin: 0 0 12px 0; color: #0f172a;">Transaction Confirmation Receipt</p>
                    <p style="font-size: 13px; color: #4b5563; margin-bottom: 16px;">Thank you for your payment. Your booking has been registered successfully at ${selectedHospital.name}!</p>
                    
                    <table style="width: 100%; font-size: 12px; border-collapse: collapse; margin-bottom: 16px;">
                      <tr style="border-bottom: 1px solid #e4e4e7;"><td style="padding: 8px 0; font-weight: bold; color: #71717a;">Patient Name:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #18181b;">${patientName}</td></tr>
                      <tr style="border-bottom: 1px solid #e4e4e7;"><td style="padding: 8px 0; font-weight: bold; color: #71717a;">Contact:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #18181b;">${patientPhone}</td></tr>
                      <tr style="border-bottom: 1px solid #e4e4e7;"><td style="padding: 8px 0; font-weight: bold; color: #71717a;">Department:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #18181b;">${selectedHospital.departments?.[0] || "Assigned care team"}</td></tr>
                      <tr style="border-bottom: 1px solid #e4e4e7;"><td style="padding: 8px 0; font-weight: bold; color: #71717a;">Scheduled Time:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #18181b;">Tomorrow at ${selectedSlot}</td></tr>
                      <tr style="border-bottom: 1px solid #e4e4e7;"><td style="padding: 8px 0; font-weight: bold; color: #71717a;">Consultation:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #6366f1; text-transform: uppercase;">${consultType}</td></tr>
                      <tr style="font-size: 14px; font-weight: bold;"><td style="padding: 12px 0; color: #0f172a;">Total Billed:</td><td style="padding: 12px 0; text-align: right; color: #0f172a;">$${selectedHospital.consultationFee}.00</td></tr>
                    </table>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 11px; color: #64748b;">
                      <strong>Appointment ID:</strong> ${data.id}<br/>
                      <strong>Merchant Ref:</strong> Aegis Health Booking
                    </div>
                  </div>
                `
            })
          }).then(async (emailRes) => {
            const emailData = await emailRes.json();
            if (emailRes.ok && emailData.previewUrl) {
              showFeedback({
                tone: "success",
                title: "Receipt dispatched",
                message: `A booking receipt was sent to ${patientEmail}. You can open the preview inbox in a new tab whenever you are ready.`,
                primaryAction: {
                  label: "Open receipt preview",
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
          });
        } catch (emailErr) {
          console.error("Failed to send receipt email:", emailErr);
        }

        setBookingSuccess(data);
        localStorage.setItem("patientEmail", patientEmail);
      } else {
        showFeedback({
          tone: "error",
          title: "Booking failed",
          message: data.error || "We could not schedule this appointment.",
        });
      }
    } catch (err) {
      console.error(err);
      showFeedback({
        tone: "error",
        title: "Something went wrong",
        message: "The booking request could not be completed. Please try again.",
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const departmentsList = Array.from(
    new Set(
      rawHospitals.flatMap((hospital) =>
        Array.isArray(hospital.departments) ? hospital.departments : []
      )
    )
  ).sort();

  const liveCityCount = Array.from(
    new Set(rawHospitals.map((hospital) => hospital.city).filter(Boolean))
  ).length;
  const liveSpecialtyCount = departmentsList.length;
  const hasPublishedHospitals = rawHospitals.length > 0;
  const hasActiveFilters = Boolean(
    searchTerm || selectedDept || emergencyOnly || insuranceOnly || maxFee !== 100
  );

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDept("");
    setEmergencyOnly(false);
    setInsuranceOnly(false);
    setMaxFee(100);
  };

  const openEmptyStateAction = () => {
    if (profile?.role === "manager" || profile?.role === "hospital_manager") {
      router.push("/onboarding");
      return;
    }
    router.push("/doctors");
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto relative z-10 space-y-10">
        
        {/* Page Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            <Hospital className="w-3.5 h-3.5 mr-1" />
            Discover & Book Care
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Search Premium Hospital Infrastructure
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed font-semibold">
            Instantly filter verified local hospitals, explore department specialties, and confirm priority appointments via secure Stripe gateways.
          </p>
        </div>

        {/* Filter Controls Card */}
        <Card className="border border-border/50 bg-card/65 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Search Input */}
            <div className="lg:col-span-2 space-y-2">
              <Label className="font-bold text-sm tracking-tight text-foreground">Hospital Name or Keywords</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="e.g. Metro Health, Neurology, Banjara Hills..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background/50 border-border/80 pl-10 focus:border-primary h-11 rounded-xl"
                />
              </div>
            </div>

            {/* Department Specialty Selector */}
            <div className="space-y-2">
              <Label className="font-bold text-sm tracking-tight text-foreground">Medical Specialty</Label>
              <select 
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-background/50 border border-border/80 focus:border-primary h-11 px-3.5 rounded-xl text-sm font-medium"
              >
                <option value="">All Specialties</option>
                {departmentsList.map((dept, i) => (
                  <option key={i} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Price Filter Selector */}
            <div className="space-y-2">
              <Label className="font-bold text-sm tracking-tight text-foreground flex justify-between">
                <span>Max Consultation Fee</span>
                <span className="text-primary font-black">${maxFee}</span>
              </Label>
              <div className="pt-2">
                <input 
                  type="range" 
                  min="20" 
                  max="150" 
                  step="5"
                  value={maxFee} 
                  onChange={(e) => setMaxFee(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

          </div>

          {/* Quick toggle check buttons */}
          <div className="flex flex-wrap gap-4 pt-6 border-t border-border/40 mt-6">
            <button
              onClick={() => setEmergencyOnly(!emergencyOnly)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all duration-300 shadow-sm",
                emergencyOnly ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400" : "bg-background/50 border-border/80 hover:bg-muted text-muted-foreground"
              )}
            >
              <ShieldAlert className="w-4 h-4" />
              Emergency ER Ready Only
            </button>
            <button
              onClick={() => setInsuranceOnly(!insuranceOnly)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all duration-300 shadow-sm",
                insuranceOnly ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-background/50 border-border/80 hover:bg-muted text-muted-foreground"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Insurance Support
            </button>
          </div>

          <div className="flex flex-wrap gap-3 pt-5">
            <Badge className="bg-primary/10 border-primary/20 text-primary font-bold rounded-full px-3 py-1">
              {rawHospitals.length} live hospitals
            </Badge>
            <Badge className="bg-background/80 border-border/70 text-foreground font-semibold rounded-full px-3 py-1">
              {liveCityCount} cities
            </Badge>
            <Badge className="bg-background/80 border-border/70 text-foreground font-semibold rounded-full px-3 py-1">
              {liveSpecialtyCount} specialties
            </Badge>
          </div>
        </Card>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2].map((idx) => (
              <Card key={idx} className="border border-border/40 bg-card/30 p-8 rounded-3xl space-y-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-muted rounded-2xl" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !hasPublishedHospitals ? (
          <Card className="border border-border/40 bg-card/45 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Live Firebase Feed
            </div>
            <div className="inline-flex p-4 bg-muted/65 rounded-full mx-auto">
              <AlertCircle className="w-8 h-8 text-muted-foreground/80" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-foreground">No hospitals are live yet</h3>
              <p className="text-sm text-muted-foreground font-semibold max-w-xl mx-auto leading-relaxed">
                Hospital discovery is connected in real time, but no hospital manager has finished onboarding a hospital into Firebase yet. As soon as a hospital profile is created, it will appear here instantly.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="rounded-xl font-bold" onClick={openEmptyStateAction}>
                {profile?.role === "manager" || profile?.role === "hospital_manager"
                  ? "Open hospital onboarding"
                  : "Browse doctors instead"}
              </Button>
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => window.location.reload()}>
                Refresh live feed
              </Button>
            </div>
          </Card>
        ) : hospitals.length === 0 ? (
          <Card className="border border-border/40 bg-card/30 rounded-3xl p-16 text-center max-w-md mx-auto space-y-6">
            <div className="inline-flex p-4 bg-muted/65 rounded-full mb-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground/80 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No hospitals match these filters</h3>
            <p className="text-sm text-muted-foreground font-semibold">
              {hasActiveFilters
                ? "Your live hospital feed has data, but nothing matches the current city, specialty, or fee filters."
                : "No hospitals matched the current view."}
            </p>
            <Button variant="outline" onClick={resetFilters} className="rounded-xl">
              Reset Filters
            </Button>
          </Card>
        ) : (
          /* Premium Hospitals list */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {hospitals.map((hospital) => (
              <motion.div
                key={hospital._id}
                whileHover={{ y: -4 }}
                className="group flex flex-col justify-between bg-card/45 hover:bg-card/75 border border-border/50 rounded-3xl shadow-lg overflow-hidden transition-all duration-300 relative"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-transparent opacity-60" />

                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex gap-5">
                    <div className="shrink-0 w-20 h-20 bg-gradient-to-br from-primary/10 to-accent/5 border border-border/80 rounded-2xl flex items-center justify-center relative shadow-inner">
                      <Hospital className="w-9 h-9 text-primary" />
                      {hospital.distanceLabel ? (
                        <span className="absolute -bottom-1.5 -right-1.5 text-[9px] bg-background border border-border font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-muted-foreground shadow-sm">
                          {hospital.distanceLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-extrabold text-foreground tracking-tight truncate leading-none">
                          {hospital.name}
                        </h3>
                        {hospital.verified && (
                          <Badge className="bg-primary/15 border-primary/20 hover:bg-primary/20 text-primary font-bold text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 shadow-sm">
                            Verified
                          </Badge>
                        )}
                        {hospital.emergencySupport && (
                          <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 shadow-sm">
                            ER Ready
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-semibold truncate">
                        <MapPin className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                        {hospital.address || hospital.city || "Address will appear after hospital onboarding is completed."}
                      </p>

                      <div className="flex items-center gap-1.5 pt-1.5">
                        <div className="flex items-center gap-0.5 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-[11px] font-bold text-foreground">{hospital.rating}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-semibold">({hospital.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Specialties</span>
                    <div className="flex flex-wrap gap-1.5">
                      {hospital.departments.map((dept: string, i: number) => (
                        <Badge key={i} variant="secondary" className="rounded-full text-xs font-semibold px-2.5 py-0.5 bg-background border border-border/50">
                          {dept}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground/90 leading-relaxed font-semibold">
                    {hospital.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4 text-xs font-semibold text-muted-foreground/80">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Timings</span>
                      </div>
                      <p className="text-foreground font-bold pl-5">
                        {hospital.availableTimings || "Timings not published yet"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-primary" />
                        <span>Doctor Matched</span>
                      </div>
                      <p className="text-foreground font-bold pl-5 truncate">
                        {hospital.primaryDoctorName || hospital.departments?.[0] || "Care team assignment pending"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Consultation Fee</span>
                      <p className="font-black text-2xl text-foreground tracking-tight">
                        {typeof hospital.consultationFee === "number" && hospital.consultationFee > 0
                          ? `$${hospital.consultationFee}`
                          : "Quoted on booking"}
                      </p>
                    </div>

                    <div className="space-y-2 sm:text-right">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block">Available Slots</span>
                      {hospital.availableSlots.length > 0 ? (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {hospital.availableSlots.slice(0, 3).map((slot: string, i: number) => (
                            <button
                              key={i}
                              disabled={!canPatientBook}
                              onClick={() => handleOpenBooking(hospital, slot)}
                              className="px-3.5 py-1.5 bg-background hover:bg-primary hover:text-white border border-border/80 text-xs font-bold rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
                          No live slots published yet
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>

      {/* Stripe Payment & Checkout Modal Drawer */}
      <AnimatePresence>
        {selectedHospital && selectedSlot && (
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
              className="w-full max-w-xl bg-card border border-border/80 shadow-2xl rounded-3xl p-6 sm:p-10 relative overflow-hidden"
            >
              
              <button 
                onClick={() => { setSelectedHospital(null); setSelectedSlot(null); }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>

              {bookingSuccess ? (
                /* Beautiful Printable Billing Receipt Invoice */
                <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full mb-1">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-foreground tracking-tight">Transaction Succeeded!</h3>
                    <p className="text-xs text-muted-foreground">Appointment ID: {bookingSuccess.id}</p>
                  </div>
                  
                  {/* Detailed receipt invoice block */}
                  <Card className="border border-dashed border-border/80 bg-muted/30 rounded-2xl p-5 text-left space-y-2 max-w-md mx-auto text-xs font-semibold text-muted-foreground">
                    <div className="flex justify-between items-center pb-2 border-b border-dashed border-border/80 mb-2">
                      <span className="font-extrabold text-foreground flex items-center gap-1"><Receipt className="w-3.5 h-3.5 text-primary" /> Invoice Summary</span>
                      <Badge className="bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider rounded">PAID</Badge>
                    </div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Patient Name:</span><span className="text-foreground">{bookingSuccess.patientName}</span></div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Registered Phone:</span><span className="text-foreground">{bookingSuccess.patientPhone}</span></div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Trauma Center:</span><span className="text-foreground truncate max-w-[200px]">{bookingSuccess.hospitalName}</span></div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Consulting Specialist:</span><span className="text-foreground">{bookingSuccess.doctorName}</span></div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Triage Time Slot:</span><span className="text-foreground">Tomorrow at {bookingSuccess.timeSlot}</span></div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Consultation Type:</span><span className="text-primary font-bold uppercase">{bookingSuccess.consultationType}</span></div>
                    <div className="flex justify-between border-t border-dashed border-border/80 pt-2"><span className="font-bold text-foreground">Total Bill (Stripe):</span><span className="text-foreground font-black">${selectedHospital.consultationFee}.00</span></div>
                  </Card>

                  <div className="pt-4 flex gap-4 max-w-md mx-auto">
                    <Button className="w-full rounded-xl text-xs font-bold" onClick={() => { setSelectedHospital(null); setSelectedSlot(null); }}>
                      Confirm & Exit
                    </Button>
                    <Button variant="outline" className="w-full rounded-xl text-xs font-bold" onClick={() => window.print()}>
                      Print Invoice
                    </Button>
                  </div>
                </div>
              ) : (
                /* Form Inputs + Stripe Form mockup */
                <form onSubmit={handleBook} className="space-y-6">
                  <div className="space-y-2">
                    <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest">Priority Scheduler</Badge>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-tight">
                      Confirm Visit Slot
                    </h3>
                    <p className="text-xs text-muted-foreground font-semibold">
                      At {selectedHospital.name} — Tomorrow at {selectedSlot}
                    </p>
                  </div>

                  {/* Consultation Mode toggles */}
                  <div className="grid grid-cols-2 gap-3 bg-muted/40 p-1.5 border border-border/40 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setConsultType("in-person")}
                      className={cn(
                        "py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-300",
                        consultType === "in-person" ? "bg-background shadow text-foreground" : "text-muted-foreground/80 hover:text-foreground"
                      )}
                    >
                      <Hospital className="w-3.5 h-3.5" />
                      In-Person Visit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsultType("video")}
                      className={cn(
                        "py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-300",
                        consultType === "video" ? "bg-background shadow text-primary" : "text-muted-foreground/80 hover:text-foreground"
                      )}
                    >
                      <Video className="w-3.5 h-3.5 text-primary" />
                      Video Call
                    </button>
                  </div>

                  {/* Patient Details */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="patientName" className="font-bold text-xs tracking-tight">Your Full Name</Label>
                        <Input 
                          id="patientName" 
                          required
                          value={patientName} 
                          onChange={(e) => setPatientName(e.target.value)} 
                          placeholder="John Doe" 
                          className="bg-background border-border/80 h-10 px-3 rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="patientEmail" className="font-bold text-xs tracking-tight">Email Address</Label>
                        <Input 
                          id="patientEmail" 
                          type="email"
                          required
                          value={patientEmail} 
                          onChange={(e) => setPatientEmail(e.target.value)} 
                          placeholder="john@example.com" 
                          className="bg-background border-border/80 h-10 px-3 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="patientPhone" className="font-bold text-xs tracking-tight">Phone Number</Label>
                      <Input 
                        id="patientPhone" 
                        type="tel"
                        required
                        value={patientPhone} 
                        onChange={(e) => setPatientPhone(e.target.value)} 
                        placeholder="+91 99999 99999" 
                        className="bg-background border-border/80 h-10 px-3 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {/* Stripe Payment Form container */}
                  <Card className="border border-primary/20 bg-primary/[0.01] rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/40 pb-2 mb-2">
                      <span className="font-black text-xs text-foreground flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-primary" /> Stripe Secure Checkout
                      </span>
                      <span className="text-[9px] text-muted-foreground font-semibold">SSL 256-bit Encrypted</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">Card Number</Label>
                        <Input 
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="bg-background border-border/85 h-9 px-3 rounded-lg text-xs font-mono font-bold tracking-widest"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">Card Expiry</Label>
                          <Input 
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="bg-background border-border/85 h-9 px-3 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">CVC Code</Label>
                          <Input 
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            className="bg-background border-border/85 h-9 px-3 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Submission and invoicing */}
                  <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Billing Total</span>
                      <p className="font-black text-xl text-foreground">${selectedHospital.consultationFee}.00</p>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={bookingLoading} 
                      className="rounded-xl px-5 h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center gap-2 shrink-0 animate-pulse"
                    >
                      {bookingLoading ? "Authorizing Stripe..." : "Confirm & Pay"}
                      {!bookingLoading && <CreditCard className="w-4 h-4" />}
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
