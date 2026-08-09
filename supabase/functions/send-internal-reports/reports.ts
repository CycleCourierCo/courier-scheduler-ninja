/**
 * Internal operational report builders.
 *
 * Each builder returns { subject, html } and reads straight from the database
 * with the service role. Aggregation rules mirror the analytics pages so the
 * emailed figures match what staff see in the app.
 */
import { esc, list, money, num, pct, section, statGrid, table, wrap } from "./report-html.ts";

const PAGE = 1000;
const LONDON = "Europe/London";

// ---------- date helpers (all Europe/London) ----------

export const londonDate = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const londonOffsetMinutes = (d: Date): number => {
  const asUTC = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const asLondon = new Date(d.toLocaleString("en-US", { timeZone: LONDON }));
  return Math.round((asLondon.getTime() - asUTC.getTime()) / 60000);
};

/** UTC ISO bounds for a London calendar day. */
export const dayBounds = (date: string): { start: string; end: string } => {
  const guess = new Date(`${date}T00:00:00Z`);
  const off = londonOffsetMinutes(guess);
  const start = new Date(guess.getTime() - off * 60000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Previous complete Mon–Sun week relative to `today`. */
export const lastWeek = (today: string): { start: string; end: string } => {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = addDays(today, -backToMonday);
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
};

const fmtDate = (d: string | null | undefined): string =>
  d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const daysUntil = (d: string | null | undefined, today: string): number | null => {
  if (!d) return null;
  const a = new Date(`${String(d).slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${today}T12:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
};

// ---------- data helpers ----------

const pageAll = async (build: (from: number) => any): Promise<any[]> => {
  const out: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build(from).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
};

const nameMap = async (admin: any, ids: string[]): Promise<Record<string, string>> => {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await admin.from("profiles").select("id,name,email").in("id", unique.slice(i, i + 200));
    for (const p of data || []) out[p.id] = p.name || p.email || "Unnamed";
  }
  return out;
};

// ---------- 1. customer update digest ----------

const STAGE_LABELS: Record<string, string> = {
  booked_awaiting_request: "Booked — awaiting availability request",
  awaiting_sender_dates: "Chaser: collection dates needed",
  awaiting_receiver_dates: "Chaser: delivery dates needed",
  sender_dates_received: "Collection dates received",
  collection_scheduled: "Collection scheduled (sender)",
  collection_scheduled_receiver: "Collection scheduled (receiver)",
  in_depot: "Bike in depot",
  delivery_scheduled: "Delivery scheduled",
  collection_delayed: "Collection running late",
  delivery_delayed: "Delivery running late",
  box_awaiting_depot: "Box My Bike — heading to depot",
  box_in_depot: "Box My Bike — at depot",
  box_boxed: "Box My Bike — boxed",
  box_awaiting_3p: "Box My Bike — awaiting courier",
  box_collected_3p: "Box My Bike — collected by courier",
  foam_pending_collection: "Northern Ireland — arranging collection",
  foam_pending_foaming: "Northern Ireland — at depot",
  foam_ready: "Northern Ireland — foamed and ready",
  foam_at_ferry: "Northern Ireland — at ferry port",
};

export const buildCustomerUpdateReport = async (admin: any, date: string) => {
  const { start, end } = dayBounds(date);

  const [{ data: runRows }, logs] = await Promise.all([
    admin.from("order_update_run_log").select("*").eq("run_date", date),
    pageAll((from: number) =>
      admin
        .from("order_update_log")
        .select("order_id,side,stage_key,recipient,sent_at")
        .gte("sent_at", start)
        .lt("sent_at", end)
        .order("sent_at", { ascending: true }),
    ),
  ]);

  const runs = runRows || [];
  const totals = runs.reduce(
    (a: any, r: any) => ({
      scanned: a.scanned + num(r.scanned),
      due: a.due + num(r.due),
      sent: a.sent + num(r.sent),
      skipped: a.skipped + num(r.skipped),
      failed: a.failed + num(r.failed),
    }),
    { scanned: 0, due: 0, sent: 0, skipped: 0, failed: 0 },
  );

  const byStage = new Map<string, { emails: number; recipients: Set<string>; orders: Set<string> }>();
  const recipients = new Set<string>();
  const orders = new Set<string>();
  let senderSide = 0;
  let receiverSide = 0;

  for (const l of logs) {
    const key = l.stage_key || "other";
    if (!byStage.has(key)) byStage.set(key, { emails: 0, recipients: new Set(), orders: new Set() });
    const s = byStage.get(key)!;
    s.emails += 1;
    if (l.recipient) s.recipients.add(String(l.recipient).toLowerCase());
    if (l.order_id) s.orders.add(l.order_id);
    if (l.recipient) recipients.add(String(l.recipient).toLowerCase());
    if (l.order_id) orders.add(l.order_id);
    if (l.side === "sender") senderSide++;
    else if (l.side === "receiver") receiverSide++;
  }

  const stageRows = Array.from(byStage.entries())
    .sort((a, b) => b[1].emails - a[1].emails)
    .map(([key, v]) => [STAGE_LABELS[key] || key, v.emails, v.recipients.size, v.orders.size]);

  const body =
    statGrid([
      { label: "Orders scanned", value: totals.scanned },
      { label: "Updates due", value: totals.due },
      { label: "Emails sent", value: logs.length, tone: "good" },
      { label: "Customers reached", value: recipients.size },
      { label: "Skipped by rules", value: totals.skipped },
      { label: "Failed", value: totals.failed, tone: totals.failed > 0 ? "bad" : undefined },
    ]) +
    section(
      "Emails by update type",
      table(["Update type", "Emails", "Customers", "Orders"], stageRows, "No customer updates were sent today."),
    ) +
    section(
      "Coverage",
      list([
        `<strong>${orders.size}</strong> orders received at least one update.`,
        `<strong>${senderSide}</strong> sender-side and <strong>${receiverSide}</strong> receiver-side emails.`,
        `<strong>${totals.skipped}</strong> orders were deliberately skipped — already updated in the last 2 days, a milestone email already went out today, still in the workshop awaiting inspection or repair, or nothing has changed worth telling the customer.`,
        `Scan ran in <strong>${runs.length}</strong> batch${runs.length === 1 ? "" : "es"}.`,
      ]),
    ) +
    (totals.failed > 0
      ? section(
          "Failures",
          `<p style="margin:0;color:#b42318;font-size:13px;">${totals.failed} email${
            totals.failed === 1 ? "" : "s"
          } failed to send. Check the proactive updates logs for the affected orders.</p>`,
        )
      : "");

  return {
    subject: `Customer updates — ${fmtDate(date)} (${logs.length} emails, ${recipients.size} customers)`,
    html: wrap("Proactive customer updates", `Daily digest for ${fmtDate(date)}`, body),
  };
};

// ---------- shared ops queries ----------

const fetchTimeslips = async (admin: any, start: string, end: string) =>
  pageAll((from: number) =>
    admin
      .from("timeslips")
      .select(
        "id,driver_id,date,total_hours,total_pay,total_stops,total_jobs,mileage,hourly_rate,van_allowance,status,vehicle_id",
      )
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true }),
  );

const fetchOrdersByDate = async (admin: any, column: string, start: string, end: string) =>
  pageAll((from: number) =>
    admin
      .from("orders")
      .select(
        "id,tracking_number,bike_quantity,status,collection_driver_name,delivery_driver_name,scheduled_pickup_date,scheduled_delivery_date,pickup_timeslot,delivery_timeslot,order_collected,order_delivered,tracking_events,is_northern_ireland",
      )
      .gte(column, `${start}T00:00:00`)
      .lte(column, `${end}T23:59:59.999`)
      .order(column, { ascending: true }),
  );

const dedupeById = (rows: any[]): any[] => {
  const m = new Map<string, any>();
  for (const r of rows) m.set(r.id, r);
  return Array.from(m.values());
};

const nameVariants = (p: any): Set<string> => {
  const s = new Set<string>();
  if (p.shipday_driver_name) s.add(String(p.shipday_driver_name).trim().toLowerCase());
  if (p.name) {
    s.add(String(p.name).trim().toLowerCase());
    const first = String(p.name).trim().split(/\s+/)[0];
    if (first) s.add(first.toLowerCase());
  }
  return s;
};

const matchesName = (name: string | null | undefined, variants: Set<string>) =>
  !!name && variants.has(String(name).trim().toLowerCase());

const londonMinutes = (iso: string): { date: string; minutes: number } | null => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(hour) * 60 + Number(parts.minute) };
};

const slotMinutes = (slot: string | null): number | null => {
  if (!slot) return null;
  const [h, m] = String(slot).split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
};

/** On-time = completed within the promised 3-hour window (grace of 15 mins). */
const onTimeForDriver = (orders: any[], variants: Set<string>) => {
  let total = 0;
  let onTime = 0;
  for (const o of orders) {
    for (const leg of ["pickup", "delivery"] as const) {
      const driverName = leg === "pickup" ? o.collection_driver_name : o.delivery_driver_name;
      if (!matchesName(driverName, variants)) continue;
      const promised = slotMinutes(leg === "pickup" ? o.pickup_timeslot : o.delivery_timeslot);
      if (promised == null) continue;
      const updates = o.tracking_events?.shipday?.updates;
      if (!Array.isArray(updates)) continue;
      const hit = updates.find((u: any) => u?.event === "ORDER_COMPLETED" && u?.leg === leg);
      if (!hit?.timestamp) continue;
      const actual = londonMinutes(hit.timestamp);
      if (!actual) continue;
      total += 1;
      if (actual.minutes >= promised - 15 && actual.minutes <= promised + 180 + 15) onTime += 1;
    }
  }
  return { total, onTime };
};

const fetchDriverProfiles = async (admin: any) => {
  const { data: roleRows } = await admin.from("user_roles").select("user_id").eq("role", "driver");
  const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id))).filter(Boolean);
  if (ids.length === 0) return [];
  const { data } = await admin
    .from("profiles")
    .select("id,name,email,shipday_driver_name,hourly_rate,van_allowance,is_active")
    .in("id", ids);
  return data || [];
};

// ---------- 2. daily operations snapshot ----------

export const buildDailyOpsReport = async (admin: any, date: string) => {
  const [
    pickupOrders,
    deliveryOrders,
    timeslips,
    drivers,
    inspectionsBooked,
    inspectionsDone,
    issuesResolved,
    { data: vehicles },
    { data: insurance },
    staleOrders,
  ] = await Promise.all([
    fetchOrdersByDate(admin, "scheduled_pickup_date", date, date),
    fetchOrdersByDate(admin, "scheduled_delivery_date", date, date),
    fetchTimeslips(admin, date, date),
    fetchDriverProfiles(admin),
    admin
      .from("bicycle_inspections")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayBounds(date).start)
      .lt("created_at", dayBounds(date).end),
    admin
      .from("bicycle_inspections")
      .select("id", { count: "exact", head: true })
      .gte("inspected_at", dayBounds(date).start)
      .lt("inspected_at", dayBounds(date).end),
    pageAll((from: number) =>
      admin
        .from("inspection_issues")
        .select("id,parts_cost,labour_cost,estimated_cost,status,resolved_at")
        .gte("resolved_at", dayBounds(date).start)
        .lt("resolved_at", dayBounds(date).end),
    ),
    admin.from("vehicles").select("id,registration,status,mot_expiry_date,tax_due_date"),
    admin.from("vehicle_insurance_policies").select("vehicle_id,insurer,end_date"),
    pageAll((from: number) =>
      admin
        .from("orders")
        .select("id,tracking_number,status,updated_at")
        .not("status", "in", "(delivered,cancelled,delivered_by_3p,delivered_to_ferry)")
        .lt("updated_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("updated_at", { ascending: true }),
    ),
  ]);

  const bikes = (o: any) => num(o.bike_quantity) || 1;
  const collected = pickupOrders.filter((o: any) => o.order_collected).reduce((a: number, o: any) => a + bikes(o), 0);
  const delivered = deliveryOrders.filter((o: any) => o.order_delivered).reduce((a: number, o: any) => a + bikes(o), 0);
  const toFerry = deliveryOrders.filter((o: any) => o.status === "delivered_to_ferry").length;
  const cancelled = [...pickupOrders, ...deliveryOrders].filter((o: any) => o.status === "cancelled").length;

  const allOrders = dedupeById([...pickupOrders, ...deliveryOrders]);
  const driverNames = await nameMap(admin, timeslips.map((t: any) => t.driver_id));

  const driverRows = timeslips.map((t: any) => {
    const profile = drivers.find((d: any) => d.id === t.driver_id);
    const ot = profile ? onTimeForDriver(allOrders, nameVariants(profile)) : { total: 0, onTime: 0 };
    return [
      driverNames[t.driver_id] || "Unknown driver",
      num(t.total_stops),
      num(t.total_jobs),
      num(t.total_hours).toFixed(2),
      ot.total > 0 ? pct(ot.onTime, ot.total) : "—",
      money(num(t.total_pay)),
    ];
  });

  const partsValue = issuesResolved.reduce((a: number, i: any) => a + num(i.parts_cost), 0);
  const labourValue = issuesResolved.reduce(
    (a: number, i: any) => a + (i.labour_cost != null ? num(i.labour_cost) : num(i.estimated_cost) - num(i.parts_cost)),
    0,
  );

  const insuranceByVehicle = new Map<string, any>();
  for (const p of insurance || []) {
    const cur = insuranceByVehicle.get(p.vehicle_id);
    if (!cur || String(p.end_date) > String(cur.end_date)) insuranceByVehicle.set(p.vehicle_id, p);
  }

  const vanAlerts: string[] = [];
  for (const v of vehicles || []) {
    const mot = daysUntil(v.mot_expiry_date, date);
    const tax = daysUntil(v.tax_due_date, date);
    const ins = daysUntil(insuranceByVehicle.get(v.id)?.end_date, date);
    if (mot != null && mot <= 14) vanAlerts.push(`<strong>${esc(v.registration)}</strong> — MOT ${mot < 0 ? "expired" : "due"} ${fmtDate(v.mot_expiry_date)}`);
    if (tax != null && tax <= 14) vanAlerts.push(`<strong>${esc(v.registration)}</strong> — tax ${tax < 0 ? "overdue" : "due"} ${fmtDate(v.tax_due_date)}`);
    if (ins != null && ins <= 14) vanAlerts.push(`<strong>${esc(v.registration)}</strong> — insurance ends ${fmtDate(insuranceByVehicle.get(v.id)?.end_date)}`);
    if (["off_road", "in_service", "in_repair"].includes(String(v.status)))
      vanAlerts.push(`<strong>${esc(v.registration)}</strong> — currently ${esc(String(v.status).replace(/_/g, " "))}`);
  }

  const body =
    statGrid([
      { label: "Bikes collected", value: collected },
      { label: "Bikes delivered", value: delivered },
      { label: "To ferry", value: toFerry },
      { label: "Cancelled", value: cancelled },
      { label: "Inspections booked", value: inspectionsBooked?.count ?? 0 },
      { label: "Inspections done", value: inspectionsDone?.count ?? 0 },
    ]) +
    section(
      "Drivers",
      table(["Driver", "Stops", "Bikes", "Hours", "On time", "Pay"], driverRows, "No timeslips logged for this day."),
    ) +
    section(
      "Workshop",
      list([
        `<strong>${issuesResolved.length}</strong> repairs completed.`,
        `Parts value <strong>${money(partsValue)}</strong>, labour value <strong>${money(labourValue)}</strong>.`,
      ]),
    ) +
    section("Van alerts (next 14 days)", list(vanAlerts, "No van alerts.")) +
    section(
      "Exceptions",
      list(
        [
          `<strong>${staleOrders.length}</strong> live orders with no movement for 7+ days.`,
          staleOrders.length > 0
            ? `Oldest: ${staleOrders
                .slice(0, 5)
                .map((o: any) => esc(o.tracking_number || o.id))
                .join(", ")}`
            : "",
        ].filter(Boolean),
      ),
    );

  return {
    subject: `Daily ops — ${fmtDate(date)} (${collected} collected, ${delivered} delivered)`,
    html: wrap("Daily operations snapshot", fmtDate(date), body),
  };
};

// ---------- 3. weekly driver report ----------

export const buildWeeklyDriverReport = async (admin: any, start: string, end: string) => {
  const prevStart = addDays(start, -7);
  const prevEnd = addDays(end, -7);

  const [drivers, slips, prevSlips, pickups, deliveries] = await Promise.all([
    fetchDriverProfiles(admin),
    fetchTimeslips(admin, start, end),
    fetchTimeslips(admin, prevStart, prevEnd),
    fetchOrdersByDate(admin, "scheduled_pickup_date", start, end),
    fetchOrdersByDate(admin, "scheduled_delivery_date", start, end),
  ]);
  const orders = dedupeById([...pickups, ...deliveries]);

  const rows: (string | number)[][] = [];
  let tStops = 0,
    tBikes = 0,
    tHours = 0,
    tPay = 0,
    tOnTime = 0,
    tLegs = 0;

  for (const d of drivers) {
    const mine = slips.filter((s: any) => s.driver_id === d.id);
    if (mine.length === 0) continue;
    const variants = nameVariants(d);
    const stops = mine.reduce((a: number, s: any) => a + num(s.total_stops), 0);
    const hours = mine.reduce((a: number, s: any) => a + num(s.total_hours), 0);
    const pay = mine.reduce((a: number, s: any) => a + num(s.total_pay), 0);
    const miles = mine.reduce((a: number, s: any) => a + num(s.mileage), 0);

    let collected = 0;
    let delivered = 0;
    for (const o of orders) {
      const qty = num(o.bike_quantity) || 1;
      if (matchesName(o.collection_driver_name, variants) && o.scheduled_pickup_date) collected += qty;
      if (matchesName(o.delivery_driver_name, variants) && o.scheduled_delivery_date) delivered += qty;
    }
    const bikes = collected + delivered;
    const ot = onTimeForDriver(orders, variants);

    const prevMine = prevSlips.filter((s: any) => s.driver_id === d.id);
    const prevBikes = prevMine.reduce((a: number, s: any) => a + num(s.total_jobs), 0);
    const trend = prevBikes === 0 ? "—" : `${bikes >= prevBikes ? "+" : ""}${bikes - prevBikes}`;

    tStops += stops;
    tBikes += bikes;
    tHours += hours;
    tPay += pay;
    tOnTime += ot.onTime;
    tLegs += ot.total;

    rows.push([
      d.name || d.email || "Unnamed",
      mine.length,
      stops,
      `${collected}/${delivered}`,
      hours.toFixed(1),
      ot.total > 0 ? pct(ot.onTime, ot.total) : "—",
      Math.round(miles),
      money(pay),
      bikes > 0 ? money(pay / bikes) : "—",
      trend,
    ]);
  }

  rows.sort((a, b) => Number(b[2]) - Number(a[2]));

  const body =
    statGrid([
      { label: "Days worked", value: slips.length },
      { label: "Stops", value: tStops },
      { label: "Bike legs", value: tBikes },
      { label: "Hours", value: tHours.toFixed(1) },
      { label: "On time", value: tLegs > 0 ? pct(tOnTime, tLegs) : "—", tone: tLegs > 0 && tOnTime / tLegs < 0.8 ? "bad" : "good" },
      { label: "Driver pay", value: money(tPay) },
    ]) +
    section(
      "Per driver",
      table(
        ["Driver", "Days", "Stops", "Col/Del", "Hours", "On time", "Miles", "Pay", "£/bike", "Bikes vs last wk"],
        rows,
        "No approved driver timeslips for this week.",
      ),
    ) +
    section(
      "Notes",
      list([
        "On time = completed inside the promised 3-hour window (15 minute grace either side), measured from courier completion events.",
        "Col/Del counts bikes on legs assigned to that driver, not stops.",
      ]),
    );

  return {
    subject: `Weekly driver report — ${fmtDate(start)} to ${fmtDate(end)}`,
    html: wrap("Weekly driver report", `${fmtDate(start)} – ${fmtDate(end)}`, body),
  };
};

// ---------- 4. weekly van report ----------

export const buildWeeklyVanReport = async (admin: any, start: string, end: string) => {
  const [{ data: vehicles }, { data: insurance }, logs, intervals, slips] = await Promise.all([
    admin.from("vehicles").select("id,registration,make,status,mot_expiry_date,tax_due_date,notes"),
    admin.from("vehicle_insurance_policies").select("vehicle_id,insurer,end_date,premium"),
    pageAll((from: number) =>
      admin
        .from("vehicle_maintenance_logs")
        .select("vehicle_id,service_type,custom_name,service_date,cost,odometer_mi,vendor")
        .gte("service_date", start)
        .lte("service_date", end)
        .order("service_date", { ascending: true }),
    ),
    admin.from("vehicle_maintenance_intervals").select("vehicle_id,service_type,custom_name,interval_miles,interval_months"),
    fetchTimeslips(admin, start, end),
  ]);

  const insuranceByVehicle = new Map<string, any>();
  for (const p of insurance || []) {
    const cur = insuranceByVehicle.get(p.vehicle_id);
    if (!cur || String(p.end_date) > String(cur.end_date)) insuranceByVehicle.set(p.vehicle_id, p);
  }

  const today = londonDate();
  const flag = (d: string | null | undefined) => {
    const n = daysUntil(d, today);
    if (n == null) return "—";
    const label = `${fmtDate(d)} (${n}d)`;
    return n <= 30 ? `<span style="color:#b42318;font-weight:600;">${esc(label)}</span>` : label;
  };

  const rows = (vehicles || []).map((v: any) => {
    const vLogs = (logs || []).filter((l: any) => l.vehicle_id === v.id);
    const vSlips = slips.filter((s: any) => s.vehicle_id === v.id);
    const miles = vSlips.reduce((a: number, s: any) => a + num(s.mileage), 0);
    const cost = vLogs.reduce((a: number, l: any) => a + num(l.cost), 0);
    return [
      `${esc(v.registration)}${v.make ? ` <span style="color:#888;">${esc(v.make)}</span>` : ""}`,
      String(v.status || "—").replace(/_/g, " "),
      Math.round(miles),
      vSlips.length,
      flag(v.mot_expiry_date),
      flag(v.tax_due_date),
      flag(insuranceByVehicle.get(v.id)?.end_date),
      vLogs.length,
      money(cost),
    ];
  });

  const totalCost = (logs || []).reduce((a: number, l: any) => a + num(l.cost), 0);
  const offRoad = (vehicles || []).filter((v: any) => ["off_road", "in_service", "in_repair"].includes(String(v.status)));

  const maintenanceRows = (logs || []).map((l: any) => {
    const v = (vehicles || []).find((x: any) => x.id === l.vehicle_id);
    return [
      v?.registration || "—",
      String(l.custom_name || l.service_type || "—").replace(/_/g, " "),
      fmtDate(l.service_date),
      l.odometer_mi ?? "—",
      l.vendor || "—",
      money(num(l.cost)),
    ];
  });

  const body =
    statGrid([
      { label: "Vehicles", value: (vehicles || []).length },
      { label: "Off road", value: offRoad.length, tone: offRoad.length > 0 ? "warn" : undefined },
      { label: "Jobs logged", value: (logs || []).length },
      { label: "Spend", value: money(totalCost) },
      { label: "Miles", value: Math.round(slips.reduce((a: number, s: any) => a + num(s.mileage), 0)) },
    ]) +
    section(
      "Fleet",
      table(
        ["Vehicle", "Status", "Miles", "Days used", "MOT", "Tax", "Insurance", "Jobs", "Spend"],
        rows,
        "No vehicles on record.",
      ),
    ) +
    section(
      "Maintenance this week",
      table(["Vehicle", "Work", "Date", "Odometer", "Vendor", "Cost"], maintenanceRows, "No maintenance logged this week."),
    ) +
    section(
      "Watch list",
      list(
        [
          ...offRoad.map((v: any) => `<strong>${esc(v.registration)}</strong> is ${esc(String(v.status).replace(/_/g, " "))}.`),
          `${(intervals?.data || intervals || []).length} maintenance intervals configured across the fleet.`,
        ],
        "Nothing needs attention.",
      ),
    );

  return {
    subject: `Weekly van report — ${fmtDate(start)} to ${fmtDate(end)}`,
    html: wrap("Weekly van report", `${fmtDate(start)} – ${fmtDate(end)}`, body),
  };
};

// ---------- 5. weekly workshop / inspection report ----------

export const buildWeeklyWorkshopReport = async (admin: any, start: string, end: string) => {
  const s = dayBounds(start).start;
  const e = dayBounds(end).end;

  const [booked, completed, issues, openInspections, mechSlips, allOpenIssues] = await Promise.all([
    pageAll((from: number) =>
      admin.from("bicycle_inspections").select("id,created_at,inspected_by_name,bike_type").gte("created_at", s).lt("created_at", e),
    ),
    pageAll((from: number) =>
      admin
        .from("bicycle_inspections")
        .select("id,order_id,inspected_at,inspected_by_name,created_at,status")
        .gte("inspected_at", s)
        .lt("inspected_at", e),
    ),
    pageAll((from: number) =>
      admin
        .from("inspection_issues")
        .select("id,inspection_id,parts_cost,labour_cost,estimated_cost,status,resolved_at,resolved_by_name")
        .gte("resolved_at", s)
        .lt("resolved_at", e),
    ),
    pageAll((from: number) => admin.from("bicycle_inspections").select("id,status,created_at,invoice_id,invoice_skipped_at")),
    pageAll((from: number) =>
      admin.from("mechanic_timeslips").select("driver_id,date,total_hours,total_pay").gte("date", start).lte("date", end),
    ),
    pageAll((from: number) =>
      admin.from("inspection_issues").select("id,status,parts_ordered,parts_arrived,estimated_cost,parts_cost,labour_cost,inspection_id"),
    ),
  ]);

  const parts = issues.reduce((a: number, i: any) => a + num(i.parts_cost), 0);
  const labour = issues.reduce(
    (a: number, i: any) => a + (i.labour_cost != null ? num(i.labour_cost) : num(i.estimated_cost) - num(i.parts_cost)),
    0,
  );

  const turnarounds = completed
    .map((c: any) => (c.created_at && c.inspected_at ? (new Date(c.inspected_at).getTime() - new Date(c.created_at).getTime()) / 86400000 : null))
    .filter((n: any): n is number => n != null && n >= 0);
  const avgTurnaround = turnarounds.length > 0 ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0;

  // Mechanic table
  const mechNames = await nameMap(admin, mechSlips.map((m: any) => m.driver_id));
  const mechRows: (string | number)[][] = [];
  const byMech = new Map<string, { hours: number; pay: number }>();
  for (const m of mechSlips) {
    const cur = byMech.get(m.driver_id) || { hours: 0, pay: 0 };
    cur.hours += num(m.total_hours);
    cur.pay += num(m.total_pay);
    byMech.set(m.driver_id, cur);
  }
  for (const [id, v] of byMech) {
    const name = mechNames[id] || "Unknown";
    const insp = completed.filter((c: any) => (c.inspected_by_name || "").toLowerCase() === name.toLowerCase()).length;
    const rep = issues.filter((i: any) => (i.resolved_by_name || "").toLowerCase() === name.toLowerCase());
    const revenue =
      rep.reduce((a: number, i: any) => a + (i.labour_cost != null ? num(i.labour_cost) : num(i.estimated_cost) - num(i.parts_cost)), 0) +
      insp * 60;
    mechRows.push([
      name,
      insp,
      rep.length,
      v.hours.toFixed(1),
      money(revenue),
      money(v.pay),
      money(revenue - v.pay),
      v.hours > 0 ? money(revenue / v.hours) : "—",
    ]);
  }
  mechRows.sort((a, b) => Number(String(b[4]).replace(/[^0-9.]/g, "")) - Number(String(a[4]).replace(/[^0-9.]/g, "")));

  // Backlog
  const now = Date.now();
  const ageBucket = (iso: string) => {
    const days = (now - new Date(iso).getTime()) / 86400000;
    if (days <= 3) return "0-3 days";
    if (days <= 7) return "4-7 days";
    if (days <= 14) return "8-14 days";
    return "15+ days";
  };
  const openByStatus = new Map<string, number>();
  const openByAge = new Map<string, number>();
  for (const i of openInspections) {
    if (i.status === "repaired" || i.status === "inspected") continue;
    openByStatus.set(i.status || "unknown", (openByStatus.get(i.status || "unknown") || 0) + 1);
    const b = ageBucket(i.created_at);
    openByAge.set(b, (openByAge.get(b) || 0) + 1);
  }

  const awaitingParts = allOpenIssues.filter((i: any) => i.status === "approved" && !i.parts_arrived).length;
  const readyToRepair = allOpenIssues.filter((i: any) => i.status === "approved" && i.parts_arrived).length;

  const invoiced = openInspections.filter((i: any) => !!i.invoice_id).length;
  const skipped = openInspections.filter((i: any) => !i.invoice_id && !!i.invoice_skipped_at).length;
  const uninvoiced = openInspections.filter(
    (i: any) => i.status === "repaired" && !i.invoice_id && !i.invoice_skipped_at,
  );
  const uninvoicedValue = uninvoiced.reduce((a: number, insp: any) => {
    const v = allOpenIssues
      .filter((i: any) => i.inspection_id === insp.id)
      .reduce((x: number, i: any) => x + (num(i.parts_cost) + num(i.labour_cost) || num(i.estimated_cost)), 0);
    return a + v;
  }, 0);

  const body =
    statGrid([
      { label: "Booked in", value: booked.length },
      { label: "Inspected", value: completed.length },
      { label: "Repairs done", value: issues.length },
      { label: "Parts value", value: money(parts) },
      { label: "Labour value", value: money(labour) },
      { label: "Avg turnaround", value: `${avgTurnaround.toFixed(1)} d` },
    ]) +
    section(
      "Mechanics",
      table(
        ["Mechanic", "Inspections", "Repairs", "Hours", "Revenue", "Cost", "Profit", "£/hr"],
        mechRows,
        "No mechanic hours logged this week.",
      ),
    ) +
    section(
      "Backlog",
      table(
        ["Stage", "Bikes"],
        [
          ...Array.from(openByStatus.entries()).map(([k, v]) => [String(k).replace(/_/g, " "), v]),
          ["Approved, awaiting parts", awaitingParts],
          ["Parts in, ready to repair", readyToRepair],
        ],
        "Workshop is clear.",
      ),
    ) +
    section(
      "Backlog age",
      table(
        ["Age", "Bikes"],
        ["0-3 days", "4-7 days", "8-14 days", "15+ days"].filter((b) => openByAge.get(b)).map((b) => [b, openByAge.get(b)!]),
        "Nothing waiting.",
      ),
    ) +
    section(
      "Billing",
      list([
        `<strong>${invoiced}</strong> inspections invoiced to date, <strong>${skipped}</strong> marked as no invoice needed.`,
        `<strong>${uninvoiced.length}</strong> repaired bikes still uninvoiced, worth roughly <strong>${money(uninvoicedValue)}</strong>.`,
      ]),
    );

  return {
    subject: `Weekly workshop report — ${fmtDate(start)} to ${fmtDate(end)}`,
    html: wrap("Weekly workshop report", `${fmtDate(start)} – ${fmtDate(end)}`, body),
  };
};
