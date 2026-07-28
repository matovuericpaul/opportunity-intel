const { sendDigestEmail } = require("../lib/digest");
const { json, options } = require("../lib/http");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options();
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  const configuredSecret = process.env.DIGEST_SECRET;
  if (!configuredSecret) return json(500, { error: "DIGEST_SECRET is not set on the server." });

  let providedSecret = null;
  try {
    const body = JSON.parse(event.body || "{}");
    providedSecret = body.secret;
  } catch (_) {
    /* ignore parse errors, handled below */
  }

  if (!providedSecret || providedSecret !== configuredSecret) {
    return json(401, { error: "Invalid or missing secret." });
  }

  try {
    const result = await sendDigestEmail({ isTest: true });
    return json(200, result);
  } catch (err) {
    return json(500, { error: err.message });
  }
};
