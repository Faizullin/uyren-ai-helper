"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { FormMode } from "@/components/dashboard/layout/types";
import {
  BTN_CONTINUE,
  BUTTON_CANCEL_TEXT,
  BUTTON_NEW_LESSON_TEXT,
  BUTTON_NEW_LESSON_TEXT_DOWNLOAD,
  BUTTON_SAVE,
  COURSE_CONTENT_HEADER,
  EDIT_SECTION_HEADER,
  LESSON_GROUP_DELETED,
  MANAGE_COURSES_PAGE_HEADING,
  NEW_SECTION_HEADER,
  TOAST_TITLE_ERROR,
  TOAST_TITLE_SUCCESS,
} from "@/lib/ui/config/strings";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import {
  Constants,
  DripType,
  Group,
  LessonType,
} from "@workspace/common-models";
import {
  DeleteConfirmNiceDialog,
  DragAndDrop,
  NiceModal,
  useToast,
} from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { truncate } from "@workspace/utils";
import {
  ChevronDown,
  ChevronRight,
  Droplets,
  Edit,
  Eye,
  FileText,
  HelpCircle,
  MoreHorizontal,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ProductType =
  GeneralRouterOutputs["lmsModule"]["courseModule"]["course"]["getByCourseDetailed"];

interface SectionFormData {
  name: string;
  rank: number;
  collapsed: boolean;
}

export default function ContentPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Record<
    string,
    string
  > | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [hoveredSectionIndex, setHoveredSectionIndex] = useState<number | null>(
    null,
  );
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionDialogMode, setSectionDialogMode] = useState<FormMode>(
    "create",
  );
  const [editingSection, setEditingSection] = useState<Group | null>(null);
  const [sectionFormData, setSectionFormData] = useState<SectionFormData>({
    name: "",
    rank: 0,
    collapsed: false,
  });
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>(
    {},
  );
  const [savingSection, setSavingSection] = useState(false);

  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { data: product } =
    trpc.lmsModule.courseModule.course.getByCourseDetailed.useQuery({
      courseId: productId,
    });
  const breadcrumbs = useMemo(() => {
    return [
      { label: MANAGE_COURSES_PAGE_HEADING, href: "/dashboard/products" },
      {
        label: product ? truncate(product.title || "", 20) || "..." : "...",
        href: `/dashboard/products/${productId}`,
      },
      { label: COURSE_CONTENT_HEADER, href: "#" },
    ];
  }, [product]);
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    await removeGroup(itemToDelete?.id!, product?.courseId!);
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  const openSectionDialog = (mode: FormMode, section?: Group) => {
    setSectionDialogMode(mode);
    if (mode === "edit" && section) {
      setEditingSection(section);
      setSectionFormData({
        name: section.name,
        rank: section.rank || 0,
        collapsed: section.collapsed || false,
      });
    } else {
      setEditingSection(null);
      setSectionFormData({
        name: "",
        rank: product?.groups?.length || 0,
        collapsed: false,
      });
    }
    setSectionErrors({});
    setSectionDialogOpen(true);
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!sectionFormData.name.trim()) {
      newErrors.name = "Section name is required";
    }

    setSectionErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        setSavingSection(true);
        if (sectionDialogMode === "create") {
          await addGroupMutation.mutateAsync({
            data: {
              courseId: product!.courseId,
              name: sectionFormData.name,
              collapsed: sectionFormData.collapsed,
            },
          });
        } else {
          await updateGroupMutation.mutateAsync({
            data: {
              groupId: editingSection!.groupId,
              courseId: product!.courseId,
              name: sectionFormData.name,
              rank: sectionFormData.rank,
              collapsed: sectionFormData.collapsed,
            },
          });
        }
      } catch (error) {
        // Error handling is done in the mutation
      } finally {
        setSavingSection(false);
      }
    }
  };

  const updateGroupMutation =
    trpc.lmsModule.courseModule.course.updateGroup.useMutation({
      onSuccess: () => {
        toast({
          title: TOAST_TITLE_SUCCESS,
          description: "Section updated successfully",
        });
        setSectionDialogOpen(false);
        trpcUtils.lmsModule.courseModule.course.getByCourseDetailed.invalidate();
      },
      onError: (error) => {
        toast({
          title: TOAST_TITLE_ERROR,
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const removeGroupMutation =
    trpc.lmsModule.courseModule.course.removeGroup.useMutation({
      onSuccess: () => {
        toast({
          title: TOAST_TITLE_SUCCESS,
          description: LESSON_GROUP_DELETED,
        });
      },
      onError: (error) => {
        toast({
          title: TOAST_TITLE_ERROR,
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const addGroupMutation =
    trpc.lmsModule.courseModule.course.addCourseChapter.useMutation({
      onSuccess: () => {
        toast({
          title: TOAST_TITLE_SUCCESS,
          description: "Section created successfully",
        });
        setSectionDialogOpen(false);
        trpcUtils.lmsModule.courseModule.course.getByCourseDetailed.invalidate();
      },
      onError: (error) => {
        toast({
          title: TOAST_TITLE_ERROR,
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const updateGroup = async (group: Group, lessonsOrder: string[]) => {
    const updated = await updateGroupMutation.mutateAsync({
      data: {
        groupId: group.groupId,
        courseId: product!.courseId,
        lessonsOrder,
      },
    });
  };
  const trpcUtils = trpc.useUtils();

  const removeGroup = async (groupId: string, courseId: string) => {
    await removeGroupMutation.mutateAsync({
      groupId: groupId,
      courseId: courseId,
    });
    trpcUtils.lmsModule.courseModule.course.getByCourseDetailed.invalidate();
  };

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <h1 className="text-4xl font-semibold tracking-tight mb-8">Content</h1>

      <ScrollArea className="h-[calc(100vh-180px)]">
        {product?.groups!.map((section, index) => (
          <div
            key={section.groupId}
            className="mb-6 relative"
            onMouseEnter={() => setHoveredSectionIndex(index)}
            onMouseLeave={() => setHoveredSectionIndex(null)}
          >
            <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSectionCollapse(section.groupId)}
                  className="p-0 hover:bg-transparent"
                >
                  {collapsedSections.includes(section.groupId) ? (
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </Button>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {section.name}
                  </h2>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-gray-100"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => openSectionDialog("edit", section)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {EDIT_SECTION_HEADER}
                  </DropdownMenuItem>
                  {!(
                    product?.type?.toLowerCase() ===
                      Constants.CourseType.DOWNLOAD &&
                    product?.groups?.length === 1
                  ) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setItemToDelete({
                            type: "section",
                            title: section.name,
                            id: section.groupId,
                          });
                          setDeleteDialogOpen(true);
                        }}
                        className="text-red-600"
                      >
                        Delete Section
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {!collapsedSections.includes(section.groupId) && (
              <CollapsibleSection
                section={section}
                product={product!}
                onUpdateGroup={updateGroup}
              />
            )}
            {hoveredSectionIndex === index && (
              <div
                className="absolute left-0 -ml-8 top-1/2 transform -translate-y-1/2"
                style={{
                  opacity: hoveredSectionIndex === index ? 1 : 0,
                  transition: "opacity 0.2s",
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full p-1 hover:bg-gray-100"
                  onClick={() => openSectionDialog("create")}
                >
                  <Plus className="h-5 w-5 text-gray-500" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {product?.type?.toLowerCase() !== Constants.CourseType.DOWNLOAD && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              className="text-sm font-medium"
              onClick={() => openSectionDialog("create")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {sectionDialogMode === "create"
                ? NEW_SECTION_HEADER
                : EDIT_SECTION_HEADER}
            </DialogTitle>
            <DialogDescription>
              {sectionDialogMode === "create"
                ? "Add a new section to your course"
                : "Edit section settings and content release schedule"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSectionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sectionName">Section Name</Label>
              <Input
                id="sectionName"
                placeholder="Enter section name"
                value={sectionFormData.name}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                className={sectionErrors.name ? "border-red-500" : ""}
              />
              {sectionErrors.name && (
                <p className="text-sm text-red-500">{sectionErrors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sectionRank">Rank</Label>
                <Input
                  id="sectionRank"
                  type="number"
                  min="0"
                  value={sectionFormData.rank}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      rank: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sectionCollapsed">Collapsed</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sectionCollapsed"
                    checked={sectionFormData.collapsed}
                    onCheckedChange={(checked) =>
                      setSectionFormData((prev) => ({
                        ...prev,
                        collapsed: checked,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {sectionFormData.collapsed ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-drip">Scheduled Release</Label>
                  <p className="text-sm text-muted-foreground">
                    Release content gradually to your students
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSectionDialogOpen(false)}
                disabled={savingSection}
              >
                {BUTTON_CANCEL_TEXT}
              </Button>
              <Button
                type="submit"
                disabled={!sectionFormData.name.trim() || savingSection}
              >
                {savingSection
                  ? "Saving..."
                  : sectionDialogMode === "create"
                    ? BTN_CONTINUE
                    : BUTTON_SAVE}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete the {itemToDelete?.type} &quot;
              {itemToDelete?.title}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardContent>
  );
}

const CollapsibleSection = ({
  section,
  product,
  onUpdateGroup,
}: {
  section: Group;
  product: ProductType;
  onUpdateGroup: (group: Group, lessonsOrder: string[]) => void;
}) => {
  const router = useRouter();
  const { toast } = useToast();

  const LessonTypeIcon = ({ type }: { type: LessonType }) => {
    switch (type) {
      case Constants.LessonType.VIDEO:
        return <Video className="h-4 w-4" />;
      case Constants.LessonType.TEXT:
        return <FileText className="h-4 w-4" />;
      case Constants.LessonType.QUIZ:
        return <HelpCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const dndItems = useMemo(() => {
    return product
      ?.attachedLessons!.filter((lesson) => lesson.groupId === section.groupId)
      .sort(
        (a, b) =>
          section.lessonsOrder?.indexOf(a.lessonId) -
          section.lessonsOrder?.indexOf(b.lessonId),
      )
      .map((lesson) => ({
        id: lesson.lessonId,
        courseId: product?.courseId,
        groupId: lesson.groupId,
        lesson,
      }));
  }, [product, section]);

  const removeLessonMutation =
    trpc.lmsModule.courseModule.lesson.delete.useMutation({
      onSuccess: () => {
        toast({
          title: TOAST_TITLE_SUCCESS,
          description: "Lesson deleted successfully",
        });
      },
    });

  const trpcUtils = trpc.useUtils();

  const handleDeleteLesson = async (
    item: ProductType["attachedLessons"][number],
  ) => {
    const response = await NiceModal.show(DeleteConfirmNiceDialog, {
      title: "Delete Lesson",
      message:
        "Are you sure you want to delete this lesson? This action cannot be undone.",
    });
    if (response.reason === "confirm") {
      await removeLessonMutation.mutateAsync({
        lessonId: item.lessonId,
      });
      trpcUtils.lmsModule.courseModule.course.getByCourseDetailed.invalidate();
    }
  };

  return (
    <div className="space-y-2 ml-8">
      <DragAndDrop
        items={dndItems}
        Renderer={({ lesson }) => (
          <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 ease-in-out w-full">
            <div className="flex items-center space-x-3">
              <LessonTypeIcon type={lesson.type} />
              <span className="text-sm font-medium">{lesson.title}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700" onClick={(e) => {
                e.stopPropagation();
                window.open(`/courses/${product.courseId}/lessons/${lesson.lessonId}`, "_blank");
              }}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(
                    `/dashboard/products/${product.courseId}/content/section/${section.groupId}/lesson?id=${lesson.lessonId}`,
                  );
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                color="destructive"
                size="sm"
                onClick={() => handleDeleteLesson(lesson)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        onChange={(items: any) => {
          const newLessonsOrder: any = items.map(
            (item: { lesson: { lessonId: any } }) => item.lesson.lessonId,
          );
          onUpdateGroup(section, newLessonsOrder);
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        asChild
      >
        <Link
          href={`/dashboard/products/${product.courseId}/content/section/${section.groupId}/lesson`}
        >
          <Plus className="mr-2 h-4 w-4" />
          {product?.type === Constants.CourseType.DOWNLOAD
            ? BUTTON_NEW_LESSON_TEXT_DOWNLOAD
            : BUTTON_NEW_LESSON_TEXT}
        </Link>
      </Button>
    </div>
  );
};
