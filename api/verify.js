
const {
  flutterwave,
  verifyReference
} = require("./helpers");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.FLW_SECRET_KEY) {
    return res.status(500).json({ error: "Server configuration missing" });
  }

  const id = String(req.query.transaction_id || "");

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid transaction ID" });
  }

  try {
    const result = await flutterwave(
      `/transactions/${encodeURIComponent(id)}/verify`
    );

    const payment = result.data || {};
    const expectedAmount = verifyReference(payment.tx_ref);

    const valid =
      payment.status === "successful" &&
      expectedAmount !== null &&
      Number(payment.amount) === expectedAmount &&
      payment.currency === (process.env.CURRENCY || "NGN");

    if (!valid) {
      return res.status(400).json({
        success: false,
        error: "Payment could not be verified"
      });
    }

    return res.status(200).json({
      success: true,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.tx_ref
    });

  } catch (error) {
    return res.status(502).json({
      success: false,
      error: "Payment verification failed"
    });
  }
};
