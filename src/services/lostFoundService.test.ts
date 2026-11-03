import { describe, expect, it, vi } from "vitest";
const single = vi.fn().mockResolvedValue({ data: { id: "item-1" }, error: null });
const update = vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => ({ update })) } }));
import { setLocationCheck, validateItemPhoto } from "./lostFoundService";
import { APP_ROUTES } from "@/config/routes";

describe("Lost and Found", () => {
  it("allows customer-service agents by default, not customers", () => {
    const route = APP_ROUTES.find(r => r.path === "/lost-and-found");
    expect(route?.defaultRoles).toEqual(["cs_agent"]);
  });
  it("records the collection van check independently", async () => {
    await setLocationCheck("item-1", "collection_van_checked", true);
    expect(update).toHaveBeenLastCalledWith({ collection_van_checked: true });
  });
  it("records the delivery van check independently", async () => {
    await setLocationCheck("item-1", "delivery_van_checked", true);
    expect(update).toHaveBeenLastCalledWith({ delivery_van_checked: true });
  });
  it("allows the depot check to be unticked independently", async () => {
    await setLocationCheck("item-1", "depot_checked", false);
    expect(update).toHaveBeenLastCalledWith({ depot_checked: false });
  });
  it("accepts an item photograph and rejects non-images", () => {
    expect(() => validateItemPhoto({ type: "image/jpeg", size: 100 })).not.toThrow();
    expect(() => validateItemPhoto({ type: "text/html", size: 100 })).toThrow();
  });
});