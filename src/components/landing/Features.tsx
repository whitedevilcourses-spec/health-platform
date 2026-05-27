"use client";

import { motion } from "framer-motion";
import { 
  Stethoscope, 
  CalendarCheck, 
  Bot, 
  Ambulance, 
  ShieldCheck, 
  FileText 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "AI Symptom Checker",
    description: "Describe how you feel, and our advanced AI engine will suggest potential conditions and next steps.",
    icon: Bot,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Instant Appointment Booking",
    description: "Find available slots with top specialists near you and book instantly without phone calls.",
    icon: CalendarCheck,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
  },
  {
    title: "Emergency SOS",
    description: "One-tap emergency button that immediately connects you to ambulances and nearby urgent care.",
    icon: Ambulance,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    title: "Secure Medical Records",
    description: "HIPAA-compliant encrypted storage for all your prescriptions, lab reports, and medical history.",
    icon: ShieldCheck,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    title: "Smart Pharmacy Finder",
    description: "Locate nearby 24/7 pharmacies and check medicine availability in real-time.",
    icon: Stethoscope,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Digital Prescriptions",
    description: "Receive and manage digital prescriptions directly from your doctor on the platform.",
    icon: FileText,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  },
};

export function Features() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container px-4 md:px-6 mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            Everything you need for better health
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our platform combines cutting-edge AI with a vast network of healthcare providers to give you the most comprehensive care experience.
          </p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card className="border-none shadow-md hover:shadow-lg transition-all duration-300 bg-card/80 backdrop-blur-sm h-full">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.bg}`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
