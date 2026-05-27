"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRealtime } from "@/lib/realtime-context";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HeartPulse, Bell, Search, Menu, X, ShieldCheck, 
  Activity, AlertTriangle, User, Brain, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { getRoleHome, getRoleProfileRoute, useCurrentUserProfile } from "@/lib/current-user";

export function Header() {
  const pathname = usePathname();
  const { notifications, onlineRole } = useRealtime();
  const { user: currentUser, profile } = useCurrentUserProfile();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("patientEmail");
      window.location.href = "/auth";
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const effectiveRole = profile?.role || onlineRole;
  const hasRecoverableSession = Boolean(currentUser && !profile);
  const navItems =
    !currentUser
      ? [
          { label: "Home", href: "/" },
          { label: "Hospitals", href: "/hospitals" },
          { label: "Doctors", href: "/doctors" },
          { label: "Emergency", href: "/emergency" },
        ]
      : hasRecoverableSession
        ? [
            { label: "Home", href: "/" },
            { label: "Continue Setup", href: "/onboarding" },
          ]
      : effectiveRole === "doctor"
      ? [
          { label: "Home", href: "/" },
          { label: "My Queue", href: "/doctor/dashboard" },
          { label: "Availability", href: "/doctor/availability" },
          { label: "Hospitals", href: "/hospitals" },
        ]
      : effectiveRole === "admin" || effectiveRole === "manager"
        ? [
            { label: "Home", href: "/" },
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Hospitals", href: "/hospitals" },
            { label: "Doctors", href: "/doctors" },
          ]
        : [
            { label: "Home", href: "/" },
            { label: "Hospitals", href: "/hospitals" },
            { label: "Doctors", href: "/doctors" },
            { label: "Emergency", href: "/emergency" },
            { label: "Dashboard", href: "/patient/dashboard" },
            { label: "Profile", href: "/patient/profile" },
          ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "doctor": return "bg-teal-500/10 text-teal-500 border-teal-500/20";
      case "admin": return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "manager": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Logo brand */}
        <Link href="/" className="flex items-center gap-2.5 font-black text-xl text-foreground tracking-tight select-none">
          <div className="h-9 w-9 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/10 relative overflow-hidden">
            <HeartPulse className="w-5 h-5 text-white animate-pulse" />
          </div>
          <span className="flex items-center">
            Aegis<span className="text-primary font-black ml-0.5">Health</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-bold tracking-tight transition-colors hover:text-foreground ${
                pathname === item.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Global actions */}
        <div className="flex items-center gap-3 relative">
          
          {/* Quick AI search */}
          <div className="relative hidden md:block w-48 focus-within:w-64 transition-all duration-300">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search platform..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full bg-muted/40 border border-border/80 focus:border-primary pl-9 pr-3 py-1.5 rounded-full text-xs font-semibold focus:outline-none"
            />
          </div>

          {/* Real-time Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-muted rounded-full relative text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 1 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>

            {/* Notification Dropdown Container */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl p-4 overflow-hidden z-50 backdrop-blur-xl"
                >
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <h5 className="font-extrabold text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-primary" /> Live AI Telemetry Logs
                    </h5>
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">Real-Time</span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="flex items-start gap-2.5 text-xs border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          notif.type === "warning" ? "bg-rose-500/10 text-rose-500" :
                          notif.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                        }`}>
                          {notif.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5" /> : 
                           notif.type === "success" ? <ShieldCheck className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                        </div>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className="font-semibold text-foreground leading-normal">{notif.text}</p>
                          <span className="text-[9px] text-muted-foreground font-semibold block">{notif.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active Role Selector Link */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <Link
                href={
                  hasRecoverableSession ? "/onboarding" : getRoleHome(effectiveRole)
                }
                className={`border px-3.5 py-1.5 rounded-xl text-xs font-black capitalize tracking-tight flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:opacity-90 ${getRoleBadgeColor(effectiveRole)}`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="truncate max-w-[90px]">{currentUser.email?.split("@")[0]}</span>
              </Link>
              <Link
                href={hasRecoverableSession ? "/onboarding" : getRoleProfileRoute(effectiveRole)}
                className="border px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {hasRecoverableSession ? "Setup" : "Profile"}
              </Link>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="h-8 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-all duration-200"
              >
                Exit
              </Button>
            </div>
          ) : (
            <Link
              href="/auth"
              className={`border px-3.5 py-1.5 rounded-xl text-xs font-black capitalize tracking-tight flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:opacity-90 ${getRoleBadgeColor(onlineRole)}`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{onlineRole}</span>
            </Link>
          )}

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>

      </div>

      {/* Mobile Drawer menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t bg-card px-4 py-6 space-y-4"
          >
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className={`text-sm font-bold tracking-tight block py-1.5 ${
                    pathname === item.href ? "text-primary font-black" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
