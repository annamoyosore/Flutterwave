
const crypto = require("crypto");

async function flutterwave(path, options = {}) {
  const response = await fetch(
    `https://api.flutterwave.com/v3${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const data = await response.json();

  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Flutterwave request failed");
  }

  return data;
}

function createReference(amount) {
  const payload = `${amount}|${Date.now()}|${crypto.randomBytes(12).toString("hex")}`;

  const signature = crypto
    .createHmac("sha256", process.env.FLW_SECRET_KEY)
    .update(payload)
    .digest("hex");

  return `atm_${Buffer.from(payload).toString("hex")}_${signature}`;
}

function verifyReference(reference) {
  try {
    const parts = String(reference).split("_");

    if (parts.length !== 3 || parts[0] !== "atm") return null;

    const payload = Buffer.from(parts[1], "hex").toString();

    const signature = crypto
      .createHmac("sha256", process.env.FLW_SECRET_KEY)
      .update(payload)
      .digest("hex");

    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(parts[2], "hex");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const [amount, timestamp] = payload.split("|");

    if (
      !/^\d+$/.test(amount) ||
      Date.now() - Number(timestamp) > 7 * 86400000 ||
      Number(timestamp) > Date.now() + 60000
    ) return null;

    return Number(amount);
  } catch {
    return null;
  }
}

module.exports = { flutterwave, createReference, verifyReference };
