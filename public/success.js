
const params = new URLSearchParams(window.location.search);

const title = document.getElementById("resultTitle");
const text = document.getElementById("resultText");
const icon = document.getElementById("resultIcon");

async function verifyPayment() {
  const transactionId = params.get("transaction_id");

  if (!transactionId) {
    title.textContent = "Payment not confirmed";
    text.textContent = "No transaction reference was returned.";
    icon.textContent = "!";
    return;
  }

  try {
    const response = await fetch(
      `/api/verify?transaction_id=${encodeURIComponent(transactionId)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Payment verification failed");
    }

    title.textContent = "Payment Successful!";
    text.textContent =
      `Verified payment: ₦${Number(data.amount).toLocaleString()}. Reference: ${data.reference}`;

  } catch (error) {
    title.textContent = "Payment not confirmed";
    text.textContent = error.message;
    icon.textContent = "!";
  }
}

verifyPayment();
