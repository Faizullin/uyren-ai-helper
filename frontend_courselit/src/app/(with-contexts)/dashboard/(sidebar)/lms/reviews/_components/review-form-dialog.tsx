"use client";

import { FormMode } from "@/components/dashboard/layout/types";
import { useProfile } from "@/components/contexts/profile-context";
import { CommentEditorField } from "@/components/editors/tiptap/templates/comment/comment-editor";
import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { UIConstants } from "@workspace/common-models";
import {
  ComboBox2,
  NiceModal,
  NiceModalHocProps,
  useToast,
} from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { checkPermission } from "@workspace/utils";
import { Loader2, Star } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const { permissions } = UIConstants;

const reviewSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.any().optional(),
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(10, "Rating cannot exceed 10"),
  targetType: z.enum(["website", "course", "product", "blog"]),
  targetId: z.string().optional(),
  published: z.boolean(),
  isFeatured: z.boolean(),
  tags: z.string().optional(),
  authorId: z.string().nullable().optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormDialogProps extends NiceModalHocProps {
  mode: FormMode;
  reviewId?: string;
  initialData?: Partial<ReviewFormData>;
}

type UserSelectItemType = {
  key: string;
  title: string;
  email: string;
};

export const ReviewFormDialog = NiceModal.create<
  ReviewFormDialogProps,
  { reason: "cancel"; data: null } | { reason: "submit"; data: ReviewFormData }
>(({ mode, reviewId, initialData }) => {
  const { visible, hide, resolve } = NiceModal.useModal();
  const { toast } = useToast();
  const { profile } = useProfile();
  const trpcUtils = trpc.useUtils();

  const canManageSite = checkPermission(profile.permissions!, [
    permissions.manageSite,
  ]);

  const createReviewMutation =
    trpc.lmsModule.reviewModule.review.create.useMutation({
      onSuccess: () => {
        toast({ title: "Success", description: "Review created successfully" });
        resolve({ reason: "submit", data: form.getValues() });
        hide();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const updateReviewMutation =
    trpc.lmsModule.reviewModule.review.update.useMutation({
      onSuccess: () => {
        toast({ title: "Success", description: "Review updated successfully" });
        resolve({ reason: "submit", data: form.getValues() });
        hide();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const loadExistingReviewQuery =
    trpc.lmsModule.reviewModule.review.getByReviewId.useQuery(
      { reviewId: reviewId! },
      { enabled: mode === "edit" && !!reviewId },
    );

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      title: "",
      content: {
        content: "",
        type: "doc",
        assets: [],
        widgets: [],
        config: { editorType: "tiptap" },
      },
      rating: 5,
      targetType: "website",
      targetId: "",
      published: false,
      isFeatured: false,
      tags: "",
      authorId: null,
    },
  });

  useEffect(() => {
    const existingReview = loadExistingReviewQuery.data;
    if (existingReview && mode === "edit") {
      form.reset({
        title: existingReview.title,
        content: existingReview.content || {
          content: "",
          type: "doc",
          assets: [],
          widgets: [],
          config: { editorType: "tiptap" },
        },
        rating: existingReview.rating,
        targetType: existingReview.targetType as any,
        targetId: existingReview.targetId || "",
        published: existingReview.published,
        isFeatured: existingReview.isFeatured,
        tags: existingReview.tags?.join(", ") || "",
        authorId: existingReview.authorId || null,
      });
    }
  }, [form, mode, loadExistingReviewQuery.data]);

  const onSubmit = (data: ReviewFormData) => {
    const tags = data.tags
      ? data.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    // Clean up authorId - if empty string, set to null
    const cleanData = {
      ...data,
      authorId:
        data.authorId && data.authorId.trim() !== "" ? data.authorId : null,
      tags,
    };

    if (mode === "create") {
      createReviewMutation.mutate({
        data: cleanData,
      } as any);
    } else if (mode === "edit" && reviewId) {
      updateReviewMutation.mutate({
        data: {
          reviewId,
          ...cleanData,
        },
      });
    }
  };

  const handleCancel = () => {
    resolve({ reason: "cancel", data: null });
    hide();
  };

  const isLoading =
    createReviewMutation.isPending || updateReviewMutation.isPending;

  // Function to fetch users for ComboBox2
  const fetchUsers = async (search: string) => {
    try {
      const result = await trpcUtils.userModule.user.list.fetch({
        pagination: { take: 15 },
        search: { q: search || undefined },
      });

      return result.items.map((user) => ({
        key: user.userId,
        title: user.name || user.email,
        email: user.email,
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <ScrollArea className="w-full h-full px-3">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {mode === "create" ? "Create New Review" : "Edit Review"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new customer review or testimonial"
                : "Update review details"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1"
            >
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 border-t border-b border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter review title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rating</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) =>
                                field.onChange(parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                  (rating) => (
                                    <SelectItem
                                      key={rating}
                                      value={rating.toString()}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                        {rating}/10
                                      </div>
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {canManageSite && (
                  <FormField
                    control={form.control}
                    name="authorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link to User (Optional)</FormLabel>
                        <FormControl>
                          <ComboBox2<UserSelectItemType>
                            title="Select a user"
                            valueKey="key"
                            value={
                              field.value
                                ? { key: field.value, title: "", email: "" }
                                : undefined
                            }
                            searchFn={fetchUsers}
                            renderText={(item) =>
                              `${item.title} (${item.email})`
                            }
                            onChange={(item) =>
                              field.onChange(item?.key || null)
                            }
                            multiple={false}
                            showCreateButton={false}
                            showEditButton={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="targetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select target type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="website">Website</SelectItem>
                            <SelectItem value="course">Course</SelectItem>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="blog">Blog</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter target ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Review Content</FormLabel>
                      <FormControl>
                        <CommentEditorField
                          name={field.name}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Enter review content..."
                          className="min-h-[120px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter tags separated by commas"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-6">
                  <FormField
                    control={form.control}
                    name="published"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </FormControl>
                        <FormLabel>Published</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </FormControl>
                        <FormLabel>Featured</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {mode === "create" ? "Creating..." : "Updating..."}
                    </>
                  ) : mode === "create" ? (
                    "Create Review"
                  ) : (
                    "Update Review"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});
