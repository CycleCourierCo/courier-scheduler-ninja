import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { UnallocatedBoxFoamJob } from '@/services/mechanicHoursService';

interface Props {
  jobs: UnallocatedBoxFoamJob[];
  mechanics: { id: string; name: string }[];
}

export function UnallocatedBoxFoamCard({ jobs, mechanics }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: mechanicProfiles } = useQuery({
    queryKey: ['mechanic-profiles-for-allocation'],
    queryFn: async () => {
      let { data } = await supabase
        .from('profiles')
        .select('id, name, email, is_active')
        .eq('role', 'mechanic' as any);
      data = (data || []).filter((p: any) => p.is_active !== false);
      return (data || []).map((p: any) => ({ id: p.id as string, name: (p.name || p.email || 'Mechanic') as string }));
    },
  });

  const options = useMemo(() => {
    const m = new Map<string, string>();
    [...mechanics, ...(mechanicProfiles || [])].forEach((x) => m.set(x.id, x.name));
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mechanics, mechanicProfiles]);

  const allocate = async (job: UnallocatedBoxFoamJob, mechanicId: string) => {
    const key = `${job.orderId}-${job.kind}`;
    setSaving(key);
    const patch = job.kind === 'box' ? { box_boxed_by_id: mechanicId } : { foam_foamed_by_id: mechanicId };
    const { error } = await supabase.from('orders').update(patch as any).eq('id', job.orderId);
    setSaving(null);
    if (error) {
      toast.error(`Couldn't allocate: ${error.message}`);
      return;
    }
    toast.success('Job allocated');
    qc.invalidateQueries({ queryKey: ['mechanic-hours'] });
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Needs allocating ({jobs.length})</CardTitle>
        <CardDescription>
          These Box My Bike / Foam My Bike jobs weren't assigned to anyone. Pick who did each one — it adds 45 minutes to
          their earned hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {jobs.map((j) => {
            const key = `${j.orderId}-${j.kind}`;
            return (
              <li key={key} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{j.kind === 'box' ? 'Box My Bike' : 'Foam My Bike'}</Badge>
                    <span className="font-medium break-all">{j.tracking}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {j.bike} · {new Date(j.doneAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <Select disabled={saving === key} onValueChange={(v) => allocate(j, v)}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Allocate to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
