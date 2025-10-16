import React from "react";

interface DocumentationLinkProps {
  text?: string;
  path: string;
}

export default function DocumentationLink({
  path,
  text = "Documentation",
}: DocumentationLinkProps) {
  return (
    <a
      className="underline"
      target="_blank"
      rel="noopener noreferrer"
      href={`https://docs.courselit.app${path}`}
    >
      {text}
    </a>
  );
}
