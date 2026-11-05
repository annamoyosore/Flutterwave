const params = new URLSearchParams(window.location.search);

const reference = params.get("ref");

document.getElementById("reference").textContent =
  reference ? "Transaction Reference: " + reference : "";