const form = document.getElementById("paymentForm");

const button = document.getElementById("payButton");

const message = document.getElementById("message");

const params = new URLSearchParams(window.location.search);

if (params.has("payment")) {
  message.textContent =
    "Payment was not completed or could not be verified. Please check your transaction before trying again.";
}

form.addEventListener("submit", async function(event) {

  event.preventDefault();

  message.textContent = "";

  button.disabled = true;

  button.textContent = "Preparing secure checkout...";

  try {

    const response = await fetch("/api/pay", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        name: document.getElementById("name").value,

        email: document.getElementById("email").value,

        amount: document.getElementById("amount").value

      })

    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Payment could not start.");
    }

    if (!data.link || !data.link.startsWith("https://")) {
      throw new Error("Invalid checkout link.");
    }

    window.location.href = data.link;

  } catch (error) {

    message.textContent = error.message;

    button.disabled = false;

    button.textContent = "Continue to Payment";

  }

});