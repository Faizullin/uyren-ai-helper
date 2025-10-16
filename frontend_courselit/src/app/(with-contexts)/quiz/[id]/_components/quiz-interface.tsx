"use client";

import {
  navigateQuizQuestion,
  submitQuizAttempt,
} from "@/server/actions/quiz-attempt";
import { IQuizAttemptHydratedDocument } from "@workspace/common-logic/models/lms/quiz-attempt.model";
import { IQuizHydratedDocument, IQuizQuestionHydratedDocument } from "@workspace/common-logic/models/lms/quiz.model";
import { IOption } from "@workspace/common-logic/models/lms/quiz.types";
import { useDialogControl, useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";

type ISerializerQuestion = Pick<IQuizQuestionHydratedDocument, "text" | "type" | "points"> & {
  _id: string;
  options: Pick<IOption, "uid" | "text" | "order">[];
};

type ISerializedQuiz = Pick<IQuizHydratedDocument, "title" | "description" | "maxAttempts" | "timeLimit" | "totalPoints"> & {
  _id: string;
  questions: ISerializerQuestion[];
};

type ISerializedAttemptAnswer = Pick<IQuizAttemptHydratedDocument["answers"][number], "answer"> & {
  questionId: string;
};

type ISerializedAttempt = Pick<IQuizAttemptHydratedDocument, "status"> & {
  _id: string;
  quizId: string;
  userId: string;
  answers: ISerializedAttemptAnswer[];
};


interface QuizInterfaceProps {
  initialQuiz: ISerializedQuiz;
  attemptId?: string;
  initialAttemptData?: ISerializedAttempt;
}

const MultipleChoiceQuestion = ({
  options,
  currentAnswer,
  onOptionChange,
}: Pick<ISerializerQuestion, "options"> & {
  currentAnswer: string[];
  onOptionChange: (optionUid: string, checked: boolean) => void;
}) => (
  <div className="space-y-3">
    {options?.map((option) => (
      <div key={option.uid} className="flex items-center space-x-3">
        <Checkbox
          id={option.uid}
          checked={currentAnswer.includes(option.uid)}
          onCheckedChange={(checked) =>
            onOptionChange(option.uid, checked as boolean)
          }
        />
        <Label
          htmlFor={option.uid}
          className="cursor-pointer text-base leading-relaxed"
        >
          {option.text}
        </Label>
      </div>
    ))}
  </div>
);

export default function QuizInterface({
  initialQuiz,
  attemptId,
  initialAttemptData,
}: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Single source of truth for quiz state
  const [quizState, setQuizState] = useState(() => {
    const initialAnswers = new Map<string, any>();
    const initialAnswered = new Set<string>();

    if (initialAttemptData?.answers) {
      initialAttemptData.answers.forEach((answer) => {
        if (answer.answer !== null && answer.answer !== undefined) {
          initialAnswers.set(answer.questionId, answer.answer);
          initialAnswered.add(answer.questionId);
        }
      });
    }

    return {
      answers: initialAnswers,
      answeredQuestions: initialAnswered,
    };
  });
  // Current answer derived from quiz state
  const currentAnswer = useMemo(() => {
    const currentQuestion = initialQuiz.questions[currentQuestionIndex];
    if (!currentQuestion) return [];

    const saved = quizState.answers.get(currentQuestion._id);
    if (saved !== undefined) return saved;

    // Return appropriate empty state based on question type
    return currentQuestion.type === "short_answer" ? [""] : [];
  }, [quizState.answers, currentQuestionIndex, initialQuiz.questions]);

  const currentQuestion = useMemo(
    () => initialQuiz.questions[currentQuestionIndex],
    [initialQuiz.questions, currentQuestionIndex],
  );

  const { toast } = useToast();
  const router = useRouter();
  const submitDialog = useDialogControl();

  const updateCurrentAnswer = useCallback(
    (newAnswer: any) => {
      if (!currentQuestion) {
        throw new Error("Current question not found");
      }
      setQuizState((prev) => {
        const newAnswers = new Map(prev.answers);
        const newAnsweredQuestions = new Set(prev.answeredQuestions);
        newAnswers.set(currentQuestion._id, newAnswer);
        const hasValidAnswer =
          newAnswer &&
          (Array.isArray(newAnswer)
            ? newAnswer.length > 0 &&
            newAnswer.some((a) => a && a.toString().trim() !== "")
            : typeof newAnswer === "string"
              ? newAnswer.trim() !== ""
              : true);
        if (hasValidAnswer) {
          newAnsweredQuestions.add(currentQuestion._id);
        } else {
          newAnsweredQuestions.delete(currentQuestion._id);
        }
        return {
          answers: newAnswers,
          answeredQuestions: newAnsweredQuestions,
        };
      });
    },
    [currentQuestion?._id],
  );

  const handleMultipleChoiceChange = useCallback(
    (optionUid: string, checked: boolean) => {
      const currentAnswers = (currentAnswer as string[]) || [];
      const newAnswer = checked
        ? currentAnswers.includes(optionUid)
          ? currentAnswers
          : [...currentAnswers, optionUid]
        : currentAnswers.filter((uid) => uid !== optionUid);
      updateCurrentAnswer(newAnswer);
    },
    [currentAnswer, updateCurrentAnswer],
  );

  const handleShortAnswerChange = useCallback(
    (answer: string) => {
      updateCurrentAnswer([answer]);
    },
    [updateCurrentAnswer],
  );

  const navigateToQuestion = useCallback(
    async (targetIndex: number) => {
      if (
        targetIndex === currentQuestionIndex ||
        targetIndex < 0 ||
        targetIndex >= initialQuiz.questions.length
      ) {
        return;
      }
      if (!attemptId || !currentQuestion) {
        throw new Error("Attempt ID or current question not found");
      }
      setIsLoading(true);
      try {
        const result = await navigateQuizQuestion({
          attemptId,
          currentQuestionId: currentQuestion._id,
          currentAnswer,
          targetQuestionIndex: targetIndex,
          saveAnswer: true, // Always save on navigation
        });
        if (result.success) {
          setCurrentQuestionIndex(targetIndex);

          // Update quiz state with server response
          setQuizState((prev) => {
            const newAnswers = new Map(prev.answers);
            const newAnsweredQuestions = result.answeredQuestions
              ? new Set(result.answeredQuestions)
              : prev.answeredQuestions;

            // Set target question answer from server
            if (result.targetQuestionAnswer !== undefined) {
              const targetQuestionId = initialQuiz.questions[targetIndex]?._id;
              if (targetQuestionId) {
                newAnswers.set(targetQuestionId, result.targetQuestionAnswer);
              }
            }

            return {
              answers: newAnswers,
              answeredQuestions: newAnsweredQuestions,
            };
          });
        } else {
          toast({
            title: "Navigation Failed",
            description: result.message || "Failed to navigate to question",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Navigation failed:", error);
        toast({
          title: "Error",
          description: "Failed to navigate to question",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [currentQuestionIndex, attemptId, currentQuestion, currentAnswer, toast],
  );

  // Navigation handlers
  const handleNext = useCallback(() => {
    navigateToQuestion(currentQuestionIndex + 1);
  }, [currentQuestionIndex, navigateToQuestion]);

  const handlePrevious = useCallback(() => {
    navigateToQuestion(currentQuestionIndex - 1);
  }, [currentQuestionIndex, navigateToQuestion]);

  const handleQuestionNavigation = useCallback(
    (questionIndex: number) => {
      navigateToQuestion(questionIndex);
    },
    [navigateToQuestion],
  );

  const handleSubmit = useCallback(async () => {
    if (!attemptId) return;

    setIsLoading(true);
    try {
      if (currentQuestion) {
        await navigateQuizQuestion({
          attemptId,
          currentQuestionId: currentQuestion._id,
          currentAnswer,
          targetQuestionIndex: currentQuestionIndex,
          saveAnswer: true,
        });
      }
      const result = await submitQuizAttempt(attemptId);

      if (result.success) {
        toast({
          title: "Quiz Submitted",
          description: result.message,
        });
        router.push(`/quiz/${initialQuiz._id}/attempts/${attemptId}/results`);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit quiz",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      submitDialog.hide();
    }
  }, [
    attemptId,
    currentQuestion,
    currentAnswer,
    currentQuestionIndex,
    toast,
    router,
    submitDialog,
  ]);

  const handleSubmitClick = useCallback(() => {
    submitDialog.show();
  }, [submitDialog]);

  return (
    <QuizWrapper>
      <Card className="w-full h-full">
        <CardContent className="h-full p-0">
          <div className="flex h-full">
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-8">
                {currentQuestion && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-semibold leading-relaxed">
                        {currentQuestion.text}
                      </h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {currentQuestion.points} point
                        {currentQuestion.points !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="min-h-[200px]">
                      {currentQuestion.type === "multiple_choice" && (
                        <MultipleChoiceQuestion
                          options={currentQuestion.options}
                          currentAnswer={currentAnswer}
                          onOptionChange={handleMultipleChoiceChange}
                        />
                      )}
                      {currentQuestion.type === "short_answer" && (
                        <ShortAnswerQuestion
                          currentAnswer={currentAnswer}
                          onAnswerChange={handleShortAnswerChange}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t bg-gray-50/50 p-6">
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0 || isLoading}
                    size="lg"
                  >
                    Previous
                  </Button>

                  {currentQuestionIndex === initialQuiz.questions.length - 1 ? (
                    <Button
                      onClick={handleSubmitClick}
                      disabled={isLoading || currentAnswer === null}
                      className="bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      {isLoading ? "Submitting..." : "Submit Quiz"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      disabled={
                        currentQuestionIndex ===
                        initialQuiz.questions.length - 1 || isLoading
                      }
                      size="lg"
                    >
                      {isLoading ? "Loading..." : "Next"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-px bg-gray-200"></div>

            <div className="w-80 flex flex-col">
              <div className="p-6 border-b">
                <h3 className="font-semibold text-lg">Question Navigator</h3>
              </div>

              {/* Question Grid - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-4 gap-3">
                  {initialQuiz.questions.map((question, index) => {
                    const hasAnswer = quizState.answeredQuestions.has(
                      question._id,
                    );
                    const isCurrent = index === currentQuestionIndex;

                    return (
                      <Button
                        key={question._id}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        className={`h-14 w-14 p-0 ${isCurrent
                          ? "bg-blue-600 text-white ring-2 ring-blue-200"
                          : ""
                          }`}
                        onClick={() => handleQuestionNavigation(index)}
                        disabled={isLoading}
                      >
                        <div className="flex flex-col items-center justify-center w-full h-full">
                          <div className="flex items-center gap-1">
                            {hasAnswer ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-xs font-medium">
                              Q{index + 1}
                            </span>
                          </div>
                          {isCurrent && (
                            <div className="w-2 h-2 bg-current rounded-full mt-1"></div>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t bg-gray-50/50 p-6">
                <Button
                  onClick={handleSubmitClick}
                  className="w-full bg-green-600 hover:bg-green-700 h-12"
                  disabled={isLoading || quizState.answeredQuestions.size === 0}
                  size="lg"
                >
                  {isLoading ? "Submitting..." : "Submit Quiz"}
                </Button>
                {quizState.answeredQuestions.size === 0 && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Answer at least one question to submit
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={submitDialog.isVisible}
        onOpenChange={submitDialog.show}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this quiz? You cannot go back and
              edit your answers after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={submitDialog.hide}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-green-600 hover:bg-green-700"
            >
              Submit Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </QuizWrapper>
  );
}

const QuizWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div className="w-full max-w-6xl h-[90vh]">{children}</div>
  </div>
);

const ShortAnswerQuestion = ({
  currentAnswer,
  onAnswerChange,
}: {
  currentAnswer: string[];
  onAnswerChange: (answer: string) => void;
}) => {
  const currentValue = currentAnswer.length > 0 ? currentAnswer[0] : "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onAnswerChange(e.target.value);
    },
    [onAnswerChange],
  );

  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Enter your answer..."
        value={currentValue}
        onChange={handleChange}
        autoComplete="off"
        className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      />
    </div>
  );
};
