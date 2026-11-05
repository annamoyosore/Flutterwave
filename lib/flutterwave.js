const crypto = require("crypto");

const API_BASE = "https://api.flutterwave.com/v3";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function flwRequest(path, options = {}) {
  const secretKey = requiredEnv("FLW_SECRET_KEY");

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.status !== "success") {
    throw new Error(
      result.message || `Flutterwave request failed (${response.status})`
    );
  }

  return result;
}

function createTxRef() {
  const base = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;

  const signature = crypto
    .createHmac("sha256", requiredEnv("FLW_SECRET_KEY"))
    .update(base)
    .digest("hex");

  return `hourly_${base}_${signature}`;
}

function isValidTxRef(txRef) {
  if (typeof txRef !== "string") return false;

  const parts = txRef.split("_");

  if (parts.length !== 3 || parts[0] !== "hourly") {
    return false;
  }

  const base = parts[1];
  const supplied = parts[2];

  const expected = crypto
    .createHmac("sha256", requiredEnv("FLW_SECRET_KEY"))
    .update(base)
    .digest();

  let suppliedBuffer;

  try {
    suppliedBuffer = Buffer.from(supplied, "hex");
  } catch {
    return false;
  }

  return (
    suppliedBuffer.length === expected.length &&
    crypto.timingSafeEqual(suppliedBuffer, expected)
  );
}

module.exports = {
  flwRequest,
  createTxRef,
  isValidTxRef,
  requiredEnv
};