"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/lib/realtime-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Lock, Settings, ShieldCheck, Stethoscope, Hospital, Activity, 
  TrendingUp, Star, Search, Clock, CheckCircle2, X, Laptop,
  Cpu, Users, ShieldAlert, AlertTriangle, ArrowUpRight
} from "lucide-react";

export default function AdminDashboardPage() {
  const { telemetry } = useRealtime();

  // Simulated live fluctuating concurrent users
  const [concurrentUsers, setConcurrentUsers] = useState(25482);
  const [latency, setLatency] = useState(14);

  // Verification List state
  const [doctorsList, setDoctorsList] = useState([
    { id: "d1", name: "Dr. Sarah Jenkins", specialty: "Neurology", hospital: "Metro Health Medical Center", verified: true },
    { id: "d2", name: "Dr. Robert Chen", specialty: "Cardiology", hospital: "Metro Health Medical Center", verified: true },
    { id: "d3", name: "Dr. Emily Watson", specialty: "Pediatrics", hospital: "St. Jude Memorial Hospital", verified: true },
    { id: "d6", name: "Dr. Kiran Kumar", specialty: "Dermatology", hospital: "Care Family Health Clinic", verified: false },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fluctuate users
      setConcurrentUsers((prev) => prev + Math.floor(Math.random() * 15) - 7);
      // Fluctuate latency
      setLatency((prev) => Math.max(10, prev + Math.floor(Math.random() * 4) - 2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleVerify = (id: string) => {
    setDoctorsList((prev) => 
      prev.map(doc => doc.id === id ? { ...doc, verified: !doc.verified } : doc)
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto relative z-10 max-w-6xl space-y-8">
        
        {/* Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card/65 backdrop-blur-xl border border-border/50 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex gap-4 items-center">
            <div className="p-3.5 bg-primary/10 rounded-2xl shrink-0">
              <Cpu className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                  Global Admin Control Center
                </h1>
                <Badge className="bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold uppercase text-[9px] px-2 py-0.5 rounded-lg shadow-sm">
                  Superuser Access
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-semibold">
                Monitor live ecosystem parameters, audit medical credential directories, and toggle platform permissions.
              </p>
            </div>
          </div>
        </div>

        {/* Global metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Users className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Concurrent Users Online</span>
              <span className="text-2xl font-black text-foreground">{concurrentUsers.toLocaleString()} <span className="text-xs font-bold text-emerald-500">Live SSE</span></span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Ecosystem Transactions</span>
              <span className="text-2xl font-black text-foreground">$145.2K <span className="text-xs font-bold text-muted-foreground/80">this month</span></span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Platform Uptime</span>
              <span className="text-2xl font-black text-foreground">99.99% <span className="text-xs font-bold text-emerald-500">SSE active</span></span>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card/45 backdrop-blur-xl p-5 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-accent/10 text-accent rounded-xl shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Average latency</span>
              <span className="text-2xl font-black text-foreground">{latency} <span className="text-xs font-bold text-muted-foreground/80">ms</span></span>
            </div>
          </Card>

        </div>

        {/* Global Admin Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Doctor Credential verification */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xl font-black tracking-tight text-foreground">Ecosystem Credential Verification</h3>
              <Badge className="bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold uppercase text-[9px] tracking-wider px-2 py-0.5 rounded-lg shadow-sm">
                4 Roster Directory
              </Badge>
            </div>

            <div className="space-y-4">
              {doctorsList.map((doc) => (
                <Card key={doc.id} className="border border-border/50 bg-card/45 hover:bg-card/75 rounded-2xl shadow-sm transition-all duration-200">
                  <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Stethoscope className="w-6 h-6 text-primary" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-base text-foreground tracking-tight leading-none truncate">
                            {doc.name}
                          </h4>
                          {doc.verified ? (
                            <Badge className="bg-primary/15 border-primary/20 text-primary font-bold text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 shadow-sm">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5">
                              Pending Audit
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold">
                          Specialty: {doc.specialty} • Roster Location: {doc.hospital}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      <Button
                        size="sm"
                        onClick={() => toggleVerify(doc.id)}
                        className={cn(
                          "rounded-xl text-xs font-bold px-4 h-9 shadow-sm",
                          doc.verified 
                            ? "bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500" 
                            : "bg-primary hover:bg-primary/95 text-white"
                        )}
                      >
                        {doc.verified ? "Revoke Audit" : "Verify Doctor"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Hospital Bed capacities monitors */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-xl font-black tracking-tight text-foreground px-1">Ecosystem Infrastructure</h3>
            
            <Card className="border border-border/50 bg-card/45 rounded-2xl p-6 space-y-6">
              <div className="space-y-0.5 border-b border-border/40 pb-3 mb-2">
                <h4 className="font-bold text-sm text-foreground">Network ER Beds Telemetry</h4>
                <span className="text-[10px] text-muted-foreground font-semibold">ICU bed capacity counts synced</span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span className="font-extrabold text-foreground">Metro Health ICU Beds</span>
                  <span className="text-primary font-black animate-pulse">{telemetry.metroHealth.icuBeds} available</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span className="font-extrabold text-foreground">St. Jude ICU Beds</span>
                  <span className="text-primary font-black animate-pulse">{telemetry.stJude.icuBeds} available</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span className="font-extrabold text-foreground">Platform Active SOS Dispatches</span>
                  <span className="text-rose-500 font-bold">Ambulance GPS active</span>
                </div>
              </div>
            </Card>
          </div>

        </div>

      </div>
    </div>
  );
}
