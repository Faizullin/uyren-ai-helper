import { trpc } from "@/utils/trpc";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ComboBox2,
  NiceModal,
  NiceModalHocProps,
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
import { Edit } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface AssignmentLinkAttrs {
  label: string;
  obj: {
    type: "quiz" | "assignment";
    id: string;
    title: string;
  } | null;
  link?: string;
}

export function AssignmentLinkNodeComponent({
  node,
  updateAttributes,
  editor,
}: NodeViewProps & {
  updateAttributes: (attrs: Partial<AssignmentLinkAttrs>) => void;
}) {
  const { label, obj, link } = node.attrs as AssignmentLinkAttrs;

  const handleSelectDialog = useCallback(() => {
    NiceModal.show(AssignmentSelectNiceDialog, {
      args: {
        obj: obj || null,
      },
    }).then((response) => {
      if (response.reason === "submit" && response.data) {
        const selectedItem = response.data as SelectItemType;
        let link = "";
        if (selectedItem.type === "assignment") {
          link = `/assignments/${selectedItem.key}`;
        } else if (selectedItem.type === "quiz") {
          link = `/quiz/${selectedItem.key}`;
        }
        updateAttributes({
          obj: {
            type: selectedItem.type,
            id: selectedItem.key,
            title: selectedItem.title,
          },
          label: `${selectedItem.title} (${selectedItem.type})`,
          link: link,
        });
      }
    });
  }, [updateAttributes]);
  const acutalLink = useMemo(() => {
    if (!obj) return "#";
    else if (obj.type === "assignment") {
      return `/assignments/${obj.id}`;
    } else if (obj.type === "quiz") {
      return `/quiz/${obj.id}`;
    }
    return `#unknown-type=${obj.type}`;
  }, [obj]);
  return (
    <NodeViewWrapper
      as="div"
      className="entity-card border rounded p-3 bg-white shadow"
    >
      <div className="flex items-center justify-between">
        <Link href={acutalLink} target="_blank">
          {label}
        </Link>
        {editor.isEditable ? (
          <Button
            type="button"
            onClick={handleSelectDialog}
            variant="ghost"
            size="icon"
          >
            <Edit />
          </Button>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

type SelectItemType = {
  key: string;
  title: string;
  type: "quiz" | "assignment";
};

const AssignmentSelectNiceDialog = NiceModal.create<
  NiceModalHocProps & { args: { obj: AssignmentLinkAttrs["obj"] | null } },
  { reason: "cancel"; data: null } | { reason: "submit"; data: any }
>(({ args }) => {
  const { visible, hide, resolve } = NiceModal.useModal();

  const handleClose = () => {
    resolve({ reason: "cancel", data: null });
    hide();
  };

  const [selectedOptions, setSelectedOptions] = useState<SelectItemType | null>(
    null,
  );
  const updateTags = (options: SelectItemType) => {
    setSelectedOptions(options);
  };
  const trpcUtils = trpc.useUtils();
  const getAssignments = useCallback(async (search: string) => {
    const response =
      await trpcUtils.lmsModule.courseModule.lesson.searchAssignmentEntities.fetch(
        {
          search: search,
        },
      );
    const data: SelectItemType[] = [];
    response.assignments.forEach((assignment) => {
      data.push({
        key: assignment._id.toString(),
        title: assignment.title,
        type: "assignment",
      });
    });
    response.quizzes.forEach((quiz) => {
      data.push({
        key: quiz._id.toString(),
        title: quiz.title,
        type: "quiz",
      });
    });
    return data;
  }, []);

  const handleSubmit = useCallback(() => {
    resolve({ reason: "submit", data: selectedOptions });
    hide();
  }, [selectedOptions, resolve, hide]);

  useEffect(() => {
    setSelectedOptions(
      args.obj
        ? {
          key: args.obj.id,
          title: args.obj.title,
          type: args.obj.type,
        }
        : null,
    );
  }, [args.obj]);

  return (
    <Dialog
      open={visible}
      onOpenChange={(v) => {
        if (!v) {
          handleClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Assignment</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <ComboBox2<SelectItemType>
            title="Assignment"
            valueKey="key"
            value={selectedOptions || undefined}
            searchFn={getAssignments}
            renderText={(book) => `${book.title}`}
            onChange={updateTags}
            multiple={false}
            showCreateButton={true}
            showEditButton={true}
            onCreateClick={() => {
              // Navigate to assignment creation page
              window.open("/dashboard/lms/assignments/new", "_blank");
            }}
            onEditClick={(item) => {
              // Navigate to assignment/quiz edit page based on type
              if (item.type === "assignment") {
                window.open(`/dashboard/lms/assignments/${item.key}`, "_blank");
              } else if (item.type === "quiz") {
                window.open(`/dashboard/lms/quizzes/${item.key}`, "_blank");
              }
            }}
          />
        </DialogDescription>
        <DialogFooter>
          <Button onClick={handleSubmit} variant="default">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
