import { supabase } from "@/integrations/supabase/client";
import type {
  BikeBuild,
  BikeBuildComponent,
  BikeBuildFormData,
  BikeBuildStageLogEntry,
} from "@/types/bikeBuild";
import type { BuildStage } from "@/constants/bikeComponents";
import type { WarehouseStock } from "@/types/warehouseStock";

const table = (name: string) => supabase.from(name as any) as any;

export const getBikeBuilds = async (siteId?: string | null): Promise<BikeBuild[]> => {
  let query = table("bike_builds").select("*").order("created_at", { ascending: false });
  if (siteId) query = query.eq("site_id", siteId);
  const { data, error } = await query;
  if (error) throw error;

  const builds = (data as any[]) || [];
  if (builds.length === 0) return [];

  const userIds = [...new Set(builds.map((b) => b.user_id))];
  const [{ data: profiles }, { data: components }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, company_name").in("id", userIds),
    table("bike_build_components")
      .select("build_id")
      .in("build_id", builds.map((b) => b.id)),
  ]);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const counts = new Map<string, number>();
  ((components as any[]) || []).forEach((c: any) => {
    counts.set(c.build_id, (counts.get(c.build_id) || 0) + 1);
  });

  return builds.map((build) => {
    const profile: any = profileMap.get(build.user_id);
    return {
      ...build,
      customer_name: profile?.company_name || profile?.name || "Unknown",
      customer_email: profile?.email || "",
      component_count: counts.get(build.id) || 0,
    } as BikeBuild;
  });
};

export const getBikeBuildComponents = async (buildId: string): Promise<BikeBuildComponent[]> => {
  const { data, error } = await table("bike_build_components")
    .select("*")
    .eq("build_id", buildId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data as any[]) || [];
  const stockIds = rows.map((r) => r.stock_id).filter(Boolean);
  let stockMap = new Map<string, any>();
  if (stockIds.length > 0) {
    const { data: stock } = await table("warehouse_stock")
      .select("id, bike_brand, bike_model, spec, sku, bay, position, status, quantity")
      .in("id", stockIds);
    stockMap = new Map(((stock as any[]) || []).map((s: any) => [s.id, s]));
  }

  return rows.map((row) => ({
    ...row,
    stock: row.stock_id ? stockMap.get(row.stock_id) ?? null : null,
  })) as BikeBuildComponent[];
};

export const getBikeBuildStageLog = async (buildId: string): Promise<BikeBuildStageLogEntry[]> => {
  const { data, error } = await table("bike_build_stage_log")
    .select("*")
    .eq("build_id", buildId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []) as BikeBuildStageLogEntry[];
};

export const createBikeBuild = async (
  form: BikeBuildFormData,
  createdBy: string
): Promise<BikeBuild> => {
  const { data, error } = await table("bike_builds")
    .insert({
      user_id: form.user_id,
      site_id: form.site_id || null,
      name: form.name,
      sku: form.sku || null,
      bike_brand: form.bike_brand || null,
      bike_model: form.bike_model || null,
      bike_type: form.bike_type || null,
      spec_notes: form.spec_notes || null,
      labour_cost: form.labour_cost ? parseFloat(form.labour_cost) : 0,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BikeBuild;
};

export const updateBikeBuild = async (
  id: string,
  updates: Partial<Omit<BikeBuild, "id">>
): Promise<void> => {
  const { error } = await table("bike_builds").update(updates).eq("id", id);
  if (error) throw error;
};

export const setBikeBuildStage = async (id: string, stage: BuildStage): Promise<void> => {
  const updates: Record<string, unknown> = { stage };
  if (stage === "bike_built") updates.built_at = new Date().toISOString();
  const { error } = await table("bike_builds").update(updates).eq("id", id);
  if (error) throw error;
};

export const deleteBikeBuild = async (id: string): Promise<void> => {
  // Release any reserved stock back to stored before removing the build.
  const components = await getBikeBuildComponents(id);
  const stockIds = components.map((c) => c.stock_id).filter(Boolean) as string[];
  if (stockIds.length > 0) {
    await table("warehouse_stock").update({ status: "stored" }).in("id", stockIds);
  }
  const { error } = await table("bike_builds").delete().eq("id", id);
  if (error) throw error;
};

/** Components in the customer's stock that are still available to allocate. */
export const getAvailableComponents = async (
  userId: string,
  siteId?: string | null
): Promise<WarehouseStock[]> => {
  let query = table("warehouse_stock")
    .select("*")
    .eq("user_id", userId)
    .eq("item_kind", "component")
    .eq("status", "stored")
    .order("component_category", { ascending: true });
  if (siteId) query = query.eq("site_id", siteId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data as any[]) || []) as WarehouseStock[];
};

const recalcPartsTotal = async (buildId: string) => {
  const components = await getBikeBuildComponents(buildId);
  const total = components.reduce(
    (sum, c) => sum + Number(c.unit_value || 0) * Number(c.quantity || 1),
    0
  );
  await table("bike_builds").update({ parts_total: total }).eq("id", buildId);
};

export const addComponentToBuild = async (params: {
  buildId: string;
  stock: WarehouseStock;
  slot: string | null;
  quantity?: number;
  addedBy: string;
}): Promise<void> => {
  const { buildId, stock, slot, quantity = 1, addedBy } = params;

  const { error } = await table("bike_build_components").insert({
    build_id: buildId,
    stock_id: stock.id,
    slot,
    category: stock.component_category || "Other",
    quantity,
    unit_value: stock.bike_value ?? null,
    added_by: addedBy,
  });
  if (error) throw error;

  // Reserve the stock so it can't be double-allocated.
  await table("warehouse_stock").update({ status: "reserved" }).eq("id", stock.id);
  await recalcPartsTotal(buildId);
};

export const removeComponentFromBuild = async (
  componentId: string,
  buildId: string,
  stockId: string | null
): Promise<void> => {
  const { error } = await table("bike_build_components").delete().eq("id", componentId);
  if (error) throw error;
  if (stockId) {
    await table("warehouse_stock").update({ status: "stored" }).eq("id", stockId);
  }
  await recalcPartsTotal(buildId);
};

/** Marks the build complete and puts the finished bike into the customer's stock. */
export const completeBikeBuild = async (
  build: BikeBuild,
  location: { bay: string; position: number },
  depositedBy: string
): Promise<void> => {
  const components = await getBikeBuildComponents(build.id);
  const partsValue = components.reduce(
    (sum, c) => sum + Number(c.unit_value || 0) * Number(c.quantity || 1),
    0
  );

  const { data: stockRow, error: stockError } = await table("warehouse_stock")
    .insert({
      user_id: build.user_id,
      deposited_by: depositedBy,
      item_kind: "bike",
      bike_brand: build.bike_brand,
      bike_model: build.bike_model,
      bike_type: build.bike_type,
      sku: build.sku || null,
      bike_value: partsValue + Number(build.labour_cost || 0),
      item_notes: `Built by Cycle Courier Co — ${build.name}`,
      bay: location.bay,
      position: location.position,
      site_id: build.site_id,
    })
    .select("id")
    .single();
  if (stockError) throw stockError;

  // The donor components have been consumed by the build.
  const stockIds = components.map((c) => c.stock_id).filter(Boolean) as string[];
  if (stockIds.length > 0) {
    await table("warehouse_stock").update({ status: "dispatched" }).in("id", stockIds);
  }

  await table("bike_builds")
    .update({
      stage: "bike_built",
      built_at: new Date().toISOString(),
      parts_total: partsValue,
      linked_stock_id: (stockRow as any)?.id ?? null,
    })
    .eq("id", build.id);
};

export const createBuildInvoice = async (buildId: string) => {
  const { data, error } = await supabase.functions.invoke("create-build-invoice", {
    body: { buildId },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as {
    invoiceNumber?: string;
    invoiceId?: string;
    invoiceUrl?: string;
    invoicePublicUrl?: string;
    totalAmount?: number;
  };
};
