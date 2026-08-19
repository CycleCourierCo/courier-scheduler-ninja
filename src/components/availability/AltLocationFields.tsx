import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Home, Briefcase, Users, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeAddress } from '@/utils/geocoding';
import {
  AltLocation,
  AltWindow,
  DAY_LABELS,
  formatAltAddress,
} from '@/lib/altLocation';

interface AltLocationFieldsProps {
  value: AltLocation | null;
  onChange: (value: AltLocation | null) => void;
  /** 'collection' for senders, 'delivery' for receivers */
  mode: 'collection' | 'delivery';
}

const DEFAULT_WORK_WINDOW: AltWindow = { days: [1, 2, 3, 4], start: '09:00', end: '17:00' };
const DEFAULT_HOME_WINDOW: AltWindow = { days: [1, 2, 3, 4, 6], start: '08:00', end: '20:00' };

const DayToggles: React.FC<{ window: AltWindow; onChange: (w: AltWindow) => void }> = ({ window: win, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {DAY_LABELS.map((label, day) => {
      const active = win.days?.includes(day);
      return (
        <Button
          key={day}
          type="button"
          size="sm"
          variant={active ? 'default' : 'outline'}
          className="h-8 px-2.5"
          onClick={() =>
            onChange({
              ...win,
              days: active ? win.days.filter((d) => d !== day) : [...(win.days || []), day],
            })
          }
        >
          {label}
        </Button>
      );
    })}
  </div>
);

export const AltLocationFields: React.FC<AltLocationFieldsProps> = ({ value, onChange, mode }) => {
  const verb = mode === 'collection' ? 'Collect' : 'Deliver';
  const alt = value || {};
  const neighbourEnabled = alt.neighbour_number !== undefined && alt.neighbour_number !== null;
  const workEnabled = Boolean(alt.work_address);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const update = (patch: Partial<AltLocation>) => {
    onChange({ ...alt, ...patch });
  };

  const workWindow: AltWindow = alt.work_windows?.[0] || DEFAULT_WORK_WINDOW;
  const homeWindow: AltWindow = alt.home_windows?.[0] || DEFAULT_HOME_WINDOW;

  const lookupWork = async () => {
    const addressText = formatAltAddress(alt.work_address);
    if (!addressText) {
      toast.error('Please enter the work address first.');
      return;
    }
    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(addressText);
      if (!result) {
        toast.error("We couldn't find that address — please check the postcode.");
        return;
      }
      update({
        work_address: {
          ...(alt.work_address as any),
          lat: (result as any).lat ?? (result as any).latitude ?? null,
          lon: (result as any).lon ?? (result as any).longitude ?? null,
        },
      });
      toast.success('Work address confirmed.');
    } catch {
      toast.error("We couldn't check that address right now.");
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <div>
        <h3 className="text-lg font-medium">Alternative {mode} options</h3>
        <p className="text-sm text-muted-foreground">
          Optional — tell us if we can {verb.toLowerCase()} somewhere else.
        </p>
      </div>

      {/* Neighbour */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="alt-neighbour"
            checked={neighbourEnabled}
            onCheckedChange={(checked) =>
              update({ neighbour_number: checked ? '' : null })
            }
          />
          <div className="grid gap-1">
            <Label htmlFor="alt-neighbour" className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4 text-primary" />
              {verb} to a neighbour if I'm out
            </Label>
            <p className="text-xs text-muted-foreground">
              We'll only use this if nobody is home.
            </p>
          </div>
        </div>
        {neighbourEnabled && (
          <div className="ml-7 max-w-xs">
            <Label htmlFor="alt-neighbour-number" className="mb-1 block text-sm">
              Neighbour's house number / name
            </Label>
            <Input
              id="alt-neighbour-number"
              value={alt.neighbour_number || ''}
              onChange={(e) => update({ neighbour_number: e.target.value })}
              placeholder="e.g. 42"
            />
          </div>
        )}
      </div>

      {/* Workplace */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="alt-work"
            checked={workEnabled}
            onCheckedChange={(checked) =>
              update({
                work_address: checked ? { street: '', city: '', state: '', zipCode: '' } : null,
                work_windows: checked ? [workWindow] : [],
                home_windows: checked ? (alt.home_windows?.length ? alt.home_windows : [homeWindow]) : [],
              })
            }
          />
          <div className="grid gap-1">
            <Label htmlFor="alt-work" className="flex items-center gap-2 font-medium">
              <Briefcase className="h-4 w-4 text-primary" />
              {verb} at my workplace during work hours
            </Label>
            <p className="text-xs text-muted-foreground">
              We'll pick the right address based on the time we're due to arrive.
            </p>
          </div>
        </div>

        {workEnabled && (
          <div className="ml-7 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="work-street" className="mb-1 block text-sm">Work address line</Label>
                <Input
                  id="work-street"
                  value={alt.work_address?.street || ''}
                  onChange={(e) =>
                    update({ work_address: { ...(alt.work_address as any), street: e.target.value } })
                  }
                  placeholder="Company name, street"
                />
              </div>
              <div>
                <Label htmlFor="work-city" className="mb-1 block text-sm">Town / city</Label>
                <Input
                  id="work-city"
                  value={alt.work_address?.city || ''}
                  onChange={(e) =>
                    update({ work_address: { ...(alt.work_address as any), city: e.target.value } })
                  }
                />
              </div>
              <div>
                <Label htmlFor="work-postcode" className="mb-1 block text-sm">Postcode</Label>
                <Input
                  id="work-postcode"
                  value={alt.work_address?.zipCode || ''}
                  onChange={(e) =>
                    update({ work_address: { ...(alt.work_address as any), zipCode: e.target.value } })
                  }
                  placeholder="e.g. B10 0AD"
                />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={lookupWork} disabled={isGeocoding}>
              {isGeocoding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
              Check address
            </Button>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Briefcase className="h-4 w-4 text-primary" /> Days &amp; times at work
              </Label>
              <DayToggles window={workWindow} onChange={(w) => update({ work_windows: [w] })} />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  value={workWindow.start}
                  onChange={(e) => update({ work_windows: [{ ...workWindow, start: e.target.value }] })}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="w-32"
                  value={workWindow.end}
                  onChange={(e) => update({ work_windows: [{ ...workWindow, end: e.target.value }] })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4 text-primary" /> Days &amp; times at home
              </Label>
              <DayToggles window={homeWindow} onChange={(w) => update({ home_windows: [w] })} />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  value={homeWindow.start}
                  onChange={(e) => update({ home_windows: [{ ...homeWindow, start: e.target.value }] })}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="w-32"
                  value={homeWindow.end}
                  onChange={(e) => update({ home_windows: [{ ...homeWindow, end: e.target.value }] })}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
