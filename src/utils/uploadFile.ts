import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

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

function isNetworkError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    e?.name === "TypeError"
  );
}

export function describeUploadError(e: any, file?: File): string {
  const msg = String(e?.message || e || "");
  const status = e?.statusCode || e?.status;
  if (isNetworkError(e)) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "You appear to be offline — reconnect and try again.";
    }
    if (file && file.size > 8 * 1024 * 1024) {
      return `Upload failed — the file is large (${(file.size / 1024 / 1024).toFixed(1)}MB) and the connection dropped. Try a smaller photo or a PDF.`;
    }
    return "Upload failed — the connection dropped before the file finished. Please try again.";
  }
  if (String(status) === "413") return "That file is too large to upload.";
  if (String(status) === "401" || String(status) === "403" || /jwt|unauthor|permission|policy/i.test(msg)) {
    return "Upload was rejected — your session may have expired. Refresh the page and try again.";
  }
  return msg || "Upload failed";
}

interface UploadOptions {
  bucket: string;
  /** Folder prefix, usually the order id. */
  prefix: string;
  file: File;
  allowedTypes?: RegExp;
  maxBytes?: number;
}

/**
 * Validates, sanitises and uploads a file to Supabase storage.
 * Retries once on a pure network failure. Returns the storage path.
 */
export async function uploadToStorage({
  bucket,
  prefix,
  file,
  allowedTypes = /^(application\/pdf|image\/)/,
  maxBytes = MAX_UPLOAD_BYTES,
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
  try {
    await supabase.auth.getSession();
  } catch {
    /* non-fatal */
  }

  const path = `${prefix}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const attempt = async () => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
  };

  try {
    await attempt();
  } catch (e: any) {
    if (!isNetworkError(e)) {
      console.error("[uploadToStorage] failed", {
        bucket,
        path,
        size: file.size,
        type: file.type,
        name: e?.name,
        message: e?.message,
        status: e?.statusCode || e?.status,
      });
      Sentry.captureException(e, {
        extra: { bucket, path, size: file.size, type: file.type },
      });
      throw new Error(describeUploadError(e, file));
    }
    // one retry for transient network failures
    try {
      await attempt();
    } catch (e2: any) {
      console.error("[uploadToStorage] failed after retry", {
        bucket,
        path,
        size: file.size,
        type: file.type,
        name: e2?.name,
        message: e2?.message,
      });
      Sentry.captureException(e2, {
        extra: { bucket, path, size: file.size, type: file.type, retried: true },
      });
      throw new Error(describeUploadError(e2, file));
    }
  }

  return path;
}
