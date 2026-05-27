"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeedbackTone = "success" | "error" | "info" | "warning";
type FeedbackButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive";

type FeedbackAction = {
  label: string;
  onClick?: () => void | Promise<void>;
  variant?: FeedbackButtonVariant;
};

type FeedbackOptions = {
  title: string;
  message: string;
  tone?: FeedbackTone;
  primaryAction?: FeedbackAction;
  secondaryAction?: FeedbackAction;
};

type FeedbackContextValue = {
  showFeedback: (options: FeedbackOptions) => void;
  hideFeedback: () => void;
};

const toneStyles: Record<
  FeedbackTone,
  {
    badge: string;
    badgeLabel: string;
    icon: typeof CheckCircle2;
    iconClassName: string;
    borderClassName: string;
  }
> = {
  success: {
    badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    badgeLabel: "Success",
    icon: CheckCircle2,
    iconClassName: "bg-emerald-500/10 text-emerald-500",
    borderClassName: "border-emerald-500/20",
  },
  error: {
    badge: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
    badgeLabel: "Action blocked",
    icon: XCircle,
    iconClassName: "bg-rose-500/10 text-rose-500",
    borderClassName: "border-rose-500/20",
  },
  info: {
    badge: "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400",
    badgeLabel: "Heads up",
    icon: Info,
    iconClassName: "bg-sky-500/10 text-sky-500",
    borderClassName: "border-sky-500/20",
  },
  warning: {
    badge: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    badgeLabel: "Please review",
    icon: AlertTriangle,
    iconClassName: "bg-amber-500/10 text-amber-500",
    borderClassName: "border-amber-500/20",
  },
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<FeedbackOptions | null>(null);
  const [pendingAction, setPendingAction] = useState<"primary" | "secondary" | null>(null);

  const hideFeedback = useCallback(() => {
    setPendingAction(null);
    setFeedback(null);
  }, []);

  const showFeedback = useCallback((options: FeedbackOptions) => {
    setPendingAction(null);
    setFeedback(options);
  }, []);

  const handleAction = useCallback(
    async (
      action: FeedbackAction | undefined,
      actionKey: "primary" | "secondary",
    ) => {
      if (!action?.onClick) {
        hideFeedback();
        return;
      }

      setPendingAction(actionKey);
      try {
        await action.onClick();
        hideFeedback();
      } catch (error) {
        console.error("Feedback action failed:", error);
      } finally {
        setPendingAction(null);
      }
    },
    [hideFeedback],
  );

  const contextValue = useMemo(
    () => ({
      showFeedback,
      hideFeedback,
    }),
    [hideFeedback, showFeedback],
  );

  const tone = feedback?.tone || "info";
  const toneStyle = toneStyles[tone];
  const ToneIcon = toneStyle.icon;

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <AnimatePresence>
        {feedback ? (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={hideFeedback}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card
                className={cn(
                  "overflow-hidden rounded-[28px] border bg-card/96 shadow-2xl backdrop-blur-2xl",
                  toneStyle.borderClassName,
                )}
              >
                <CardContent className="space-y-6 p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-4">
                      <Badge className={cn("border font-bold uppercase tracking-[0.24em]", toneStyle.badge)}>
                        {toneStyle.badgeLabel}
                      </Badge>
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                            toneStyle.iconClassName,
                          )}
                        >
                          <ToneIcon className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-black tracking-tight text-foreground">
                            {feedback.title}
                          </h2>
                          <p className="whitespace-pre-line text-sm font-medium leading-6 text-muted-foreground">
                            {feedback.message}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={hideFeedback}
                      aria-label="Close message"
                      className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    {feedback.secondaryAction ? (
                      <Button
                        variant={feedback.secondaryAction.variant || "outline"}
                        onClick={() => void handleAction(feedback.secondaryAction, "secondary")}
                        disabled={pendingAction !== null}
                        className="rounded-xl px-5 font-bold"
                      >
                        {pendingAction === "secondary" ? "Working..." : feedback.secondaryAction.label}
                      </Button>
                    ) : null}

                    <Button
                      variant={feedback.primaryAction?.variant || "default"}
                      onClick={() => void handleAction(feedback.primaryAction, "primary")}
                      disabled={pendingAction !== null}
                      className="rounded-xl px-5 font-bold"
                    >
                      {pendingAction === "primary"
                        ? "Working..."
                        : feedback.primaryAction?.label || "Close"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider.");
  }
  return context;
}
