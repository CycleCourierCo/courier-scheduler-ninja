import { supabase } from "@/integrations/supabase/client";
import type { WarehouseStock, WarehouseStockFormData } from "@/types/warehouseStock";

export const getWarehouseStock = async (): Promise<WarehouseStock[]> => {
  const { data, error } = await supabase
    .from("warehouse_stock" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Fetch customer profiles for display names
  const items = (data as any[]) || [];
  const userIds = [...new Set(items.map((i: any) => i.user_id))];
  
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, company_name")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return items.map((item: any) => {
    const profile = profileMap.get(item.user_id);
    return {
      ...item,
      customer_name: profile?.company_name || profile?.name || 'Unknown',
      customer_email: profile?.email || '',
    } as WarehouseStock;
  });
};

export const addWarehouseStock = async (
  data: WarehouseStockFormData,
  depositedBy: string
): Promise<void> => {
  const { error } = await supabase
    .from("warehouse_stock" as any)
    .insert({
      user_id: data.user_id,
      deposited_by: depositedBy,
      bike_brand: data.bike_brand || null,
      bike_model: data.bike_model || null,
      bike_type: data.bike_type || null,
      bike_value: data.bike_value ? parseFloat(data.bike_value) : null,
      item_notes: data.item_notes || null,
      bay: data.bay,
      position: data.position,
    } as any);

  if (error) throw error;
};

export const updateWarehouseStock = async (
  id: string,
  updates: Partial<WarehouseStockFormData & { status: string }>
): Promise<void> => {
  const payload: any = { ...updates };
  if (payload.bike_value) payload.bike_value = parseFloat(payload.bike_value);
  
  const { error } = await supabase
    .from("warehouse_stock" as any)
    .update(payload)
    .eq("id", id);

  if (error) throw error;
};

export const removeWarehouseStock = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("warehouse_stock" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
};

export const checkLocationConflict = async (
  bay: string,
  position: number,
  excludeId?: string
): Promise<boolean> => {
  let query = (supabase.from("warehouse_stock" as any) as any)
    .select("id")
    .eq("bay", bay)
    .eq("position", position)
    .in("status", ["stored", "reserved"]);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;
  return (data as any[] || []).length > 0;
};

export const getCustomerList = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, company_name, role")
    .in("role", ["b2b_customer", "b2c_customer"])
    .order("name");

  if (error) throw error;
  return data || [];
};
