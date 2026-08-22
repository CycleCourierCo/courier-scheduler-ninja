import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useReviewableUsers } from "@/hooks/useReviews";
import { createReviewCycle } from "@/services/reviewService";
import { REVIEW_TYPE_LABELS, type ReviewType } from "@/types/review";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  defaultReviewerId?: string;
}

const NewReviewDialog: React.FC<Props> = ({ open, onOpenChange, onCreated, defaultReviewerId }) => {
  const { data: users = [] } = useReviewableUsers();
  const [employeeId, setEmployeeId] = useState("");
  const [reviewerId, setReviewerId] = useState(defaultReviewerId ?? "");
  const [reviewType, setReviewType] = useState<ReviewType>("quarterly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!employeeId || !periodStart || !periodEnd) {
      toast.error("Employee and review period are required");
      return;
    }
    if (periodEnd < periodStart) {
      toast.error("Period end must be after period start");
      return;
    }
    setSaving(true);
    try {
      const cycle = await createReviewCycle({
        employee_id: employeeId,
        reviewer_id: reviewerId || null,
        review_type: reviewType,
        period_start: periodStart,
        period_end: periodEnd,
        review_date: reviewDate || null,
      });
      toast.success("Review created");
      onOpenChange(false);
      onCreated(cycle.id);
    } catch (e: any) {
      toast.error(e?.message || "Could not create the review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New review</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Reviewer / manager</Label>
            <Select value={reviewerId} onValueChange={setReviewerId}>
              <SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Review type</Label>
            <Select value={reviewType} onValueChange={v => setReviewType(v as ReviewType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REVIEW_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Period start</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Period end</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Review meeting date (optional)</Label>
            <Input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewReviewDialog;
