import qrcode from 'qrcode-generator';

/** Stable public destination; future signed-in routing can change without reprinting. */
export const labelTrackingUrl = (reference: string): string =>
  `https://booking.cyclecourierco.com/tracking/${encodeURIComponent(reference)}`;

export const createLabelQr = (reference: string) => {
  const code = qrcode(0, 'M');
  code.addData(labelTrackingUrl(reference));
  code.make();
  return code;
};