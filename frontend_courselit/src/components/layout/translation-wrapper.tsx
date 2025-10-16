"use client";

import i18next from "@/app/i18n/i18next";
import { I18nextProvider } from "react-i18next";

interface TranslationWrapperProps {
  children: React.ReactNode;
}

export default function TranslationWrapper({
  children,
}: TranslationWrapperProps) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
