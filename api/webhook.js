const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers["verif-hash"];

  if (!secretHash || !signature) {
    return res.status(401).send("Unauthorized");
  }

  const expected = Buffer.from(String(secretHash));
  const received = Buffer.from(String(signature));

  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return res.status(401).send("Invalid signature");
  }

  // No customer or transaction data is stored.
  // You can connect Appwrite here in the future.

  return res.status(200).json({
    received: true
  });
};