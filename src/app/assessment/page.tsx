import { AssessmentForm } from "@/components/assessment/AssessmentForm";

export default function AssessmentPage() {
  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-accent/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-40 -left-40 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Health Assessment
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Answer a few questions to get a triage summary, urgency check, and next-step guidance.
          </p>
        </div>

        <AssessmentForm />
      </div>
    </div>
  );
}
