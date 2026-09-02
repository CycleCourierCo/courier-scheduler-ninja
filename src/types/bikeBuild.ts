import type { BuildStage } from "@/constants/bikeComponents";

export type BikeBuild = {
  id: string;
  user_id: string;
  site_id: string | null;
  name: string;
  sku: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  bike_type: string | null;
  spec_notes: string | null;
  stage: BuildStage;
  labour_cost: number;
  parts_total: number;
  invoice_number: string | null;
  invoice_url: string | null;
  invoiced_at: string | null;
  built_at: string | null;
  linked_stock_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customer_name?: string;
  customer_email?: string;
  component_count?: number;
};

export type BikeBuildComponent = {
  id: string;
  build_id: string;
  stock_id: string | null;
  slot: string | null;
  category: string;
  quantity: number;
  unit_value: number | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined from warehouse_stock
  stock?: {
    id: string;
    bike_brand: string | null;
    bike_model: string | null;
    spec: string | null;
    sku: string | null;
    bay: string;
    position: number;
    status: string;
    quantity: number;
  } | null;
};

export type BikeBuildStageLogEntry = {
  id: string;
  build_id: string;
  from_stage: BuildStage | null;
  to_stage: BuildStage;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

export type BikeBuildFormData = {
  user_id: string;
  name: string;
  sku: string;
  bike_brand: string;
  bike_model: string;
  bike_type: string;
  spec_notes: string;
  labour_cost: string;
  site_id?: string | null;
};

export type BikeBuildTemplateItem = {
  id: string;
  template_id: string;
  category: string;
  slot: string | null;
  quantity: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BikeBuildTemplate = {
  id: string;
  user_id: string;
  name: string;
  sku: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  bike_type: string | null;
  spec_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  items?: BikeBuildTemplateItem[];
  customer_name?: string;
};

export type BikeBuildTemplateFormData = {
  user_id: string;
  name: string;
  sku: string;
  bike_brand: string;
  bike_model: string;
  bike_type: string;
  spec_notes: string;
  items: { category: string; quantity: number; slot?: string | null }[];
};

