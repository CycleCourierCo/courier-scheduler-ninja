/**
 * Front-end mirror of the shared email design tokens
 * (`supabase/functions/_shared/emailLayout.ts`).
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
  primary: "#0B61B1",
  primaryDark: "#084C8B",
  text: "#16191D",
  muted: "#5C6570",
  border: "#D8DEE4",
  panel: "#F2F5F7",
  page: "#EDF1F4",
  radius: "6px",
  font:
    "Overpass,'Overpass',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

/** Marker that tells the edge-function shell a document is already branded. */
export const EMAIL_BRAND_MARKER = "ccc-email-shell";
