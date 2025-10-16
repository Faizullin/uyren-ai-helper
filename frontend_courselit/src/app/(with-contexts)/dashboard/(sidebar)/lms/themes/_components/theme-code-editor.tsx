"use client";

import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { ThemeAssetTypeEnum } from "@workspace/common-logic/models/theme.types";
import {
  DeleteConfirmNiceDialog,
  NiceModal,
  useToast,
} from "@workspace/components-library";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  Code,
  Edit,
  FileText,
  ImageIcon,
  MoreVertical,
  Plus,
  Trash2,
  Type
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useThemeContext } from "./theme-context";
;

// Simple Monaco-like editor component (you can replace this with actual Monaco editor)
function MonacoEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-900">
      <div className="bg-gray-200 dark:bg-gray-800 px-3 py-2 border-b border-gray-300 dark:border-gray-700">
        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
          CSS
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-96 p-4 font-mono text-sm bg-transparent border-none outline-none resize-none"
        placeholder="/* Enter your CSS code here */"
      />
    </div>
  );
}

const defaultLayout = [20, 32, 48];

type AssetType = {
  _id: string;
  assetType: ThemeAssetTypeEnum;
  url?: string;
  content?: string;
  preload?: boolean;
  async?: boolean;
  defer?: boolean;
  media?: string;
  crossorigin?: string;
  integrity?: string;
  rel?: string;
  sizes?: string;
  mimeType?: string;
  name?: string;
  description?: string;
};

const assetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  assetType: z.nativeEnum(ThemeAssetTypeEnum),
  url: z.string(),
  content: z.string().optional(),
  preload: z.boolean().optional(),
  async: z.boolean().optional(),
  defer: z.boolean().optional(),
  media: z.string().optional(),
  crossorigin: z.string().optional(),
  integrity: z.string().optional(),
  rel: z.string().optional(),
  sizes: z.string().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

const newAssetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  assetType: z.nativeEnum(ThemeAssetTypeEnum),
});

type AssetFormData = z.infer<typeof assetSchema>;
type NewAssetFormData = z.infer<typeof newAssetSchema>;

export default function ThemeCodeEditor() {
  const { theme } = useThemeContext();
  const utils = trpc.useUtils();

  const [selectedAsset, setSelectedAsset] = useState<AssetType | null>(null);

  const { toast } = useToast();

  // Query to fetch theme assets
  const { data: assetsData, isLoading } =
    trpc.lmsModule.themeModule.theme.listAssets.useQuery(
      { themeId: theme?._id || "" },
      { enabled: !!theme?._id },
    );

  const updateMutation = trpc.lmsModule.themeModule.theme.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Theme updated successfully",
      });
      utils.lmsModule.themeModule.theme.listAssets.invalidate({
        themeId: theme?._id || "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assets = useMemo(() => {
    if (!assetsData) return [];
    return assetsData.map((asset, index) => ({
      ...asset,
      _id: asset._id || `temp-${Date.now()}-${index}`,
    }));
  }, [assetsData]);

  const handleSaveAssets = () => {
    if (!theme?._id) return;

    updateMutation.mutate({
      id: `${theme._id}`,
      data: { assets },
    });
  };

  const handleAddAsset = (asset: AssetType) => {
    if (!theme?._id) return;

    const updatedAssets = [...assets, asset];
    updateMutation.mutate({
      id: theme._id.toString(),
      data: { assets: updatedAssets },
    });
  };

  const handleRemoveAsset = (index: number) => {
    if (!theme?._id) return;

    const updatedAssets = assets.filter((_, i) => i !== index);
    updateMutation.mutate({
      id: theme._id.toString(),
      data: { assets: updatedAssets },
    });
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(sizes: number[]) => {
        document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(
          sizes,
        )}`;
      }}
      className="h-full max-h-[800px] items-stretch border-1"
    >
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={15}>
        <Tabs defaultValue="all">
          <TabsContent value="all" className="m-0">
            <MailList
              assets={assets}
              onAddAsset={handleAddAsset}
              onSelectAsset={setSelectedAsset}
              onDeleteAsset={handleRemoveAsset}
              isLoading={isLoading}
            />
          </TabsContent>
          <TabsContent value="unread" className="m-0">
            {/* <MailList items={mails.filter((item) => !item.read)} /> */}
          </TabsContent>
        </Tabs>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
        <AssetEditor selectedAsset={selectedAsset} onSave={handleSaveAssets} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

const getAssetIcon = (type: ThemeAssetTypeEnum) => {
  switch (type) {
    case ThemeAssetTypeEnum.STYLESHEET:
      return <FileText className="h-4 w-4" />;
    case ThemeAssetTypeEnum.SCRIPT:
      return <Code className="h-4 w-4" />;
    case ThemeAssetTypeEnum.FONT:
      return <Type className="h-4 w-4" />;
    case ThemeAssetTypeEnum.IMAGE:
      return <ImageIcon className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getAssetTypeColor = (type: ThemeAssetTypeEnum) => {
  switch (type) {
    case ThemeAssetTypeEnum.STYLESHEET:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case ThemeAssetTypeEnum.SCRIPT:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case ThemeAssetTypeEnum.FONT:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case ThemeAssetTypeEnum.IMAGE:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

interface MailListProps {
  assets: AssetType[];
  onAddAsset: (asset: AssetType) => void;
  onSelectAsset: (asset: AssetType | null) => void;
  onDeleteAsset: (index: number) => void;
  isLoading: boolean;
}

function MailList({
  assets,
  onAddAsset,
  onSelectAsset,
  onDeleteAsset,
  isLoading,
}: MailListProps) {
  const [createAssetOpen, setCreateAssetOpen] = useState(false);

  const form = useForm<NewAssetFormData>({
    resolver: zodResolver(newAssetSchema),
    defaultValues: {
      name: "",
      assetType: ThemeAssetTypeEnum.STYLESHEET,
    },
  });

  const detectAssetType = useCallback((filename: string) => {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "css" || ext === "scss" || ext === "sass") return ThemeAssetTypeEnum.STYLESHEET;
    if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx")
      return ThemeAssetTypeEnum.SCRIPT;
    if (
      ext === "woff" ||
      ext === "woff2" ||
      ext === "ttf" ||
      ext === "otf" ||
      ext === "eot"
    )
      return ThemeAssetTypeEnum.FONT;
    if (
      ext === "png" ||
      ext === "jpg" ||
      ext === "jpeg" ||
      ext === "gif" ||
      ext === "svg" ||
      ext === "webp"
    )
      return ThemeAssetTypeEnum.IMAGE;
    return ThemeAssetTypeEnum.STYLESHEET;
  }, []);

  const onSubmit = (data: NewAssetFormData) => {
    // Generate default URL based on filename
    const defaultUrl = `/${data.name}`;

    const asset: AssetType = {
      _id: Date.now().toString(),
      assetType: data.assetType,
      url: defaultUrl,
      name: data.name,
      description: "",
      content: "",
      rel: data.assetType === ThemeAssetTypeEnum.STYLESHEET ? "stylesheet" : undefined,
    };

    onAddAsset(asset);

    // Reset form
    form.reset();
    setCreateAssetOpen(false);
  };

  const handleNameChange = useCallback(
    (name: string) => {
      const assetType = detectAssetType(name);
      form.setValue("assetType", assetType);
    },
    [detectAssetType, form],
  );

  const handleEditAsset = useCallback(
    (asset: AssetType) => {
      onSelectAsset(asset);
    },
    [onSelectAsset],
  );

  const handleDeleteAsset = useCallback(
    (asset: AssetType) => {
      NiceModal.show(DeleteConfirmNiceDialog, {
        title: "Delete Asset",
        message: `Are you sure you want to delete "${asset.name}"? This action cannot be undone.`,
        data: asset,
      }).then((result) => {
        if (result.reason === "confirm") {
          const index = assets.findIndex((a) => a._id === asset._id);
          if (index !== -1) {
            onDeleteAsset(index);
          }
        }
      });
    },
    [assets, onDeleteAsset],
  );

  return (
    <>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Theme Assets</h2>
          <DropdownMenu
            open={createAssetOpen}
            onOpenChange={setCreateAssetOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-4">
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor="asset-name" className="text-sm font-medium">
                    Filename
                  </Label>
                  <Input
                    id="asset-name"
                    placeholder="style.css"
                    {...form.register("name")}
                    onChange={(e) => {
                      form.setValue("name", e.target.value);
                      handleNameChange(e.target.value);
                    }}
                    className="mt-1"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1"
                    disabled={form.formState.isSubmitting}
                  >
                    Create
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateAssetOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {assets.map((item) => (
            <div
              key={item._id}
              className="p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => onSelectAsset(item)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {getAssetIcon(item.assetType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getAssetTypeColor(item.assetType)}`}
                    >
                      {item.assetType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditAsset(item)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteAsset(item)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

interface AssetEditorProps {
  selectedAsset: AssetType | null;
  onSave: () => void;
}

function AssetEditor({ selectedAsset, onSave }: AssetEditorProps) {
  const [activeTab, setActiveTab] = useState<"properties" | "code">(
    "properties",
  );

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: "",
      assetType: ThemeAssetTypeEnum.STYLESHEET,
      url: "",
      content: "",
      description: "",
    },
  });

  useEffect(() => {
    if (selectedAsset) {
      form.reset({
        name: selectedAsset.name || "",
        assetType: selectedAsset.assetType,
        url: selectedAsset.url || "",
        content: selectedAsset.content || "",
        description: selectedAsset.description || "",
        preload: selectedAsset.preload,
        async: selectedAsset.async,
        defer: selectedAsset.defer,
        media: selectedAsset.media,
        crossorigin: selectedAsset.crossorigin,
        integrity: selectedAsset.integrity,
        rel: selectedAsset.rel,
        sizes: selectedAsset.sizes,
        mimeType: selectedAsset.mimeType,
      });
    }
  }, [selectedAsset, form]);

  const onSubmit = (data: AssetFormData) => {
    if (selectedAsset) {
      Object.assign(selectedAsset, data);
      onSave();
    }
  };

  if (!selectedAsset) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select an asset to edit</p>
      </div>
    );
  }

  const isCodeAsset =
    selectedAsset.assetType === ThemeAssetTypeEnum.STYLESHEET ||
    selectedAsset.assetType === ThemeAssetTypeEnum.SCRIPT;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">{selectedAsset.name}</h3>
        <p className="text-sm text-muted-foreground">
          {selectedAsset.description}
        </p>
      </div>

      <div className="flex-1 p-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "properties" | "code")
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="code" disabled={!isCodeAsset}>
              Code Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="mt-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Name
                </Label>
                <Input id="name" {...form.register("name")} className="mt-1" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <Badge
                  variant="secondary"
                  className={getAssetTypeColor(form.watch("assetType"))}
                >
                  {form.watch("assetType")}
                </Badge>
              </div>
              <div>
                <Label htmlFor="url" className="text-sm font-medium">
                  URL
                </Label>
                <Input id="url" {...form.register("url")} className="mt-1" />
                {form.formState.errors.url && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.url.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Input
                  id="description"
                  {...form.register("description")}
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                Save Changes
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="code" className="mt-4">
            {isCodeAsset ? (
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="content" className="text-sm font-medium">
                    Content
                  </Label>
                  <textarea
                    id="content"
                    {...form.register("content")}
                    className="w-full h-64 p-3 font-mono text-sm border border-input rounded-md resize-none"
                    placeholder={`Enter your ${selectedAsset.assetType === ThemeAssetTypeEnum.STYLESHEET ? "CSS" : "JavaScript"} code here`}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  Save Changes
                </Button>
              </form>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>
                  Code editing is only available for stylesheet and script assets
                  assets
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
