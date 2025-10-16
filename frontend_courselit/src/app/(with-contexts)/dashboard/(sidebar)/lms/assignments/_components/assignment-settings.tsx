"use client";

import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { ComboBox2, useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { Switch } from "@workspace/ui/components/switch";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useAssignmentContext } from "./assignment-context";

const AssignmentSettingsSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  course: z.object(
    {
      key: z.string(),
      title: z.string(),
    },
    { required_error: "Please select a course" },
  ),
  instructions: z.string().optional(),
  totalPoints: z.number().min(1),
  dueDate: z.date().optional(),
  assignmentType: z.enum([
    "essay",
    "project",
    "presentation",
    "file_upload",
    "peer_review",
  ]),
  availableFrom: z.date().optional(),
  allowLateSubmission: z.boolean(),
});

type AssignmentSettingsFormDataType = z.infer<typeof AssignmentSettingsSchema>;
type CourseSelectItemType = {
  key: string;
  title: string;
};

export default function AssignmentSettings() {
  const { assignment, mode } = useAssignmentContext();
  const router = useRouter();
  const { toast } = useToast();
  const trpcUtils = trpc.useUtils();
  const form = useForm<AssignmentSettingsFormDataType>({
    resolver: zodResolver(AssignmentSettingsSchema),
    defaultValues: {
      title: "",
      description: "",
      course: undefined as any,
      instructions: "",
      totalPoints: 100,
      availableFrom: undefined,
      dueDate: undefined,
      assignmentType: "project",
      allowLateSubmission: false,
    },
  });

  const createMutation =
    trpc.lmsModule.assignmentModule.assignment.create.useMutation({
      onSuccess: (response) => {
        toast({
          title: "Success",
          description: "Assignment created successfully",
        });
        router.push(`/dashboard/lms/assignments/${response._id}`);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  const updateMutation =
    trpc.lmsModule.assignmentModule.assignment.update.useMutation({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Assignment updated successfully",
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

  const handleSubmit = useCallback(
    async (data: AssignmentSettingsFormDataType) => {
      const transformedData = {
        ...data,
        courseId: data.course?.key || "", // Extract just the key for API
        course: undefined,
      };

      if (mode === "create") {
        await createMutation.mutateAsync({
          data: transformedData,
        });
      } else if (mode === "edit" && assignment) {
        await updateMutation.mutateAsync({
          id: `${assignment._id}`,
          data: transformedData,
        });
      }
    },
    [mode, assignment, createMutation, updateMutation],
  );
  
  const fetchCourses = useCallback(
    async (search: string) => {
      const response = await trpcUtils.lmsModule.courseModule.course.list.fetch(
        {
          pagination: {
            take: 15,
            skip: 0,
          },
          search: {
            q: search,
          },
        },
      );
      return response.items.map((course) => ({
        key: course.courseId,
        title: course.title,
      }));
    },
    [trpcUtils],
  );

  useEffect(() => {
    if (assignment && mode === "edit") {
      form.reset({
        title: assignment.title || "",
        description: assignment.description || "",
        course: assignment.course
          ? { key: assignment.course.courseId, title: assignment.course.title }
          : undefined,
        instructions: assignment.instructions || "",
        totalPoints: assignment.totalPoints || 100,
        availableFrom: assignment.availableFrom
          ? new Date(assignment.availableFrom)
          : undefined,
        dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined,
        assignmentType: assignment.assignmentType || "project",
        allowLateSubmission: assignment.allowLateSubmission || false,
      });
    }
  }, [assignment, form.reset, mode]);

  const handleCheckProject = useCallback(() => {
    const url = `${process.env.NEXT_PUBLIC_TUTOR_IDE_URL}/projects/init?externalAssignmentId=${assignment?._id}`;
    window.open(url, "_blank");
  }, [assignment?._id]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isSubmitting = form.formState.isSubmitting;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving || isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Assignment Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter assignment title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter assignment description"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Associated Course</FormLabel>
                    <FormControl>
                      <ComboBox2<CourseSelectItemType>
                        title="Select a course"
                        valueKey="key"
                        value={field.value || undefined}
                        searchFn={fetchCourses}
                        renderText={(item) => item.title}
                        onChange={field.onChange}
                        multiple={false}
                        showCreateButton={true}
                        showEditButton={true}
                        onCreateClick={() => {
                          window.open(`/dashboard/products/new`, "_blank");
                        }}
                        onEditClick={(item) => {
                          window.open(
                            `/dashboard/products/${item.key}`,
                            "_blank",
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter detailed instructions for students"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="availableFrom"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Available From</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? new Date(e.target.value)
                                : undefined,
                            )
                          }
                          value={
                            field.value
                              ? new Date(field.value).toISOString().slice(0, 16)
                              : ""
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="datetime-local"
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? new Date(e.target.value)
                                : undefined,
                            )
                          }
                          value={
                            field.value
                              ? new Date(field.value).toISOString().slice(0, 16)
                              : ""
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="assignmentType"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Assignment Type</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select assignment type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="essay">Essay</SelectItem>
                            <SelectItem value="project">Project</SelectItem>
                            <SelectItem value="presentation">Presentation</SelectItem>
                            <SelectItem value="file_upload">File Upload</SelectItem>
                            <SelectItem value="peer_review">Peer Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col">
                  {
                    form.watch("assignmentType") === "project" && (
                      <Button variant="outline" className="w-full" size="sm" onClick={handleCheckProject}>
                        Check Project
                      </Button>
                    )
                  }
                </div>
              </div>
              <FormField
                control={form.control}
                name="allowLateSubmission"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Allow Late Submissions
                      </FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Students can submit after due date
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
