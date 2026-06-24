import React, { useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Warehouse, ArrowUp, ArrowDown } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useStorageBays, StorageBay } from "@/hooks/useStorageBays";

const StorageBaysPage: React.FC = () => {
  const { bays, loading, refresh } = useStorageBays(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StorageBay | null>(null);
  const [label, setLabel] = useState("");
  const [positionCount, setPositionCount] = useState("20");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setLabel("");
    setPositionCount("20");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (bay: StorageBay) => {
    setEditing(bay);
    setLabel(bay.label);
    setPositionCount(String(bay.position_count));
    setIsActive(bay.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const cleanLabel = label.trim().toUpperCase();
    const count = parseInt(positionCount, 10);
    if (!cleanLabel) return toast.error("Label is required");
    if (!Number.isFinite(count) || count < 1 || count > 100)
      return toast.error("Positions must be 1–100");

    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase.from("storage_bays" as any) as any)
          .update({ label: cleanLabel, position_count: count, is_active: isActive })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Bay updated");
      } else {
        const maxOrder = Math.max(0, ...bays.map((b) => b.display_order));
        const { error } = await (supabase.from("storage_bays" as any) as any).insert({
          label: cleanLabel,
          position_count: count,
          is_active: isActive,
          display_order: maxOrder + 1,
        });
        if (error) throw error;
        toast.success("Bay added");
      }
      setDialogOpen(false);
      refresh();
    } catch (err: any) {
      Sentry.captureException(err);
      toast.error(err?.message || "Failed to save bay");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bay: StorageBay) => {
    if (!confirm(`Delete bay ${bay.label}? This cannot be undone.`)) return;
    try {
      const { error } = await (supabase.from("storage_bays" as any) as any)
        .delete()
        .eq("id", bay.id);
      if (error) throw error;
      toast.success("Bay deleted");
      refresh();
    } catch (err: any) {
      Sentry.captureException(err);
      toast.error(err?.message || "Failed to delete bay (it may still be in use)");
    }
  };

  const move = async (bay: StorageBay, direction: -1 | 1) => {
    const sorted = [...bays].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((b) => b.id === bay.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    try {
      await Promise.all([
        (supabase.from("storage_bays" as any) as any)
          .update({ display_order: other.display_order })
          .eq("id", bay.id),
        (supabase.from("storage_bays" as any) as any)
          .update({ display_order: bay.display_order })
          .eq("id", other.id),
      ]);
      refresh();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Failed to reorder");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Warehouse className="h-6 w-6" />
              Storage Bays
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure the bays and slot counts used on the Loading &amp; Warehouse Stock pages.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Add Bay
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : bays.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No bays configured yet.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Bay</TableHead>
                  <TableHead>Slots</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bays.map((bay, idx) => (
                  <TableRow key={bay.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(bay, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={idx === bays.length - 1} onClick={() => move(bay, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-lg">{bay.label}</TableCell>
                    <TableCell>{bay.position_count}</TableCell>
                    <TableCell>
                      {bay.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(bay)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(bay)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Bay" : "Add Bay"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bay Label *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value.toUpperCase())}
                placeholder="e.g. K"
                maxLength={4}
                className="uppercase font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Short letter/code. Must be unique.</p>
            </div>
            <div>
              <Label>Number of Slots *</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={positionCount}
                onChange={(e) => setPositionCount(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive bays are hidden from loaders.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save" : "Add Bay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default StorageBaysPage;
