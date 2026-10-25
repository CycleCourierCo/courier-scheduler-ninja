import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getInspection, listTemplates, saveResult, updateInspection, createCorrection, defectFromResult,
  type Inspection, type InspectionResult, type InspectionTemplate, type Defect,
} from "@/services/fleetInspectionService";
import { CHECK_RESULTS, TYRE_FIELDS, finaliseErrors, treadState, INSPECTION_RESULT_LABEL } from "@/lib/fleet/inspections";
import { SEVERITY_RAG } from "@/lib/fleet/defects";

const InspectionForm = () => {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [results, setResults] = useState<InspectionResult[]>([]);
  const [tpl, setTpl] = useState<InspectionTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [corrReason, setCorrReason] = useState("");
  const [defectFor, setDefectFor] = useState<InspectionResult | null>(null);
  const [defSev, setDefSev] = useState<Defect["severity"]>("medium");

  const load = async () => {
    try {
      const { insp, results } = await getInspection(id);
      setInsp(insp); setResults(results);
      const t = await listTemplates();
      setTpl(t.find((x) => x.id === insp.template_id) ?? null);
    } catch (e) { toast.error(`Couldn't load inspection — ${(e as Error).message}`); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const locked = insp?.status === "final";
  const groups = useMemo(() => {
    const m = new Map<string, InspectionResult[]>();
    results.forEach((r) => m.set(r.category, [...(m.get(r.category) ?? []), r]));
    return [...m.entries()];
  }, [results]);

  const patchLocal = (rid: string, p: Partial<InspectionResult>) => setResults((rs) => rs.map((r) => (r.id === rid ? { ...r, ...p } : r)));
  const persist = async (rid: string, p: Partial<InspectionResult>) => {
    patchLocal(rid, p);
    try { await saveResult(rid, p); } catch (e) { toast.error(`Not saved — ${(e as Error).message}`); }
  };
  const persistHeader = async (p: Partial<Inspection>) => {
    setInsp((i) => (i ? { ...i, ...p } : i));
    try { await updateInspection(id, p); } catch (e) { toast.error(`Not saved — ${(e as Error).message}`); }
  };

  const finalise = async () => {
    if (!insp) return;
    const errs = finaliseErrors(results, { requiresCompetentInspector: !!tpl?.requires_competent_inspector, inspectorName: insp.inspector_name, inspectorOrganisation: insp.inspector_organisation });
    if (errs.length) return errs.forEach((e) => toast.error(e));
    setBusy(true);
    try { await updateInspection(id, { status: "final" }); toast.success("Inspection finalised and locked"); load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const correct = async () => {
    if (!insp || !corrReason.trim()) return toast.error("Give a reason for the correction");
    setBusy(true);
    try { const n = await createCorrection(insp, results, corrReason.trim()); setCorrecting(false); nav(`/fleet/inspections/${n.id}`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const raiseDefect = async () => {
    if (!insp || !defectFor) return;
    setBusy(true);
    try { await defectFromResult(insp, defectFor, defSev); toast.success("Defect raised"); setDefectFor(null); load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!insp) return <Layout><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Layout>;
  const fails = results.filter((r) => r.result === "fail").length;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-3xl">
        <Link to={`/fleet/vehicles/${insp.vehicle_id}`} className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft className="h-4 w-4" /> Back to van</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{tpl?.name ?? insp.inspection_type}</h1>
          {locked ? <Badge><Lock className="h-3 w-3 mr-1" />Final · {INSPECTION_RESULT_LABEL[insp.overall_result ?? ""] ?? ""}</Badge> : <Badge variant="secondary">Draft</Badge>}
          {fails > 0 && <Badge variant="destructive">{fails} failed</Badge>}
        </div>
        {tpl?.description && <p className="text-sm text-muted-foreground">{tpl.description}</p>}
        {insp.supersedes_id && (
          <Card className="p-3 text-sm">Correction of <Link className="underline" to={`/fleet/inspections/${insp.supersedes_id}`}>an earlier inspection</Link>. Reason: {insp.correction_reason}</Card>
        )}

        <Card className="p-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="when">Date and time</Label>
            <Input id="when" type="datetime-local" disabled={locked} value={insp.inspected_at.slice(0, 16)} onChange={(e) => persistHeader({ inspected_at: new Date(e.target.value).toISOString() })} /></div>
          <div className="space-y-1"><Label htmlFor="odo">Mileage</Label>
            <Input id="odo" type="number" inputMode="numeric" disabled={locked} value={insp.odometer_mi ?? ""} onChange={(e) => setInsp({ ...insp, odometer_mi: e.target.value ? Number(e.target.value) : null })} onBlur={() => persistHeader({ odometer_mi: insp.odometer_mi })} /></div>
          <div className="space-y-1"><Label htmlFor="iname">Inspector name{tpl?.requires_competent_inspector ? " *" : ""}</Label>
            <Input id="iname" disabled={locked} value={insp.inspector_name ?? ""} onChange={(e) => setInsp({ ...insp, inspector_name: e.target.value })} onBlur={() => persistHeader({ inspector_name: insp.inspector_name })} /></div>
          <div className="space-y-1"><Label htmlFor="iorg">Garage / organisation{tpl?.requires_competent_inspector ? " *" : ""}</Label>
            <Input id="iorg" disabled={locked} value={insp.inspector_organisation ?? ""} onChange={(e) => setInsp({ ...insp, inspector_organisation: e.target.value })} onBlur={() => persistHeader({ inspector_organisation: insp.inspector_organisation })} /></div>
        </Card>

        {groups.map(([cat, rows]) => (
          <Card key={cat} className="p-3 space-y-3">
            <h2 className="font-semibold">{cat}</h2>
            {rows.map((r) => (
              <div key={r.id} className="space-y-2 border-t pt-2 first:border-0 first:pt-0">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="grid grid-cols-4 gap-1">
                  {CHECK_RESULTS.map((o) => (
                    <Button key={o.value} type="button" size="sm" disabled={locked}
                      variant={r.result === o.value ? (o.value === "fail" ? "destructive" : "default") : "outline"}
                      onClick={() => persist(r.id, { result: o.value })}>{o.label}</Button>
                  ))}
                </div>
                {r.is_tyre && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TYRE_FIELDS.map((t) => {
                      const v = (r as any)[t.key] as number | null;
                      const s = treadState(v);
                      return (
                        <div key={t.key} className="space-y-1">
                          <Label className="text-xs">{t.label} (mm)</Label>
                          <Input type="number" step="0.1" inputMode="decimal" disabled={locked} value={v ?? ""}
                            className={s === "red" ? "border-destructive" : s === "amber" ? "border-status-waiting" : ""}
                            onChange={(e) => patchLocal(r.id, { [t.key]: e.target.value === "" ? null : Number(e.target.value) } as any)}
                            onBlur={() => saveResult(r.id, { [t.key]: (results.find((x) => x.id === r.id) as any)?.[t.key] ?? null } as any).catch((e) => toast.error(e.message))} />
                          {s === "red" && <p className="text-xs text-destructive">Below legal 1.6mm</p>}
                          {s === "amber" && <p className="text-xs text-status-waiting">Low — plan replacement</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {(r.result === "fail" || r.result === "not_checked") && (
                  <Textarea rows={2} disabled={locked} placeholder={r.result === "fail" ? "What's wrong? (required)" : "Why wasn't this checked? (required)"}
                    value={r.reason ?? ""} onChange={(e) => patchLocal(r.id, { reason: e.target.value })} onBlur={() => saveResult(r.id, { reason: results.find((x) => x.id === r.id)?.reason ?? null }).catch((e) => toast.error(e.message))} />
                )}
                {r.result === "fail" && (r.defect_id
                  ? <p className="text-xs text-muted-foreground">Defect raised.</p>
                  : <Button size="sm" variant="outline" onClick={() => { setDefectFor(r); setDefSev("medium"); }}><AlertTriangle className="h-4 w-4 mr-1" />Raise defect</Button>)}
              </div>
            ))}
          </Card>
        ))}

        <Card className="p-3 space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} disabled={locked} value={insp.notes ?? ""} onChange={(e) => setInsp({ ...insp, notes: e.target.value })} onBlur={() => persistHeader({ notes: insp.notes })} />
        </Card>

        <div className="flex justify-end gap-2 pb-8">
          {locked
            ? <Button variant="outline" onClick={() => { setCorrReason(""); setCorrecting(true); }}>Create correction</Button>
            : <Button onClick={finalise} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Finalise and lock</Button>}
        </div>
      </div>

      <Dialog open={correcting} onOpenChange={setCorrecting}>
        <DialogContent>
          <DialogHeader><DialogTitle>Correct this inspection</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The original stays locked. A new draft copy is created and linked to it.</p>
          <Textarea rows={3} placeholder="Reason for the correction" value={corrReason} onChange={(e) => setCorrReason(e.target.value)} />
          <DialogFooter><Button onClick={correct} disabled={busy}>Create correction</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!defectFor} onOpenChange={(o) => !o && setDefectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise defect</DialogTitle></DialogHeader>
          <p className="text-sm"><strong>{defectFor?.label}</strong>{defectFor?.reason ? ` — ${defectFor.reason}` : ""}</p>
          <Label>Severity</Label>
          <Select value={defSev} onValueChange={(v) => setDefSev(v as Defect["severity"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">{SEVERITY_RAG.high.label} — unsafe, off the road</SelectItem>
              <SelectItem value="medium">{SEVERITY_RAG.medium.label} — fix soon</SelectItem>
              <SelectItem value="low">{SEVERITY_RAG.low.label} — minor</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter><Button onClick={raiseDefect} disabled={busy}>Raise defect</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default InspectionForm;
