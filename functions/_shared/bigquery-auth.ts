/**
 * Google Cloud JWT authentication for Cloudflare Workers.
 * Uses Web Crypto API to sign JWTs with a service account private key.
 * Falls back to ADC (gcloud CLI) for local development.
 */

interface Env {
  GCP_SERVICE_ACCOUNT_EMAIL?: string;
  GCP_PRIVATE_KEY?: string;
  GCP_ACCESS_TOKEN?: string;
  KPI_CACHE?: KVNamespace;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(
  email: string,
  privateKeyPem: string,
): Promise<string> {
  // Strip PEM headers and decode
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\r\n\s]/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/bigquery.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64url(signature)}`;
}

async function getTokenFromServiceAccount(env: Env): Promise<string> {
  const jwt = await signJwt(env.GCP_SERVICE_ACCOUNT_EMAIL!, env.GCP_PRIVATE_KEY!);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return data.access_token;
}

async function getTokenFromADC(): Promise<string> {
  // For local dev: try the metadata server (used by wrangler pages dev)
  // or fall back to reading the ADC token file
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } },
    );
    if (res.ok) {
      const data = (await res.json()) as { access_token: string };
      return data.access_token;
    }
  } catch {
    // Not on GCE, try ADC file
  }

  // Try the well-known ADC location
  // This won't work in Workers but helps during local dev with node
  throw new Error(
    "No GCP credentials found. Set GCP_SERVICE_ACCOUNT_EMAIL and GCP_PRIVATE_KEY environment variables.",
  );
}

export async function getAccessToken(env: Env): Promise<string> {
  // Check cached token (valid for at least 5 more minutes)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  let token: string;
  if (env.GCP_ACCESS_TOKEN) {
    // Direct access token (from gcloud auth print-access-token)
    token = env.GCP_ACCESS_TOKEN;
  } else if (env.GCP_SERVICE_ACCOUNT_EMAIL && env.GCP_PRIVATE_KEY) {
    token = await getTokenFromServiceAccount(env);
  } else {
    token = await getTokenFromADC();
  }

  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

export type { Env };
