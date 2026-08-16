import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Username + password sign-in for the admin panel.
 *
 * This exists so the panel is reachable without depending on which Google
 * account happens to be signed in. It is a shared secret, so it is weaker
 * than the email allow-list — keep both if you can, and change the
 * password after the event.
 *
 *   HUNT_ADMIN_USER=admin
 *   HUNT_ADMIN_PASSWORD=something-long
 */

const COOKIE = "bep_admin";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secret(): string {
  const s = process.env.HUNT_SECRET;
  return s && s.length >= 16 ? s : "dev-only-insecure-key-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export function adminLoginConfigured(): boolean {
  const u = process.env.HUNT_ADMIN_USER;
  const p = process.env.HUNT_ADMIN_PASSWORD;
  return Boolean(u && u.trim() && p && p.length >= 6);
}

/** Ties the cookie to the current credentials, so changing either revokes
 *  every session that was handed out under the old ones. */
function sessionValue(): string {
  return sign(
    `admin:${process.env.HUNT_ADMIN_USER}:${sign(String(process.env.HUNT_ADMIN_PASSWORD))}`,
  );
}

/* ------------------------------ throttling ------------------------ */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 5 * 60_000;

export function loginBlockedFor(ip: string): number {
  const rec = attempts.get(ip);
  if (!rec) return 0;
  if (rec.until > Date.now()) return rec.until - Date.now();
  if (rec.until !== 0 && rec.until <= Date.now()) attempts.delete(ip);
  return 0;
}

export function noteFailedLogin(ip: string): void {
  const rec = attempts.get(ip) ?? { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.until = Date.now() + LOCKOUT_MS;
    rec.count = 0;
  }
  attempts.set(ip, rec);
}

export function clearFailedLogins(ip: string): void {
  attempts.delete(ip);
}

/* -------------------------------- session ------------------------- */

export function credentialsMatch(user: string, pass: string): boolean {
  if (!adminLoginConfigured()) return false;
  // Compare both, always, so a wrong username and a wrong password take
  // the same time.
  const okUser = safeEqual(user, String(process.env.HUNT_ADMIN_USER));
  const okPass = safeEqual(pass, String(process.env.HUNT_ADMIN_PASSWORD));
  return okUser && okPass;
}

export async function grantAdminSession(): Promise<void> {
  (await cookies()).set(COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function revokeAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function hasAdminSession(): Promise<boolean> {
  if (!adminLoginConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  return raw ? safeEqual(raw, sessionValue()) : false;
}
