import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarCheck, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  setGuaranteedDelivery,
  clearGuaranteedDelivery,
  type GuaranteedDeliveryPayer,
} from "@/services/orderService";

interface GuaranteedDeliveryCardProps {
  order: any;
  onUpdate?: () => void;
}

const GuaranteedDeliveryCard = ({ order, onUpdate }: GuaranteedDeliveryCardProps) => {
  const [open, setOpen] = useState(false);
  const [payer, setPayer] = useState<GuaranteedDeliveryPayer>("account");
  const [amount, setAmount] = useState<string>("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isOn = !!order?.guaranteed_delivery;
  const currentPayer = order?.guaranteed_delivery_payer as GuaranteedDeliveryPayer | null;
  const currentAmount = Number(order?.guaranteed_delivery_amount || 0);

  const payerLabel = (p?: string | null) => {
    if (p === "sender") return order?.sender?.name ? `Sender (${order.sender.name})` : "Sender";
    if (p === "receiver") return order?.receiver?.name ? `Receiver (${order.receiver.name})` : "Receiver";
    return "Booking account (weekly invoice)";
  };

  const handleConfirm = async () => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (payer !== "account" && parsed <= 0) {
      toast.error("A standalone invoice needs an amount greater than £0");
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      await setGuaranteedDelivery(order.id, payer, parsed, note.trim() || undefined, {
        id: user?.id,
        name: (user?.user_metadata as any)?.name || user?.email || null,
      });

      if (payer === "account") {
        toast.success(
          parsed > 0
            ? `Guaranteed delivery set — £${parsed.toFixed(2)} will be added to their weekly invoice`
            : "Guaranteed delivery set — no surcharge added"
        );
      } else {
        const { data, error } = await supabase.functions.invoke(
          "create-guaranteed-delivery-invoice",
          { body: { orderId: order.id } }
        );

        if (error || (data as any)?.error) {
          const msg = (data as any)?.error || error?.message || "Invoice creation failed";
          toast.error(`Guarantee saved, but invoice failed: ${msg}`);
        } else {
          const inv = data as any;
          toast.success(`Guaranteed delivery invoiced (#${inv.invoiceNumber})`, {
            action: inv.invoiceUrl
              ? { label: "Open", onClick: () => window.open(inv.invoiceUrl, "_blank") }
              : undefined,
          });
        }
      }

      setOpen(false);
      setNote("");
      onUpdate?.();
    } catch (err: any) {
      console.error("Failed to set guaranteed delivery:", err);
      toast.error(err?.message || "Failed to set guaranteed delivery");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await clearGuaranteedDelivery(order.id);
      toast.success("Guaranteed delivery removed");
      onUpdate?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove guaranteed delivery");
    } finally {
      setRemoving(false);
    }
  };

  const openEdit = () => {
    setPayer((currentPayer as GuaranteedDeliveryPayer) || "account");
    setAmount(String(currentAmount || 0));
    setNote(order?.guaranteed_delivery_note || "");
    setOpen(true);
  };

  const markedAt = order?.guaranteed_delivery_marked_at
    ? new Date(order.guaranteed_delivery_marked_at).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const Shell = ({ children }: { children: React.ReactNode }) =>
    bare ? (
      <div>{children}</div>
    ) : (
      <Card className={isOn ? "overflow-hidden border-green-500/50" : "overflow-hidden"}>{children}</Card>
    );

  return (
    <Shell>
      {!bare && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {isOn ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <CalendarCheck className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">Guaranteed Date Delivery</span>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={bare ? "space-y-3 p-0" : "space-y-3"}>

        {isOn ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-green-600 hover:bg-green-600 text-white">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Guaranteed — confirmed
              </Badge>
              {order?.guaranteed_delivery_invoice_number && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer break-all"
                  onClick={() =>
                    order.guaranteed_delivery_invoice_url &&
                    window.open(order.guaranteed_delivery_invoice_url, "_blank")
                  }
                >
                  Invoice #{order.guaranteed_delivery_invoice_number}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {(order as any)?.guaranteed_delivery_invoice_public_url && (
                <Badge
                  variant="outline"
                  className="cursor-pointer break-all"
                  onClick={() =>
                    window.open((order as any).guaranteed_delivery_invoice_public_url, "_blank")
                  }
                >
                  Customer link
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Badge>
              )}
            </div>


            <dl className="space-y-1.5 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Extra charge:</dt>
                <dd className="font-medium break-words">
                  £{currentAmount.toFixed(2)} <span className="text-muted-foreground font-normal">excl. VAT</span>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Paid by:</dt>
                <dd className="font-medium break-words">{payerLabel(currentPayer)}</dd>
              </div>
              {markedAt && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Marked:</dt>
                  <dd className="break-words">
                    {markedAt}
                    {order?.guaranteed_delivery_marked_by_name
                      ? ` by ${order.guaranteed_delivery_marked_by_name}`
                      : ""}
                  </dd>
                </div>
              )}
              {order?.guaranteed_delivery_note && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Note:</dt>
                  <dd className="break-words">{order.guaranteed_delivery_note}</dd>
                </div>
              )}
            </dl>

            {currentPayer === "account" && !order?.guaranteed_delivery_invoice_number && (
              <p className="text-xs text-muted-foreground">
                This surcharge will be added to the booking account's next weekly invoice.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openEdit}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={handleRemove} disabled={removing}>
                {removing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Mark this order as a guaranteed delivery date and charge the surcharge to whoever is paying.
            </p>
            <Button size="sm" onClick={() => setOpen(true)}>
              <CalendarCheck className="mr-2 h-4 w-4" />
              Guaranteed date delivery
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guaranteed date delivery</DialogTitle>
            <DialogDescription>
              Confirm who is paying and how much extra to charge for guaranteeing this delivery date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Who is paying?</Label>
              <RadioGroup
                value={payer}
                onValueChange={(v) => setPayer(v as GuaranteedDeliveryPayer)}
                className="space-y-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="account" id="gd-account" className="mt-1" />
                  <Label htmlFor="gd-account" className="font-normal leading-snug">
                    Account that created it — add to their weekly invoice
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="sender" id="gd-sender" className="mt-1" />
                  <Label htmlFor="gd-sender" className="font-normal leading-snug">
                    Sender{order?.sender?.name ? ` — ${order.sender.name}` : ""} — separate invoice now
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="receiver" id="gd-receiver" className="mt-1" />
                  <Label htmlFor="gd-receiver" className="font-normal leading-snug">
                    Receiver{order?.receiver?.name ? ` — ${order.receiver.name}` : ""} — separate invoice now
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gd-amount">Extra amount to pay (£, excl. VAT)</Label>
              <Input
                id="gd-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gd-note">Note (optional)</Label>
              <Textarea
                id="gd-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Guaranteed delivery on 14 May"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default GuaranteedDeliveryCard;
