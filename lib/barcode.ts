import bwipjs from 'bwip-js/node';

/** Generates a Code128 barcode as a PNG buffer for the given text (e.g. appointment number). */
export async function generateBarcodePng(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
    backgroundcolor: 'FFFFFF'
  });
}
