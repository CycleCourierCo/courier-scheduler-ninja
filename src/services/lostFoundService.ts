import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type LostFoundItem = Tables<"lost_found_items">;
export const LOCATION_CHECKS = [
  { key: "collection_van_checked", label: "Collection van checked" },
  { key: "delivery_van_checked", label: "Delivery van checked" },
  { key: "depot_checked", label: "Depot checked" },
] as const;
export type LocationCheck = typeof LOCATION_CHECKS[number]["key"];
export const lostFoundQueryKey = ["lost-found-items"];

export async function listLostFoundItems(page: number, search: string, type: string) {
  let query = supabase.from("lost_found_items").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(page * 30, page * 30 + 29);
  if (search.trim()) query = query.ilike("item_name", `%${search.trim()}%`);
  if (type !== "all") query = query.eq("item_type", type);
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data ?? [], count: count ?? 0 };
}

export async function setLocationCheck(id: string, key: LocationCheck, checked: boolean) {
  const { data, error } = await supabase.from("lost_found_items")
    .update({ [key]: checked }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export function validateItemPhoto(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP photo");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Photo must be 10 MB or smaller");
}

export async function uploadItemPhoto(id: string, file: File) {
  validateItemPhoto(file);
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
  const path = `${id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("lost-found-photos").upload(path, file, { upsert: false });
  if (error) throw error;
  const { error: saveError } = await supabase.from("lost_found_items").update({ photo_path: path }).eq("id", id).select("id").single();
  if (saveError) {
    await supabase.storage.from("lost-found-photos").remove([path]);
    throw saveError;
  }
}

export async function itemPhotoUrl(path: string) {
  const { data, error } = await supabase.storage.from("lost-found-photos").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}