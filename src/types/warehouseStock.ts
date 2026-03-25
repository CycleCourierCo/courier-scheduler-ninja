export type WarehouseStockStatus = 'stored' | 'reserved' | 'dispatched' | 'returned';

export type WarehouseStock = {
  id: string;
  user_id: string;
  deposited_by: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  bike_type: string | null;
  bike_value: number | null;
  item_notes: string | null;
  bay: string;
  position: number;
  status: WarehouseStockStatus;
  linked_order_id: string | null;
  deposited_at: string;
  dispatched_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined field
  customer_name?: string;
  customer_email?: string;
};

export type WarehouseStockFormData = {
  user_id: string;
  bike_brand: string;
  bike_model: string;
  bike_type: string;
  bike_value: string;
  item_notes: string;
  bay: string;
  position: number;
};
