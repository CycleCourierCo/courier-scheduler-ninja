import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

/**
 * Self-hosted Leaflet markers.
 *
 * Previously the pins were loaded from raw.githubusercontent.com and cdnjs,
 * both of which are routinely blocked by corporate networks and antivirus
 * web-filters — leaving maps with invisible markers. Everything here is either
 * bundled from the leaflet package or an inline SVG, so nothing external is
 * requested.
 */

export const DEFAULT_MARKER_URLS = {
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
};

/** Apply the bundled images to Leaflet's default marker. Safe to call twice. */
export function applyDefaultMarkerIcons() {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions(DEFAULT_MARKER_URLS);
}

export type MarkerColour = "green" | "red" | "blue" | "orange" | "black" | "grey" | "violet" | "gold";

const COLOURS: Record<MarkerColour, { fill: string; stroke: string }> = {
  green: { fill: "#2AAD27", stroke: "#1a6b18" },
  red: { fill: "#CB2B3E", stroke: "#7e1a26" },
  blue: { fill: "#2A81CB", stroke: "#1a5180" },
  orange: { fill: "#CB8427", stroke: "#7e5218" },
  black: { fill: "#3D3D3D", stroke: "#1a1a1a" },
  grey: { fill: "#7B7B7B", stroke: "#4d4d4d" },
  violet: { fill: "#9C2BCB", stroke: "#611a7e" },
  gold: { fill: "#FFD326", stroke: "#a88a12" },
};

const svgCache = new Map<MarkerColour, string>();

/** Inline SVG pin as a data URI — no network request at all. */
export function markerSvgUrl(colour: MarkerColour): string {
  const cached = svgCache.get(colour);
  if (cached) return cached;
  const { fill, stroke } = COLOURS[colour] ?? COLOURS.blue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0.5C5.87 0.5 0.5 5.87 0.5 12.5c0 8.5 12 28 12 28s12-19.5 12-28C24.5 5.87 19.13 0.5 12.5 0.5z" fill="${fill}" stroke="${stroke}" stroke-width="1"/><circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff" fill-opacity="0.85"/></svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  svgCache.set(colour, url);
  return url;
}

const iconCache = new Map<MarkerColour, L.Icon>();

/** Coloured pin, matching the sizing of the old leaflet-color-markers pins. */
export function colouredMarkerIcon(colour: MarkerColour): L.Icon {
  const cached = iconCache.get(colour);
  if (cached) return cached;
  const icon = new L.Icon({
    iconUrl: markerSvgUrl(colour),
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  iconCache.set(colour, icon);
  return icon;
}
