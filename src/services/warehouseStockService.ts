import { supabase } from "@/integrations/supabase/client";
import type { WarehouseStock, WarehouseStockFormData } from "@/types/warehouseStock";
import { generateTrackingNumber } from "@/services/trackingService";
import { sendOrderCreationConfirmationToUser, sendOrderNotificationToReceiver, sendReceiverAvailabilityEmail } from "@/services/emailService";
import { createShipdayOrder } from "@/services/shipdayService";

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

export const getMyWarehouseStock = async (userId: string): Promise<WarehouseStock[]> => {
  const { data, error } = await supabase
    .from("warehouse_stock" as any)
    .select("*")
    .eq("user_id", userId)
    .in("status", ["stored", "reserved"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data as any[]) || []).map((item: any) => ({
    ...item,
  })) as WarehouseStock[];
};

export const requestDeliveryFromStock = async (
  stockItem: WarehouseStock,
  receiverDetails: {
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  },
  userId: string
): Promise<string> => {
  // 1. Get user profile for sender details
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, phone, address_line_1, city, postal_code")
    .eq("id", userId)
    .single();

  if (!profile) throw new Error("Could not fetch your profile");

  // 2. Create the order
  const timestamp = new Date().toISOString();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      sender: {
        name: profile.name || "Warehouse",
        email: profile.email || "",
        phone: profile.phone || "",
        address: {
          street: profile.address_line_1 || "Depot",
          city: profile.city || "",
          state: "",
          zipCode: profile.postal_code || "",
          country: "United Kingdom",
        },
      },
      receiver: {
        name: receiverDetails.name,
        email: receiverDetails.email,
        phone: receiverDetails.phone,
        address: {
          street: receiverDetails.street,
          city: receiverDetails.city,
          state: receiverDetails.state,
          zipCode: receiverDetails.zipCode,
          country: receiverDetails.country || "United Kingdom",
        },
      },
      bike_brand: stockItem.bike_brand,
      bike_model: stockItem.bike_model,
      bike_type: stockItem.bike_type,
      bike_value: stockItem.bike_value,
      bike_quantity: 1,
      status: "created",
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // 3. Update stock status to reserved and link order
  const { error: updateError } = await supabase
    .from("warehouse_stock" as any)
    .update({
      status: "reserved",
      linked_order_id: order.id,
    } as any)
    .eq("id", stockItem.id);

  if (updateError) throw updateError;

  // 4. Generate tracking number and update order
  const senderName = profile.name || "Warehouse";
  const receiverZipCode = receiverDetails.zipCode || "000";
  try {
    const trackingNumber = await generateTrackingNumber(senderName, receiverZipCode);
    await supabase
      .from("orders")
      .update({ tracking_number: trackingNumber })
      .eq("id", order.id);
    console.log("Tracking number generated for stock delivery:", trackingNumber);
  } catch (err) {
    console.error("Failed to generate tracking number for stock delivery:", err);
  }

  // 5. Fire-and-forget: Send emails (no sender availability needed - stock is at depot)
  const userEmail = profile.email || "";
  sendOrderCreationConfirmationToUser(order.id, userEmail, profile.name || "Customer").catch(err =>
    console.error("Failed to send order confirmation email:", err)
  );
  sendOrderNotificationToReceiver(order.id).catch(err =>
    console.error("Failed to send receiver notification email:", err)
  );
  sendReceiverAvailabilityEmail(order.id).catch(err =>
    console.error("Failed to send receiver availability email:", err)
  );

  // 6. Fire-and-forget: Create Shipday delivery job (no pickup needed)
  createShipdayOrder(order.id, 'delivery').catch(err =>
    console.error("Failed to create Shipday delivery job:", err)
  );

  return order.id;
};
