import { useEffect, useRef, type RefObject } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";

/** Camera QR reader (BarcodeDetector, jsQR fallback). Calls onCode for each read while `on`. */
export function useQrScanner(on: boolean, video: RefObject<HTMLVideoElement>, onCode: (text: string) => void, onFail?: () => void) {
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null; let timer = 0; let stopped = false;
    const detector = "BarcodeDetector" in window ? new (window as any).BarcodeDetector({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const v = video.current;
          if (v.readyState >= 2) {
            try {
              if (detector) { const codes = await detector.detect(v); if (codes[0]) cb.current(codes[0].rawValue); }
              else if (ctx) {
                canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
                const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
                if (r) cb.current(r.data);
              }
            } catch { /* keep scanning */ }
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch { toast.error("Camera not available — type the code instead."); onFail?.(); }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}
