/**
 * Front-end mirror of the shared email design tokens
 * (`supabase/functions/_shared/emailLayout.ts`), per ccc-email-design.md §1.
 *
 * The app itself never delivers mail — every front-end sender goes through the
 * `send-email` function, which applies the branded shell. These values exist so
 * previews and the announcement composer show the same palette as the real
 * emails. Keep them in step with the edge-function module.
 */

export const EMAIL_BRAND = {
  name: "Cycle Courier Co.",
  legalName: "Cycorco Ltd trading as Cycle Courier Co.",
  address: "30 Wake Green Road, Birmingham, B13 9PB",
  companyNo: "16220087",
  vatNo: "GB507727188",
  email: "Info@cyclecourierco.com",
  phone: "+44 121 798 0767",
  website: "https://booking.cyclecourierco.com",
  primary: "#0B5FB0",
  primaryDark: "#084C8B",
  primaryText: "#FFFFFF",
  text: "#16191D",
  muted: "#5B6470",
  border: "#D9DFE5",
  panel: "#F2F5F7",
  page: "#EDF1F4",
  surface: "#FFFFFF",
  routeTint: "#E3EEF8",
  radius: "6px",
  font:
    "Overpass,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'Overpass Mono',ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace",
} as const;

/** Status pill tokens — mirror ccc-design.md §2. */
export const EMAIL_STATUS = {
  neutral: { bg: "#6B7580", text: "#FFFFFF" },
  waiting: { bg: "#F5B800", text: "#16191D" },
  booked: { bg: "#0B5FB0", text: "#FFFFFF" },
  transit: { bg: "#6B4FBF", text: "#FFFFFF" },
  done: { bg: "#1E7A46", text: "#FFFFFF" },
  failed: { bg: "#C22F2E", text: "#FFFFFF" },
  ni: { bg: "#3F51B5", text: "#FFFFFF" },
  trunk: { bg: "#0E7C8C", text: "#FFFFFF" },
  inspection: { bg: "#2B8CD8", text: "#FFFFFF" },
} as const;

/** Marker that tells the edge-function shell a document is already branded. */
export const EMAIL_BRAND_MARKER = "ccc-email-shell";
