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
  primary: "#4D6863",
  primaryDark: "#3A514C",
  primaryText: "#F8F8EE",
  text: "#1C2421",
  muted: "#5E6A66",
  border: "#DEDED6",
  panel: "#F3F7F5",
  page: "#F2F2EC",
  surface: "#FFFFFF",
  routeTint: "#E6EDEA",
  radius: "10px",
  font:
    "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'DM Mono',ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace",
} as const;

/** Status pill tokens — mirror ccc-design.md §2. */
export const EMAIL_STATUS = {
  neutral: { bg: "#656C67", text: "#FFFFFF" },
  waiting: { bg: "#9A6200", text: "#FFFFFF" },
  booked: { bg: "#2F5E8F", text: "#FFFFFF" },
  transit: { bg: "#6B4A96", text: "#FFFFFF" },
  done: { bg: "#2A7349", text: "#FFFFFF" },
  failed: { bg: "#B23A32", text: "#FFFFFF" },
  ni: { bg: "#3F4E8C", text: "#FFFFFF" },
  trunk: { bg: "#1C6F7A", text: "#FFFFFF" },
  inspection: { bg: "#2C6E9E", text: "#FFFFFF" },
} as const;

/** Marker that tells the edge-function shell a document is already branded. */
export const EMAIL_BRAND_MARKER = "ccc-email-shell";
