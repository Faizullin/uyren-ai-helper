"use client";

import React from "react";
import MainPageSettings from "./main-page-settings";

export default function WebsiteSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Website Configuration</h2>
        <p className="text-muted-foreground">
          Configure your website appearance and main page settings.
        </p>
      </div>
      <MainPageSettings />
    </div>
  );
}
