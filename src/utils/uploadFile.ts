import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Strip anything that could break a Supabase storage key. */
export function sanitizeFileName(name: string): string {
  const trimmed = (name || "file").normalize("NFKD");
  const dot = trimmed.lastIndexOf(".");
  let base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  let ext = dot > 0 ? trimmed.slice(dot + 1) : "";

  const clean = (s: string) =>
    s
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");

  base = clean(base).slice(0, 60) || "file";
  ext = clean(ext).slice(0, 10);
  return ext ? `${base}.${ext}` : base;
}

class UploadError extends Error {
  status?: number;
  transport: boolean;
  constructor(message: string, opts: { status?: number; transport?: boolean } = {}) {
    super(message);
    this.name = "UploadError";
    this.status = opts.status;
    this.transport = !!opts.transport;
  }
}

function isTransportError(e: any): boolean {
  if (e instanceof UploadError) {
    return e.transport || (!!e.status && (e.status >= 500 || e.status === 408 || e.status === 429));
  }
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("timed out") ||
    e?.name === "TypeError"
  );
}

export function describeUploadError(e: any, file?: File): string {
  const msg = String(e?.message || e || "");
  const status = (e as any)?.status ?? (e as any)?.statusCode;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline — reconnect and try again.";
  }
  if (String(status) === "413") return "That file is too large to upload.";
  if (
    String(status) === "401" ||
    String(status) === "403" ||
    /jwt|unauthor|permission|policy/i.test(msg)
  ) {
    return "Upload was rejected — your session may have expired. Refresh the page and try again.";
  }
  if (status && Number(status) >= 500) {
    return `The storage service returned an error (${status}). Please try again in a moment.`;
  }
  if (isTransportError(e)) {
    if (file && file.size > 8 * 1024 * 1024) {
      return `Upload stalled — the file is large (${(file.size / 1024 / 1024).toFixed(
        1,
      )}MB) and the connection dropped. Try a smaller photo or a PDF.`;
    }
    return "Upload failed — the connection dropped before the file finished. Please try again.";
  }
  return msg || "Upload failed";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload straight to the storage REST endpoint with XHR.
 * XHR survives mobile network handovers better than fetch and gives us a
 * real HTTP status instead of an opaque "Failed to fetch".
 */
function xhrUpload(params: {
  bucket: string;
  path: string;
  file: File;
  token: string;
  onProgress?: (pct: number) => void;
  timeoutMs?: number;
}): Promise<void> {
  const { bucket, path, file, token, onProgress, timeoutMs = 120_000 } = params;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    xhr.open("POST", url, true);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "3600");

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (HTTP ${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText || "{}");
        if (body?.message || body?.error) message = body.message || body.error;
      } catch {
        /* keep default */
      }
      reject(new UploadError(message, { status: xhr.status }));
    };
    xhr.onerror = () =>
      reject(new UploadError("Network error during upload", { transport: true }));
    xhr.ontimeout = () => reject(new UploadError("Upload timed out", { transport: true }));
    xhr.onabort = () => reject(new UploadError("Upload aborted", { transport: true }));

    xhr.send(file);
  });
}

/** Last-resort path: push the file through an edge function using the service role. */
async function edgeFallbackUpload(params: {
  bucket: string;
  path: string;
  file: File;
}): Promise<void> {
  const form = new FormData();
  form.append("bucket", params.bucket);
  form.append("path", params.path);
  form.append("file", params.file, params.file.name || "upload");

  const { data, error } = await supabase.functions.invoke("upload-file", { body: form });
  if (error) throw new UploadError(error.message || "Fallback upload failed");
  if (data && (data as any).error) throw new UploadError((data as any).error);
}

interface UploadOptions {
  bucket: string;
  /** Folder prefix, usually the order id. */
  prefix: string;
  file: File;
  allowedTypes?: RegExp;
  maxBytes?: number;
  onProgress?: (pct: number) => void;
}

/**
 * Validates, sanitises and uploads a file to Supabase storage.
 * Retries transport failures with backoff, then falls back to an edge function.
 * Returns the storage path.
 */
export async function uploadToStorage({
  bucket,
  prefix,
  file,
  allowedTypes = /^(application\/pdf|image\/)/,
  maxBytes = MAX_UPLOAD_BYTES,
  onProgress,
}: UploadOptions): Promise<string> {
  if (!file.size) throw new Error("That file is empty.");
  if (file.size > maxBytes) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${Math.round(
        maxBytes / 1024 / 1024,
      )}MB. Please upload a smaller photo or a PDF.`,
    );
  }
  if (file.type && !allowedTypes.test(file.type)) {
    throw new Error("Only PDF or image files can be uploaded.");
  }

  // Make sure the access token is fresh before a potentially slow upload
  let token = SUPABASE_ANON_KEY;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch {
    /* non-fatal */
  }

  const path = `${prefix}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const backoff = [1000, 3000, 6000];
  let lastError: any;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      onProgress?.(0);
      await xhrUpload({ bucket, path, file, token, onProgress });
      onProgress?.(100);
      return path;
    } catch (e: any) {
      lastError = e;
      if (!isTransportError(e)) break; // 4xx — fail fast with the server message
      if (attempt < 2) await sleep(backoff[attempt]);
    }
  }

  // Transport keeps failing against the storage host — try the functions host.
  if (isTransportError(lastError)) {
    try {
      await edgeFallbackUpload({ bucket, path, file });
      onProgress?.(100);
      return path;
    } catch (fallbackError: any) {
      console.error("[uploadToStorage] fallback failed", {
        bucket,
        path,
        size: file.size,
        type: file.type,
        message: fallbackError?.message,
      });
      Sentry.captureException(fallbackError, {
        extra: { bucket, path, size: file.size, type: file.type, fallback: true },
      });
      throw new Error(describeUploadError(lastError, file));
    }
  }

  console.error("[uploadToStorage] failed", {
    bucket,
    path,
    size: file.size,
    type: file.type,
    name: lastError?.name,
    message: lastError?.message,
    status: lastError?.status,
  });
  Sentry.captureException(lastError, {
    extra: { bucket, path, size: file.size, type: file.type },
  });
  throw new Error(describeUploadError(lastError, file));
}
