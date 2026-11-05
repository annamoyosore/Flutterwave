
const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_SECRET_HASH = process.env.FLW_SECRET_HASH;
const SITE_NAME = process.env.SITE_NAME || "My ATM Payment";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/success.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "success.html"));
});

// Start Flutterwave payment
app.post("/api/pay", async (req, res) => {
  try {
    if (!FLW_SECRET_KEY) {
      return res.status(500).json({
        error: "Flutterwave secret key is not configured."
      });
    }

    const paymentPlanId = process.env.FLW_PAYMENT_PLAN_ID;

    if (!paymentPlanId) {
      return res.status(500).json({
        error: "Flutterwave payment plan ID is not configured."
      });
    }

    const txRef = `hourly_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: 10000,
        currency: "NGN",
        payment_plan: Number(paymentPlanId),
        payment_options: "card",
        redirect_url: `${process.env.BASE_URL}/success.html`,
        customer: {
          email: String(req.body.email || "").trim()
        },
        customizations: {
          title: SITE_NAME,
          description: "₦10,000 recurring hourly payment"
        }
      })
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      return res.status(400).json({
        error: data.message || "Unable to initialize payment."
      });
    }

    return res.json({
      status: "success",
      checkout_url: data.data.link
    });
  } catch (error) {
    console.error("Payment initialization error:", error);

    return res.status(500).json({
      error: "Payment initialization failed."
    });
  }
});

// Verify initial payment
app.get("/api/verify", async (req, res) => {
  try {
    if (!FLW_SECRET_KEY) {
      return res.status(500).json({
        error: "Flutterwave secret key is not configured."
      });
    }

    const transactionId = req.query.transaction_id;

    if (!transactionId || !/^\d+$/.test(String(transactionId))) {
      return res.status(400).json({
        error: "Invalid transaction ID."
      });
    }

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      return res.status(400).json({
        status: "failed",
        message: "Unable to verify transaction."
      });
    }

    const transaction = result.data;

    const valid =
      transaction.status === "successful" &&
      Number(transaction.amount) >= 10000 &&
      transaction.currency === "NGN";

    return res.json({
      status: valid ? "success" : "failed",
      message: valid
        ? "Initial payment verified."
        : "Payment could not be verified."
    });
  } catch (error) {
    console.error("Verification error:", error);

    return res.status(500).json({
      status: "failed",
      message: "Transaction verification failed."
    });
  }
});

// Flutterwave webhook
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      if (!FLW_SECRET_HASH) {
        return res.status(500).send("Webhook secret is not configured.");
      }

      const signature = req.headers["verif-hash"];

      if (
        typeof signature !== "string" ||
        signature.length !== FLW_SECRET_HASH.length ||
        !crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(FLW_SECRET_HASH)
        )
      ) {
        return res.status(401).send("Invalid webhook signature.");
      }

      let event;

      try {
        event = JSON.parse(req.body.toString("utf8"));
      } catch {
        return res.status(400).send("Invalid webhook payload.");
      }

      console.log("Verified Flutterwave webhook:", event.event);

      return res.status(200).send("Webhook received.");
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(500).send("Webhook processing failed.");
    }
  }
);

app.listen(PORT, () => {
  console.log(`${SITE_NAME} server running on port ${PORT}`);
});
