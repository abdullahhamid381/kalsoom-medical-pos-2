import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// WhatsApp integration
//
// Automated sending uses "whatsapp-web.js", an unofficial library that drives
// a real, logged-in WhatsApp Web session (no paid Meta Business API needed).
// The session is saved to disk (.wwebjs_auth by default, or WWEBJS_DATA_PATH
// if set - point this at a persistent volume on platforms like Railway) so
// the clinic only scans the QR code once. This requires the optional
// dependency to be installed and a Chromium browser available (installed
// automatically by puppeteer on `npm install`, or point
// PUPPETEER_EXECUTABLE_PATH at an existing Chrome).
//
// IMPORTANT (please read): this is an UNOFFICIAL method of using WhatsApp.
// It works well for small clinics but WhatsApp does not officially support
// it, so there is a small risk of the linked number being temporarily
// restricted if it sends a very high volume of messages. For most single
// clinics sending a handful of appointment confirmations a day this is the
// commonly used, practical approach. If you ever need guaranteed,
// officially-supported delivery at scale, that requires Meta's paid
// WhatsApp Business Platform API instead.
//
// Even without finishing this setup, the app remains fully usable: every
// appointment has a "Share on WhatsApp" button that opens a pre-filled
// WhatsApp chat (wa.me link) for the receptionist to send manually, and a
// "Download PDF" button to attach the slip by hand.
// ---------------------------------------------------------------------------

type WaState = 'disabled' | 'not_initialized' | 'initializing' | 'qr' | 'connected' | 'auth_failed';

declare global {
  // eslint-disable-next-line no-var
  var __kmcWa:
    | {
        client: any | null;
        state: WaState;
        qrDataUrl: string | null;
        lastError: string | null;
      }
    | undefined;
}

function store() {
  if (!global.__kmcWa) {
    global.__kmcWa = { client: null, state: 'not_initialized', qrDataUrl: null, lastError: null };
  }
  return global.__kmcWa;
}

export function isWhatsAppEnabled() {
  return (process.env.WHATSAPP_ENABLED || 'true').toLowerCase() !== 'false';
}

export function getWhatsAppStatus() {
  const s = store();
  return { state: s.state, qrDataUrl: s.qrDataUrl, lastError: s.lastError };
}

/** Lazily starts the WhatsApp Web client. Safe to call repeatedly. */
export async function initWhatsApp(): Promise<{ ok: boolean; error?: string }> {
  if (!isWhatsAppEnabled()) {
    return { ok: false, error: 'WhatsApp integration is disabled (WHATSAPP_ENABLED=false).' };
  }
  const s = store();
  if (s.client || s.state === 'initializing') {
    return { ok: true };
  }

  let wweb: any;
  try {
    // Dynamic require so the rest of the app keeps working even if this
    // optional, heavy dependency hasn't been installed yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    wweb = require('whatsapp-web.js');
  } catch (err: any) {
    s.state = 'not_initialized';
    s.lastError =
      'whatsapp-web.js is not installed. Run "npm install" with internet access (it downloads a Chromium browser), then try again.';
    return { ok: false, error: s.lastError };
  }

  s.state = 'initializing';
  s.lastError = null;

  try {
    const { Client, LocalAuth } = wweb;
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'kalsoom-medical-pos',
        dataPath: process.env.WWEBJS_DATA_PATH || '.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    client.on('qr', async (qr: string) => {
      s.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      s.state = 'qr';
    });

    client.on('ready', () => {
      s.state = 'connected';
      s.qrDataUrl = null;
      s.lastError = null;
    });

    client.on('auth_failure', (msg: string) => {
      s.state = 'auth_failed';
      s.lastError = msg || 'WhatsApp authentication failed.';
    });

    client.on('disconnected', () => {
      s.state = 'not_initialized';
      s.client = null;
      s.qrDataUrl = null;
    });

    s.client = client;
    await client.initialize();
    return { ok: true };
  } catch (err: any) {
    s.state = 'not_initialized';
    s.lastError = err?.message || 'Failed to start WhatsApp client.';
    s.client = null;
    return { ok: false, error: s.lastError };
  }
}

/** Normalizes a Pakistani-style phone number into the chat id whatsapp-web.js expects. */
export function toWhatsAppChatId(rawPhone: string): string {
  let digits = rawPhone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) {
    digits = '92' + digits.slice(1); // local 03xxxxxxxxx -> 923xxxxxxxxx
  } else if (!digits.startsWith('92') && digits.length === 10) {
    digits = '92' + digits;
  }
  return `${digits}@c.us`;
}

/** Builds the wa.me link used for the manual "Share on WhatsApp" fallback button. */
export function buildWhatsAppShareLink(rawPhone: string, message: string): string {
  let digits = rawPhone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = '92' + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Sends a PDF (appointment slip, lab report, etc.) as a direct WhatsApp message via the
 *  logged-in whatsapp-web.js session. Callers should fall back to buildWhatsAppShareLink()
 *  when this returns { ok: false } (e.g. session not connected). */
export async function sendPdfOnWhatsApp(opts: {
  phone: string;
  caption: string;
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const s = store();
  if (s.state !== 'connected' || !s.client) {
    return { ok: false, error: 'WhatsApp is not connected. Go to Settings > WhatsApp and scan the QR code first.' };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wweb = require('whatsapp-web.js');
    const { MessageMedia } = wweb;
    const chatId = toWhatsAppChatId(opts.phone);
    const media = new MessageMedia('application/pdf', opts.pdfBuffer.toString('base64'), opts.fileName);
    await s.client.sendMessage(chatId, opts.caption);
    await s.client.sendMessage(chatId, media);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to send WhatsApp message.' };
  }
}
