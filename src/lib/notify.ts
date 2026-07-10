/**
 * Unified notification / toast API for the app.
 *
 * Thin wrapper around `sonner` so every caller gets consistent:
 *  - types (success / info / warning / error / loading / promise)
 *  - durations (errors persist longer, others auto-dismiss)
 *  - manual dismissal (close button always available)
 *  - accessibility (sonner renders inside an aria-live region, pauses on hover)
 *  - a `confirm()` replacement that is non-blocking and dismissable
 *
 * Prefer `notify.*` over calling `toast` from "sonner" directly in new code.
 * Existing `import { toast } from "sonner"` call sites keep working — both
 * write to the same Sonner queue rendered by <Toaster /> in App.tsx.
 */
import { toast as sonner, type ExternalToast } from "sonner";

const DURATIONS = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 10000,
} as const;

type Opts = ExternalToast;

function normalizeError(err: unknown): { message: string; description?: string } {
  if (!err) return { message: "Something went wrong" };
  if (typeof err === "string") return { message: err };
  if (err instanceof Error) return { message: err.message };
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return { message: m };
  }
  return { message: "Something went wrong", description: String(err) };
}

export const notify = {
  success(message: string, opts?: Opts) {
    return sonner.success(message, { duration: DURATIONS.success, ...opts });
  },

  info(message: string, opts?: Opts) {
    return sonner.info(message, { duration: DURATIONS.info, ...opts });
  },

  warning(message: string, opts?: Opts) {
    return sonner.warning(message, { duration: DURATIONS.warning, ...opts });
  },

  /**
   * Errors persist longer than success/info and always show the close button.
   * Pass an Error/{message} object as the second arg and the description will
   * auto-populate from `.message`.
   */
  error(message: string, errOrOpts?: unknown | Opts) {
    let opts: Opts = { duration: DURATIONS.error, closeButton: true };
    if (errOrOpts && typeof errOrOpts === "object" && !("duration" in (errOrOpts as object)) &&
        !("description" in (errOrOpts as object)) && !("action" in (errOrOpts as object))) {
      const norm = normalizeError(errOrOpts);
      opts = { ...opts, description: norm.message };
    } else if (errOrOpts) {
      opts = { ...opts, ...(errOrOpts as Opts) };
    }
    return sonner.error(message, opts);
  },

  loading(message: string, opts?: Opts) {
    return sonner.loading(message, opts);
  },

  promise<T>(
    p: Promise<T>,
    msgs: { loading: string; success: string | ((data: T) => string); error: string | ((err: unknown) => string) },
  ) {
    return sonner.promise(p, msgs);
  },

  dismiss(id?: string | number) {
    return sonner.dismiss(id);
  },

  /**
   * Non-blocking confirm toast — replaces `window.confirm()`.
   * Stays until the user clicks Confirm, Cancel or the close button.
   */
  confirm(args: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    destructive?: boolean;
  }): string | number {
    const {
      title,
      description,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      onConfirm,
      onCancel,
      destructive,
    } = args;

    const id = sonner(title, {
      description,
      duration: Infinity,
      closeButton: true,
      className: destructive ? "border-destructive" : undefined,
      action: {
        label: confirmLabel,
        onClick: () => {
          void onConfirm();
        },
      },
      cancel: {
        label: cancelLabel,
        onClick: () => {
          onCancel?.();
        },
      },
    });
    return id;
  },
};

export default notify;
