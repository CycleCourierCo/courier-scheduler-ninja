import React, { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  AltDateWindow,
  AltLocation,
  toDateKey,
} from '@/lib/altLocation';

interface AltLocationFieldsProps {
  value: AltLocation | null;
  onChange: (value: AltLocation | null) => void;
  /** 'collection' for senders, 'delivery' for receivers */
  mode: 'collection' | 'delivery';
  /** Availability dates the customer selected on the calendar */
  dates?: Date[];
}

const DEFAULT_WINDOW: AltDateWindow = { start: '09:00', end: '17:00' };

interface AddressSuggestion {
  properties: {
    formatted: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    lat?: number;
    lon?: number;
  };
}

export const AltLocationFields: React.FC<AltLocationFieldsProps> = ({ value, onChange, mode, dates = [] }) => {
  const verb = mode === 'collection' ? 'Collect' : 'Deliver';
  const alt = value || {};
  const neighbourEnabled = alt.neighbour_number !== undefined && alt.neighbour_number !== null;
  const workEnabled = Boolean(alt.work_address);

  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const update = (patch: Partial<AltLocation>) => {
    onChange({ ...alt, ...patch });
  };

  const workDates = alt.work_dates || {};

  const sortedDates = useMemo(
    () => [...dates].sort((a, b) => a.getTime() - b.getTime()),
    [dates]
  );

  // Keep work_dates in sync with the calendar selection (drop removed dates)
  useEffect(() => {
    if (!workEnabled) return;
    const keys = new Set(sortedDates.map(toDateKey));
    const pruned = Object.fromEntries(
      Object.entries(workDates).filter(([key]) => keys.has(key))
    );
    if (Object.keys(pruned).length !== Object.keys(workDates).length) {
      onChange({ ...alt, work_dates: pruned });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedDates, workEnabled]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!searchValue || searchValue.length < 3) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
          searchValue
        )}&filter=countrycode:gb&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        setSuggestions(Array.isArray(data?.features) ? data.features : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  const applySuggestion = (suggestion: AddressSuggestion) => {
    const p = suggestion.properties;
    const street = [p.housenumber, p.street].filter(Boolean).join(' ').trim();
    update({
      work_address: {
        street: street || p.formatted || '',
        city: p.city || p.county || '',
        state: p.county || '',
        zipCode: p.postcode || '',
        lat: p.lat ?? null,
        lon: p.lon ?? null,
      },
    });
    setSearchValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const setWindow = (key: string, patch: Partial<AltDateWindow> | null) => {
    const next = { ...workDates };
    if (patch === null) {
      delete next[key];
    } else {
      next[key] = { ...(next[key] || DEFAULT_WINDOW), ...patch };
    }
    update({ work_dates: next });
  };

  const applyToAll = (win: AltDateWindow) => {
    const next: Record<string, AltDateWindow> = {};
    sortedDates.forEach((d) => {
      next[toDateKey(d)] = { ...win };
    });
    update({ work_dates: next });
  };

  const firstWindow = sortedDates
    .map((d) => workDates[toDateKey(d)])
    .find(Boolean) || DEFAULT_WINDOW;

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
            onCheckedChange={(checked) => update({ neighbour_number: checked ? '' : null })}
          />
          <div className="grid gap-1">
            <Label htmlFor="alt-neighbour" className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4 text-primary" />
              {verb} to a neighbour if I'm out
            </Label>
            <p className="text-xs text-muted-foreground">We'll only use this if nobody is home.</p>
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
                work_dates: checked ? workDates : {},
              })
            }
          />
          <div className="grid gap-1">
            <Label htmlFor="alt-work" className="flex items-center gap-2 font-medium">
              <Briefcase className="h-4 w-4 text-primary" />
              {verb} at my workplace during work hours
            </Label>
            <p className="text-xs text-muted-foreground">
              Anything outside the hours you set is treated as being at home.
            </p>
          </div>
        </div>

        {workEnabled && (
          <div className="ml-0 space-y-4 sm:ml-7">
            <div className="relative">
              <Label htmlFor="work-search" className="mb-1 block text-sm">Search work address</Label>
              <div className="relative">
                <Input
                  id="work-search"
                  className="pl-8"
                  placeholder="Search for an address in the UK..."
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setShowSuggestions(e.target.value.length >= 3);
                  }}
                  onFocus={() => setShowSuggestions(searchValue.length >= 3)}
                />
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {showSuggestions && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-lg">
                  {loading && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!loading && suggestions.length === 0 && (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No address found.</div>
                  )}
                  {!loading &&
                    suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        {suggestion.properties.formatted}
                      </button>
                    ))}
                  <div className="border-t p-2">
                    <Button
                      variant="link"
                      type="button"
                      className="w-full text-sm"
                      onClick={() => setShowSuggestions(false)}
                    >
                      Enter address manually
                    </Button>
                  </div>
                </div>
              )}
            </div>

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

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="h-4 w-4 text-primary" /> Work hours on your chosen dates
                </Label>
                {sortedDates.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => applyToAll(firstWindow)}>
                    Apply {firstWindow.start}–{firstWindow.end} to all dates
                  </Button>
                )}
              </div>

              {sortedDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Select your available dates above and they'll appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedDates.map((date) => {
                    const key = toDateKey(date);
                    const win = workDates[key];
                    const atWork = Boolean(win);
                    return (
                      <div key={key} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                        <div className="flex min-w-[9rem] items-center gap-2">
                          <Checkbox
                            id={`work-date-${key}`}
                            checked={atWork}
                            onCheckedChange={(checked) => setWindow(key, checked ? DEFAULT_WINDOW : null)}
                          />
                          <Label htmlFor={`work-date-${key}`} className="text-sm">
                            {format(date, 'EEE, d MMM')}
                          </Label>
                        </div>
                        {atWork ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              className="w-28"
                              value={win!.start}
                              onChange={(e) => setWindow(key, { start: e.target.value })}
                            />
                            <span className="text-sm text-muted-foreground">to</span>
                            <Input
                              type="time"
                              className="w-28"
                              value={win!.end}
                              onChange={(e) => setWindow(key, { end: e.target.value })}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">At home all day</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
