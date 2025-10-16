"use client";

import { useProfile } from "@/components/contexts/profile-context";
import DashboardContent from "@/components/dashboard/dashboard-content";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { DeleteConfirmNiceDialog, NiceModal, useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { useDebounce } from "@workspace/ui/hooks/use-debounce";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ModelKey = "users" | "courses" | "quizzes" | "media" | "assignments" | "lessons" | "domains" | "activities" | "apikeys" | "pages" | "progress" | "memberships";

const MODEL_OPTIONS: { value: ModelKey; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "courses", label: "Courses" },
  { value: "quizzes", label: "Quizzes" },
  { value: "media", label: "Media" },
  { value: "assignments", label: "Assignments" },
  { value: "lessons", label: "Lessons" },
  { value: "domains", label: "Domains" },
  { value: "activities", label: "Activities" },
  { value: "apikeys", label: "API Keys" },
  { value: "pages", label: "Pages" },
  { value: "progress", label: "Progress" },
  { value: "memberships", label: "Memberships" },
];

async function fetcher(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getDisplayValue(item: any, model: ModelKey): { primary: string; secondary: string } {
  const displayMap: Record<ModelKey, (item: any) => { primary: string; secondary: string }> = {
    users: (item) => ({ primary: item.name || item.email, secondary: item.email || item.userId }),
    courses: (item) => ({ primary: item.title, secondary: item.instructor || item.courseId }),
    quizzes: (item) => ({ primary: item.title, secondary: item.ownerId }),
    media: (item) => ({ primary: item.originalFileName, secondary: item.mimeType }),
    assignments: (item) => ({ primary: item.title, secondary: item.ownerId }),
    lessons: (item) => ({ primary: item.title, secondary: item.type || item.courseId }),
    domains: (item) => ({ primary: item.name, secondary: item.customDomain || "" }),
    activities: (item) => ({ primary: item.type, secondary: item.userId }),
    apikeys: (item) => ({ primary: item.name, secondary: item.createdBy }),
    pages: (item) => ({ primary: item.title, secondary: item.slug }),
    progress: (item) => ({ primary: item.userId, secondary: item.courseId }),
    memberships: (item) => ({ primary: item.userId, secondary: item.communityId }),
  };

  const display = displayMap[model]?.(item) || { primary: item._id, secondary: "" };
  return {
    primary: display.primary || item._id,
    secondary: display.secondary || ""
  };
}

export default function DatabaseManagementPage() {
  const { profile } = useProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [model, setModel] = useState<ModelKey>("users");
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const [editorValue, setEditorValue] = useState("{}");

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["studio-db", model, debouncedSearch, skip],
    queryFn: () => {
      const params = new URLSearchParams({
        model,
        search: debouncedSearch,
        skip: skip.toString(),
        take: "20",
      });
      return fetcher(`/api/services/studio/db?${params}`);
    },
    enabled: !!profile?.roles?.includes("admin"), // Only run query if user is admin
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load records",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  useEffect(() => {
    if (selected) {
      setEditorValue(JSON.stringify(selected, null, 2));
    }
  }, [selected]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetcher(`/api/services/studio/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, data }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-db"] });
      setEditorValue("{}");
      toast({ title: "Success", description: "Record created successfully" });
    },
    onError: (error: any) => {
      console.error("Create error:", error);
      toast({ title: "Error", description: "Failed to create record", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetcher(`/api/services/studio/db`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, id, data }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-db"] });
      toast({ title: "Success", description: "Record updated successfully" });
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      toast({ title: "Error", description: "Failed to update record", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/services/studio/db?model=${model}&id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelected(null);
      setEditorValue("{}");
      qc.invalidateQueries({ queryKey: ["studio-db"] });
      toast({ title: "Success", description: "Record deleted successfully" });
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" });
    },
  });

  const parsedEditor = useMemo(() => {
    try {
      return JSON.parse(editorValue);
    } catch {
      return null;
    }
  }, [editorValue]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setModel(e.target.value as ModelKey);
    setSkip(0);
    setSelected(null);
    setEditorValue("{}");
  }, []);

  const handleCreate = useCallback(() => {
    if (!parsedEditor) return;
    const { _id, __v, createdAt, updatedAt, domain, ...cleanData } = parsedEditor;
    createMutation.mutate(cleanData);
  }, [createMutation, parsedEditor]);

  const handleUpdate = useCallback(() => {
    if (!selected || !parsedEditor) return;
    const { _id, __v, createdAt, updatedAt, domain, ...cleanData } = parsedEditor;
    updateMutation.mutate({ id: selected._id, data: cleanData });
  }, [updateMutation, selected, parsedEditor]);

  const handleDelete = useCallback(() => {
    if (!selected) return;
    NiceModal.show(DeleteConfirmNiceDialog, {
      title: "Delete Record",
      content: `Are you sure you want to delete this ${model.slice(0, -1)} record? This action cannot be undone.`,
    }).then((result) => {
      if (result.reason === "confirm") {
        deleteMutation.mutate(selected._id);
      }
    });
  }, [deleteMutation, selected, model]);

  const records = data?.data || [];
  const total = data?.total || 0;
  const hasMore = data?.hasMore || false;

  return (
    <DashboardContent breadcrumbs={[
      { label: "Studio", href: "/dashboard/studio" },
      { label: "Database", href: "#" }
    ]}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Database Management</h1>
          <div className="flex items-center gap-2">
            <select
              className="border rounded px-2 py-1"
              value={model}
              onChange={handleModelChange}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              className="border rounded px-2 py-1 w-64"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button onClick={() => refetch()} variant="outline" size="icon">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Records ({total})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-96 overflow-auto">
                {isLoading ? (
                  <div className="text-center py-4">Loading...</div>
                ) : records.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No records found</div>
                ) : (
                  records.map((item: any) => {
                    const { primary, secondary } = getDisplayValue(item, model);
                    return (
                      <div
                        key={item._id}
                        className={`p-2 border rounded cursor-pointer hover:bg-muted ${selected?._id === item._id ? "bg-primary/10 border-primary" : ""
                          }`}
                        onClick={() => setSelected(item)}
                      >
                        <div className="font-medium truncate">{primary}</div>
                        {secondary && <div className="text-xs text-muted-foreground truncate">{secondary}</div>}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-between items-center mt-4">
                <Button onClick={() => setSkip(Math.max(0, skip - 20))} disabled={skip === 0} variant="outline" size="sm">
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {skip + 1}-{Math.min(skip + 20, total)} of {total}
                </span>
                <Button onClick={() => setSkip(skip + 20)} disabled={!hasMore} variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>JSON Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-64 p-2 border rounded font-mono text-xs"
                value={editorValue}
                onChange={(e) => setEditorValue(e.target.value)}
                placeholder="Enter JSON data..."
              />
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleCreate}
                  disabled={!parsedEditor || createMutation.isPending}
                  size="sm"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={!selected || !parsedEditor || updateMutation.isPending}
                  variant="secondary"
                  size="sm"
                >
                  {updateMutation.isPending ? "Updating..." : "Update"}
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={!selected || deleteMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
              {selected && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  Selected: {getDisplayValue(selected, model).primary}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardContent>
  );
} 