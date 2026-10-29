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
  driverId: string;
}
const QUEUE_KEY = "driver-proof-queue";
const QUARANTINE_KEY = "driver-proof-quarantine";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let queueLock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => undefined);
  return run;
}

/** Unattributed or malformed entries are kept aside, never uploaded as whoever signs in next. */
export function splitQueuedProofs(items: unknown[]) {
  const valid: QueuedProof[] = [];
  const quarantined: unknown[] = [];
  for (const p of items as any[]) {
    const ok = p && typeof p.driverId === "string" && UUID.test(p.driverId) && UUID.test(String(p.id)) && UUID.test(String(p.orderId))
      && (p.stopType === "pickup" || p.stopType === "delivery") && Array.isArray(p.photos) && !Number.isNaN(Date.parse(p.capturedAt));
    if (ok) valid.push(p); else quarantined.push(p);
  }
  return { valid, quarantined };
}

async function readRaw(key: string) {
  const { value } = await Preferences.get({ key });
  return value;
}
async function readQueue(): Promise<QueuedProof[]> {
  const value = await readRaw(QUEUE_KEY);
  if (!value) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { parsed = { unreadable: value }; }
  const { valid, quarantined } = splitQueuedProofs(Array.isArray(parsed) ? parsed : [parsed]);
  if (quarantined.length) {
    const old = await readRaw(QUARANTINE_KEY);
    let kept: unknown[] = [];
    try { kept = old ? JSON.parse(old) : []; } catch { kept = [{ unreadable: old }]; }
    await Preferences.set({ key: QUARANTINE_KEY, value: JSON.stringify([...kept, ...quarantined]) });
    await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(valid) });
  }
  return valid;
}
async function writeQueue(q: QueuedProof[]) {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(q) });
}
export async function queuedCount(driverId: string) {
  return (await readQueue()).filter((p) => p.driverId === driverId).length;
}
export async function queuedStopKeys(driverId: string) {
  return new Set((await readQueue()).filter((p) => p.driverId === driverId).map((p) => `${p.orderId}:${p.stopType}`));
}

async function dataUrlToBlob(url: string) { return (await fetch(url)).blob(); }
async function digest(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function isExistingObjectError(error: unknown) {
  const e = error as { statusCode?: string | number; status?: number; message?: string };
  return String(e?.statusCode ?? e?.status ?? "") === "409" || /already exists|duplicate/i.test(e?.message ?? "");
}

/** Files are insert-only; a retry may reuse an existing file only when its bytes are identical. */
async function ensureProofFile(path: string, blob: Blob, contentType: string) {
  const bucket = supabase.storage.from("delivery-proofs");
  const { error } = await bucket.upload(path, blob, { contentType, upsert: false });
  if (!error) return;
  if (!isExistingObjectError(error)) throw error;
  const { data, error: readError } = await bucket.download(path);
  if (readError || !data || data.size !== blob.size || await digest(data) !== await digest(blob)) {
    throw new Error("Saved proof file does not match this proof");
  }
}

async function uploadProof(p: QueuedProof, driverId: string) {
  const base = `${driverId}/${p.orderId}/${p.id}`;
  const photoPaths = p.photos.map((_, i) => `${base}/photo-${i + 1}.jpg`);
  const signaturePath = p.signature ? `${base}/signature.png` : null;
  const reservation = { id: p.id, driver_id: driverId, order_id: p.orderId, captured_at: p.capturedAt, photo_paths: photoPaths, signature_path: signaturePath };
  const { error: reserveError } = await supabase.from("delivery_proof_uploads" as any).insert(reservation);
  if (reserveError?.code === "23505") {
    const { data } = await supabase.from("delivery_proof_uploads" as any).select("driver_id, order_id, captured_at, photo_paths, signature_path").eq("id", p.id).maybeSingle();
    const r = data as any;
    if (!r || r.driver_id !== driverId || r.order_id !== p.orderId || Date.parse(r.captured_at) !== Date.parse(p.capturedAt)
      || JSON.stringify(r.photo_paths) !== JSON.stringify(photoPaths) || r.signature_path !== signaturePath) throw new Error("Proof reservation mismatch");
  } else if (reserveError) throw reserveError;
  for (let i = 0; i < p.photos.length; i++) await ensureProofFile(photoPaths[i], await dataUrlToBlob(p.photos[i]), "image/jpeg");
  if (p.signature && signaturePath) await ensureProofFile(signaturePath, await dataUrlToBlob(p.signature), "image/png");
  const row = {
    id: p.id, order_id: p.orderId, driver_id: driverId, stop_type: p.stopType,
    photo_paths: photoPaths, signature_path: signaturePath,
    recipient_name: p.recipientName || null, note: p.note || null,
    lat: p.lat, lng: p.lng, captured_at: p.capturedAt,
  };
  const { error } = await supabase.from("delivery_proofs" as any).insert(row);
  if (error?.code === "23505") {
    const { data } = await supabase.from("delivery_proofs" as any).select("order_id, driver_id, stop_type, photo_paths, signature_path, captured_at").eq("id", p.id).maybeSingle();
    const d = data as any;
    if (!d || d.order_id !== p.orderId || d.driver_id !== driverId || d.stop_type !== p.stopType || Date.parse(d.captured_at) !== Date.parse(p.capturedAt)
      || JSON.stringify(d.photo_paths) !== JSON.stringify(photoPaths) || d.signature_path !== signaturePath) throw new Error("Saved proof does not match");
  } else if (error) throw error;
}

/** Saves the proof on the phone first, then tries to upload everything waiting. */
export async function saveProof(p: QueuedProof, driverId: string) {
  await withQueueLock(async () => {
    const q = await readQueue();
    const same = q.find((x) => x.id === p.id);
    if (same && JSON.stringify(same) !== JSON.stringify({ ...p, driverId })) throw new Error("A different proof already uses this id");
    if (!same) await writeQueue([...q, { ...p, driverId }]);
  });
  return flushProofs(driverId);
}

const flushes = new Map<string, Promise<number>>();
export function flushProofs(driverId: string): Promise<number> {
  const running = flushes.get(driverId);
  if (running) return running;
  const run = (async () => {
    const mine = (await withQueueLock(readQueue)).filter((p) => p.driverId === driverId);
    for (const p of mine) {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id !== driverId) break;
      try {
        await uploadProof(p, driverId);
        await withQueueLock(async () => writeQueue((await readQueue()).filter((x) => x.id !== p.id || x.driverId !== driverId)));
      } catch {
        // Keep it on the phone for the next retry.
      }
    }
    return queuedCount(driverId);
  })().finally(() => flushes.delete(driverId));
  flushes.set(driverId, run);
  return run;
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
