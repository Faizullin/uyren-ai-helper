"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Plus, Trash2, Globe, Building2, Edit } from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  useToast,
  DeleteConfirmNiceDialog,
} from "@workspace/components-library";
import { NiceModal } from "@workspace/components-library";
import SchoolDialog from "./school-dialog";
import { GeneralRouterOutputs } from "@/server/api/types";
import { FormMode } from "@/components/dashboard/layout/types";

type DomainItemType =
  GeneralRouterOutputs["siteModule"]["domain"]["list"]["items"][number];

export default function SchoolsManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<FormMode>("create");
  const [selectedDomain, setSelectedDomain] = useState<any>(null);
  const { toast } = useToast();

  const {
    data: domains,
    isLoading,
    refetch,
  } = trpc.siteModule.domain.list.useQuery({
    pagination: { take: 100, skip: 0 },
    orderBy: { field: "createdAt", direction: "desc" },
  });

  const deleteDomainMutation = trpc.siteModule.domain.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "School deleted",
        description: "The school has been successfully deleted.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete school",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (domain: DomainItemType) => {
    setSelectedDomain(domain);
    setDialogMode("edit");
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedDomain(null);
    setDialogMode("create");
    setIsDialogOpen(true);
  };

  const handleDelete = (domain: DomainItemType) => {
    NiceModal.show(DeleteConfirmNiceDialog, {
      title: "Delete School",
      message: `Are you sure you want to delete "${domain.settings?.title || domain.name}"? This action cannot be undone.`,
      data: domain,
    }).then((result) => {
      if (result.reason === "confirm") {
        deleteDomainMutation.mutate({ id: domain._id.toString() });
      }
    });
  };

  const isMainDomain = (domain: DomainItemType) => {
    return domain.name === "main" || domain.name === "localhost";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Schools Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage all schools/domains in your multi-tenant system.
          </p>
        </div>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add School
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Schools ({domains?.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded-md"></div>
                </div>
              ))}
            </div>
          ) : domains?.items?.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No schools found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first school.
              </p>
              <Button onClick={handleAdd}>Add First School</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {domains?.items?.map((domain) => (
                <div
                  key={`${domain._id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
                      <Globe className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {domain.settings?.title || domain.name}
                        </h3>
                        {isMainDomain(domain) && (
                          <Badge variant="secondary">Main</Badge>
                        )}
                        {domain.customDomain && (
                          <Badge variant="outline">{domain.customDomain}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Subdomain: {domain.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Email: {domain.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(domain)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {!isMainDomain(domain) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(domain)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SchoolDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode={dialogMode}
        domain={dialogMode === "edit" ? selectedDomain : undefined}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
