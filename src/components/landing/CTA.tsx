"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full opacity-50 pointer-events-none" />
      
      <div className="container px-4 md:px-6 mx-auto relative z-10 max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8 bg-card/60 backdrop-blur-2xl p-10 md:p-16 rounded-3xl border border-border shadow-xl"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Ready to take control of your health?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join millions of users who trust our platform for their healthcare needs. It's fast, secure, and incredibly easy to use.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="rounded-full h-14 px-8 text-lg w-full sm:w-auto">
              Get Started for Free
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg w-full sm:w-auto bg-background/50 backdrop-blur-sm hover:bg-background/80">
              Are you a Doctor?
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
