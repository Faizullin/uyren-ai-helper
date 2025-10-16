"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { useRouter } from "next/navigation";
import ApiKeysSettings from "./api-keys-settings";
import CustomizationsSettings from "./customizations-settings";
import DomainManagement from "./domain-management";
import GeneralSettings from "./general-settings";
import MailsSettings from "./mails-settings";
import PaymentSettings from "./payment-settings";

interface SettingsProps {
  selectedTab: string;
}

export default function Settings({ selectedTab }: SettingsProps) {
  const selectedTabValue = [
    "General",
    "Payment",
    "Mails",
    "Customizations",
    "API Keys",
    "Domain Management",
  ].includes(selectedTab)
    ? selectedTab
    : "General";
  const router = useRouter();

  const items = [
    "General",
    "Payment",
    "Mails",
    "Customizations",
    "API Keys",
    "Domain Management",
  ];

  return (
    <div>
      <div className="flex justify-between items-baseline">
        <h1 className="text-4xl font-semibold mb-4">
          Settings
        </h1>
      </div>
      <Tabs
        value={selectedTabValue}
        onValueChange={(tab: string) => {
          router.replace(`/dashboard/settings?tab=${tab}`);
        }}
        className="w-full gap-4 md:gap-8"
      >
        <TabsList className="flex flex-wrap gap-2 w-fit h-auto justify-start">
          {items.map((item) => (
            <TabsTrigger key={item} value={item} className="flex-none">
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="General"
          className="flex flex-col gap-8"
        >
          <GeneralSettings />
        </TabsContent>

        <TabsContent
          value="Payment"
          className="flex flex-col gap-8"
        >
          <PaymentSettings />
        </TabsContent>

        <TabsContent value="Mails" className="flex flex-col gap-8">
          <MailsSettings />
        </TabsContent>

        <TabsContent
          value="Customizations"
          className="flex flex-col gap-8"
        >
          <CustomizationsSettings />
        </TabsContent>

        <TabsContent
          value="API Keys"
          className="flex flex-col gap-8"
        >
          <ApiKeysSettings />
        </TabsContent>

        <TabsContent value="Domain Management" className="flex flex-col gap-8">
          <DomainManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
