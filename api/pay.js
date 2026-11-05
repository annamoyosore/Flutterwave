const {
  flwRequest,
  createTxRef,
  requiredEnv
} = require("../lib/flutterwave");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const consent = req.body?.consent === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Enter a valid email address."
      });
    }

    if (!consent) {
      return res.status(400).json({
        error: "You must agree to the hourly recurring charge."
      });
    }

    const planId = Number(
      requiredEnv("FLW_PAYMENT_PLAN_ID")
    );

    if (!Number.isSafeInteger(planId) || planId <= 0) {
      throw new Error("Invalid Flutterwave Payment Plan ID.");
    }

    const baseUrl = requiredEnv("BASE_URL")
      .replace(/\/+$/, "");

    const txRef = createTxRef();

    const result = await flwRequest("/payments", {
      method: "POST",

      body: JSON.stringify({
        tx_ref: txRef,

        amount: 10000,

        currency: "NGN",

        redirect_url: `${baseUrl}/success.html`,

        customer: {
          email
        },

        payment_plan: planId,

        payment_options: "card",

        customizations: {
          title: "Hourly Subscription",
          description: "₦10,000 recurring every hour"
        },

        meta: {
          subscription_interval: "hourly",
          customer_consent: "hourly_recurring_charge"
        }
      })
    });

    const checkoutUrl = result.data?.link;

    if (!checkoutUrl) {
      throw new Error("Flutterwave did not return a checkout link.");
    }

    return res.status(200).json({
      checkout_url: checkoutUrl
    });

  } catch (error) {
    console.error("Checkout error:", error.message);

    return res.status(500).json({
      error: "Unable to start payment. Please try again later."
    });
  }
};