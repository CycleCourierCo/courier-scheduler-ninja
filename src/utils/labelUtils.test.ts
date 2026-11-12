import { describe, it, expect, vi } from "vitest";
import jsPDF from "jspdf";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { prepareThermalLabelArtwork, renderLabelPage, LABEL_WIDTH, LABEL_HEIGHT } from "./labelUtils";

describe("thermal label artwork", () => {
  it("prints a label without fetching artwork from any website", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchSpy);
    const art = await prepareThermalLabelArtwork();
    // PNG signature on the native one-bit mark
    expect(Array.from(art.full.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const pdf = new jsPDF("portrait", "pt", [LABEL_WIDTH, LABEL_HEIGHT]);
    renderLabelPage(pdf, {
      id: "1", trackingNumber: "CCC754311169318SAMNG6", needsInspection: true, isBoxMyBike: true,
      receiver: { name: "Test", address: { street: "1 Road", city: "Birmingham", zipCode: "B1 1AA" } },
    } as any, 0, 1, LABEL_WIDTH, false);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
