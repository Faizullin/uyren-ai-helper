"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startQuizAttempt } from "@/server/actions/quiz-attempt";
import { Button } from "@workspace/ui/components/button";
import { Play, RotateCcw } from "lucide-react";
import { useToast } from "@workspace/components-library";

interface QuizActionsProps {
  quizId: string;
  currentAttempt: any;
  remainingAttempts: number;
}

export default function QuizActions({
  quizId,
  currentAttempt,
  remainingAttempts,
}: QuizActionsProps) {
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleStartQuiz = async () => {
    if (remainingAttempts === 0) return;

    setIsStarting(true);
    try {
      const result = await startQuizAttempt(quizId);
      if (result.success) {
        router.push(`/quiz/${quizId}/attempts/${result.attemptId}`);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start quiz",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleContinueAttempt = () => {
    router.push(`/quiz/${quizId}/attempts/${currentAttempt._id}`);
  };

  if (currentAttempt) {
    return (
      <Button
        onClick={handleContinueAttempt}
        size="lg"
        className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-4 text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <RotateCcw className="w-5 h-5 mr-2" />
        Continue Attempt
      </Button>
    );
  }

  return (
    <Button
      onClick={handleStartQuiz}
      disabled={isStarting || remainingAttempts === 0}
      size="lg"
      className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-4 text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:bg-muted-foreground/50 disabled:cursor-not-allowed"
    >
      <Play className="w-5 h-5 mr-2" />
      {isStarting ? "Starting..." : "Start Quiz"}
    </Button>
  );
}
