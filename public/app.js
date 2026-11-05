const form = document.getElementById("payment-form");

const button = document.getElementById("pay-button");

const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {

  event.preventDefault();

  message.textContent = "";

  button.disabled = true;

  button.textContent = "Connecting to Flutterwave...";

  try {

    const response = await fetch("/api/pay", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        email: document.getElementById("email").value,

        consent: document.getElementById("consent").checked

      })

    });

    const result = await response.json();

    if (!response.ok || !result.checkout_url) {

      throw new Error(
        result.error || "Could not start checkout."
      );

    }

    window.location.assign(result.checkout_url);

  } catch (error) {

    message.textContent =
      error.message || "Something went wrong.";

    button.disabled = false;

    button.textContent = "Continue to secure payment";

  }

});