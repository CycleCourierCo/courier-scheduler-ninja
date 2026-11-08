// Opening routes in new Route Builder tabs. Every new tab carries the route's
// day and start time and opens straight into Get Timeslots.

export interface RouteTabStop { orderId: string; type: 'pickup' | 'delivery' }

export interface RouteTabOptions {
  /** Stops in order (for generated routes). */
  jobs?: RouteTabStop[];
  /** Saved route to load instead of a stop list. */
  savedRouteId?: string;
  /** Key of stops stashed with stashRouteStops (keeps work/home choices). */
  stashKey?: string;
  /** Route day, YYYY-MM-DD. */
  routeDate?: string | null;
  /** Start time, HH:MM. */
  startTime?: string | null;
}

export interface RouteTabParams {
  routeDate: string | null;
  startTime: string | null;
  openTimeslots: boolean;
  stashKey: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STASH_PREFIX = 'ccc-route-tab:';

export const isRouteTabDate = (v: unknown): v is string =>
  typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
export const isRouteTabTime = (v: unknown): v is string => typeof v === 'string' && TIME_RE.test(v);

export function routeTabUrl(opts: RouteTabOptions): string {
  const q = new URLSearchParams();
  if (opts.savedRouteId) q.set('savedRoute', opts.savedRouteId);
  if (opts.stashKey) q.set('routeTab', opts.stashKey);
  if (isRouteTabDate(opts.routeDate)) {
    q.set('routeDate', opts.routeDate);
    // Also show that day's jobs in the job list, as before
    if (opts.jobs?.length) q.set('date', opts.routeDate);
  }
  if (isRouteTabTime(opts.startTime)) q.set('start', opts.startTime);
  q.set('timeslots', '1');
  // jobs last: ids and ':' stay readable
  const jobs = (opts.jobs || []).map((j) => `${j.orderId}:${j.type}`).join(',');
  return `/scheduling?${q.toString()}${jobs ? `&jobs=${jobs}` : ''}`;
}

export function parseRouteTabParams(search: string): RouteTabParams {
  const q = new URLSearchParams(search);
  const d = q.get('routeDate');
  const t = q.get('start');
  return {
    routeDate: isRouteTabDate(d) ? d : null,
    startTime: isRouteTabTime(t) ? t : null,
    openTimeslots: q.get('timeslots') === '1',
    stashKey: q.get('routeTab'),
  };
}

/** Hand a full stop list to a new tab (localStorage is shared between tabs). */
export function stashRouteStops(stops: unknown[]): string {
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(STASH_PREFIX + key, JSON.stringify(stops));
  return key;
}

/** Read and remove stashed stops; old stashes are tidied away too. */
export function takeStashedRouteStops(key: string): unknown[] | null {
  try {
    const raw = localStorage.getItem(STASH_PREFIX + key);
    localStorage.removeItem(STASH_PREFIX + key);
    const dayAgo = Date.now() - 86_400_000;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(STASH_PREFIX)) continue;
      const ts = parseInt(k.slice(STASH_PREFIX.length, -6), 36);
      if (Number.isFinite(ts) && ts < dayAgo) localStorage.removeItem(k);
    }
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Open each URL in its own tab; returns how many the browser blocked. */
export function openRouteTabs(urls: string[]): number {
  let blocked = 0;
  for (const url of urls) {
    const w = window.open(url, '_blank');
    if (!w) blocked++;
  }
  return blocked;
}

export const blockedTabsMessage = (blocked: number) =>
  `${blocked} tab${blocked === 1 ? ' was' : 's were'} blocked. Allow pop-ups for this site and try again.`;
