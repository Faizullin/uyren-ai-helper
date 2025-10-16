import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { CohortStatusEnum } from "@workspace/common-logic/models/lms/cohort.types";
import {
    ComboBox2,
    FormDialog,
    useDialogControl,
    useToast
} from "@workspace/components-library";
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
import { slugify } from "@workspace/utils";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const CohortSchema = z.object({
    title: z
        .string()
        .min(1, "Title is required")
        .max(255, "Title must be less than 255 characters"),
    courseId: z.string().min(1, "Course is required"),
    description: z.string().optional(),
    inviteCode: z
        .string()
        .min(6, "Invite code must be at least 6 characters")
        .max(50, "Invite code must be less than 50 characters"),
    status: z.nativeEnum(CohortStatusEnum),
});
type CohortFormDataType = z.infer<typeof CohortSchema>;


type CourseItem = {
    _id: string;
    title: string;
};

export function CohortCreateDialog(props: {
    control: ReturnType<typeof useDialogControl>;
}) {
    const { t } = useTranslation(["dashboard", "common"]);
    const { toast } = useToast();
    const router = useRouter();
    const trpcUtils = trpc.useUtils();

    const form = useForm<CohortFormDataType>({
        resolver: zodResolver(CohortSchema),
        defaultValues: {
            title: "",
            courseId: "",
            description: "",
            inviteCode: "",
            status: CohortStatusEnum.UPCOMING,
        },
    });

    const createCohortMutation =
        trpc.lmsModule.cohortModule.cohort.create.useMutation({
            onSuccess: (response) => {
                toast({
                    title: t("common:dashboard.success"),
                    description: "Cohort created successfully",
                });
                props.control.hide();
                trpcUtils.lmsModule.cohortModule.cohort.list.invalidate();
            },
            onError: (err: any) => {
                toast({
                    title: t("common:dashboard.error"),
                    description: err.message,
                    variant: "destructive",
                });
            },
        });

    const handleSubmit = async (data: CohortFormDataType) => {
        const slug = slugify(data.title);
        await createCohortMutation.mutateAsync({
            data: {
                title: data.title,
                slug: slug,
                courseId: data.courseId,
                description: data.description,
                inviteCode: data.inviteCode,
                status: data.status,
            },
        })
    };

    const searchCourses = async (search: string, offset: number, size: number): Promise<CourseItem[]> => {
        const result = await trpcUtils.lmsModule.courseModule.course.list.fetch({
            pagination: { skip: offset, take: size },
            search: search ? { q: search } : undefined,
        });
        return result.items.map(course => ({ _id: course._id, title: course.title }));
    };

    const isSubmitting = form.formState.isSubmitting;
    const isSaving = createCohortMutation.isPending;

    return (
        <FormDialog
            open={props.control.isVisible}
            onOpenChange={(open) => {
                if (!open) {
                    props.control.hide();
                    form.reset({
                        title: "",
                        courseId: "",
                        description: "",
                        inviteCode: "",
                        status: CohortStatusEnum.UPCOMING,
                    });
                }
            }}
            title="Create New Cohort"
            description="Create a new cohort for a course"
            onSubmit={form.handleSubmit(handleSubmit)}
            onCancel={props.control.hide}
            isLoading={isSaving || isSubmitting}
            submitText="Create Cohort"
            cancelText={t("common:dashboard.cancel")}
            maxWidth="xl"
        >
            <Form {...form}>
                <div className="space-y-4 min-h-[300px]">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cohort Title</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g., Spring 2024 Cohort" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="courseId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Course</FormLabel>
                                <FormControl>
                                    <ComboBox2<CourseItem>
                                        title="Select course"
                                        valueKey="_id"
                                        value={field.value ? { _id: field.value, title: "" } : undefined}
                                        searchFn={searchCourses}
                                        renderLabel={(item) => item.title}
                                        onChange={(item) => field.onChange(item?._id || "")}
                                        multiple={false}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="inviteCode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Invite Code</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g., SPRING2024" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <FormControl>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CohortStatusEnum).map(([key, value]) => (
                                                <SelectItem key={key} value={value}>{value}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea {...field} placeholder="Add a description for this cohort..." rows={3} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </Form>
        </FormDialog>
    );
} 