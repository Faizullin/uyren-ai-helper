"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import LoadingScreen from "@/components/dashboard/loading-screen";
import { trpc } from "@/utils/trpc";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ComboBox2, useToast } from "@workspace/components-library";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Switch } from "@workspace/ui/components/switch";
import { Calendar, Mail, Shield, User, UserCircle, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const breadcrumbs = [
  { label: "Users", href: "/dashboard/admin/users" },
  { label: "User Details", href: "#" },
];

type PermissionType = { key: string; label: string };
type RoleType = { key: string; label: string };

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const trpcUtils = trpc.useUtils();
  const [initialLoading, setInitialLoading] = useState(true);

  const loadUserQuery = trpc.userModule.user.getById.useQuery({
    id: id,
  }, {
    enabled: !!id,
  });

  // Mutations
  const updateUserMutation = trpc.userModule.user.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      trpcUtils.userModule.user.getById.invalidate({
        id: id,
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

  useEffect(() => {
    if (loadUserQuery.error) {
      toast({
        title: "Error",
        description: loadUserQuery.error.message,
        variant: "destructive",
      });
    }
  }, [loadUserQuery.error, toast]);

  useEffect(() => {
    if (loadUserQuery.data && initialLoading) {
      setInitialLoading(false);
    }
  }, [loadUserQuery.data, initialLoading]);

  const toggleActiveState = async (value: boolean) => {
    if (loadUserQuery.data?._id) {
      updateUserMutation.mutate({
        id: loadUserQuery.data._id,
        data: {
          active: value,
        },
      });
    }
  };

  // Available permissions and roles
  const allPermissions: PermissionType[] = useMemo(() => [
    { key: UIConstants.permissions.manageUsers, label: "Manage Users" },
    { key: UIConstants.permissions.manageAnyCourse, label: "Manage Any Course" },
    { key: UIConstants.permissions.manageCourse, label: "Manage Course" },
    { key: UIConstants.permissions.publishCourse, label: "Publish Course" },
    { key: UIConstants.permissions.manageMedia, label: "Manage Media" },
    { key: UIConstants.permissions.manageSite, label: "Manage Site" },
    { key: UIConstants.permissions.manageSettings, label: "Manage Settings" },
    { key: UIConstants.permissions.manageCommunity, label: "Manage Community" },
    { key: UIConstants.permissions.enrollInCourse, label: "Enroll In Course" },
  ], []);

  const allRoles: RoleType[] = useMemo(() => [
    { key: UIConstants.roles.admin, label: "Admin" },
    { key: UIConstants.roles.instructor, label: "Instructor" },
    { key: UIConstants.roles.student, label: "Student" },
  ], []);

  // Initial and current values for permissions and roles
  const [initialPermissions, setInitialPermissions] = useState<PermissionType[]>([]);
  const [initialRoles, setInitialRoles] = useState<RoleType[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionType[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>([]);

  useEffect(() => {
    if (loadUserQuery.data) {
      const permissions = (loadUserQuery.data.permissions || [])
        .map(p => allPermissions.find(ap => ap.key === p))
        .filter(Boolean) as PermissionType[];
      setInitialPermissions(permissions);
      setSelectedPermissions(permissions);

      const roles = (loadUserQuery.data.roles || [])
        .map(r => allRoles.find(ar => ar.key === r))
        .filter(Boolean) as RoleType[];
      setInitialRoles(roles);
      setSelectedRoles(roles);
    }
  }, [loadUserQuery.data, allPermissions, allRoles]);

  // Detect changes
  const hasChanges = useMemo(() => {
    const permissionsChanged = JSON.stringify(initialPermissions.map(p => p.key).sort()) 
      !== JSON.stringify(selectedPermissions.map(p => p.key).sort());
    const rolesChanged = JSON.stringify(initialRoles.map(r => r.key).sort()) 
      !== JSON.stringify(selectedRoles.map(r => r.key).sort());
    return permissionsChanged || rolesChanged;
  }, [initialPermissions, selectedPermissions, initialRoles, selectedRoles]);

  // Search functions for ComboBox2
  const searchPermissions = async (search: string, offset: number, size: number): Promise<PermissionType[]> => {
    const filtered = allPermissions.filter(p =>
      p.label.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.slice(offset, offset + size);
  };

  const searchRoles = async (search: string, offset: number, size: number): Promise<RoleType[]> => {
    const filtered = allRoles.filter(r =>
      r.label.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.slice(offset, offset + size);
  };

  const handlePermissionsChange = (permissions: PermissionType[]) => {
    setSelectedPermissions(permissions);
  };

  const handleRolesChange = (roles: RoleType[]) => {
    setSelectedRoles(roles);
  };

  const handleSaveChanges = () => {
    if (loadUserQuery.data?._id) {
      updateUserMutation.mutate({
        id: loadUserQuery.data._id,
        data: {
          permissions: selectedPermissions.map(p => p.key),
          roles: selectedRoles.map(r => r.key),
        },
      }, {
        onSuccess: () => {
          // Update initial values to current after successful save
          setInitialPermissions(selectedPermissions);
          setInitialRoles(selectedRoles);
        }
      });
    }
  };

  const user = loadUserQuery.data;
  const userInitials = useMemo(() => {
    if (!user) return "~";
    if (user.fullName) {
      return user.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user.username) {
      return user.username[0]?.toUpperCase() || "U";
    }
    return user.email?.[0]?.toUpperCase() || "U";
  }, [user]);

  if (initialLoading || !user) {
    return <LoadingScreen />;
  }

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar?.url} alt={user.fullName || user.username || user.email} />
                <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">
                    {user.fullName || user.username || user.email}
                  </h1>
                  {user.active ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {user.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <Link href={`mailto:${user.email}`} className="hover:underline">
                        {user.email}
                      </Link>
                    </div>
                  )}
                  {user.username && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>@{user.username}</span>
                    </div>
                  )}
                </div>

                {user.bio && (
                  <p className="text-sm text-muted-foreground mt-2">{user.bio}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Switch
                  checked={user.active}
                  onCheckedChange={(value) => toggleActiveState(value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Roles Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                <CardTitle>User Roles</CardTitle>
              </div>
              <CardDescription>
                Define user access level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComboBox2<RoleType>
                title="Select roles"
                valueKey="key"
                value={selectedRoles}
                searchFn={searchRoles}
                renderLabel={(item) => item.label}
                onChange={handleRolesChange}
                multiple={true}
                badgeRenderType="outside"
              />
            </CardContent>
          </Card>

          {/* Permissions Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Permissions</CardTitle>
              </div>
              <CardDescription>
                Fine-grained access control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComboBox2<PermissionType>
                title="Select permissions"
                valueKey="key"
                value={selectedPermissions}
                searchFn={searchPermissions}
                renderLabel={(item) => item.label}
                onChange={handlePermissionsChange}
                multiple={true}
                badgeRenderType="outside"
              />
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end">
            <Button
              onClick={handleSaveChanges}
              disabled={!hasChanges || updateUserMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}

        {/* Additional Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Created:</span>
                <span className="text-sm text-muted-foreground">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last Updated:</span>
                <span className="text-sm text-muted-foreground">
                  {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Subscribed to Updates:</span>
                <Badge variant={user.subscribedToUpdates ? "default" : "secondary"}>
                  {user.subscribedToUpdates ? "Yes" : "No"}
                </Badge>
              </div>
              {user.invited && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Invited User</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardContent>
  );
}
