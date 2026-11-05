
const form = document.getElementById("paymentForm");
const button = document.getElementById("payButton");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  button.disabled = true;
  button.textContent = "Preparing checkout...";
  message.textContent = "";

  try {
    const amount = Number(document.getElementById("amount").value);
    const email = document.getElementById("email").value.trim();

    const response = await fetch("/api/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount, email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Payment failed");
    }

    window.location.href = data.checkoutUrl;

  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Continue to Payment";
  }
});
