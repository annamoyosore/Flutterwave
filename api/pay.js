
const {
  flutterwave,
  createReference
} = require("./helpers");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.FLW_SECRET_KEY || !process.env.BASE_URL) {
    return res.status(500).json({ error: "Server configuration missing" });
  }

  try {
    const { amount, email } = req.body || {};

    const value = Number(amount);
    const min = Number(process.env.MIN_AMOUNT || 100);
    const max = Number(process.env.MAX_AMOUNT || 10000000);

    if (!Number.isFinite(value) || value < min || value > max) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    if (
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email.trim())
    ) {
      return res.status(400).json({ error: "Enter a valid email" });
    }

    const reference = createReference(value);

    const result = await flutterwave("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: reference,
        amount: value,
        currency: process.env.CURRENCY || "NGN",
        redirect_url: `${process.env.BASE_URL}/success.html`,
        payment_options: "card,banktransfer,ussd",
        customer: {
          email: email.trim()
        },
        customizations: {
          title: process.env.SITE_NAME || "My ATM Payment",
          description: "Secure payment"
        }
      })
    });

    return res.status(200).json({
      checkoutUrl: result.data.link
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Payment initialization failed"
    });
  }
};
