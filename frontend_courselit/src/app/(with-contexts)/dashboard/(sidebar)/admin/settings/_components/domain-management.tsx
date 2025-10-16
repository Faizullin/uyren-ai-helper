"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { useSettingsContext } from "./settings-context";

export default function DomainManagement() {
  const { profile } = useProfile();
  const { loadSettingsQuery } = useSettingsContext();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Domain Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage your domain settings and configurations.
        </p>
      </div>

      <div className="p-4 border rounded-md bg-muted">
        <p className="text-sm">
          Domain management features will be implemented here.
        </p>
        {loadSettingsQuery.isLoading && (
          <p className="text-sm text-muted-foreground mt-2">
            Loading domain settings...
          </p>
        )}
      </div>
    </div>
  );
}
