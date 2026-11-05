require("dotenv").config();

async function main() {
  const secretKey = process.env.FLW_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "Add FLW_SECRET_KEY to your .env file first."
    );
  }

  console.log("Creating hourly subscription plan...");

  const response = await fetch(
    "https://api.flutterwave.com/v3/payment-plans",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        amount: 10000,
        name: "NGN 10,000 Hourly Subscription",
        interval: "hourly",
        currency: "NGN"
      })
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    result.status !== "success" ||
    !result.data?.id
  ) {
    throw new Error(
      result.message || "Could not create payment plan."
    );
  }

  console.log("Payment Plan created.");
  console.log("Plan ID:", result.data.id);

  console.log(
    "Copy this ID into Vercel as FLW_PAYMENT_PLAN_ID."
  );

  console.log(
    "Do not run this script again unless you intentionally want another plan."
  );
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});