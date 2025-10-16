"use client";

import {
  CommentEditor as CommentEditorTemplate,
  CommentEditorRef,
} from "@workspace/text-editor/tiptap-sh";
import { forwardRef } from "react";
import { TextEditorContent } from "@workspace/common-models";

import "./comment-editor.scss";

export interface CommentEditorFieldProps {
  name: string;
  value?: TextEditorContent;
  onChange: (value: TextEditorContent) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CommentEditorField = forwardRef<
  CommentEditorRef,
  CommentEditorFieldProps
>(({ name, value, onChange, placeholder, className, disabled }, ref) => {
  const handleContentChange = (content: string) => {
    const textEditorContent: TextEditorContent = {
      content,
      type: "doc",
      assets: [],
      widgets: [],
      config: { editorType: "tiptap" },
    };
    onChange(textEditorContent);
  };

  const getInitialContent = () => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.content || "";
  };

  return (
    <CommentEditorTemplate
      onEditor={(
        editor: CommentEditorRef | null,
        meta: { reason: "create" | "destroy" },
      ) => {
        if (ref && typeof ref === "function") {
          ref(editor);
        } else if (ref && typeof ref === "object") {
          (ref as any).current = editor;
        }
      }}
      className={`comment-editor-wrapper ${className || ""}`}
      placeholder={placeholder || "Write a comment..."}
      initialContent={getInitialContent()}
      onChange={handleContentChange}
      editable={!disabled}
    />
  );
});

CommentEditorField.displayName = "CommentEditorField";
