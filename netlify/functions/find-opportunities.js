const { callOpenRouter, extractJson } = require("../lib/openrouter");
const { loadOpportunities, saveOpportunities } = require("../lib/store");
const { json, options } = require("../lib/http");
const sbeProfile = require("../../data/sbe-profile.json");

// Append ':online' to enable OpenRouter's web-search grounding on a compatible model.
const ONLINE_MODEL = process.env.OPENROUTER_MODEL_ONLINE || "perplexity/sonar-pro:online";

const SEARCH_PROMPT = `
Search the live web for CURRENTLY OPEN or upcoming (not expired) funding opportunities — grants, fellowships,
prizes, or challenge funds — that are a strong match for the venture profiles provided below.

Hard priorities:
- Prefer opportunities explicitly open to INDIVIDUALS, informal ventures, or unregistered social enterprises —
  not only registered NGOs/companies. Note clearly when eligibility is unclear or requires registration.
- Prefer opportunities open to youth (roughly ages 18-35) or with no age restriction.
- Prefer opportunities relevant to: wetland/ecosystem restoration, aquaculture, circular economy / waste-to-value,
  smallholder agriculture, gender & environment, youth social enterprise, East Africa / Uganda / Sub-Saharan Africa.
- Only include opportunities with a real, verifiable application link. Do not invent funders or links.
- Skip anything you are not reasonably confident actually exists and is current in 2026.

Return ONLY a JSON object of this exact shape:
{
  "opportunities": [
    {
      "name": "",
      "funder": "",
      "type": "grant | fellowship | prize | challenge fund",
      "amountMin": <number or null>,
      "amountMax": <number or null>,
      "currency": "USD" ,
      "deadline": "YYYY-MM-DD or null if unknown",
      "openingDate": "YYYY-MM-DD or null",
      "cycle": "",
      "eligibility": { "individualsAllowed": true|false|"unclear", "orgRequired": true|false|"unclear", "ageRange": "", "geography": "" },
      "requirements": "",
      "sdgs": [],
      "pastWinners": "",
      "reviewTimeline": "",
      "applicationLink": "",
      "ventureFit": ["aquafarm" | "fbt"],
      "confidence": "high | medium | low"
    }
  ]
}
`.trim();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options();
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") return json(405, { error: "Use POST or GET." });

  let focus = "both ventures";
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (body.focus) focus = body.focus; // "aquafarm" | "fbt" | "both ventures"
  } catch (_) {
    /* no body provided, use default */
  }

  try {
    const { content } = await callOpenRouter({
      model: ONLINE_MODEL,
      json: true,
      maxTokens: 2200,
      messages: [
        { role: "system", content: "You are a meticulous funding-opportunity researcher. You never fabricate funders or links." },
        {
          role: "user",
          content: `${SEARCH_PROMPT}\n\nFocus this search primarily on: ${focus}.\n\nVENTURE PROFILES:\n${JSON.stringify(sbeProfile, null, 2)}`
        }
      ]
    });

    const parsed = extractJson(content);
    const found = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];

    const list = await loadOpportunities();
    const added = [];
    for (const f of found) {
      const alreadyExists = list.some(
        (o) => o.name.toLowerCase() === (f.name || "").toLowerCase() && o.funder.toLowerCase() === (f.funder || "").toLowerCase()
      );
      if (alreadyExists || !f.name || !f.funder) continue;
      const newOpp = {
        id: `ai-${(f.name || "opp").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
        name: f.name,
        funder: f.funder,
        type: f.type || "grant",
        amountMin: f.amountMin ?? null,
        amountMax: f.amountMax ?? null,
        currency: f.currency || "USD",
        deadline: f.deadline || null,
        openingDate: f.openingDate || null,
        cycle: f.cycle || null,
        eligibility: f.eligibility || {},
        requirements: f.requirements || "",
        sdgs: f.sdgs || [],
        pastWinners: f.pastWinners || "",
        reviewTimeline: f.reviewTimeline || "",
        applicationLink: f.applicationLink || null,
        ventureFit: f.ventureFit || [],
        status: "not started",
        score: null,
        notes: `AI-discovered (confidence: ${f.confidence || "unspecified"}). Verify all details before relying on them.`,
        archived: false,
        source: "ai-found",
        verified: false,
        dateAdded: new Date().toISOString().slice(0, 10),
        lastUpdated: new Date().toISOString().slice(0, 10)
      };
      list.push(newOpp);
      added.push(newOpp);
    }
    await saveOpportunities(list);

    return json(200, { mode: "online", addedCount: added.length, added });
  } catch (err) {
    // Offline fallback: surface a curated static list drawn from the seed file's
    // "worth searching" categories so the UI always has something actionable.
    try {
      const fallback = require("../../data/opportunities-seed.json")
        .filter((o) => o.source === "seed")
        .map((o) => ({ ...o, notes: `${o.notes} (Offline fallback — live search unavailable: ${err.message})` }));
      return json(200, {
        mode: "offline-fallback",
        error: err.message,
        addedCount: 0,
        added: [],
        fallbackSuggestions: fallback
      });
    } catch (fallbackErr) {
      return json(500, { error: `Live search failed (${err.message}) and offline fallback also failed (${fallbackErr.message}).` });
    }
  }
};
