import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";
import { shouldSendPosition } from "./stops";

export const isNative = () => Capacitor.isNativePlatform();

// ---------- Offline proof queue ----------
export interface QueuedProof {
  id: string;
  orderId: string;
  stopType: string;
  photos: string[]; // data URLs
  signature: string | null; // data URL
  recipientName: string;
  note: string;
  lat: number | null;
  lng: number | null;
  capturedAt: string;
  /** Account that captured the proof; only that driver may upload it. */
  driverId?: string;
}
const QUEUE_KEY = "driver-proof-queue";

async function readQueue(): Promise<QueuedProof[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  try { return value ? JSON.parse(value) : []; } catch { return []; }
}
async function writeQueue(q: QueuedProof[]) {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(q) });
}
export async function queuedCount(driverId?: string) {
  const q = await readQueue();
  return driverId ? q.filter((p) => !p.driverId || p.driverId === driverId).length : q.length;
}
export async function queuedOrderIds() { return new Set((await readQueue()).map((p) => p.orderId)); }

async function dataUrlToBlob(url: string) { return (await fetch(url)).blob(); }

async function uploadProof(p: QueuedProof, driverId: string) {
  const base = `${driverId}/${p.orderId}/${p.id}`;
  const photoPaths: string[] = [];
  for (let i = 0; i < p.photos.length; i++) {
    const path = `${base}/photo-${i + 1}.jpg`;
    const { error } = await supabase.storage.from("delivery-proofs").upload(path, await dataUrlToBlob(p.photos[i]), { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    photoPaths.push(path);
  }
  let signaturePath: string | null = null;
  if (p.signature) {
    signaturePath = `${base}/signature.png`;
    const { error } = await supabase.storage.from("delivery-proofs").upload(signaturePath, await dataUrlToBlob(p.signature), { contentType: "image/png", upsert: true });
    if (error) throw error;
  }
  const { error } = await supabase.from("delivery_proofs" as any).insert({
    id: p.id, order_id: p.orderId, driver_id: driverId, stop_type: p.stopType,
    photo_paths: photoPaths, signature_path: signaturePath,
    recipient_name: p.recipientName || null, note: p.note || null,
    lat: p.lat, lng: p.lng, captured_at: p.capturedAt,
  });
  if (error && error.code !== "23505") throw error; // duplicate = already uploaded
}

/** Saves the proof on the phone first, then tries to upload everything waiting. */
export async function saveProof(p: QueuedProof, driverId: string) {
  await writeQueue([...(await readQueue()), { ...p, driverId }]);
  return flushProofs(driverId);
}

let flushing = false;
export async function flushProofs(driverId: string): Promise<number> {
  if (flushing) return queuedCount(driverId);
  flushing = true;
  try {
    const remaining: QueuedProof[] = [];
    for (const p of await readQueue()) {
      // A proof captured by another driver on this phone stays queued for them.
      if (p.driverId && p.driverId !== driverId) { remaining.push(p); continue; }
      try { await uploadProof(p, driverId); } catch { remaining.push(p); }
    }
    await writeQueue(remaining);
    return remaining.filter((p) => !p.driverId || p.driverId === driverId).length;
  } finally { flushing = false; }
}

// ---------- Shift location sharing ----------
interface BgLocation { latitude: number; longitude: number; accuracy: number }
interface BgPlugin {
  addWatcher(o: Record<string, unknown>, cb: (loc?: BgLocation, err?: { code?: string }) => void): Promise<string>;
  removeWatcher(o: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BgPlugin>("BackgroundGeolocation");

let watcherId: string | null = null;
let webWatch: number | null = null;
let lastSent: number | null = null;

async function sendPosition(driverId: string, lat: number, lng: number, accuracy: number | null) {
  const now = Date.now();
  if (!shouldSendPosition(lastSent, now)) return;
  lastSent = now;
  await supabase.from("driver_positions" as any).insert({ driver_id: driverId, lat, lng, accuracy });
}

export async function startShiftTracking(driverId: string, onError: (msg: string) => void) {
  lastSent = null;
  if (isNative()) {
    watcherId = await BackgroundGeolocation.addWatcher(
      { backgroundTitle: "Sharing your location", backgroundMessage: "Cycle Courier Co. is sharing your location while you're on shift.", requestPermissions: true, stale: false, distanceFilter: 25 },
      (loc, err) => {
        if (err) { onError(err.code === "NOT_AUTHORIZED" ? "Location access is turned off for this app." : "Couldn't read your location."); return; }
        if (loc) void sendPosition(driverId, loc.latitude, loc.longitude, loc.accuracy);
      },
    );
  } else if ("geolocation" in navigator) {
    webWatch = navigator.geolocation.watchPosition(
      (p) => void sendPosition(driverId, p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      () => onError("Location access was blocked."),
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
  } else onError("This device can't share location.");
}

export async function stopShiftTracking() {
  if (watcherId) { await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {}); watcherId = null; }
  if (webWatch != null) { navigator.geolocation.clearWatch(webWatch); webWatch = null; }
}

export function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null), { timeout: 8000, maximumAge: 60_000 });
  });
}
