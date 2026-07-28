const { loadOpportunities, saveOpportunities } = require("../lib/store");
const { json, options } = require("../lib/http");

function makeId(name) {
  const slug = (name || "opportunity")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `custom-${slug}-${Date.now().toString(36)}`;
}

const REQUIRED_ON_CREATE = ["name", "funder"];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options();

  try {
    const list = await loadOpportunities();

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      for (const field of REQUIRED_ON_CREATE) {
        if (!body[field]) return json(400, { error: `Missing required field: ${field}` });
      }
      const newOpp = {
        id: makeId(body.name),
        name: body.name,
        funder: body.funder,
        type: body.type || "grant",
        amountMin: body.amountMin ?? null,
        amountMax: body.amountMax ?? null,
        currency: body.currency || "USD",
        deadline: body.deadline || null,
        openingDate: body.openingDate || null,
        cycle: body.cycle || null,
        eligibility: body.eligibility || {
          individualsAllowed: null,
          orgRequired: null,
          ageRange: null,
          geography: null
        },
        requirements: body.requirements || "",
        sdgs: body.sdgs || [],
        pastWinners: body.pastWinners || "",
        reviewTimeline: body.reviewTimeline || "",
        applicationLink: body.applicationLink || null,
        ventureFit: body.ventureFit || [],
        status: body.status || "not started",
        score: body.score || null,
        notes: body.notes || "",
        archived: false,
        source: "manual",
        verified: body.verified ?? false,
        dateAdded: new Date().toISOString().slice(0, 10),
        lastUpdated: new Date().toISOString().slice(0, 10)
      };
      list.push(newOpp);
      await saveOpportunities(list);
      return json(201, { opportunity: newOpp });
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      if (!body.id) return json(400, { error: "Missing id." });
      const idx = list.findIndex((o) => o.id === body.id);
      if (idx === -1) return json(404, { error: "Opportunity not found." });
      list[idx] = { ...list[idx], ...body, lastUpdated: new Date().toISOString().slice(0, 10) };
      await saveOpportunities(list);
      return json(200, { opportunity: list[idx] });
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) return json(400, { error: "Missing id query param." });
      const idx = list.findIndex((o) => o.id === id);
      if (idx === -1) return json(404, { error: "Opportunity not found." });
      const hardDelete = event.queryStringParameters.hard === "true";
      if (hardDelete) {
        list.splice(idx, 1);
      } else {
        list[idx].archived = true;
        list[idx].lastUpdated = new Date().toISOString().slice(0, 10);
      }
      await saveOpportunities(list);
      return json(200, { ok: true, archived: !hardDelete });
    }

    return json(405, { error: "Use POST, PUT, or DELETE." });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
