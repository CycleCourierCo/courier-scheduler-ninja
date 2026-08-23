import React, { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APP_ROUTES, ROUTE_SECTIONS, ASSIGNABLE_PERMISSION_ROLES } from "@/config/routes";
import { useRoutePermissions, routePermissionsQueryKey } from "@/hooks/useRoutePermissions";
import { ALL_ROLES } from "@/lib/roles";
import { useAuth } from "@/contexts/AuthContext";
import { getRoles } from "@/lib/roles";
import { Loader2, Save, RotateCcw } from "lucide-react";
import type { UserRole } from "@/types/user";

const roleLabel = (role: UserRole) =>
  ALL_ROLES.find(r => r.value === role)?.label ?? role;

const RoutePermissionsPage: React.FC = () => {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { matrix, isLoading } = useRoutePermissions(getRoles(userProfile));

  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const copy: Record<string, Set<string>> = {};
    for (const [key, roles] of Object.entries(matrix)) copy[key] = new Set(roles);
    setDraft(copy);
  }, [isLoading, matrix]);

  const dirty = useMemo(() => {
    return APP_ROUTES.some(route => {
      const a = Array.from(matrix[route.key] ?? []).sort().join(",");
      const b = Array.from(draft[route.key] ?? []).sort().join(",");
      return a !== b;
    });
  }, [matrix, draft]);

  const toggle = (routeKey: string, role: UserRole) => {
    setDraft(prev => {
      const next = { ...prev };
      const set = new Set(next[routeKey] ?? []);
      if (set.has(role)) set.delete(role); else set.add(role);
      next[routeKey] = set;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = APP_ROUTES.flatMap(route =>
        ASSIGNABLE_PERMISSION_ROLES.map(role => ({
          role,
          route_key: route.key,
          allowed: draft[route.key]?.has(role) ?? false,
        }))
      );

      const { error } = await supabase
        .from("role_route_permissions")
        .upsert(rows, { onConflict: "role,route_key" });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: routePermissionsQueryKey });
      toast.success("Page permissions saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("role_route_permissions")
        .delete()
        .not("route_key", "is", null);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: routePermissionsQueryKey });
      toast.success("Reset to built-in defaults");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Route Permissions</h1>
            <p className="text-sm text-muted-foreground">
              Choose which pages each role can open. Admins always have access to everything.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleResetDefaults} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset defaults
            </Button>
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          ROUTE_SECTIONS.map(section => {
            const routes = APP_ROUTES.filter(r => r.section === section);
            if (!routes.length) return null;
            return (
              <Card key={section}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{section}</CardTitle>
                  <CardDescription>{routes.length} pages</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-left font-medium min-w-[220px]">Page</th>
                          {ASSIGNABLE_PERMISSION_ROLES.map(role => (
                            <th key={role} className="px-3 py-2 text-center font-medium whitespace-nowrap">
                              {roleLabel(role)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {routes.map(route => (
                          <tr key={route.key} className="border-b last:border-0">
                            <td className="sticky left-0 z-10 bg-background px-4 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium">{route.label}</span>
                                <span className="text-xs text-muted-foreground">{route.path}</span>
                              </div>
                              {route.hiddenInMenu && (
                                <Badge variant="outline" className="mt-1 text-[10px]">Not in menu</Badge>
                              )}
                            </td>
                            {ASSIGNABLE_PERMISSION_ROLES.map(role => (
                              <td key={role} className="px-3 py-2 text-center">
                                <Checkbox
                                  checked={draft[route.key]?.has(role) ?? false}
                                  onCheckedChange={() => toggle(route.key, role)}
                                  aria-label={`${roleLabel(role)} can access ${route.label}`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </Layout>
  );
};

export default RoutePermissionsPage;
