require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const CURRENCY = process.env.CURRENCY || "NGN";
const MIN_AMOUNT = Number(process.env.MIN_AMOUNT || 100);
const MAX_AMOUNT = Number(process.env.MAX_AMOUNT || 10000000);

if (
  !process.env.FLW_SECRET_KEY ||
  !process.env.FLW_SECRET_HASH ||
  !process.env.MONGODB_URI ||
  !process.env.ADMIN_PASSWORD
) {
  throw new Error("Missing required environment variables.");
}

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const transactionSchema = new mongoose.Schema({
  tx_ref: {
    type: String,
    required: true,
    unique: true
  },

  flutterwave_id: {
    type: String,
    default: null
  },

  customer_name: String,
  customer_email: String,

  amount: Number,
  currency: String,

  status: {
    type: String,
    enum: ["pending", "successful", "failed"],
    default: "pending"
  },

  payment_type: String,
  verified_at: Date,
  created_at: {
    type: Date,
    default: Date.now
  }
});

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));

  return aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb);
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Payment Admin"');
    return res.status(401).json({
      message: "Admin login required."
    });
  }

  let decoded;

  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return res.status(401).json({
      message: "Invalid login."
    });
  }

  const separator = decoded.indexOf(":");
  const password = separator >= 0
    ? decoded.slice(separator + 1)
    : "";

  if (!safeEqual(password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({
      message: "Invalid admin password."
    });
  }

  next();
}

// Verify payment directly with Flutterwave.
async function verifyWithFlutterwave(transactionId) {
  const response = await axios.get(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
      },
      timeout: 15000
    }
  );

  return response.data.data;
}

// Verify payment against the original order.
async function verifyAndRecord(transactionId, expectedRef) {
  const order = await Transaction.findOne({
    tx_ref: expectedRef
  });

  if (!order) {
    throw new Error("Transaction reference not found.");
  }

  const payment = await verifyWithFlutterwave(transactionId);

  const paidAmount = Number(payment.amount);

  const valid =
    payment.status === "successful" &&
    payment.tx_ref === order.tx_ref &&
    payment.currency === order.currency &&
    Number.isFinite(paidAmount) &&
    paidAmount >= order.amount;

  if (!valid) {
    await Transaction.updateOne(
      { tx_ref: expectedRef, status: "pending" },
      {
        $set: {
          status: "failed",
          flutterwave_id: String(transactionId)
        }
      }
    );

    throw new Error("Payment verification failed.");
  }

  await Transaction.updateOne(
    { tx_ref: expectedRef },
    {
      $set: {
        status: "successful",
        flutterwave_id: String(transactionId),
        payment_type: payment.payment_type || null,
        verified_at: new Date()
      }
    }
  );

  return Transaction.findOne({
    tx_ref: expectedRef
  }).lean();
}

// Create payment.
app.post("/api/pay", paymentLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const amount = Number(req.body.amount);

    if (
      !name ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !Number.isFinite(amount) ||
      amount < MIN_AMOUNT ||
      amount > MAX_AMOUNT
    ) {
      return res.status(400).json({
        message: "Enter valid payment details."
      });
    }

    const tx_ref = `atm_${crypto.randomUUID()}`;

    await Transaction.create({
      tx_ref,
      customer_name: name,
      customer_email: email,
      amount,
      currency: CURRENCY,
      status: "pending"
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency: CURRENCY,

        redirect_url: `${BASE_URL}/callback`,

        customer: {
          name,
          email
        },

        customizations: {
          title: process.env.SITE_NAME || "My ATM Payment",
          description: "Secure online payment"
        },

        payment_options: "card,banktransfer,ussd"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const link = response.data.data.link;

    if (!link) {
      throw new Error("Checkout link unavailable.");
    }

    res.json({ link });

  } catch (error) {
    console.error(
      "Payment creation error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      message: "Unable to start payment."
    });
  }
});

// Payment callback.
app.get("/callback", async (req, res) => {
  try {
    const {
      status,
      transaction_id,
      tx_ref
    } = req.query;

    if (
      status !== "successful" ||
      !transaction_id ||
      !tx_ref
    ) {
      return res.redirect("/?payment=not-completed");
    }

    await verifyAndRecord(
      String(transaction_id),
      String(tx_ref)
    );

    res.redirect(
      `/success.html?ref=${encodeURIComponent(String(tx_ref))}`
    );

  } catch (error) {
    console.error("Callback error:", error.message);

    res.redirect("/?payment=verification-failed");
  }
});

// Flutterwave webhook.
app.post("/webhook", async (req, res) => {
  const signature = req.headers["verif-hash"];

  if (
    !signature ||
    !safeEqual(signature, process.env.FLW_SECRET_HASH)
  ) {
    return res.status(401).send("Invalid webhook signature.");
  }

  try {
    const transactionId = req.body?.data?.id;
    const txRef = req.body?.data?.tx_ref;

    if (transactionId && txRef) {
      await verifyAndRecord(
        String(transactionId),
        String(txRef)
      );
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error.message);
    res.sendStatus(500);
  }
});

// Admin transaction list.
app.get(
  "/api/admin/transactions",
  requireAdmin,
  async (req, res) => {
    try {
      const transactions = await Transaction.find({})
        .sort({ created_at: -1 })
        .limit(500)
        .lean();

      res.json({ transactions });

    } catch {
      res.status(500).json({
        message: "Unable to load transactions."
      });
    }
  }
);

// Admin summary.
app.get(
  "/api/admin/summary",
  requireAdmin,
  async (req, res) => {
    try {
      const [
        total,
        successful,
        pending,
        failed,
        paid
      ] = await Promise.all([
        Transaction.countDocuments(),
        Transaction.countDocuments({ status: "successful" }),
        Transaction.countDocuments({ status: "pending" }),
        Transaction.countDocuments({ status: "failed" }),
        Transaction.aggregate([
          { $match: { status: "successful" } },
          {
            $group: {
              _id: null,
              amount: { $sum: "$amount" }
            }
          }
        ])
      ]);

      res.json({
        total,
        successful,
        pending,
        failed,
        amount: paid[0]?.amount || 0,
        currency: CURRENCY
      });

    } catch {
      res.status(500).json({
        message: "Unable to load summary."
      });
    }
  }
);

app.get("/health", (req, res) => {
  res.json({ status: "online" });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Payment website running at ${BASE_URL}`);
    });
  })
  .catch(error => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
'''
}
for rel, content in files.items():
    p=os.path.join(root,rel)
    with open(p,"w",encoding="utf-8") as f:f.write(content)
print("Wrote base backend and configuration files.")
## 5. public/index.html

Create the `public` folder, then create `index.html`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Secure ATM Payment</title>
  <link rel="stylesheet" href="style.css">
  <script src="app.js" defer></script>
</head>
<body>

  <main class="page-shell">
    <section class="payment-card">

      <div class="brand-mark">₦</div>

      <p class="eyebrow">SECURE CHECKOUT</p>

      <h1>My ATM Payment</h1>

      <p class="muted">
        Make a secure payment using your preferred payment method.
      </p>

      <form id="paymentForm">

        <label for="name">Full Name</label>
        <input
          id="name"
          type="text"
          maxlength="100"
          required
          placeholder="Enter your full name"
        >

        <label for="email">Email Address</label>
        <input
          id="email"
          type="email"
          required
          placeholder="Enter your email"
        >

        <label for="amount">Payment Amount (₦)</label>

        <div class="amount-wrap">
          <span>₦</span>
          <input
            id="amount"
            type="number"
            min="100"
            max="10000000"
            required
            placeholder="5000"
          >
        </div>

        <button id="payButton" type="submit">
          Continue to Payment
        </button>

        <p id="message" class="message"></p>

      </form>

      <div class="secure-note">
        🔒 Secure payment powered by Flutterwave.
      </div>

      <div class="methods">
        ATM CARD • BANK TRANSFER • USSD
      </div>

      <a href="/admin.html" class="admin-link">
        Admin Dashboard
      </a>

    </section>

    <footer>
      Payments are securely processed by Flutterwave.
    </footer>

  </main>

</body>
</html>