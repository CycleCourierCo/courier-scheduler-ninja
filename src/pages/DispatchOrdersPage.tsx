import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Search, Upload, Plus, Loader2 } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";
import { getOrders } from "@/services/fetchOrderService";
import type { Order, OrderStatus } from "@/types/order";

type TabKey = "current" | "scheduled" | "completed" | "incomplete" | "history";

const CURRENT_STATUSES: OrderStatus[] = [
  "created",
  "sender_availability_pending",
  "sender_availability_confirmed",
  "receiver_availability_pending",
  "receiver_availability_confirmed",
  "scheduled_dates_pending",
  "pending_approval",
];

const SCHEDULED_STATUSES: OrderStatus[] = [
  "scheduled",
  "collection_scheduled",
  "delivery_scheduled",
  "driver_to_collection",
  "collected",
  "driver_to_delivery",
  "shipped",
];

const COMPLETED_STATUSES: OrderStatus[] = ["delivered"];
const INCOMPLETE_STATUSES: OrderStatus[] = ["cancelled"];

function inTab(order: Order, tab: TabKey): boolean {
  switch (tab) {
    case "current":
      return CURRENT_STATUSES.includes(order.status);
    case "scheduled":
      return SCHEDULED_STATUSES.includes(order.status);
    case "completed":
      return COMPLETED_STATUSES.includes(order.status);
    case "incomplete":
      return INCOMPLETE_STATUSES.includes(order.status);
    case "history":
      return true;
  }
}

function fmtDateTime(d?: Date | string | null): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, h:mm a");
  } catch {
    return "—";
  }
}

const DispatchOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("current");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["dispatch-orders"],
    queryFn: getOrders,
  });

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      current: 0,
      scheduled: 0,
      completed: 0,
      incomplete: 0,
      history: orders.length,
    };
    for (const o of orders) {
      if (CURRENT_STATUSES.includes(o.status)) c.current++;
      if (SCHEDULED_STATUSES.includes(o.status)) c.scheduled++;
      if (COMPLETED_STATUSES.includes(o.status)) c.completed++;
      if (INCOMPLETE_STATUSES.includes(o.status)) c.incomplete++;
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (!inTab(o, tab)) return false;
      if (!q) return true;
      return (
        (o.trackingNumber || "").toLowerCase().includes(q) ||
        (o.receiver?.name || "").toLowerCase().includes(q) ||
        (o.sender?.name || "").toLowerCase().includes(q) ||
        (o.receiver?.address?.zipCode || "").toLowerCase().includes(q) ||
        (o.customerOrderNumber || "").toLowerCase().includes(q)
      );
    });
  }, [orders, tab, search]);

  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((o) => next.delete(o.id));
      } else {
        filtered.forEach((o) => next.add(o.id));
      }
      return next;
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search order, name, postcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" asChild>
              <Link to="/dispatch/routes">Routes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/bulk-upload">
                <Upload className="h-4 w-4 mr-1" /> CSV upload
              </Link>
            </Button>
            <Button asChild>
              <Link to="/create-order">
                <Plus className="h-4 w-4 mr-1" /> New order
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="current">
              Current
              <Badge variant="secondary" className="ml-2">{counts.current}</Badge>
            </TabsTrigger>
            <TabsTrigger value="scheduled">
              Scheduled
              <Badge variant="secondary" className="ml-2">{counts.scheduled}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
              <Badge variant="secondary" className="ml-2">{counts.completed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="incomplete">
              Incomplete
              <Badge variant="secondary" className="ml-2">{counts.incomplete}</Badge>
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {selected.size > 0 && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="outline" disabled>
                  Bulk assign (coming soon)
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Add to route (coming soon)
                </Button>
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Pick-up</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Req. Delivery</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No orders.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((o) => (
                      <TableRow
                        key={o.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/orders/${o.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(o.id)}
                            onCheckedChange={() => toggleOne(o.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {o.trackingNumber || o.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {o.receiver?.name || "—"}
                          {o.sender?.name && (
                            <div className="text-xs text-muted-foreground">
                              from {o.sender.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {o.sender?.address?.city || "—"}
                          {o.sender?.address?.zipCode && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {o.sender.address.zipCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {o.receiver?.address?.city || "—"}
                          {o.receiver?.address?.zipCode && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {o.receiver.address.zipCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmtDateTime(o.scheduledDeliveryDate)}
                          {o.deliveryTimeslot && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {o.deliveryTimeslot}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {o.delivery_driver_name ||
                            o.collection_driver_name ||
                            "Unassigned"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={o.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default DispatchOrdersPage;
