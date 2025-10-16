"use client";

import { Button } from "@workspace/ui/components/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback } from "react";

type HeaderProps = {
  header: {
    title: string;
    subtitle?: string;
  };
  backLink?: boolean;
  rightAction?: ReactNode;
};

const HeaderTopbar = (props: HeaderProps) => {
  const router = useRouter();
  const handleBack = useCallback(() => {
    if (props.backLink) {
      router.back();
    }
  }, [props.backLink]);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {props.backLink && (
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="flex-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {props.header.title}
        </h1>
        {props.header.subtitle && (
          <p className="text-muted-foreground">{props.header.subtitle}</p>
        )}
      </div>
      {props.rightAction}
    </div>
  );
};

export default HeaderTopbar;
