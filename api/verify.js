const {
  flwRequest,
  isValidTxRef
} = require("../lib/flutterwave");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const transactionId = String(
    req.query.transaction_id || ""
  ).trim();

  if (!/^\d+$/.test(transactionId)) {
    return res.status(400).json({
      error: "Invalid transaction ID."
    });
  }

  try {
    const result = await flwRequest(
      `/transactions/${encodeURIComponent(transactionId)}/verify`,
      {
        method: "GET"
      }
    );

    const data = result.data || {};

    const valid =
      data.status === "successful" &&
      Number(data.amount) === 10000 &&
      data.currency === "NGN" &&
      isValidTxRef(data.tx_ref);

    if (!valid) {
      return res.status(400).json({
        verified: false,
        message: "Payment could not be verified."
      });
    }

    return res.status(200).json({
      verified: true,
      amount: 10000,
      currency: "NGN",
      interval: "hourly",
      message:
        "Your first payment was verified. Check your Flutterwave subscription status for recurring billing."
    });

  } catch (error) {
    console.error("Verification error:", error.message);

    return res.status(500).json({
      error: "Unable to verify payment right now."
    });
  }
};