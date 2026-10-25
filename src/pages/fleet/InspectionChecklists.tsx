import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listTemplates, listTemplateItems, type InspectionTemplate, type TemplateItem } from "@/services/fleetInspectionService";

const db = supabase as any;

const InspectionChecklists = () => {
  const [tpls, setTpls] = useState<InspectionTemplate[]>([]);
  const [sel, setSel] = useState("");
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [cat, setCat] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => { listTemplates().then((t) => { setTpls(t); setSel(t[0]?.id ?? ""); }).catch((e) => toast.error(e.message)); }, []);
  const loadItems = () => sel && listTemplateItems(sel).then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { loadItems(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel]);

  const tpl = tpls.find((t) => t.id === sel);
  const cats = [...new Set(items.map((i) => i.category))];

  const upd = async (table: string, id: string, patch: any) => {
    const { error } = await db.from(table).update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const add = async () => {
    if (!cat.trim() || !label.trim()) return toast.error("Pick a category and enter the check");
    const { error } = await db.from("fleet_inspection_template_items").insert({ template_id: sel, category: cat.trim(), label: label.trim(), sort_order: (items.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return toast.error(error.message);
    setLabel(""); loadItems();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-3xl">
        <Link to="/fleet" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft className="h-4 w-4" /> Fleet dashboard</Link>
        <h1 className="text-xl font-bold">Inspection checklists</h1>
        <p className="text-sm text-muted-foreground">Changes apply to inspections started from now on. Past inspections keep the checks they were done with.</p>
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{tpls.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        {tpl && (
          <Card className="p-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><Switch checked={tpl.active} onCheckedChange={(v) => { setTpls(tpls.map((t) => t.id === tpl.id ? { ...t, active: v } : t)); upd("fleet_inspection_templates", tpl.id, { active: v }); }} />In use</label>
            <label className="flex items-center gap-2"><Switch checked={tpl.requires_competent_inspector} onCheckedChange={(v) => { setTpls(tpls.map((t) => t.id === tpl.id ? { ...t, requires_competent_inspector: v } : t)); upd("fleet_inspection_templates", tpl.id, { requires_competent_inspector: v }); }} />Needs garage / competent inspector</label>
          </Card>
        )}
        {cats.map((c) => (
          <Card key={c} className="p-3 space-y-2">
            <h2 className="font-semibold">{c}</h2>
            {items.filter((i) => i.category === c).map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <Input defaultValue={i.label} onBlur={(e) => e.target.value.trim() && e.target.value !== i.label && upd("fleet_inspection_template_items", i.id, { label: e.target.value.trim() })} />
                <Switch checked={i.active} aria-label="In use" onCheckedChange={(v) => { setItems(items.map((x) => x.id === i.id ? { ...x, active: v } : x)); upd("fleet_inspection_template_items", i.id, { active: v }); }} />
              </div>
            ))}
          </Card>
        ))}
        <Card className="p-3 space-y-2">
          <h2 className="font-semibold">Add a check</h2>
          <div className="space-y-1"><Label htmlFor="cat">Category</Label><Input id="cat" list="cats" value={cat} onChange={(e) => setCat(e.target.value)} />
            <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="space-y-1"><Label htmlFor="lbl">Check</Label><Input id="lbl" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <Button onClick={add}>Add</Button>
        </Card>
      </div>
    </Layout>
  );
};

export default InspectionChecklists;
