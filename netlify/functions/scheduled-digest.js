const { sendDigestEmail } = require("../lib/digest");

// Netlify scheduled function: runs on this cron schedule regardless of traffic.
// 6:00 UTC = 9:00 Kampala time (EAT, UTC+3, no DST).
exports.config = { schedule: "0 6 * * *" };

exports.handler = async () => {
  try {
    const result = await sendDigestEmail({ isTest: false });
    console.log(`Digest sent: ${result.itemCount} opportunities within the deadline window.`);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error("Scheduled digest failed:", err.message);
    // Scheduled functions should not throw uncaught — log and return 200 so Netlify doesn't retry-loop.
    return { statusCode: 200, body: JSON.stringify({ sent: false, error: err.message }) };
  }
};
