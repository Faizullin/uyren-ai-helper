import {
  ContentEditor,
  ContentEditorProps,
} from "@workspace/text-editor/tiptap-sh";
import { cn } from "@workspace/ui/lib/utils";
import "./description-editor.scss";

export function DescriptionEditor(props: ContentEditorProps) {
  return (
    <ContentEditor
      className={cn(
        "description-editor-wrapper",
        props.className,
        props.editable ? "" : "readonly",
      )}
      {...props}
    />
  );
}
