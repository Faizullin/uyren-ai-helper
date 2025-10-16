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
import { Link, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useQuizContext } from "./quiz-context";

const QuizSettingsSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  course: z.object(
    {
      key: z.string(),
      title: z.string(),
    },
    { required_error: "Please select a course" },
  ),
  timeLimit: z.number().min(1).optional(),
  maxAttempts: z.number().min(1).max(10),
  passingScore: z.number().min(0).max(100),
  shuffleQuestions: z.boolean(),
  showResults: z.boolean(),
  totalPoints: z.number().min(1),
});

type QuizSettingsFormDataType = z.infer<typeof QuizSettingsSchema>;
type CourseSelectItemType = {
  key: string;
  title: string;
};

export default function QuizSettings() {
  const { quiz, mode } = useQuizContext();

  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<QuizSettingsFormDataType>({
    resolver: zodResolver(QuizSettingsSchema),
    defaultValues: {
      title: "",
      description: "",
      course: undefined as any,
      timeLimit: 30,
      passingScore: 70,
      maxAttempts: 3,
      shuffleQuestions: true,
      showResults: false,
      totalPoints: 0,
    },
  });

  const createMutation = trpc.lmsModule.quizModule.quiz.create.useMutation({
    onSuccess: (response) => {
      toast({
        title: "Success",
        description: "Quiz created successfully",
      });
      router.push(`/dashboard/lms/quizzes/${response._id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const updateMutation = trpc.lmsModule.quizModule.quiz.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Quiz updated successfully",
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
    async (data: QuizSettingsFormDataType) => {
      // Transform the data to match the API expectations
      const transformedData = {
        ...data,
        courseId: data.course?.key || "", // Extract just the key for API
        course: undefined,
      };
      if (mode === "create") {
        await createMutation.mutateAsync({
          data: transformedData,
        });
      } else if (mode === "edit" && quiz) {
        await updateMutation.mutateAsync({
          id: quiz._id,
          data: transformedData,
        });
      }
    },
    [mode],
  );

  useEffect(() => {
    if (quiz && mode === "edit") {
      form.reset({
        title: quiz.title || "",
        description: quiz.description || "",
        course: quiz.course
          ? {
            key: quiz.course._id,
            title: quiz.course.title
          }
          : undefined,
        timeLimit: quiz.timeLimit || 30,
        passingScore: quiz.passingScore || 70,
        maxAttempts: quiz.maxAttempts || 3,
        shuffleQuestions: quiz.shuffleQuestions ?? true,
        showResults: quiz.showResults ?? false,
        totalPoints: quiz.totalPoints || 0,
      });
    }
  }, [quiz, form.reset]);

  const trpcUtils = trpc.useUtils();
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
        key: course._id,
        title: course.title,
      }));
    },
    [trpcUtils],
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isSubmitting = form.formState.isSubmitting;

  const handleCopyLink = useCallback(async () => {
    if (!quiz?._id) return;

    const quizUrl = `${window.location.origin}/quiz/${quiz._id}`;

    try {
      await navigator.clipboard.writeText(quizUrl);
      toast({
        title: "Link Copied",
        description: "Quiz link copied to clipboard",
      });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = quizUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      toast({
        title: "Link Copied",
        description: "Quiz link copied to clipboard",
      });
    }
  }, [quiz?._id, toast]);

  return (
    <div className="space-y-6">
      {/* NEW FORM IMPLEMENTATION WITH Form COMPONENTS */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={mode === "create" || !quiz?._id}
              onClick={handleCopyLink}
              className="flex items-center gap-2"
            >
              <Link className="h-4 w-4" />
              Copy Link
            </Button>
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
                      <FormLabel>Quiz Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter quiz title" />
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
                          placeholder="Enter quiz description"
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
                      <FormLabel>Course</FormLabel>
                      <FormControl>
                        <ComboBox2<CourseSelectItemType>
                          title="Select a course"
                          valueKey="key"
                          value={field.value || undefined}
                          searchFn={fetchCourses}
                          renderLabel={(item) => item.title}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quiz Configuration (New Form)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="timeLimit"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Time Limit (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="passingScore"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Passing Score (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxAttempts"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Max Attempts</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(parseInt(value))
                          }
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 Attempt</SelectItem>
                            <SelectItem value="2">2 Attempts</SelectItem>
                            <SelectItem value="3">3 Attempts</SelectItem>
                            <SelectItem value="-1">Unlimited</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalPoints"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Total Points</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 0)
                            }
                          // readOnly
                          // className="bg-muted"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
