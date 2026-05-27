"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Assess Symptoms",
    description: "Tell our AI how you're feeling. It analyzes your symptoms against vast medical databases to understand your condition.",
  },
  {
    number: "02",
    title: "Get Recommendations",
    description: "Receive personalized recommendations for the type of specialist you need, along with top-rated doctors nearby.",
  },
  {
    number: "03",
    title: "Book Appointment",
    description: "Choose a convenient time slot and book your in-person or video consultation instantly.",
  },
  {
    number: "04",
    title: "Feel Better",
    description: "Get treated, access your prescriptions digitally, and manage your follow-ups all in one place.",
  }
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-background">
      <div className="container px-4 md:px-6 mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          
          <div className="flex-1 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                How <span className="text-primary">HealthAI</span> Works
              </h2>
              <p className="text-lg text-muted-foreground max-w-md">
                A seamless journey from symptom check to full recovery. We guide you every step of the way.
              </p>
            </div>

            <div className="space-y-8">
              {steps.map((step, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex-1 relative w-full aspect-square max-w-md mx-auto"
          >
            {/* Abstract visual representation of the app */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-accent/20 to-background rounded-3xl border border-border shadow-2xl overflow-hidden">
              <div className="absolute inset-x-4 top-4 bottom-4 bg-card rounded-2xl shadow-sm border border-border p-6 flex flex-col gap-4">
                {/* Mock UI Elements */}
                <div className="h-12 w-full bg-muted/50 rounded-lg animate-pulse" />
                <div className="flex gap-4">
                  <div className="h-24 flex-1 bg-primary/10 rounded-lg animate-pulse" />
                  <div className="h-24 flex-1 bg-accent/10 rounded-lg animate-pulse" />
                </div>
                <div className="h-40 w-full bg-muted/30 rounded-lg mt-auto flex items-center justify-center">
                  <div className="text-muted-foreground/50 font-medium">Interactive Demo</div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
