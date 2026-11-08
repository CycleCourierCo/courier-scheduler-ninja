// Decides what "Add all to Shipday" should do for each stop on a route.
// Inputs are read fresh at click time (order ids from the database, job state
// from Shipday) so stops added after the route was built are never missed.

export type RouteShipdayAction = "create" | "move" | "skip";

export interface RouteShipdayJobState {
  orderId: string;
  type: "pickup" | "delivery";
  /** Current Shipday job id for this leg, straight from the order. */
  shipdayId: string | null;
  /** Whether that job is still open on Shipday (undefined = not checked). */
  onShipday?: boolean;
  /** Day the open Shipday job is planned for (YYYY-MM-DD), if Shipday says. */
  shipdayDate?: string | null;
  orderStatus?: string | null;
}

export interface RouteShipdayDecision<T extends RouteShipdayJobState> {
  job: T;
  action: RouteShipdayAction;
  reason: "no_job" | "job_gone" | "other_day" | "on_route_day" | "cancelled" | "unchecked";
}

export function planRouteShipdayPush<T extends RouteShipdayJobState>(
  jobs: T[],
  routeDate: string,
): RouteShipdayDecision<T>[] {
  return jobs.map((job) => {
    if (job.orderStatus === "cancelled") return { job, action: "skip", reason: "cancelled" };
    if (!job.shipdayId) return { job, action: "create", reason: "no_job" };
    if (job.onShipday === false) return { job, action: "create", reason: "job_gone" };
    if (job.onShipday === undefined) return { job, action: "skip", reason: "unchecked" };
    if (job.shipdayDate && job.shipdayDate !== routeDate) return { job, action: "move", reason: "other_day" };
    return { job, action: "skip", reason: "on_route_day" };
  });
}
