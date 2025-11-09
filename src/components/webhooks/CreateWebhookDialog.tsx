import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AVAILABLE_EVENTS = [
  { id: 'order.created', label: 'Order Created' },
  { id: 'order.status.updated', label: 'Status Updated' },
  { id: 'order.collection.started', label: 'Collection Started' },
  { id: 'order.collection.completed', label: 'Collection Completed' },
  { id: 'order.delivery.started', label: 'Delivery Started' },
  { id: 'order.delivery.completed', label: 'Delivery Completed' },
  { id: 'order.delivery.failed', label: 'Delivery Failed' },
  { id: 'order.cancelled', label: 'Order Cancelled' },
];

export function CreateWebhookDialog({ open, onOpenChange, onSuccess }: CreateWebhookDialogProps) {
  const [step, setStep] = useState<'form' | 'secret'>('form');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState('');

  const resetForm = () => {
    setStep('form');
    setName('');
    setEndpointUrl('');
    setSelectedEvents([]);
    setGeneratedSecret('');
    setCopied(false);
    setUserId('');
  };

  const handleSubmit = async () => {
    if (!name || !endpointUrl || selectedEvents.length === 0) {
      toast.error("Please fill in all fields and select at least one event");
      return;
    }

    if (!userId) {
      toast.error("Please enter a user ID");
      return;
    }

    // Validate URL
    try {
      const url = new URL(endpointUrl);
      if (url.protocol !== 'https:') {
        toast.error("Endpoint URL must use HTTPS");
        return;
      }
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc('admin_generate_webhook_secret', {
      p_user_id: userId,
      p_name: name,
      p_endpoint_url: endpointUrl,
      p_events: selectedEvents,
    });

    if (error) {
      toast.error("Failed to create webhook");
      console.error(error);
    } else if (data && data.length > 0) {
      setGeneratedSecret(data[0].webhook_secret);
      setStep('secret');
      toast.success("Webhook created successfully");
    }

    setLoading(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedSecret);
    setCopied(true);
    toast.success("Secret copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (step === 'secret') {
      onSuccess();
    }
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook endpoint to receive order event notifications
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Customer User ID *</Label>
                <Input
                  id="userId"
                  placeholder="Enter customer user ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Webhook Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Webhook"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpointUrl">Endpoint URL * (must be HTTPS)</Label>
                <Input
                  id="endpointUrl"
                  type="url"
                  placeholder="https://example.com/webhooks/orders"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Events to Subscribe *</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={selectedEvents.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <label
                        htmlFor={event.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {event.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Creating..." : "Create Webhook"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Webhook Secret</DialogTitle>
              <DialogDescription>
                Save this secret securely. You won't be able to see it again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <Label>Webhook Secret</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background p-3 rounded text-sm break-all">
                    {generatedSecret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Use this secret to verify webhook signatures</p>
                <p>• Store it securely in your application</p>
                <p>• Never share it publicly or commit it to version control</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
