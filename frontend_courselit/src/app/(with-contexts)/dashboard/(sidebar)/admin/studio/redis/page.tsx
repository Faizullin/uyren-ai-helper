"use client";

import { useProfile } from "@/components/contexts/profile-context";
import DashboardContent from "@/components/dashboard/dashboard-content";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteConfirmNiceDialog, NiceModal, useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { useDebounce } from "@workspace/ui/hooks/use-debounce";
import { Edit, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type RedisKeyInfo = {
  key: string;
  type: string;
  value: any;
  ttl: number | null;
  size: number;
};

async function fetcher(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return "null";

  switch (type) {
    case "string":
      return String(value);
    case "list":
      return Array.isArray(value) ? `[${value.length} items]` : String(value);
    case "set":
      return Array.isArray(value) ? `{${value.length} items}` : String(value);
    case "zset":
      return Array.isArray(value) ? `{${value.length / 2} items}` : String(value);
    case "hash":
      return typeof value === "object" ? `{${Object.keys(value).length} fields}` : String(value);
    default:
      return JSON.stringify(value);
  }
}

function formatTTL(ttl: number | null): string {
  if (ttl === null) return "No expiry";
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Key doesn't exist";

  const days = Math.floor(ttl / 86400);
  const hours = Math.floor((ttl % 86400) / 3600);
  const minutes = Math.floor((ttl % 3600) / 60);
  const seconds = ttl % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function RedisManagementPage() {
  const { profile } = useProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pattern, setPattern] = useState("*");
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<RedisKeyInfo | null>(null);
  const [editorValue, setEditorValue] = useState("{}");
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTTL, setNewTTL] = useState<number | undefined>(undefined);

  const debouncedPattern = useDebounce(pattern, 400);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["studio-redis", debouncedPattern, cursor],
    queryFn: () => {
      const params = new URLSearchParams({
        pattern: debouncedPattern,
        cursor: cursor.toString(),
        count: "50",
      });
      return fetcher(`/api/services/studio/redis?${params}`);
    },
    enabled: !!profile?.roles?.includes("admin"),
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load Redis keys",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  useEffect(() => {
    if (selected) {
      setEditorValue(JSON.stringify(selected.value, null, 2));
    }
  }, [selected]);

  const createMutation = useMutation({
    mutationFn: (data: { key: string; value: any; ttl?: number }) =>
      fetcher(`/api/services/studio/redis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-redis"] });
      setIsCreating(false);
      setNewKey("");
      setNewValue("");
      setNewTTL(undefined);
      toast({ title: "Success", description: "Key created successfully" });
    },
    onError: (error: any) => {
      console.error("Create error:", error);
      toast({ title: "Error", description: "Failed to create key", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value, ttl }: { key: string; value: any; ttl?: number }) =>
      fetcher(`/api/services/studio/redis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, ttl }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-redis"] });
      toast({ title: "Success", description: "Key updated successfully" });
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      toast({ title: "Error", description: "Failed to update key", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) =>
      fetcher(`/api/services/studio/redis?key=${key}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelected(null);
      setEditorValue("{}");
      qc.invalidateQueries({ queryKey: ["studio-redis"] });
      toast({ title: "Success", description: "Key deleted successfully" });
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      toast({ title: "Error", description: "Failed to delete key", variant: "destructive" });
    },
  });

  const parsedEditor = useMemo(() => {
    try {
      return JSON.parse(editorValue);
    } catch {
      return null;
    }
  }, [editorValue]);

  const handleCreate = useCallback(() => {
    if (!newKey || !newValue) return;

    let value: any;
    try {
      value = JSON.parse(newValue);
    } catch {
      value = newValue;
    }

    createMutation.mutate({ key: newKey, value, ttl: newTTL });
  }, [createMutation, newKey, newValue, newTTL]);

  const handleUpdate = useCallback(() => {
    if (!selected || !parsedEditor) return;
    updateMutation.mutate({ key: selected.key, value: parsedEditor, ttl: selected.ttl || undefined });
  }, [updateMutation, selected, parsedEditor]);

  const handleDelete = useCallback(() => {
    if (!selected) return;
    NiceModal.show(DeleteConfirmNiceDialog, {
      title: "Delete Redis Key",
      content: `Are you sure you want to delete the key "${selected.key}"? This action cannot be undone.`,
    }).then((result) => {
      if (result.reason === "confirm") {
        deleteMutation.mutate(selected.key);
      }
    });
  }, [deleteMutation, selected]);

  const handleLoadMore = useCallback(() => {
    if (data?.hasMore) {
      setCursor(data.cursor);
    }
  }, [data]);

  const keys = data?.keys || [];
  const hasMore = data?.hasMore || false;

  return (
    <DashboardContent breadcrumbs={[
      { label: "Studio", href: "/dashboard/studio" },
      { label: "Redis", href: "#" }
    ]}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Redis Cache Management</h1>
          <div className="flex items-center gap-2">
            <input
              className="border rounded px-2 py-1 w-64"
              placeholder="Key pattern (e.g., user:* or *)"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
            <Button onClick={() => refetch()} variant="outline" size="icon">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsCreating(true)} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Key</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Key</label>
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Enter key name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Value (JSON or string)</label>
                  <textarea
                    className="w-full border rounded px-2 py-1 h-20"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder='Enter value (e.g., "hello" or {"name": "value"})'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">TTL (seconds, optional)</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-1"
                    value={newTTL || ""}
                    onChange={(e) => setNewTTL(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Leave empty for no expiry"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={!newKey || !newValue || createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                  <Button onClick={() => setIsCreating(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Redis Keys ({keys.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-96 overflow-auto">
                {isLoading ? (
                  <div className="text-center py-4">Loading...</div>
                ) : keys.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No keys found</div>
                ) : (
                  keys.map((keyInfo: RedisKeyInfo) => (
                    <div
                      key={keyInfo.key}
                      className={`p-2 border rounded cursor-pointer hover:bg-muted ${selected?.key === keyInfo.key ? "bg-primary/10 border-primary" : ""
                        }`}
                      onClick={() => setSelected(keyInfo)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{keyInfo.key}</div>
                          <div className="text-xs text-muted-foreground">
                            {keyInfo.type} • {formatValue(keyInfo.value, keyInfo.type)} • {formatTTL(keyInfo.ttl)}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(keyInfo);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              NiceModal.show(DeleteConfirmNiceDialog, {
                                title: "Delete Redis Key",
                                content: `Are you sure you want to delete the key "${keyInfo.key}"?`,
                              }).then((result) => {
                                if (result.reason === "confirm") {
                                  deleteMutation.mutate(keyInfo.key);
                                }
                              });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {hasMore && (
                <div className="mt-4 text-center">
                  <Button onClick={handleLoadMore} variant="outline" size="sm">
                    Load More
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Details & Editor</CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div><strong>Key:</strong> {selected.key}</div>
                    <div><strong>Type:</strong> {selected.type}</div>
                    <div><strong>TTL:</strong> {formatTTL(selected.ttl)}</div>
                    <div><strong>Size:</strong> {selected.size} {selected.type === "string" ? "bytes" : "items"}</div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Value (JSON)</label>
                    <textarea
                      className="w-full h-40 p-2 border rounded font-mono text-xs"
                      value={editorValue}
                      onChange={(e) => setEditorValue(e.target.value)}
                      placeholder="Enter JSON data..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpdate}
                      disabled={!parsedEditor || updateMutation.isPending}
                      size="sm"
                    >
                      {updateMutation.isPending ? "Updating..." : "Update"}
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select a key to view and edit its details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardContent>
  );
}
