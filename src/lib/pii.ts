/**
 * PII masking utility - applied at the service/API layer, NOT the UI layer.
 * All personally identifiable information must be masked before leaving the server.
 */

const PII_FIELDS = new Set([
  // Names
  "full_name", "first_name", "middle_name", "last_name", "card_holder_name",
  "fx_dw001_name", "fx_dw001_emb_name", "fx_dw002_name",
  // Phone numbers
  "phone_number", "mobile_phone", "landline_phone",
  "fx_dw001_hp", "fx_dw001_bil_tel", "fx_dw002_hp", "fx_dw002_hme_tel", "fx_dw002_corsp_tel",
  "context_traits_phone_number",
  // Email
  "email", "email_id", "fx_dw001_email_addr", "fx_dw002_email_addr",
  // Government ID (NIK)
  "gov_id", "id_document_number", "fx_dw001_new_id", "fx_dw002_new_id",
  // Addresses
  "fx_dw001_bil_addr_1", "fx_dw001_bil_addr_2", "fx_dw001_bil_addr_3", "fx_dw001_bil_addr_4",
  "fx_dw002_hme_addr_1", "fx_dw002_hme_addr_2", "fx_dw002_hme_addr_3", "fx_dw002_hme_addr_4",
  "fx_dw002_corsp_addr_1", "fx_dw002_corsp_addr_2", "fx_dw002_corsp_addr_3", "fx_dw002_corsp_addr_4",
  // Demographics
  "date_of_birth", "f9_dw001_dob", "f9_dw002_dob", "dob",
  "fx_dw002_gendr", "context_traits_gender",
  "fx_dw002_marr_stat",
  "mother_maiden_name",
  // Location details
  "fx_dw001_bil_zip", "fx_dw002_hme_zip", "fx_dw002_corsp_zip",
  "fx_dw001_pob", "fx_dw002_pob",
]);

export function maskValue(fieldName: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const key = fieldName.toLowerCase();
  if (!PII_FIELDS.has(key)) return value;

  const str = String(value);
  if (str.length === 0) return value;

  // Name masking: first char + asterisks
  if (key.includes("name") || key === "mother_maiden_name") {
    return str[0] + "*".repeat(Math.min(str.length - 1, 8));
  }

  // Phone: show last 4 digits only
  if (key.includes("phone") || key.includes("_hp") || key.includes("_tel")) {
    if (str.length <= 4) return "****";
    return "*".repeat(str.length - 4) + str.slice(-4);
  }

  // Email: first char + ***@domain
  if (key.includes("email")) {
    const atIdx = str.indexOf("@");
    if (atIdx > 0) return str[0] + "***" + str.slice(atIdx);
    return str[0] + "***";
  }

  // NIK/Gov ID: first 4 + **** + last 2
  if (key.includes("gov_id") || key.includes("new_id") || key.includes("document_number")) {
    if (str.length <= 6) return "****";
    return str.slice(0, 4) + "*".repeat(str.length - 6) + str.slice(-2);
  }

  // Everything else (address, DOB, gender, marital status): fully redacted
  return "[REDACTED]";
}

export function maskRow(row: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    masked[key] = maskValue(key, value);
  }
  return masked;
}

export function maskRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(maskRow);
}
