"use client";

import ThemeClientWrapper from "../_components/theme-client-wrapper";


export default function ThemePage() {
  const initialMode = "create";
  return (
    <ThemeClientWrapper
      initialMode={initialMode}
      initialItemId={null}
    />
  );
}
