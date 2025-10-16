"use client";

import {
  APIKEY_NEW_BTN_CAPTION,
  APIKEY_NEW_GENERATED_KEY_COPIED,
  APIKEY_NEW_GENERATED_KEY_DESC,
  APIKEY_NEW_GENERATED_KEY_HEADER,
  APIKEY_NEW_HEADER,
  APIKEY_NEW_LABEL,
  BUTTON_CANCEL_TEXT,
  BUTTON_DONE_TEXT,
  TOAST_TITLE_ERROR,
  TOAST_TITLE_SUCCESS,
} from "@/lib/ui/config/strings";
import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@workspace/components-library";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Copy } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const newApiKeySchema = z.object({
  name: z.string().min(1, "API key name is required"),
  purposeKey: z.string(),
});

type NewApiKeyFormData = z.infer<typeof newApiKeySchema>;

interface NewApiKeyDialogProps {
  children: React.ReactNode;
}

export default function NewApiKeyDialog({
  children,
}: NewApiKeyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();
  const addApiKeyMutation = trpc.siteModule.siteInfo.addApiKey.useMutation({
    onSuccess: (response) => {
      if (response?.key) {
        setGeneratedKey(response.key);
        trpcUtils.siteModule.siteInfo.listApiKeys.invalidate();
      }
    },
    onError: (error: any) => {
      toast({
        title: TOAST_TITLE_ERROR,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<NewApiKeyFormData>({
    resolver: zodResolver(newApiKeySchema),
    defaultValues: {
      name: "",
      purposeKey: "",
    },
  });

  const onSubmit = async (data: NewApiKeyFormData) => {
    try {
      await addApiKeyMutation.mutateAsync({
        data,
      });
    } catch (error) {
      toast({
        title: TOAST_TITLE_ERROR,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(generatedKey);
        toast({
          title: TOAST_TITLE_SUCCESS,
          description: APIKEY_NEW_GENERATED_KEY_COPIED,
        });
      } catch (error) {
        toast({
          title: TOAST_TITLE_ERROR,
          description: "Failed to copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const handleDone = () => {
    setIsOpen(false);
  };

  const isSubmitting = addApiKeyMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{APIKEY_NEW_HEADER}</DialogTitle>
          <DialogDescription>
            Create a new API key for external integrations and services.
          </DialogDescription>
        </DialogHeader>

        {!generatedKey ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{APIKEY_NEW_LABEL}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter API key name..."
                        disabled={isSubmitting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purposeKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Purpose Key
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter API key purpose..."
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional value used to identify the API key purpose.
                    </FormDescription>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  {BUTTON_CANCEL_TEXT}
                </Button>
                <Button
                  type="submit"
                  disabled={!form.watch("name") || isSubmitting}
                >
                  {isSubmitting ? "Creating..." : APIKEY_NEW_BTN_CAPTION}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {APIKEY_NEW_GENERATED_KEY_DESC}
              </p>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleDone}>{BUTTON_DONE_TEXT}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
