import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createWorkshopInspection } from "@/services/inspectionService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createdById: string;
  createdByName: string;
  onCreated?: () => void;
}

export default function NewWorkshopInspectionDialog({
  open,
  onOpenChange,
  createdById,
  createdByName,
  onCreated,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_company: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    bike_brand: "",
    bike_model: "",
    frame_size: "",
    reference: "",
    notes: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.customer_name.trim()) {
      toast.error("Please enter the customer's name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())) {
      toast.error("Please enter a valid customer email address");
      return;
    }
    setSaving(true);
    try {
      await createWorkshopInspection(
        {
          customer_name: form.customer_name.trim(),
          customer_email: form.customer_email.trim(),
          customer_phone: form.customer_phone.trim() || null,
          customer_company: form.customer_company.trim() || null,
          customer_address:
            form.line1.trim() || form.city.trim() || form.postcode.trim()
              ? {
                  line1: form.line1.trim() || null,
                  line2: form.line2.trim() || null,
                  city: form.city.trim() || null,
                  postcode: form.postcode.trim() || null,
                }
              : null,
          bike_brand: form.bike_brand.trim() || null,
          bike_model: form.bike_model.trim() || null,
          frame_size: form.frame_size.trim() || null,
          reference: form.reference.trim() || null,
          notes: form.notes.trim() || null,
        },
        createdById,
        createdByName
      );
      toast.success("Workshop inspection created");
      setForm({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_company: "",
        line1: "",
        line2: "",
        city: "",
        postcode: "",
        bike_brand: "",
        bike_model: "",
        frame_size: "",
        reference: "",
        notes: "",
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("Error creating workshop inspection:", err);
      toast.error("Couldn't create the inspection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New workshop inspection</DialogTitle>
          <DialogDescription>
            For a bike brought straight to the workshop. The customer gets the repair approval email
            and the invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wi-name">Customer name *</Label>
              <Input id="wi-name" value={form.customer_name} onChange={set("customer_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-email">Email *</Label>
              <Input id="wi-email" type="email" value={form.customer_email} onChange={set("customer_email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-phone">Phone</Label>
              <Input id="wi-phone" value={form.customer_phone} onChange={set("customer_phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-company">Company</Label>
              <Input id="wi-company" value={form.customer_company} onChange={set("customer_company")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wi-line1">Address line 1</Label>
              <Input id="wi-line1" value={form.line1} onChange={set("line1")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wi-line2">Address line 2</Label>
              <Input id="wi-line2" value={form.line2} onChange={set("line2")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-city">City</Label>
              <Input id="wi-city" value={form.city} onChange={set("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-postcode">Postcode</Label>
              <Input id="wi-postcode" value={form.postcode} onChange={set("postcode")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="wi-brand">Bike make</Label>
              <Input id="wi-brand" value={form.bike_brand} onChange={set("bike_brand")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-model">Model</Label>
              <Input id="wi-model" value={form.bike_model} onChange={set("bike_model")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-size">Frame size</Label>
              <Input id="wi-size" value={form.frame_size} onChange={set("frame_size")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wi-ref">Your reference</Label>
            <Input id="wi-ref" value={form.reference} onChange={set("reference")} placeholder="e.g. job sheet number" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wi-notes">Notes</Label>
            <Textarea id="wi-notes" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
