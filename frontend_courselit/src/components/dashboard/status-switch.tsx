"use client";

import { useState, useEffect } from "react";
import { Switch } from "@workspace/ui/components/switch";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

type StatusType = "draft" | "published";

interface StatusSwitchProps {
  status: StatusType;
  onStatusChange: (status: StatusType) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function StatusSwitch({
  status,
  onStatusChange,
  disabled = false,
  className,
  showLabel = true,
}: StatusSwitchProps) {
  const [isChecked, setIsChecked] = useState(status === "published");

  useEffect(() => {
    setIsChecked(status === "published");
  }, [status]);

  const handleToggle = (checked: boolean) => {
    const newStatus: StatusType = checked ? "published" : "draft";
    setIsChecked(checked);
    onStatusChange(newStatus);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <Badge
          variant={status === "published" ? "default" : "secondary"}
          className={cn(
            "text-xs font-medium",
            status === "published"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {status === "published" ? "Published" : "Draft"}
        </Badge>
      )}
      <Switch
        checked={isChecked}
        onCheckedChange={handleToggle}
        disabled={disabled}
        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary"
      />
    </div>
  );
}

// Compact version for table cells
export function StatusSwitchCompact({
  status,
  onStatusChange,
  disabled = false,
}: Omit<StatusSwitchProps, "showLabel" | "className">) {
  return (
    <StatusSwitch
      status={status}
      onStatusChange={onStatusChange}
      disabled={disabled}
      showLabel={false}
      className="justify-end"
    />
  );
}
