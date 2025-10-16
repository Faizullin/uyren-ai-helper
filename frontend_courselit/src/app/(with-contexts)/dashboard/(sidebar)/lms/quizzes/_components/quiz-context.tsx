"use client";

import { FormMode } from "@/components/dashboard/layout/types";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { IQuiz } from "@workspace/common-logic/models/lms/quiz.types";
import { useToast } from "@workspace/components-library";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type QuizType =
  GeneralRouterOutputs["lmsModule"]["quizModule"]["quiz"]["getById"];

interface QuizContextType {
  initialData: IQuiz;
  quiz: QuizType | null;
  mode: FormMode;
  loadDetailQuery: ReturnType<
    typeof trpc.lmsModule.quizModule.quiz.getById.useQuery
  >;
  updateMutation: ReturnType<
    typeof trpc.lmsModule.quizModule.quiz.update.useMutation
  >;
}

const QuizContext = createContext<QuizContextType>({
  initialData: null as any,
  quiz: null,
  mode: "create",
  loadDetailQuery: (() => {
    throw new Error("loadDetailQuery is not implemented");
  }) as any,
  updateMutation: (() => {
    throw new Error("updateStatusMutation is not implemented");
  }) as any,
});

interface QuizProviderProps {
  children: ReactNode;
  initialData?: any;
  initialMode: FormMode;
}

export function QuizProvider({
  children,
  initialMode,
  initialData,
}: QuizProviderProps) {
  const { toast } = useToast();
  const [mode] = useState<FormMode>(initialMode);
  const [quiz, setQuiz] = useState<QuizType | null>(null);

  const loadDetailQuery = trpc.lmsModule.quizModule.quiz.getById.useQuery(
    {
      id: initialData?._id!,
    },
    {
      enabled: mode === "edit" && !!initialData?._id,
    },
  );
  const updateMutation = trpc.lmsModule.quizModule.quiz.update.useMutation({
    onSuccess: (response) => {
      setQuiz(response as any);
      toast({
        title: "Success",
        description: "Quiz status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  useEffect(() => {
    if (loadDetailQuery.data) {
      setQuiz(loadDetailQuery.data);
    }
  }, [loadDetailQuery.data]);
  return (
    <QuizContext.Provider
      value={{
        initialData,
        mode,
        quiz,
        loadDetailQuery,
        updateMutation,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuizContext() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuizContext must be used within a QuizProvider");
  }
  return context;
}
