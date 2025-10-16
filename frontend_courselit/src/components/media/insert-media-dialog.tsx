"use client";

import { trpc } from "@/utils/trpc";
import { Media } from "@workspace/common-models";
import { MediaComponents, NiceModal, NiceModalHocProps } from "@workspace/components-library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { useCallback, useMemo, useState } from "react";


function InsertMediaDialog(props: {
    selectMode?: boolean;
    selectedMedia?: Media | null;
    initialFileType?: string;
  } & NiceModalHocProps) {
    const { selectMode = false, selectedMedia, initialFileType } = props;
    const { visible, hide, resolve } = NiceModal.useModal();
    const [activeTab, setActiveTab] = useState<"browse" | "upload">("browse");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [type, setType] = useState<string>(initialFileType || "all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);
  const take = 20;

  const listInput = useMemo(() => ({
    pagination: { skip: page * take, take },
    search: search ? { q: search } : undefined,
    mimeType: type !== "all" ? mapTypeToMime(type) : undefined,
  }), [page, take, search, type]);

  const listQuery = trpc.mediaModule.media.list.useQuery(listInput);
  const deleteMutation = trpc.mediaModule.media.delete.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const handleDelete = useCallback(async (item: any) => {
    await deleteMutation.mutateAsync({ mediaId: item.mediaId });
  }, [deleteMutation]);

  const handleRetry = useCallback(() => {
    listQuery.refetch();
  }, [listQuery]);

  const handleChoose = useCallback((item: any) => {
    resolve({ reason: "submit", data: item });
    hide();
  }, []);

  const handleCancel = useCallback(() => {
    resolve({ reason: "cancel", data: null });
    hide();
  }, [resolve, hide]);

  const handleUploaded = useCallback(async (attachment: Media) => {
    listQuery.refetch();
    setActiveTab("browse");
  }, [listQuery]);

  const config = {
    title: "Media Library",
    allowUpload: true,
    allowDelete: true,
    allowSelection: true,
    showFilters: true,
    showPagination: true,
    perPage: 20,
    initialFileType: "all",
    // ...props?.config,
  };

  return (
    <Dialog 
    open={visible}
    onOpenChange={(v) => {
      if (!v) {
        handleCancel();
      }
    }}
  >
      <DialogContent className="!max-w-[1000px] w-[1000px] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Insert Media</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full h-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse">Browse</TabsTrigger>
              {config.allowUpload && (
                <TabsTrigger value="upload">Upload</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="browse" className="flex-1 min-h-0 flex flex-col">
          <MediaComponents.MediaFilters
            typeValue={type}
            setTypeValue={setType}
            searchTermValue={search}
            setSearchTermValue={setSearch}
            viewModeValue={viewMode}
            setViewModeValue={setViewMode as any}
            showFilters
            showViewToggle
          />

          {viewMode === "grid" ? (
            <MediaComponents.MediaGrid
              items={listQuery.data?.items || []}
              isLoading={listQuery.isLoading}
              isError={!!listQuery.error}
              errorText={listQuery.error ? "Failed to load" : undefined}
              onRetry={handleRetry}
              onSelect={selectMode ? handleChoose : undefined}
              onDelete={handleDelete}
              deleting={deleteMutation.isPending}
            />
          ) : (
            <MediaComponents.MediaList
              items={listQuery.data?.items || []}
              onSelect={selectMode ? handleChoose : undefined}
            />
          )}

          <div className="mt-auto px-4 pb-4">
            <MediaComponents.PaginationBar
              page={Math.floor((listQuery.data?.meta?.skip || 0) / take)}
              total={listQuery.data?.total || 0}
              perPage={take}
              onChange={setPage}
              disabled={listQuery.isLoading}
            />
          </div>
          </TabsContent>
          {config.allowUpload && (
              <TabsContent value="upload" className="flex-1 overflow-auto">
                <MediaComponents.UploadArea
                  onUploaded={handleUploaded}
                  uploadFile={async (file) => {
                    if (!file) {
                        throw new Error("File is required");
                    };

                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("caption", file.name);
                    formData.append("access", "public");
                    formData.append("type", type);
            
                    const xhr = new XMLHttpRequest();
            
                    xhr.upload.addEventListener("progress", (event) => {
                      if (event.lengthComputable) {
                        const fileProgress = Math.round((event.loaded / event.total) * 100);
                      }
                    });
            
                    const uploadPromise = new Promise<Media>((resolve, reject) => {
                      xhr.onload = () => {
                        if (xhr.status === 200) {
                          try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                          } catch (e) {
                            reject(new Error("Invalid response format"));
                          }
                        } else {
                          reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                      };
            
                      xhr.onerror = () => reject(new Error("Upload failed"));
            
                      xhr.open("POST", `/api/services/media/upload?storageType=cloudinary`);
                      xhr.send(formData);
                    });
            
                    const result = await uploadPromise;
                    return result;
                  }}
                  className="p-6"
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapTypeToMime(type: string | undefined) {
  if (!type) return undefined;
  if (type === "image") return "image/";
  if (type === "video") return "video/";
  if (type === "audio") return "audio/";
  if (type === "document") return "application/";
  if (type === "json") return "application/json";
  return undefined;
}

// Create the modal with proper typing
export const InsertMediaNiceDialog = NiceModal.create<
  React.ComponentProps<typeof InsertMediaDialog> & NiceModalHocProps,
  { reason: "cancel"; data: null } | { reason: "submit"; data: Media }
>(InsertMediaDialog);
