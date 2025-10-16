import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  AssignmentLinkAttrs,
  AssignmentLinkNodeComponent,
} from "./assignment-link-node-component";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    assignmentLink: {
      insertAssignmentLink: (attrs: AssignmentLinkAttrs) => ReturnType;
    };
  }
}

export const AssignmentLinkNodeExtension = Node.create({
  name: "assignmentLink",
  group: "block",
  atom: true, // self-contained

  addAttributes() {
    return {
      label: {
        default: "Assignment",
      },
      obj: {
        default: null,
      },
      link: {
        default: "#",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "assignment-link",
        getAttrs: (node) => {
          if (typeof node === "string") return {};
          const element = node as HTMLElement;
          try {
            const label = element.getAttribute("data-label") || "Assignment";
            const objRaw = element.getAttribute("data-obj");
            const link = element.getAttribute("data-link") || "#";

            let obj = {
              type: "assignment" as const,
              id: "",
              title: "Sample Assignment",
            };

            if (objRaw && objRaw !== "null") {
              try {
                obj = JSON.parse(objRaw);
              } catch (err) {
                console.error("Invalid obj JSON:", objRaw, err);
              }
            }

            const result = { label, obj, link };
            return result;
          } catch (err) {
            console.error("Failed to parse assignment-link attributes:", err);
            return {};
          }
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { label, obj, link } = HTMLAttributes;
    const safeObj =
      obj && typeof obj === "object" ? JSON.stringify(obj) : "null";

    return [
      "assignment-link",
      mergeAttributes({
        "data-label": label || "Assignment",
        "data-obj": safeObj,
        "data-link": link || "#",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AssignmentLinkNodeComponent as any);
  },

  addCommands() {
    return {
      insertAssignmentLink:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "assignmentLink",
            attrs,
          });
        },
    };
  },
});
