import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { Layers, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createBuildFromTemplate, deleteBuildTemplate, getBuildTemplates } from "@/services/bikeBuildService";
import type { BikeBuildTemplate } from "@/types/bikeBuild";
import BuildTemplateDialog from "./BuildTemplateDialog";

type Props = {
  isStaff: boolean;
  customers: any[];
  currentUserId: string;
  /** Customers only ever see their own stored builds. */
  restrictToUserId?: string | null;
  siteId: string | null;
  onBuildCreated: () => void;
};

const StoredBuildsTab: React.FC<Props> = ({
  isStaff,
  customers,
  currentUserId,
  restrictToUserId,
  siteId,
  onBuildCreated,
}) => {
  const [templates, setTemplates] = useState<BikeBuildTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BikeBuildTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setTemplates(await getBuildTemplates(restrictToUserId ?? null));
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't load stored builds. Refresh the page to try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictToUserId]);

  const handleCreateBuild = async (template: BikeBuildTemplate) => {
    setBusyId(template.id);
    try {
      const result = await createBuildFromTemplate(template, currentUserId, siteId);
      if (result.missing.length === 0) {
        toast.success(`Build created — ${result.allocated} part(s) allocated from stock`);
      } else {
        toast.success(
          `Build created — ${result.allocated} part(s) allocated. Waiting on: ${result.missing
            .map((m) => `${m.quantity} × ${m.category}`)
            .join(", ")}`
        );
      }
      onBuildCreated();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't create the build from this stored spec. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (template: BikeBuildTemplate) => {
    notify.confirm({
      title: `Delete "${template.name}"?`,
      description: "The saved spec is removed. Existing builds are unaffected.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteBuildTemplate(template.id);
          toast.success("Stored build deleted");
          load();
        } catch (err) {
          Sentry.captureException(err);
          toast.error("Couldn't delete that stored build. Try again.");
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Saved specs for stock bikes. One click turns a spec into a live build and pulls the parts from stock.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New stored build
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No stored builds yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{template.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[template.bike_brand, template.bike_model].filter(Boolean).join(" ") ||
                        template.customer_name}
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(template);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 text-xs">
                  {template.sku && <Badge variant="secondary">SKU {template.sku}</Badge>}
                  <Badge variant="outline">{template.items?.length ?? 0} part lines</Badge>
                  {template.bike_type && <Badge variant="outline">{template.bike_type}</Badge>}
                </div>

                {(template.items?.length ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.items!.map((i) => `${i.quantity} × ${i.category}`).join(", ")}
                  </p>
                )}

                <Button
                  className="w-full"
                  size="sm"
                  disabled={busyId === template.id}
                  onClick={() => handleCreateBuild(template)}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  {busyId === template.id ? "Creating…" : "Create build"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BuildTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        isStaff={isStaff}
        customers={customers}
        currentUserId={currentUserId}
        onSaved={load}
      />
    </div>
  );
};

export default StoredBuildsTab;
