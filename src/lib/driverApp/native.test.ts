import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false }, registerPlugin: () => ({}) }));
vi.mock("@capacitor/preferences", () => ({ Preferences: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { isExistingObjectError, splitQueuedProofs } from "./native";

const proof = {
  id: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  driverId: "33333333-3333-4333-8333-333333333333",
  stopType: "delivery", photos: [], signature: null, recipientName: "", note: "", lat: null, lng: null,
  capturedAt: "2026-10-29T03:00:00.000Z",
};

describe("offline proof queue", () => {
  it("quarantines a proof with no capturing driver", () => {
    const { driverId: _driver, ...legacy } = proof;
    expect(splitQueuedProofs([legacy])).toEqual({ valid: [], quarantined: [legacy] });
  });

  it("keeps a proof captured by a named driver", () => {
    expect(splitQueuedProofs([proof]).valid).toEqual([proof]);
  });

  it("treats only an existing-file response as a retry match candidate", () => {
    expect(isExistingObjectError({ statusCode: "409" })).toBe(true);
    expect(isExistingObjectError({ statusCode: "403", message: "row-level security" })).toBe(false);
  });
});
