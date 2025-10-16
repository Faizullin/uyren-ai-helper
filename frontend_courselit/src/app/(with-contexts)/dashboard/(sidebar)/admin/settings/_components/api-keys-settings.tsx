"use client";

import Resources from "@/components/resources";
import {
  APIKEY_EXISTING_HEADER,
  APIKEY_EXISTING_TABLE_HEADER_CREATED,
  APIKEY_EXISTING_TABLE_HEADER_NAME,
  APIKEY_NEW_BUTTON,
  APIKEY_REMOVE_BTN,
  APIKEY_REMOVE_DIALOG_HEADER,
  APIKYE_REMOVE_DIALOG_DESC,
  SETTINGS_RESOURCE_API,
  TOAST_TITLE_ERROR,
  TOAST_TITLE_SUCCESS,
} from "@/lib/ui/config/strings";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { DeleteConfirmNiceDialog, NiceModal, useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import NewApiKeyDialog from "./new-api-key-dialog";
import { useSettingsContext } from "./settings-context";
import { Trash2 } from "lucide-react";

type ApiKeyType =
  GeneralRouterOutputs["siteModule"]["siteInfo"]["listApiKeys"][number] & {
    createdAt: string;
  };

export default function ApiKeysSettings() {
  const { loadSettingsQuery } = useSettingsContext();
  const { toast } = useToast();

  const loadApiKeysQuery = trpc.siteModule.siteInfo.listApiKeys.useQuery();
  const removeApiKeyMutation =
    trpc.siteModule.siteInfo.removeApiKey.useMutation({
      onSuccess: () => {
        toast({
          title: TOAST_TITLE_SUCCESS,
          description: "API key removed successfully",
        });
        loadApiKeysQuery.refetch();
      },
      onError: (error: any) => {
        toast({
          title: TOAST_TITLE_ERROR,
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const handleDelete = (obj: ApiKeyType) => {
    NiceModal.show(DeleteConfirmNiceDialog, {
      title: "Delete API Key",
      data: obj,
    }).then((result) => {
      if (result.reason === "confirm") {
        removeApiKeyMutation.mutateAsync({
          data: {
            keyId: obj.keyId,
          },
        });
      }
    });
  };

  const isRemoving = removeApiKeyMutation.isPending;
  const isLoading = loadSettingsQuery.isLoading;
  const isDisabled = isLoading || isRemoving;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{APIKEY_EXISTING_HEADER}</h2>
        <NewApiKeyDialog>
          <Button disabled={isDisabled}>{APIKEY_NEW_BUTTON}</Button>
        </NewApiKeyDialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{APIKEY_EXISTING_TABLE_HEADER_NAME}</TableHead>
            <TableHead>{APIKEY_EXISTING_TABLE_HEADER_CREATED}</TableHead>
            <TableHead>Purpose Key</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadApiKeysQuery.data?.map((item) => (
            <TableRow key={item.name}>
              <TableCell className="py-4">{item.name}</TableCell>
              <TableCell>
                {new Date(item.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>{item.purposeKey}</TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={isDisabled} 
                  onClick={() => handleDelete(item)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* <Resources
        links={[
          {
            href: "https://docs.courselit.app/en/developers/introduction",
            text: SETTINGS_RESOURCE_API,
          },
        ]}
      /> */}
    </div>
  );
}
