
require("dotenv").config();

async function createPaymentPlan() {
  if (!process.env.FLW_SECRET_KEY) {
    throw new Error("FLW_SECRET_KEY is missing from .env");
  }

  const response = await fetch(
    "https://api.flutterwave.com/v3/payment-plans",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: 10000,
        name: "Hourly Payment Plan",
        interval: "hourly",
        currency: "NGN"
      })
    }
  );

  const result = await response.json();

  if (!response.ok || result.status !== "success") {
    console.error("Plan creation failed:", result);
    process.exitCode = 1;
    return;
  }

  console.log("Payment plan created successfully!");
  console.log("YOUR FLW_PAYMENT_PLAN_ID:", result.data.id);
  console.log("Plan details:", result.data);
}

createPaymentPlan().catch(console.error);
