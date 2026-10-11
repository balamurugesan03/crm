import nodemailer from 'nodemailer';
import Organization from '../models/Organization.js';
import { AppError } from '../utils/AppError.js';

const WHATSAPP_API = 'https://graph.facebook.com/v21.0';

async function loadIntegrations(orgId) {
  const org = await Organization.findById(orgId).select('name integrations');
  if (!org) throw new AppError('Organization not found', 404);
  return org;
}

export function isSmtpReady(smtp) {
  return Boolean(smtp?.host && smtp?.user && smtp?.pass && smtp?.fromEmail);
}

export function isWhatsappReady(wa) {
  return Boolean(wa?.phoneNumberId && wa?.accessToken);
}

function transportFor(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: Boolean(smtp.secure),
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 15_000,
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendEmail(orgId, { to, subject, body, replyTo }) {
  const org = await loadIntegrations(orgId);
  const smtp = org.integrations?.smtp;
  if (!isSmtpReady(smtp)) throw new AppError('Email is not set up. Configure SMTP in Settings → Integrations.', 400);
  const info = await transportFor(smtp).sendMail({
    from: { name: smtp.fromName || org.name, address: smtp.fromEmail },
    to,
    replyTo,
    subject,
    text: body,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1d29">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`,
  });
  return { providerId: info.messageId };
}

export async function verifySmtp(orgId) {
  const org = await loadIntegrations(orgId);
  const smtp = org.integrations?.smtp;
  if (!isSmtpReady(smtp)) throw new AppError('Fill in host, username, password and from-email first.', 400);
  await transportFor(smtp).verify();
}

// Normalises Indian numbers: "98400 12345" -> "919840012345"
export function toWhatsappNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

async function whatsappRequest(wa, payload) {
  const res = await fetch(`${WHATSAPP_API}/${encodeURIComponent(wa.phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wa.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `WhatsApp API error ${res.status}`;
    // 131047: outside the 24h customer-service window - only approved templates may be sent.
    const hint = data?.error?.code === 131047 ? ' (24-hour window closed — the customer must message you first, or use an approved template)' : '';
    throw new AppError(`${msg}${hint}`, 502);
  }
  return data;
}

export async function sendWhatsapp(orgId, { to, body }) {
  const org = await loadIntegrations(orgId);
  const wa = org.integrations?.whatsapp;
  if (!isWhatsappReady(wa)) throw new AppError('WhatsApp Business API is not set up. Configure it in Settings → Integrations.', 400);
  const data = await whatsappRequest(wa, { to: toWhatsappNumber(to), type: 'text', text: { preview_url: true, body } });
  return { providerId: data?.messages?.[0]?.id };
}

export async function verifyWhatsapp(orgId) {
  const org = await loadIntegrations(orgId);
  const wa = org.integrations?.whatsapp;
  if (!isWhatsappReady(wa)) throw new AppError('Fill in Phone number ID and access token first.', 400);
  const res = await fetch(`${WHATSAPP_API}/${encodeURIComponent(wa.phoneNumberId)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${wa.accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(data?.error?.message || 'Could not reach WhatsApp', 400);
  return { displayNumber: data.display_phone_number, verifiedName: data.verified_name };
}
