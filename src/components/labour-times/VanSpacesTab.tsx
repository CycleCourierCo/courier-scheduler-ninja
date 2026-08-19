import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  BikeTypeSpaceRow,
  DEFAULT_VAN_SPACES_CAPACITY,
  formatSpaces,
  useBikeSpaces,
  useUpdateBikeSpaces,
} from "@/lib/bikeSpaces";
import { pricingData, BIKE_TYPE_BY_ID } from "@/constants/bikePricing";

interface VanSpacesTabProps {
  isAdmin: boolean;
}

const KNOWN_TYPES = Array.from(
  new Set([...pricingData.map((p) => p.type), ...Object.values(BIKE_TYPE_BY_ID)]),
);

export default function VanSpacesTab({ isAdmin }: VanSpacesTabProps) {
  const { data, isLoading } = useBikeSpaces();
  const save = useUpdateBikeSpaces();

  const [capacityInput, setCapacityInput] = useState<string>(String(DEFAULT_VAN_SPACES_CAPACITY));
  const [values, setValues] = useState<Record<string, string>>({});
  const [newType, setNewType] = useState("");

  const rows: BikeTypeSpaceRow[] = useMemo(() => {
    const existing = data?.rows ?? [];
    const map = new Map(existing.map((r) => [r.bike_type, r.spaces]));
    KNOWN_TYPES.forEach((t) => {
      if (!map.has(t)) map.set(t, 1);
    });
    return Array.from(map.entries())
      .map(([bike_type, spaces]) => ({ bike_type, spaces }))
      .sort((a, b) => a.bike_type.localeCompare(b.bike_type));
  }, [data?.rows]);

  useEffect(() => {
    if (data?.capacity) setCapacityInput(String(data.capacity));
  }, [data?.capacity]);

  useEffect(() => {
    setValues((prev) => {
      const next: Record<string, string> = {};
      rows.forEach((r) => {
        next[r.bike_type] = prev[r.bike_type] ?? String(r.spaces);
      });
      return next;
    });
  }, [rows]);

  const handleSave = () => {
    const capacity = Number(capacityInput);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      toast.error("Spaces per van must be greater than 0");
      return;
    }
    const payload: BikeTypeSpaceRow[] = Object.entries(values).map(([bike_type, raw]) => ({
      bike_type,
      spaces: Math.max(0, Number(raw) || 0),
    }));
    save.mutate(
      { rows: payload, capacity },
      {
        onSuccess: () => toast.success("Van space settings saved"),
        onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
      },
    );
  };

  const addType = () => {
    const t = newType.trim();
    if (!t) return;
    if (values[t] !== undefined) {
      toast.error("That bike type already exists");
      return;
    }
    setValues((prev) => ({ ...prev, [t]: "1" }));
    setNewType("");
  };

  const totalIfFull = Number(capacityInput) || DEFAULT_VAN_SPACES_CAPACITY;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Van capacity</CardTitle>
          <CardDescription>
            How many spaces a van holds. Route stops in job scheduling show the load in spaces and turn red once this is exceeded.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Spaces per van</Label>
            <Input
              type="number"
              min={1}
              step="0.5"
              value={capacityInput}
              onChange={(e) => setCapacityInput(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="text-sm text-muted-foreground sm:col-span-2">
            A van fits e.g. {formatSpaces(totalIfFull)} standard bikes, or {formatSpaces(totalIfFull / 2.5)} cargo bikes at 2.5 spaces each.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Spaces per bike type</CardTitle>
            <CardDescription>Decimals allowed — e.g. 0.5 for a wheelset, 2.5 for a cargo bike.</CardDescription>
          </div>
          {isAdmin && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Add bike type</Label>
                <Input
                  value={newType}
                  placeholder="Bike type name"
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addType();
                    }
                  }}
                />
              </div>
              <Button variant="outline" onClick={addType}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bike type</TableHead>
                  <TableHead className="w-40">Spaces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(values)
                  .sort((a, b) => a.localeCompare(b))
                  .map((type) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{type}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          value={values[type]}
                          onChange={(e) => setValues((prev) => ({ ...prev, [type]: e.target.value }))}
                          disabled={!isAdmin}
                          className="w-28"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
