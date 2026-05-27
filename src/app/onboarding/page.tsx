"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore-healthcare";
import { bootstrapClientProfile, completeClientProfile, type ClientCompleteInput, type ClientProfileRole } from "@/lib/client-profile";
import { getRoleHome, useCurrentUserProfile } from "@/lib/current-user";
import { useRealtime } from "@/lib/realtime-context";
import { useFeedback } from "@/components/providers/feedback-provider";

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const DOCTOR_SPECIALTY_OPTIONS: Record<string, string[]> = {
  Cardiology: ["Interventional Cardiology", "Electrophysiology", "Heart Failure", "Preventive Cardiology"],
  Neurology: ["Stroke Care", "Epilepsy", "Movement Disorders", "Neurocritical Care"],
  Orthopedics: ["Sports Medicine", "Joint Replacement", "Spine Surgery", "Trauma Care"],
  Dermatology: ["Cosmetic Dermatology", "Dermatosurgery", "Pediatric Dermatology", "Clinical Dermatology"],
  Pediatrics: ["Neonatology", "Pediatric Cardiology", "Pediatric Neurology", "General Pediatrics"],
  ENT: ["Otology", "Rhinology", "Laryngology", "Head and Neck Surgery"],
  Ophthalmology: ["Retina", "Cornea", "Glaucoma", "Pediatric Ophthalmology"],
  General_Medicine: ["Primary Care", "Internal Medicine", "Geriatric Care", "Preventive Medicine"],
};
const DEGREE_OPTIONS = ["MBBS", "MD", "MS", "DM", "DNB", "MCh", "DO", "BDS", "MDS"] as const;
const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali"] as const;
const TIMING_OPTIONS = [
  "Mon-Fri 9AM-1PM",
  "Mon-Fri 2PM-6PM",
  "Mon-Fri 6PM-9PM",
  "Sat 9AM-1PM",
  "Sat 2PM-6PM",
  "Sun 9AM-1PM",
  "Emergency On-Call",
] as const;

type HospitalOption = {
  id: string;
  name: string;
  city?: string;
  departments?: string[];
};

function toggleDelimitedValue(currentValue: string, nextValue: string) {
  const values = new Set(splitCsv(currentValue));
  if (values.has(nextValue)) {
    values.delete(nextValue);
  } else {
    values.add(nextValue);
  }
  return Array.from(values).join(", ");
}

function OptionPills({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = splitCsv(value);

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {options.map((option) => {
        const isActive = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(toggleDelimitedValue(value, option))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200",
              isActive
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border/70 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SuggestionButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-left transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="text-sm font-semibold text-foreground">{label}</div>
      {description ? (
        <div className="text-xs text-muted-foreground">{description}</div>
      ) : null}
    </button>
  );
}

export default function OnboardingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useCurrentUserProfile();
  const { onlineRole, setOnlineRole } = useRealtime();
  const { showFeedback } = useFeedback();
  const [submitting, setSubmitting] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const [repairingProfile, setRepairingProfile] = useState(false);
  const [repairAttempted, setRepairAttempted] = useState(false);
  const [repairError, setRepairError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [specialty, setSpecialty] = useState("");
  const [subSpecialization, setSubSpecialization] = useState("");
  const [degrees, setDegrees] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [city, setCity] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [fee, setFee] = useState("");
  const [languages, setLanguages] = useState("");
  const [availableTimings, setAvailableTimings] = useState("");
  const [hospitalOptions, setHospitalOptions] = useState<HospitalOption[]>([]);

  const [managerHospitalName, setManagerHospitalName] = useState("");
  const [departments, setDepartments] = useState("");
  const [address, setAddress] = useState("");
  const [facilities, setFacilities] = useState("");
  const [emergencySupport, setEmergencySupport] = useState(true);
  const isEditMode = pathname !== "/onboarding";

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName || "");
    setPhone(profile.phone || "");
  }, [profile]);

  useEffect(() => {
    if (profile?.role !== "doctor") return;

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.hospitals), orderBy("name")),
      (snapshot) => {
        setHospitalOptions(
          snapshot.docs.map((item) => {
            const data = item.data() as Record<string, unknown>;
            return {
              id: item.id,
              name: String(data.name || ""),
              city: data.city ? String(data.city) : undefined,
              departments: Array.isArray(data.departments)
                ? data.departments.map((department) => String(department))
                : [],
            };
          }),
        );
      },
      (error) => {
        console.warn("Hospital onboarding options listener failed:", error);
        setHospitalOptions([]);
      },
    );

    return () => unsubscribe();
  }, [profile?.role]);

  useEffect(() => {
    if (!loading && profile?.onboardingCompleted && !isEditMode) {
      router.replace(getRoleHome(profile.role));
    }
  }, [isEditMode, loading, profile, router]);

  useEffect(() => {
    const repairMissingProfile = async () => {
      if (loading || !user || profile || repairAttempted) return;

      setRepairAttempted(true);
      setRepairingProfile(true);
      setRepairError(null);

      try {
        const recoveredRole = (localStorage.getItem("onlineRole") as ClientProfileRole | null) || onlineRole;
        await bootstrapClientProfile({
          role: recoveredRole,
          fullName: user.displayName || user.email?.split("@")[0] || "Aegis user",
        });
        setOnlineRole(recoveredRole);
      } catch (error) {
        setRepairError(error instanceof Error ? error.message : "Unable to rebuild your profile.");
      } finally {
        setRepairingProfile(false);
        setPrefillLoading(false);
      }
    };

    void repairMissingProfile();
  }, [loading, onlineRole, profile, repairAttempted, setOnlineRole, user]);

  useEffect(() => {
    const hydrateRoleProfile = async () => {
      if (!user || !profile) {
        setPrefillLoading(false);
        return;
      }

      try {
        if (profile.role === "patient") {
          const patientSnap = await getDoc(doc(db, COLLECTIONS.patients, user.uid));
          if (patientSnap.exists()) {
            const data = patientSnap.data();
            setUsername(data.username || "");
            setAge(data.age ? String(data.age) : "");
            setGender(data.gender || "");
            setBloodGroup(data.bloodGroup || "");
            setConditions(Array.isArray(data.conditions) ? data.conditions.join(", ") : "");
            setAllergies(Array.isArray(data.allergies) ? data.allergies.join(", ") : "");
            setEmergencyContact(data.emergencyContact || "");
          }
        }

        if (profile.role === "doctor") {
          const doctorSnap = await getDoc(doc(db, COLLECTIONS.doctors, user.uid));
          if (doctorSnap.exists()) {
            const data = doctorSnap.data();
            setSpecialty(data.specialty || "");
            setSubSpecialization(data.subSpecialization || "");
            setDegrees(data.degrees || "");
            setYearsOfExperience(data.yearsOfExperience != null ? String(data.yearsOfExperience) : "");
            setCity(data.city || "");
            setSelectedHospitalId(data.hospitalId || "");
            setHospitalName(data.hospitalName || "");
            setFee(data.fee != null ? String(data.fee) : "");
            setLanguages(Array.isArray(data.languages) ? data.languages.join(", ") : "");
            setAvailableTimings(Array.isArray(data.availableTimings) ? data.availableTimings.join(", ") : "");
          }
        }

        if (profile.role === "manager") {
          const hospitalId = (profile as { hospitalId?: string }).hospitalId;
          if (hospitalId) {
            const hospitalSnap = await getDoc(doc(db, COLLECTIONS.hospitals, hospitalId));
            if (hospitalSnap.exists()) {
              const data = hospitalSnap.data();
              setManagerHospitalName(data.name || "");
              setDepartments(Array.isArray(data.departments) ? data.departments.join(", ") : "");
              setAddress(data.address || "");
              setFacilities(Array.isArray(data.facilities) ? data.facilities.join(", ") : "");
              setEmergencySupport(Boolean(data.emergencySupport));
            }
          }
        }
      } finally {
        setPrefillLoading(false);
      }
    };

    void hydrateRoleProfile();
  }, [profile, user]);

  const title = useMemo(() => {
    if (isEditMode && profile?.role === "doctor") return "Edit Doctor Profile";
    if (isEditMode && profile?.role === "manager") return "Edit Hospital Profile";
    if (isEditMode && profile?.role === "patient") return "Edit Patient Profile";
    if (profile?.role === "doctor") return "Complete Doctor Onboarding";
    if (profile?.role === "manager") return "Complete Hospital Manager Onboarding";
    return "Complete Patient Onboarding";
  }, [isEditMode, profile?.role]);

  const specialtyOptions = useMemo(
    () => Object.keys(DOCTOR_SPECIALTY_OPTIONS).map((option) => option.replaceAll("_", " ")),
    [],
  );
  const subSpecialtyOptions = useMemo(() => {
    if (!specialty) return [];
    const normalizedKey = specialty.replaceAll(" ", "_");
    return DOCTOR_SPECIALTY_OPTIONS[normalizedKey] || DOCTOR_SPECIALTY_OPTIONS[specialty] || [];
  }, [specialty]);
  const hospitalChoices = useMemo(() => {
    const normalizedSearch = hospitalName.trim().toLowerCase();
    const normalizedCity = city.trim().toLowerCase();
    const scoredHospitals = hospitalOptions
      .map((hospital) => {
        const hospitalDepartments = Array.isArray(hospital.departments) ? hospital.departments : [];
        const specialtyMatch = specialty
          ? hospitalDepartments.some((department) => department.toLowerCase() === specialty.toLowerCase())
          : false;
        const textMatch =
          !normalizedSearch ||
          hospital.name.toLowerCase().includes(normalizedSearch) ||
          String(hospital.city || "").toLowerCase().includes(normalizedSearch);
        const cityMatch =
          !normalizedCity || String(hospital.city || "").toLowerCase().includes(normalizedCity);

        return {
          hospital,
          specialtyMatch,
          textMatch,
          cityMatch,
        };
      })
      .filter((entry) => entry.textMatch && entry.cityMatch)
      .sort((left, right) => {
        if (left.specialtyMatch !== right.specialtyMatch) {
          return left.specialtyMatch ? -1 : 1;
        }
        return left.hospital.name.localeCompare(right.hospital.name);
      })
      .map((entry) => entry.hospital);

    return scoredHospitals.slice(0, 8);
  }, [city, hospitalName, hospitalOptions, specialty]);
  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          hospitalOptions
            .map((hospital) => hospital.city)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [hospitalOptions],
  );
  const matchingCityOptions = useMemo(() => {
    const normalizedCity = city.trim().toLowerCase();
    const filtered = cityOptions.filter((option) =>
      !normalizedCity || option.toLowerCase().includes(normalizedCity),
    );
    return filtered.slice(0, 8);
  }, [city, cityOptions]);

  useEffect(() => {
    if (subSpecialization && !subSpecialtyOptions.includes(subSpecialization)) {
      setSubSpecialization("");
    }
  }, [subSpecialization, subSpecialtyOptions]);

  useEffect(() => {
    if (!selectedHospitalId) return;
    const selectedHospital = hospitalOptions.find((hospital) => hospital.id === selectedHospitalId);
    if (!selectedHospital) {
      setSelectedHospitalId("");
      return;
    }
    if (selectedHospital.name !== hospitalName) {
      setHospitalName(selectedHospital.name);
    }
    if (selectedHospital.city && selectedHospital.city !== city) {
      setCity(selectedHospital.city);
    }
  }, [city, hospitalName, hospitalOptions, selectedHospitalId]);

  useEffect(() => {
    if (!loading && !prefillLoading && !repairingProfile && !user) {
      router.replace("/auth");
    }
  }, [loading, prefillLoading, repairingProfile, router, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !profile) return;

    setSubmitting(true);
    try {
      const payload: ClientCompleteInput =
        profile.role === "doctor"
          ? {
              role: "doctor",
              fullName,
              phone,
              doctorProfile: {
                specialty,
                subSpecialization,
                degrees,
                yearsOfExperience: Number(yearsOfExperience),
                city,
                hospitalId: selectedHospitalId || undefined,
                hospitalName,
                fee: Number(fee),
                languages: splitCsv(languages),
                availableTimings: splitCsv(availableTimings),
              },
            }
          : profile.role === "manager"
            ? {
                role: "manager",
                fullName,
                phone,
                hospitalProfile: {
                  hospitalName: managerHospitalName,
                  departments: splitCsv(departments),
                  address,
                  facilities: splitCsv(facilities),
                  emergencySupport,
                },
                existingHospitalId: profile.hospitalId || null,
              }
            : {
                role: "patient",
                fullName,
                phone,
                patientProfile: {
                  username,
                  age: Number(age),
                  gender,
                  bloodGroup,
                  conditions: splitCsv(conditions),
                  allergies: splitCsv(allergies),
                  emergencyContact,
                },
            };

      await completeClientProfile(payload);

      router.replace(getRoleHome(profile.role));
    } catch (error) {
      showFeedback({
        tone: "error",
        title: "Onboarding could not be completed",
        message: error instanceof Error ? error.message : "We could not save your profile details.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || prefillLoading || repairingProfile) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading profile…</div>;
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-muted/20 py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Badge className="bg-primary/10 text-primary border-primary/20">Profile Recovery</Badge>
            <h1 className="text-4xl font-black tracking-tight text-foreground">We&apos;re rebuilding your account profile</h1>
            <p className="text-sm text-muted-foreground">
              Your Firebase sign-in exists, but the Firestore role profile is still missing.
            </p>
          </div>
          <Card className="border border-border/50 bg-card/70 backdrop-blur-xl shadow-xl rounded-3xl">
            <CardContent className="p-8 text-center space-y-5">
              <p className="text-sm text-muted-foreground font-semibold">
                {repairError || "Click below to recreate the missing profile document and continue onboarding."}
              </p>
              <Button
                className="w-full rounded-xl h-11 font-bold"
                onClick={async () => {
                  try {
                    setRepairingProfile(true);
                    setRepairError(null);
                    const recoveredRole = (localStorage.getItem("onlineRole") as ClientProfileRole | null) || onlineRole;
                    await bootstrapClientProfile({
                      role: recoveredRole,
                      fullName: user.displayName || user.email?.split("@")[0] || "Aegis user",
                    });
                    setOnlineRole(recoveredRole);
                  } catch (error) {
                    setRepairError(error instanceof Error ? error.message : "Unable to rebuild your profile.");
                  } finally {
                    setRepairingProfile(false);
                  }
                }}
              >
                Repair profile and continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Badge className="bg-primary/10 text-primary border-primary/20">Onboarding Required</Badge>
          <h1 className="text-4xl font-black tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">Complete your role-specific profile before entering the platform.</p>
        </div>
        <Card className="border border-border/50 bg-card/70 backdrop-blur-xl shadow-xl rounded-3xl">
          <CardContent className="p-8">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              {profile.role === "patient" && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Age</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value)} required /></div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                      >
                        <option value="">Select gender</option>
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Blood group</Label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                      >
                        <option value="">Select blood group</option>
                        {BLOOD_GROUP_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Conditions</Label><Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Diabetes, Migraine" /></div>
                  <div className="space-y-2"><Label>Allergies</Label><Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Penicillin, Peanuts" /></div>
                  <div className="space-y-2"><Label>Emergency contact</Label><Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} required /></div>
                </>
              )}

              {profile.role === "doctor" && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Specialization</Label>
                      <select
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                      >
                        <option value="">Select specialization</option>
                        {specialtyOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sub-specialization</Label>
                      <select
                        value={subSpecialization}
                        onChange={(e) => setSubSpecialization(e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!specialty}
                      >
                        <option value="">{specialty ? "Select sub-specialization" : "Choose specialization first"}</option>
                        {subSpecialtyOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Degrees</Label>
                      <Input value={degrees} onChange={(e) => setDegrees(e.target.value)} placeholder="MBBS, MD" required />
                      <OptionPills options={DEGREE_OPTIONS} value={degrees} onChange={setDegrees} />
                    </div>
                    <div className="space-y-2"><Label>Experience (years)</Label><Input type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} required /></div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder={cityOptions.length > 0 ? "Choose or type your city" : "Enter your city"}
                        required
                      />
                      {cityOptions.length > 0 ? (
                        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">Live city suggestions</span>
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {cityOptions.length} cities
                            </Badge>
                          </div>
                          <div className="grid gap-2">
                            {matchingCityOptions.map((option) => (
                              <SuggestionButton
                                key={option}
                                label={option}
                                description="City with onboarded hospitals"
                                onClick={() => setCity(option)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground">
                          No hospital locations are live yet. Hospitals will appear here in real time after a hospital manager onboards them.
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Hospital association</Label>
                      <Input
                        value={hospitalName}
                        onChange={(e) => {
                          const nextHospitalName = e.target.value;
                          setHospitalName(nextHospitalName);
                          const matchedHospital = hospitalOptions.find(
                            (hospital) => hospital.name.toLowerCase() === nextHospitalName.toLowerCase(),
                          );
                          setSelectedHospitalId(matchedHospital?.id || "");
                          if (matchedHospital?.city) {
                            setCity(matchedHospital.city);
                          }
                        }}
                        placeholder={hospitalChoices.length > 0 ? "Choose or type your hospital" : "Type your hospital name"}
                        required
                      />
                      {hospitalOptions.length > 0 ? (
                        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">Live hospital suggestions</span>
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {hospitalOptions.length} hospitals
                            </Badge>
                          </div>
                          {hospitalChoices.length > 0 ? (
                            <div className="grid gap-2">
                              {hospitalChoices.map((hospital) => (
                                <SuggestionButton
                                  key={hospital.id}
                                  label={hospital.name}
                                  description={hospital.city || "City not added yet"}
                                  onClick={() => {
                                    setHospitalName(hospital.name);
                                    setSelectedHospitalId(hospital.id);
                                    if (hospital.city) {
                                      setCity(hospital.city);
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No live hospital matches yet for this city or specialty. You can still type the hospital name manually.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground">
                          No hospitals have been onboarded yet, so there is nothing to list in real time. Create a hospital through the hospital manager flow and it will appear here instantly.
                        </div>
                      )}
                    </div>
                    <div className="space-y-2"><Label>Consultation fee</Label><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} required /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Languages spoken</Label>
                    <Input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Telugu" />
                    <OptionPills options={LANGUAGE_OPTIONS} value={languages} onChange={setLanguages} />
                  </div>
                  <div className="space-y-2">
                    <Label>Available timings</Label>
                    <Textarea
                      value={availableTimings}
                      onChange={(e) => setAvailableTimings(e.target.value)}
                      placeholder="Select shifts below or add custom availability notes."
                      className="min-h-24"
                    />
                    <OptionPills options={TIMING_OPTIONS} value={availableTimings} onChange={setAvailableTimings} />
                  </div>
                </>
              )}

              {profile.role === "manager" && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Hospital name</Label><Input value={managerHospitalName} onChange={(e) => setManagerHospitalName(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Departments</Label><Input value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="Cardiology, Neurology" required /></div>
                  </div>
                  <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Facilities</Label><Input value={facilities} onChange={(e) => setFacilities(e.target.value)} placeholder="ICU, MRI, Trauma Center" /></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={emergencySupport} onChange={(e) => setEmergencySupport(e.target.checked)} /> Emergency support available</label>
                </>
              )}

              <Button type="submit" disabled={submitting} className="w-full rounded-xl h-11 font-bold">
                {submitting ? "Saving profile..." : isEditMode ? "Save profile changes" : "Complete onboarding"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
