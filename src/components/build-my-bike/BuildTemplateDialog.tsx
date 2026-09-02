import React, { useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPONENT_CATEGORIES, slotForCategory, type BikeHotspot } from "@/constants/bikeComponents";
import BikeDiagram from "./BikeDiagram";
import { saveBuildTemplate } from "@/services/bikeBuildService";
import type { BikeBuildTemplate, BikeBuildTemplateFormData } from "@/types/bikeBuild";

const BIKE_TYPES = ["Road", "Mountain", "Hybrid", "Electric", "Gravel", "BMX", "Folding", "Kids", "Other"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: BikeBuildTemplate | null;
  /** Staff pick the customer; customers create against their own account. */
  isStaff: boolean;
  customers: any[];
  currentUserId: string;
  onSaved: () => void;
};

const emptyForm: BikeBuildTemplateFormData = {
  user_id: "",
  name: "",
  sku: "",
  bike_brand: "",
  bike_model: "",
  bike_type: "",
  spec_notes: "",
  items: [],
};

const BuildTemplateDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  template,
  isStaff,
  customers,
  currentUserId,
  onSaved,
}) => {
  const [form, setForm] = useState<BikeBuildTemplateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeSlot, setActiveSlot] = useState<BikeHotspot | null>(null);

  const countsBySlot = useMemo(() => {
    const counts: Record<string, number> = {};
    form.items.forEach((item) => {
      const slot = slotForCategory(item.category);
      if (slot) counts[slot] = (counts[slot] || 0) + (Number(item.quantity) || 1);
    });
    return counts;
  }, [form.items]);

  const visibleItems = useMemo(
    () =>
      form.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !activeSlot || slotForCategory(item.category) === activeSlot.slot),
    [form.items, activeSlot]
  );

  const handleSelectSlot = (hotspot: BikeHotspot) => {
    if (activeSlot?.slot === hotspot.slot) {
      setActiveSlot(null);
      return;
    }
    if (!countsBySlot[hotspot.slot]) {
      setForm((prev) => ({
        ...prev,
        items: [...prev.items, { category: hotspot.categories[0] || "", quantity: 1 }],
      }));
    }
    setActiveSlot(hotspot);
  };

  useEffect(() => {
    if (!open) return;
    setActiveSlot(null);
    if (template) {
      setForm({
        user_id: template.user_id,
        name: template.name,
        sku: template.sku || "",
        bike_brand: template.bike_brand || "",
        bike_model: template.bike_model || "",
        bike_type: template.bike_type || "",
        spec_notes: template.spec_notes || "",
        items: (template.items || []).map((i) => ({
          category: i.category,
          quantity: Number(i.quantity || 1),
          slot: i.slot,
          notes: i.notes,
        })),
      });
    } else {
      setForm({ ...emptyForm, user_id: isStaff ? "" : currentUserId });
    }
  }, [open, template, isStaff, currentUserId]);

  const setItem = (
    index: number,
    patch: Partial<{ category: string; quantity: number; notes: string }>
  ) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const handleSave = async () => {
    const userId = isStaff ? form.user_id : currentUserId;
    if (!userId) {
      toast.error("Pick which customer this stored build belongs to.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Give the stored build a name.");
      return;
    }
    setSaving(true);
    try {
      await saveBuildTemplate({ ...form, user_id: userId }, currentUserId, template?.id ?? null);
      toast.success(template ? "Stored build updated" : "Stored build saved");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't save the stored build. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{template ? "Edit stored build" : "New stored build"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isStaff && (
            <div>
              <Label>Customer *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || c.name || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Trail Pro 29er"
              />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Brand</Label>
              <Input value={form.bike_brand} onChange={(e) => setForm({ ...form, bike_brand: e.target.value })} />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.bike_model} onChange={(e) => setForm({ ...form, bike_model: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Bike type</Label>
            <Select value={form.bike_type} onValueChange={(v) => setForm({ ...form, bike_type: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {BIKE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2">
              <Label>Parts needed</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    items: [
                      ...prev.items,
                      { category: activeSlot?.categories[0] || "", quantity: 1 },
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add part
              </Button>
            </div>

            <BikeDiagram countsBySlot={countsBySlot} onSelectSlot={handleSelectSlot} />

            <div className="mt-2 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {activeSlot ? `Area: ${activeSlot.label}` : "Tap an area on the bike to focus its parts"}
              </span>
              {activeSlot && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setActiveSlot(null)}>
                  Show all parts
                </Button>
              )}
            </div>

            {form.items.length === 0 ? (
              <p className="text-xs text-muted-foreground border rounded-md p-3 text-center">
                Add the part categories this spec needs, e.g. Frame, Fork, Wheelset, Groupset.
              </p>
            ) : visibleItems.length === 0 ? (
              <p className="text-xs text-muted-foreground border rounded-md p-3 text-center">
                No parts on this spec for that area yet.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleItems.map(({ item, index }) => (
                  <div key={index} className="space-y-2 border rounded-md p-2">
                    <div className="flex items-center gap-2">
                      <Select value={item.category} onValueChange={(v) => setItem(index, { category: v })}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPONENT_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={item.quantity}
                        onChange={(e) => setItem(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={item.notes || ""}
                      onChange={(e) => setItem(index, { notes: e.target.value })}
                      placeholder="Exact spec, e.g. Continental Terra Speed 700x40c"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Spec notes</Label>
            <Textarea
              value={form.spec_notes}
              onChange={(e) => setForm({ ...form, spec_notes: e.target.value })}
              placeholder="Anything the workshop needs to know about this spec"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save stored build"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuildTemplateDialog;
