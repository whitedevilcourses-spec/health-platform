"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Activity, ShieldPlus, HeartPulse } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-24 pb-32">
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
      
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-8">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
          >
            <Activity className="mr-2 h-4 w-4" />
            AI-Powered Healthcare Ecosystem
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl text-foreground"
          >
            Your Health, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Intelligently Guided.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            Experience the future of medicine. Our AI assesses your symptoms, 
            recommends top-rated specialists, and helps you book appointments in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link 
              href="/assessment" 
              className={cn(buttonVariants({ variant: "default", size: "lg", className: "rounded-full h-14 px-8 text-lg group" }))}
            >
              Check Symptoms Now
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link 
              href="/hospitals" 
              className={cn(buttonVariants({ variant: "outline", size: "lg", className: "rounded-full h-14 px-8 text-lg" }))}
            >
              Find a Doctor
            </Link>
          </motion.div>

          {/* Floating Feature Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 w-full max-w-5xl"
          >
            <div className="flex flex-col items-center p-6 bg-card rounded-2xl border border-border shadow-sm backdrop-blur-xl bg-card/50">
              <div className="p-3 bg-primary/10 rounded-full mb-4">
                <HeartPulse className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Smart Assessment</h3>
              <p className="text-sm text-muted-foreground text-center">AI analyzes your symptoms instantly</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-card rounded-2xl border border-border shadow-sm backdrop-blur-xl bg-card/50">
              <div className="p-3 bg-accent/10 rounded-full mb-4">
                <Activity className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Verified Specialists</h3>
              <p className="text-sm text-muted-foreground text-center">Connect with top-rated doctors</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-card rounded-2xl border border-border shadow-sm backdrop-blur-xl bg-card/50">
              <div className="p-3 bg-destructive/10 rounded-full mb-4">
                <ShieldPlus className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Emergency Ready</h3>
              <p className="text-sm text-muted-foreground text-center">One-tap SOS and urgent care routing</p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
