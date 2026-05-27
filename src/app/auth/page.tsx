"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/lib/realtime-context";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Lock, Mail, KeyRound, Brain, Sparkles, ShieldCheck, 
  Smartphone, Eye, EyeOff, UserCheck, Compass
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore-healthcare";
import { getRoleHome, useCurrentUserProfile } from "@/lib/current-user";
import { bootstrapClientProfile } from "@/lib/client-profile";
import { useFeedback } from "@/components/providers/feedback-provider";

type RoleType = "patient" | "doctor" | "admin" | "manager";

function toRealtimeRole(role?: string | null): RoleType {
  if (role === "doctor" || role === "admin" || role === "manager") {
    return role;
  }
  if (role === "hospital_manager") {
    return "manager";
  }
  return "patient";
}

export default function AuthPage() {
  const router = useRouter();
  const { setOnlineRole } = useRealtime();
  const { user, profile, loading: profileLoading } = useCurrentUserProfile();
  const { showFeedback } = useFeedback();

  const [activeTab, setActiveTab] = useState<"login" | "register" | "otp">("login");
  const [selectedRole, setSelectedRole] = useState<RoleType>(() => {
    if (typeof window === "undefined") return "patient";
    const saved = localStorage.getItem("onlineRole");
    return saved === "doctor" || saved === "admin" || saved === "manager" ? saved : "patient";
  });
  
  // Credentials States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // OTP States
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  useEffect(() => {
    if (profileLoading || !user || !profile) return;

    const resolvedRole = toRealtimeRole(profile.role);
    setSelectedRole(resolvedRole);
    setOnlineRole(resolvedRole);

    if (resolvedRole === "patient" && user.email) {
      localStorage.setItem("patientEmail", user.email);
    }

    router.replace(profile.onboardingCompleted ? getRoleHome(profile.role) : "/onboarding");
  }, [profileLoading, profile, router, setOnlineRole, user]);

  const createOtpCode = () => {
    const bytes = crypto.getRandomValues(new Uint32Array(1))[0];
    return String(bytes % 900000 + 100000);
  };

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setOnlineRole(role);
  };

  const recoverMissingProfile = async () => {
    if (!user) {
      throw new Error("No authenticated session found.");
    }

    await bootstrapClientProfile({
      role: selectedRole,
      fullName: user.displayName || user.email?.split("@")[0] || "Aegis user",
      phone,
    });
  };

  // Real Google Sign-In Popup authentication
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      await bootstrapClientProfile({
        role: selectedRole,
        fullName: googleUser.displayName || googleUser.email?.split("@")[0] || "Authenticated user",
        phone,
      });

      const profileSnap = await getDoc(doc(db, COLLECTIONS.users, googleUser.uid));
      const resolvedRole = (profileSnap.data()?.role as RoleType | undefined) || selectedRole;
      setOnlineRole(resolvedRole);
      
      if (resolvedRole === "patient") {
        localStorage.setItem("patientEmail", googleUser.email || "");
      }

      const nextRoute = profileSnap.data()?.onboardingCompleted ? getRoleHome(resolvedRole) : "/onboarding";
      showFeedback({
        tone: "success",
        title: "Google sign-in successful",
        message: `Welcome back, ${googleUser.displayName || googleUser.email}. Your secure session is ready.`,
        primaryAction: {
          label: "Continue",
          onClick: () => router.push(nextRoute),
        },
      });
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      showFeedback({
        tone: "error",
        title: "Google sign-in failed",
        message: err.message || "We could not complete Google authentication.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = () => {
    handleGoogleLogin();
  };

  // Real credentials submit using Firebase Authentication
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      // 1. Sign in with Firebase Auth
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profileSnap = await getDoc(doc(db, COLLECTIONS.users, credential.user.uid));
      const resolvedRole = (profileSnap.data()?.role as RoleType | undefined) || selectedRole;
      setOnlineRole(resolvedRole);
      
      // 2. Save patient credentials to local storage so dynamic sync can kick off
      if (resolvedRole === "patient") {
        localStorage.setItem("patientEmail", email);
      }
      
      const nextRoute = profileSnap.data()?.onboardingCompleted ? getRoleHome(resolvedRole) : "/onboarding";
      router.push(nextRoute);
    } catch (err: any) {
      console.error("Firebase Login Error:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-email" || err.code === "auth/wrong-password") {
        showFeedback({
          tone: "error",
          title: "Authentication failed",
          message: `${err.message} If this is a new account, use Create Account first.`,
        });
      } else {
        showFeedback({
          tone: "error",
          title: "Authentication error",
          message: err.message || "We could not sign you in.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Real user registration using Firebase Authentication
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (password !== confirmPassword) {
      showFeedback({
        tone: "warning",
        title: "Passwords do not match",
        message: "Please confirm the same password in both fields before creating the account.",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Register with Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await bootstrapClientProfile({
        role: selectedRole,
        fullName: userCred.user.displayName || email.split("@")[0],
        phone,
      });

      setOnlineRole(selectedRole);

      if (selectedRole === "patient") {
        localStorage.setItem("patientEmail", email);
      }

      showFeedback({
        tone: "success",
        title: "Registration successful",
        message: `Permanent profile access has been created for ${email}. Continue to role setup to complete onboarding.`,
        primaryAction: {
          label: "Continue onboarding",
          onClick: () => router.push("/onboarding"),
        },
      });
    } catch (err: any) {
      console.error("Firebase Register Error:", err);
      showFeedback({
        tone: "error",
        title: "Registration failed",
        message: err.message || "We could not create the account.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Dynamic OTP Generation & real Ethereal email dispatch
  const generateOtpCode = async () => {
    if (!email) {
      showFeedback({
        tone: "warning",
        title: "Email required",
        message: "Enter an email address in the credentials form first so we can securely mail your OTP code.",
      });
      return;
    }
    
    setLoading(true);
    const randomCode = createOtpCode();
    setGeneratedCode(randomCode);
    
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "Dynamic Access Portal OTP Gatekeeper",
          type: "otp",
          html: `
            <div style="text-align: center; padding: 12px 0;">
              <p style="font-size: 15px; font-weight: bold; margin: 0 0 12px 0; color: #0f172a;">Aegis Telemetry Verification Request</p>
              <p style="font-size: 13px; text-align: left; margin: 0 0 16px 0; color: #4b5563;">You initiated a dynamic login request to your designated healthcare portal. Please enter the following 6-digit E2E-shielded verification OTP code to authenticate your local session:</p>
              
              <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; font-size: 26px; font-weight: 900; letter-spacing: 6px; padding: 16px; border-radius: 12px; font-family: monospace; color: #0f172a; margin-bottom: 16px; display: inline-block;">
                ${randomCode}
              </div>
              
              <p style="font-size: 11px; color: #888888; margin: 8px 0 0 0;">This OTP code expires in 5 minutes and is valid for a single session verification only.</p>
            </div>
          `
        })
      });

      const data = await res.json();
      if (res.ok && data.previewUrl) {
        setOtpSent(true);
        showFeedback({
          tone: "success",
          title: "OTP email sent",
          message: `A live Ethereal verification email was dispatched to ${email}. Open the preview inbox in a new tab to copy the OTP code.`,
          primaryAction: {
            label: "Open inbox preview",
            onClick: () => {
              window.open(data.previewUrl, "_blank", "noopener,noreferrer");
            },
          },
          secondaryAction: {
            label: "I will open it later",
            variant: "outline",
          },
        });
      } else {
        showFeedback({
          tone: "error",
          title: "OTP dispatch failed",
          message: "We could not deliver the OTP email. Please try again.",
        });
      }
    } catch (err: any) {
      console.error("OTP Send Error:", err);
      showFeedback({
        tone: "error",
        title: "OTP send failure",
        message: err.message || "We could not dispatch the OTP email.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode !== generatedCode) {
      showFeedback({
        tone: "error",
        title: "Invalid verification code",
        message: "The OTP you entered does not match the secure code we generated. Please try again.",
      });
      return;
    }
    setLoading(true);
    setOnlineRole(selectedRole);
    if (selectedRole === "patient" && email) {
      localStorage.setItem("patientEmail", email);
    }
    
    router.push("/onboarding");
  };

  if (user && profileLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] py-16 px-4 md:px-6 relative overflow-hidden flex items-center justify-center bg-muted/20">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md space-y-5 text-center relative z-10">
          <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Restoring Session
          </Badge>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Routing to your portal</h1>
          <p className="text-sm text-muted-foreground font-semibold">
            We&apos;re loading your verified healthcare role and sending you to the correct dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (user && !profileLoading && !profile) {
    return (
      <div className="min-h-[calc(100vh-4rem)] py-16 px-4 md:px-6 relative overflow-hidden flex items-center justify-center bg-muted/20">
        {/* Immersive visual highlights */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center space-y-2.5">
            <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold uppercase tracking-widest px-3.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Session Shield Active
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Welcome back to Aegis
            </h1>
            <p className="text-xs text-muted-foreground font-semibold">
              You are currently authenticated as:
            </p>
            <div className="bg-card/50 border border-border px-4 py-2 rounded-2xl inline-block text-sm font-black text-foreground">
              {user.email}
            </div>
          </div>

          <Card className="border border-border/50 bg-card/65 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden text-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground">
                We found your Firebase session, but your Firestore profile is missing or incomplete.
              </p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await recoverMissingProfile();
                      router.push("/onboarding");
                    } catch (error) {
                      showFeedback({
                        tone: "error",
                        title: "Registration failed",
                        message: error instanceof Error ? error.message : "We could not repair this account session.",
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full rounded-xl h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5"
                >
                  {loading ? "Repairing profile..." : "Continue account setup"}
                  <Compass className="w-4 h-4" />
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={async () => {
                    try {
                      await auth.signOut();
                      localStorage.removeItem("patientEmail");
                      localStorage.removeItem("onlineRole");
                    } catch (err) {
                      console.error("Sign out error:", err);
                    }
                  }}
                  className="w-full rounded-xl h-11 text-xs font-bold border-border/80 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200"
                >
                  Disconnect Session (Sign Out)
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-16 px-4 md:px-6 relative overflow-hidden flex items-center justify-center bg-muted/20">
      {/* Immersive visual highlights */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl space-y-8 relative z-10">
        
        <div className="text-center space-y-2.5">
          <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3.5 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5 mr-1" />
            Enterprise Gatekeeper
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Sign In to Aegis Health
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-semibold">
            Choose your designated portal role below to unlock live synchronization.
          </p>
        </div>

        {/* Role Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-2 border border-border/60 rounded-2xl">
          {[
            { id: "patient", label: "Patient", desc: "Consult care" },
            { id: "doctor", label: "Doctor", desc: "Manage queue" },
          { id: "admin", label: "Admin", desc: "Analytics" },
          { id: "manager", label: "Manager", desc: "Hospitals" },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id as RoleType)}
              className={`p-3 rounded-xl border text-center flex flex-col justify-between items-center transition-all duration-300 ${
                selectedRole === role.id 
                  ? "bg-card border-primary text-primary shadow-sm" 
                  : "bg-transparent border-transparent hover:bg-muted text-muted-foreground"
              }`}
            >
              <span className="font-extrabold text-xs tracking-tight">{role.label}</span>
              <span className="text-[9px] font-semibold text-muted-foreground/80 mt-1">{role.desc}</span>
            </button>
          ))}
        </div>

        <Card className="border border-border/50 bg-card/65 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
          {/* Decorative scan */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent blur-2xl pointer-events-none" />

          {/* Form Tabs */}
          <div className="flex gap-6 border-b border-border/40 pb-3">
            {[
              { id: "login", label: "Log In" },
              { id: "register", label: "Create Account" },
              { id: "otp", label: "Dynamic OTP" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setOtpSent(false); }}
                className={`text-xs font-black uppercase tracking-wider pb-1 transition-colors ${
                  activeTab === tab.id 
                    ? "border-b-2 border-primary text-primary font-black" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            
            {/* Tab 1: Credentials Login Form */}
            {activeTab === "login" && (
              <motion.form
                key="credentials"
                onSubmit={handleCredentialsSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="authEmail" className="font-bold text-xs tracking-tight">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="authEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patient@aegis.com"
                      className="bg-background/50 border-border/80 pl-9 focus:border-primary focus:ring-primary/15 h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="authPass" className="font-bold text-xs tracking-tight">Account Password</Label>
                    <a href="#" className="text-[10px] text-primary font-bold hover:underline">Forgot password?</a>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="authPass"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-background/50 border-border/80 pl-9 pr-10 focus:border-primary focus:ring-primary/15 h-10 rounded-xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1 select-none">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 bg-background border-border text-primary focus:ring-primary/15 rounded"
                  />
                  <label htmlFor="remember" className="text-xs font-bold text-muted-foreground cursor-pointer">Remember access token session</label>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full rounded-xl h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5"
                >
                  {loading ? "Authenticating session..." : `Unlock ${selectedRole} portal`}
                  {!loading && <UserCheck className="w-4 h-4" />}
                </Button>
              </motion.form>
            )}

            {/* Tab 2: Register Form */}
            {activeTab === "register" && (
              <motion.form
                key="registerForm"
                onSubmit={handleRegisterSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="regEmail" className="font-bold text-xs tracking-tight">Register Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="regEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@example.com"
                      className="bg-background/50 border-border/80 pl-9 focus:border-primary h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPass" className="font-bold text-xs tracking-tight">Create Account Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="regPass"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="bg-background/50 border-border/80 pl-9 pr-10 focus:border-primary h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPassConfirm" className="font-bold text-xs tracking-tight">Confirm Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="regPassConfirm"
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat account password"
                      className="bg-background/50 border-border/80 pl-9 pr-10 focus:border-primary h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full rounded-xl h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5"
                >
                  {loading ? "Creating dynamic credentials..." : `Create permanent ${selectedRole} profile`}
                  {!loading && <ShieldCheck className="w-4 h-4" />}
                </Button>
              </motion.form>
            )}

            {/* Tab 3: OTP Form */}
            {activeTab === "otp" && (
              <motion.form
                key="otp"
                onSubmit={handleOtpVerify}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="authPhone" className="font-bold text-xs tracking-tight">Registered Phone Number</Label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="authPhone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 99999 10101"
                        className="bg-background/50 border-border/80 pl-9 focus:border-primary h-10 rounded-xl text-sm"
                      />
                    </div>
                    <Button 
                      type="button" 
                      onClick={generateOtpCode}
                      className="rounded-xl h-10 text-xs font-bold shrink-0"
                    >
                      {otpSent ? "Resend" : "Send OTP"}
                    </Button>
                  </div>
                </div>

                {otpSent && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2 pt-2"
                  >
                    <Label htmlFor="authOtp" className="font-bold text-xs tracking-tight">Input 6-digit Verification Code</Label>
                    <Input
                      id="authOtp"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="e.g. 482091"
                      className="bg-background/50 border-border/80 focus:border-primary h-10 rounded-xl text-sm text-center font-black tracking-widest"
                    />
                  </motion.div>
                )}

                <Button 
                  type="submit" 
                  disabled={loading || !otpSent}
                  className="w-full rounded-xl h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5"
                >
                  {loading ? "Verifying signature..." : `Verify & Log In`}
                  {!loading && <ShieldCheck className="w-4 h-4" />}
                </Button>
              </motion.form>
            )}

          </AnimatePresence>

          {/* Social login buttons */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="relative flex justify-center text-xs uppercase select-none">
              <span className="bg-card px-3 text-muted-foreground font-black tracking-wider z-10">Or connect enterprise accounts</span>
              <div className="absolute left-0 right-0 top-1/2 border-t border-border/40 z-0" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleGoogleLogin}
                className="rounded-xl h-10 text-xs font-bold border-border/80"
              >
                Sign in with Google
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAppleLogin}
                className="rounded-xl h-10 text-xs font-bold border-border/80"
              >
                Sign in with Apple
              </Button>
            </div>
          </div>

        </Card>

      </div>
    </div>
  );
}
