import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { RealtimeProvider } from "@/lib/realtime-context";
import { Header } from "@/components/Header";
import { FeedbackProvider } from "@/components/providers/feedback-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aegis Health — Enterprise AI Healthcare & Priority Care Triage",
  description: "Experience modern, intelligent medicine. Triage your symptoms, book verified local specialists, and manage your clinical records securely.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RealtimeProvider>
          <FeedbackProvider>
            <Header />
            <div className="flex-1">
              {children}
            </div>
            <FloatingChat />
          </FeedbackProvider>
        </RealtimeProvider>
      </body>
    </html>
  );
}
