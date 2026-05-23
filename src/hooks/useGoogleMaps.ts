import { useEffect, useState } from "react";

const SCRIPT_ID = "google-maps-js";
let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(libraries: string[] = ["drawing", "geometry"]): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window not available"));
  }
  // @ts-ignore
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) {
    return Promise.reject(new Error("Google Maps connector key missing"));
  }

  loadPromise = new Promise((resolve, reject) => {
    // @ts-ignore
    (window as any).__initGoogleMaps = () => {
      // @ts-ignore
      resolve(window.google);
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) return;
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=${libraries.join(",")}&callback=__initGoogleMaps${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function useGoogleMaps(libraries: string[] = ["drawing", "geometry"]) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    loadGoogleMaps(libraries)
      .then(() => { if (active) setReady(true); })
      .catch((e) => { if (active) setError(e); });
    return () => { active = false; };
  }, [libraries.join(",")]);
  return { ready, error };
}
