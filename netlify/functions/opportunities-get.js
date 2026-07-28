const { loadOpportunities, daysUntil } = require("../lib/store");
const { json, options } = require("../lib/http");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options();
  if (event.httpMethod !== "GET") return json(405, { error: "Use GET." });

  try {
    const opportunities = await loadOpportunities();
    const withDerived = opportunities.map((o) => ({
      ...o,
      daysUntilDeadline: daysUntil(o.deadline)
    }));
    return json(200, { opportunities: withDerived, count: withDerived.length });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
