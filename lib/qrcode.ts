import QRCode from 'qrcode';

/** Generates a QR code as a PNG buffer for the given data (e.g. a report's print-page URL). */
export async function generateQrPng(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: 'png', width: 220, margin: 1, errorCorrectionLevel: 'M' });
}
