import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import {
  createCannedResponse, deleteCannedResponse, updateCannedResponse,
  type CsCannedResponse,
} from "@/services/cannedResponseService";

const PLACEHOLDERS = ['{{customer_name}}', '{{ticket_ref}}', '{{tracking_number}}', '{{order_status}}', '{{my_name}}'];

const CannedResponseManager: React.FC = () => {
  const qc = useQueryClient();
  const { data: responses = [], isLoading } = useCannedResponses(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: '', category: 'General', body: '', keywords: '' });

  const refresh = () => qc.invalidateQueries({ queryKey: ['cs-canned-responses'] });

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const parseKeywords = (raw: string) =>
    raw.split(',').map(k => k.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add an instant response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Title, e.g. Tracking / where is my bike"
              value={draft.title}
              onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
            />
            <Input
              placeholder="Category, e.g. Deliveries"
              value={draft.category}
              onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))}
            />
          </div>
          <Textarea
            rows={5}
            placeholder="The message staff will send…"
            value={draft.body}
            onChange={(e) => setDraft(d => ({ ...d, body: e.target.value }))}
          />
          <Input
            placeholder="Trigger words, comma separated — e.g. tracking, where is my bike"
            value={draft.keywords}
            onChange={(e) => setDraft(d => ({ ...d, keywords: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            You can use:
            {PLACEHOLDERS.map(p => <code key={p} className="bg-muted rounded px-1">{p}</code>)}
          </div>
          <Button
            disabled={busy || !draft.title.trim() || !draft.body.trim()}
            onClick={() => run(async () => {
              await createCannedResponse({
                title: draft.title.trim(),
                category: draft.category,
                body: draft.body,
                keywords: parseKeywords(draft.keywords),
              });
              setDraft({ title: '', category: 'General', body: '', keywords: '' });
            }, 'Instant response added')}
          >
            <Plus className="h-4 w-4 mr-1" />Add response
          </Button>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Loading instant responses…</p>}

      {responses.map((r: CsCannedResponse) => (
        <Card key={r.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center flex-wrap gap-2">
              <CardTitle className="text-base">{r.title}</CardTitle>
              <Badge variant="secondary">{r.category}</Badge>
              {!r.is_active && <Badge variant="outline">Hidden</Badge>}
              <div className="ml-auto flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Active
                  <Switch
                    checked={r.is_active}
                    disabled={busy}
                    onCheckedChange={(v) => run(
                      () => updateCannedResponse(r.id, { is_active: v }),
                      v ? 'Shown in the inbox' : 'Hidden from the inbox',
                    )}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={busy}
                  onClick={() => run(() => deleteCannedResponse(r.id), 'Instant response deleted')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <Input
                className="h-8 text-sm"
                defaultValue={r.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v || v === r.title) return;
                  run(() => updateCannedResponse(r.id, { title: v }), 'Title updated');
                }}
              />
              <Input
                className="h-8 text-sm sm:w-40"
                defaultValue={r.category}
                onBlur={(e) => {
                  const v = e.target.value.trim() || 'General';
                  if (v === r.category) return;
                  run(() => updateCannedResponse(r.id, { category: v }), 'Category updated');
                }}
              />
            </div>
            <Textarea
              rows={6}
              className="text-sm"
              defaultValue={r.body}
              onBlur={(e) => {
                const v = e.target.value;
                if (!v.trim() || v === r.body) return;
                run(() => updateCannedResponse(r.id, { body: v }), 'Message updated');
              }}
            />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Trigger words (comma separated)</div>
              <Input
                className="h-8 text-sm"
                defaultValue={(r.keywords || []).join(', ')}
                onBlur={(e) => {
                  const list = parseKeywords(e.target.value);
                  if (list.join('|') === (r.keywords || []).join('|')) return;
                  run(() => updateCannedResponse(r.id, { keywords: list }), 'Trigger words updated');
                }}
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Order in the list</div>
              <Input
                type="number"
                className="h-8 text-sm sm:w-28"
                defaultValue={r.sort_order}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n) || n === r.sort_order) return;
                  run(() => updateCannedResponse(r.id, { sort_order: n }), 'Order updated');
                }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CannedResponseManager;
