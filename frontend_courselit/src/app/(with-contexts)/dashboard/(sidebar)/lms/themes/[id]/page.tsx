"use client";

import { useParams } from "next/navigation";
import ThemeClientWrapper from "../_components/theme-client-wrapper";


export default function ThemePage() {
  const initialMode = "edit";
  const initialItemId = useParams<{
    id: string;
  }>().id;
  return (
    <ThemeClientWrapper
      initialMode={initialMode}
      initialItemId={initialItemId}
    />
  );
}
