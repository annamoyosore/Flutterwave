const passwordInput = document.getElementById("password");

const errorBox = document.getElementById("error");

const rows = document.getElementById("rows");

async function loadDashboard() {

  const password = passwordInput.value;

  if (!password) {

    errorBox.textContent = "Enter your admin password.";

    return;

  }

  const encodedAuth =
    "Basic " + btoa("admin:" + password);

  errorBox.textContent = "Loading dashboard...";

  try {

    const headers = {
      Authorization: encodedAuth
    };

    const [summaryResponse, transactionsResponse] =
      await Promise.all([

        fetch("/api/admin/summary", { headers }),

        fetch("/api/admin/transactions", { headers })

      ]);

    if (
      summaryResponse.status === 401 ||
      transactionsResponse.status === 401
    ) {

      throw new Error("Incorrect admin password.");

    }

    if (
      !summaryResponse.ok ||
      !transactionsResponse.ok
    ) {

      throw new Error("Could not load dashboard.");

    }

    const summary = await summaryResponse.json();

    const data = await transactionsResponse.json();

    document.getElementById("total").textContent =
      summary.total;

    document.getElementById("successful").textContent =
      summary.successful;

    document.getElementById("pending").textContent =
      summary.pending;

    document.getElementById("amount").textContent =
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: summary.currency
      }).format(summary.amount);

    rows.replaceChildren();

    if (!data.transactions.length) {

      const tr = document.createElement("tr");

      const td = document.createElement("td");

      td.colSpan = 5;

      td.textContent = "No transactions yet.";

      tr.appendChild(td);

      rows.appendChild(tr);

    } else {

      for (const item of data.transactions) {

        const tr = document.createElement("tr");

        const values = [

          new Date(item.created_at).toLocaleString(),

          item.customer_name + " (" + item.customer_email + ")",

          new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: item.currency
          }).format(item.amount),

          item.tx_ref,

          item.status

        ];

        values.forEach((value, index) => {

          const td = document.createElement("td");

          td.textContent = value;

          if (index === 4) {
            td.className = "status " + item.status;
          }

          tr.appendChild(td);

        });

        rows.appendChild(tr);

      }

    }

    errorBox.textContent = "";

  } catch (error) {

    errorBox.textContent = error.message;

  }

}

document
  .getElementById("refresh")
  .addEventListener("click", loadDashboard);

passwordInput.addEventListener("keydown", function(event) {

  if (event.key === "Enter") {

    loadDashboard();

  }

});