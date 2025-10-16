"use client";

import { FormMode } from "@/components/dashboard/layout/types";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { IAssignment } from "@workspace/common-logic/models/lms/assignment.types";
import { useToast } from "@workspace/components-library";
import {  
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type AssignmentType =
  GeneralRouterOutputs["lmsModule"]["assignmentModule"]["assignment"]["getById"];

interface AssignmentContextType {
  initialData: IAssignment;
  assignment: AssignmentType | null;
  mode: FormMode;
  loadDetailQuery: ReturnType<
    typeof trpc.lmsModule.assignmentModule.assignment.getById.useQuery
  >;
  updateMutation: ReturnType<
    typeof trpc.lmsModule.assignmentModule.assignment.update.useMutation
  >;
}

const AssignmentContext = createContext<AssignmentContextType>({
  initialData: null as any,
  assignment: null,
  mode: "create",
  loadDetailQuery: (() => {
    throw new Error("loadDetailQuery is not implemented");
  }) as any,
  updateMutation: (() => {
    throw new Error("updateStatusMutation is not implemented");
  }) as any,
});

interface AssignmentProviderProps {
  children: ReactNode;
  initialData?: any;
  initialMode: FormMode;
}

export function AssignmentProvider({
  children,
  initialMode,
  initialData,
}: AssignmentProviderProps) {
  const { toast } = useToast();
  const [mode] = useState<FormMode>(initialMode);
  const [assignment, setAssignment] = useState<AssignmentType | null>(
    initialData || null,
  );

  const loadDetailQuery =
    trpc.lmsModule.assignmentModule.assignment.getById.useQuery(
      {
        id: initialData?._id!,
      },
      {
        enabled: mode === "edit" && !!initialData?._id,
      },
    );
  const updateMutation =
    trpc.lmsModule.assignmentModule.assignment.update.useMutation({
      onSuccess: (response) => {
        setAssignment(response as any);
        toast({
          title: "Success",
          description: "Assignment status updated successfully",
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
      setAssignment(loadDetailQuery.data);
    }
  }, [loadDetailQuery.data]);
  return (
    <AssignmentContext.Provider
      value={{
        initialData,
        mode,
        assignment,
        loadDetailQuery,
        updateMutation,
      }}
    >
      {children}
    </AssignmentContext.Provider>
  );
}

export function useAssignmentContext() {
  const context = useContext(AssignmentContext);
  if (context === undefined) {
    throw new Error(
      "useAssignmentContext must be used within a AssignmentProvider",
    );
  }
  return context;
}
