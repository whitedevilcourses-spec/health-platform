"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtime } from "@/lib/realtime-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  ShieldAlert, Phone, AlertOctagon, Heart, MapPin, Search, Navigation,
  Activity, Star, Compass, Clock, Send, ShieldCheck, Truck, ShieldAlert as AlertIcon
} from "lucide-react";

export default function EmergencyPage() {
  const { ambulance, sosTriggered, triggerSos, clearSos } = useRealtime();
  
  const [bloodSearch, setBloodSearch] = useState("");
  const [locationShared, setLocationShared] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("Share Live Coordinates");

  const handleShareLocation = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setLocationLabel("Locating...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentCoordinates({ lat, lng });
          setLocationShared(true);
          setLocationLabel(`Shared: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        },
        (err) => {
          console.warn("Geolocation sharing failed:", err);
          setLocationShared(true);
          setLocationLabel("Nellore, AP Shared");
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocationShared(true);
      setLocationLabel("Nellore, AP Shared");
    }
  };

  const emergencyHospitals = [
    {
      name: "Metro Health ER Trauma Center",
      distance: "1.4 miles",
      ambulancePhone: "+91 99999 00100",
      verified: true,
      time: "5 mins away",
      erOccupancy: "Moderate"
    },
    {
      name: "St. Jude Memorial Emergency Triage",
      distance: "2.8 miles",
      ambulancePhone: "+91 99999 00200",
      verified: true,
      time: "9 mins away",
      erOccupancy: "Low"
    }
  ];

  const bloodBanks = [
    { name: "City Red Cross Blood Center", address: "Gachibowli, Hyderabad", distance: "2.5m", groups: ["A+", "B+", "O+", "O-", "AB+"] },
    { name: "Apollo Hope Blood Bank", address: "Banjara Hills, Hyderabad", distance: "3.1m", groups: ["A+", "B+", "O+", "A-", "B-", "O-"] }
  ];

  // Helper to map lat/lng into absolute percentage bounds of our grid mockup map
  const mapCoordinatesToPercentages = (lat: number, lng: number) => {
    // Path range bounds: lat 14.4426 to 14.4548, lng 79.9865 to 79.9982
    const minLat = 14.4426;
    const maxLat = 14.4548;
    const minLng = 79.9865;
    const maxLng = 79.9982;

    const latPercent = ((lat - minLat) / (maxLat - minLat)) * 100;
    const lngPercent = ((lng - minLng) / (maxLng - minLng)) * 100;

    // Constrain inside bounds
    return {
      top: `${Math.max(10, Math.min(90, 95 - latPercent))}%`,
      left: `${Math.max(10, Math.min(90, 5 + lngPercent))}%`,
    };
  };

  const ambulancePos = mapCoordinatesToPercentages(ambulance.lat, ambulance.lng);

  return (
    <div className="min-h-screen bg-rose-500/[0.02] dark:bg-rose-500/[0.01] py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Red Pulsing emergency blobglows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-destructive/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />

      <div className="container mx-auto relative z-10 max-w-6xl space-y-12">
        
        {/* Urgent header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-destructive/10 border-destructive/25 text-destructive font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full flex items-center gap-1.5 w-fit mx-auto">
            <AlertOctagon className="w-4 h-4 animate-pulse" />
            Urgent Triage & SOS Panel
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Emergency Care Routing
          </h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            One-tap ambulance calling, emergency dispatcher triggering, live location coordinates broadcasting, and blood bank matching infrastructure.
          </p>
        </div>

        {/* Dynamic map preview and SOS control row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: SOS Pulse Card & Telemetry Details */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border border-destructive/25 bg-destructive/[0.02] dark:bg-destructive/[0.01] rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-destructive/10 via-transparent to-transparent blur-2xl pointer-events-none" />
              
              <div className="relative z-10 space-y-6 flex flex-col items-center">
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-tight text-destructive">
                    {sosTriggered ? "SOS Dispatch Active!" : "Instant Emergency SOS"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Pressing the button below instantly broadcasts your coordinates to trauma centers and dispatches the nearest ambulance.
                  </p>
                </div>

                {/* Pulsing Trigger */}
                <div className="relative flex justify-center items-center h-44 w-44">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.4, 0.15] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="absolute w-full h-full bg-destructive rounded-full"
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.6, 0.25] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.3 }}
                    className="absolute w-5/6 h-5/6 bg-destructive rounded-full"
                  />
                  
                  <button
                    onClick={triggerSos}
                    disabled={sosTriggered}
                    className={cn(
                      "relative z-10 w-32 h-32 rounded-full border-4 border-white dark:border-zinc-950 font-black text-xl tracking-widest text-white shadow-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-300 active:scale-95",
                      sosTriggered ? "bg-emerald-500 shadow-emerald-500/25" : "bg-destructive shadow-destructive/25"
                    )}
                  >
                    <ShieldAlert className="w-8 h-8 animate-bounce" />
                    {sosTriggered ? "ACTIVE" : "SOS"}
                  </button>
                </div>

                {sosTriggered && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearSos} 
                    className="rounded-xl text-[10px] uppercase font-bold border-destructive/20 text-destructive/80 hover:bg-destructive/10"
                  >
                    Cancel SOS Triage
                  </Button>
                )}

                {/* Geolocation sharing options */}
                <div className="pt-4 flex flex-col gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={handleShareLocation}
                    className="rounded-xl font-bold text-xs h-10 border-border/80"
                  >
                    <MapPin className="w-4 h-4 mr-2 text-primary" />
                    {locationLabel}
                  </Button>
                  
                  <a 
                    href="tel:108"
                    className={cn(buttonVariants({ variant: "outline", className: "rounded-xl font-bold text-xs h-10 border-border/80 text-rose-500 bg-rose-500/[0.01]" }))}
                  >
                    <Phone className="w-4 h-4 mr-2 text-rose-500" />
                    Direct ER Call (108)
                  </a>
                </div>
              </div>
            </Card>

            {/* Live SSE Coordinate telemetry block */}
            {sosTriggered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 border border-primary/20 bg-card/65 rounded-2xl space-y-3"
              >
                <h4 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-primary animate-pulse" /> Dispatch Telemetry
                </h4>
                <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                  <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">GPS Latitude:</span><span className="text-foreground font-mono">{ambulance.lat.toFixed(5)}</span></div>
                  <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">GPS Longitude:</span><span className="text-foreground font-mono">{ambulance.lng.toFixed(5)}</span></div>
                  <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Ambulance ETA:</span><span className="text-primary font-black">{ambulance.eta}</span></div>
                  <div className="flex justify-between border-t border-border/40 pt-2"><span className="font-medium text-muted-foreground/60">Dispatch Status:</span><span className="text-emerald-500 font-bold uppercase tracking-wider">{ambulance.status}</span></div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Column 2 & 3: Elegant Simulated Map */}
          <div className="lg:col-span-2">
            <div className="w-full h-full min-h-[460px] border border-border/50 rounded-3xl overflow-hidden shadow-2xl bg-card/30 backdrop-blur-md flex flex-col justify-between relative group">
              
              {/* Simulated Map Grid Paths */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none z-0" />
              
              {/* Static Path SVG Representation */}
              <svg className="absolute inset-0 w-full h-full opacity-35 z-0" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M 50 400 L 150 350 L 250 280 L 350 220 L 450 180 L 520 120" 
                  fill="none" 
                  stroke="var(--color-primary)" 
                  strokeWidth="4" 
                  strokeDasharray="8 6"
                  className="animate-[dash_8s_linear_infinite]" 
                />
              </svg>

              {/* Patient Pin (Destination) */}
              <div className="absolute top-[85%] left-[5%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <div className="px-2 py-0.5 bg-background border border-border text-[9px] font-black rounded shadow whitespace-nowrap mb-1">
                  {currentCoordinates ? `You (${currentCoordinates.lat.toFixed(4)}, ${currentCoordinates.lng.toFixed(4)})` : "You (Patient Pin)"}
                </div>
                <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
              </div>

              {/* Hospital Pin (Base) */}
              <div className="absolute top-[10%] left-[80%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <div className="px-2 py-0.5 bg-primary text-white text-[9px] font-black rounded shadow whitespace-nowrap mb-1">
                  Metro Health ER Base
                </div>
                <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg" />
              </div>

              {/* Live Pulsing Ambulance Marker */}
              {sosTriggered && (
                <motion.div 
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ top: ambulancePos.top, left: ambulancePos.left }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-500 ease-out"
                >
                  <div className="px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded shadow whitespace-nowrap mb-1 border border-white/20 uppercase tracking-widest flex items-center gap-1">
                    <Truck className="w-2.5 h-2.5 text-white" /> Emergency (ETA: {ambulance.eta})
                  </div>
                  <div className="w-6 h-6 bg-rose-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center relative">
                    <span className="absolute inset-0 bg-rose-500 rounded-full blur animate-ping" />
                    <AlertIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                </motion.div>
              )}

              {/* Overlay controls */}
              <div className="relative z-10 p-6 flex flex-col justify-between h-full pointer-events-none">
                <div className="bg-background/85 backdrop-blur border border-border/40 p-3.5 rounded-xl shadow-lg flex items-center space-x-2 w-fit">
                  <Compass className="w-5 h-5 text-primary animate-spin" />
                  <div>
                    <h5 className="text-xs font-black text-foreground">Interactive Triage Navigator</h5>
                    <p className="text-[9px] text-muted-foreground">Routing active dispatches over local telemetry coordinates</p>
                  </div>
                </div>
                
                <div className="bg-background/85 backdrop-blur border border-border/40 p-4 rounded-xl shadow-lg flex flex-col space-y-2 pointer-events-auto max-w-sm">
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {sosTriggered 
                      ? "Ambulance active coordinates streaming from live Next.js EventSource endpoint." 
                      : "Trigger SOS button on the left to dispatch ambulance and begin real-time GPS coordinate movement."}
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Emergency Centers & Blood Bank Search */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
          
          {/* Active Ambulance Trauma Centers list */}
          <div className="space-y-6">
            <h3 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2 px-1">
              <ShieldAlert className="w-5 h-5 text-destructive animate-pulse" />
              Nearest Ambulance & ER Dispatch
            </h3>

            <div className="space-y-4">
              {emergencyHospitals.map((hospital, idx) => (
                <Card key={idx} className="border border-destructive/20 bg-card/45 rounded-2xl shadow-sm">
                  <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-base text-foreground tracking-tight">{hospital.name}</h4>
                        <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold">
                          {hospital.erOccupancy} occupancy
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {hospital.distance} • {hospital.time}
                      </p>
                    </div>

                    <a 
                      href={`tel:${hospital.ambulancePhone}`}
                      className={cn(buttonVariants({ className: "rounded-xl font-bold text-xs bg-rose-500 hover:bg-rose-600 text-white shrink-0 shadow-lg shadow-rose-500/10" }))}
                    >
                      <Phone className="w-3.5 h-3.5 mr-2" />
                      Ambulance Call
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Blood Bank search panel */}
          <div className="space-y-6">
            <h3 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2 px-1">
              <Heart className="w-5 h-5 text-rose-500 animate-pulse" />
              Blood Bank Dispatch Locator
            </h3>

            <Card className="border border-border/50 bg-card/45 backdrop-blur-md rounded-2xl p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="bloodQuery" className="font-bold text-xs tracking-tight text-muted-foreground/80">Search Specific Blood Group</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="bloodQuery"
                    placeholder="e.g. O-, AB+, A+..." 
                    value={bloodSearch}
                    onChange={(e) => setBloodSearch(e.target.value)}
                    className="bg-background/50 border-border/80 pl-9 focus:border-primary h-10 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-border/40">
                {bloodBanks.map((bank, i) => (
                  <div key={i} className="flex justify-between items-start gap-4 text-xs font-semibold text-muted-foreground border-b border-border/30 pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <h4 className="font-bold text-foreground text-sm">{bank.name}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary/80" />
                        {bank.address} ({bank.distance})
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
                      {bank.groups.map((gp, idx) => (
                        <span 
                          key={idx} 
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                            bloodSearch && gp.toLowerCase().includes(bloodSearch.toLowerCase()) 
                              ? "bg-rose-500 border-rose-600 text-white shadow-sm"
                              : "bg-background border-border text-muted-foreground/80"
                          )}
                        >
                          {gp}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>

      </div>
    </div>
  );
}
