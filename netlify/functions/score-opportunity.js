const { callOpenRouter, extractJson } = require("../lib/openrouter");
const { loadOpportunities, saveOpportunities } = require("../lib/store");
const { json, options } = require("../lib/http");
const sbeProfile = require("../../data/sbe-profile.json");

const MODEL = process.env.OPENROUTER_MODEL_SCORING || "anthropic/claude-sonnet-4.5";

const SCORING_RUBRIC = `
Score the opportunity's fit for SBE's ventures from 0-100 using this rubric, then assign a band:
- 95 (Exceptional fit): Directly matches sector + geography + eligibility (explicitly open to individuals/unregistered ventures) + right award size. Near-zero eligibility risk.
- 80 (Strong fit): Matches sector and geography well, eligibility is likely workable (may need a fiscal sponsor or minor adaptation), award size reasonable.
- 65 (Worth exploring): Partial thematic overlap, or eligibility/registration status is unclear and needs verification, or geography/sector is a stretch but plausible.
- Below 65: Poor fit — wrong sector, wrong geography, or hard eligibility blocker (e.g. requires registered 501c3/NGO with no individual pathway, or excludes the applicant's country/age).

Weight eligibility for INDIVIDUALS/unregistered ventures heavily — SBE Aquafarm and SBE FBT are NOT registered organizations. An opportunity that flatly requires registered-org status with no individual or fiscal-sponsorship pathway should be capped well below 65 regardless of thematic fit.

Respond ONLY with a JSON object of this exact shape:
{
  "score": <integer 0-100>,
  "band": "95 - Exceptional" | "80 - Strong" | "65 - Worth exploring" | "Low fit",
  "bestVentureFit": "aquafarm" | "fbt" | "both" | "neither",
  "reasoning": "<3-5 sentences, concrete, referencing specific facts about the opportunity and the venture>",
  "eligibilityConcerns": "<specific concerns, or 'None identified' >",
  "topStrengths": ["<short phrase>", "..."],
  "topRisks": ["<short phrase>", "..."]
}
`.trim();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options();
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  try {
    const body = JSON.parse(event.body || "{}");
    const opportunity = body.opportunity;
    if (!opportunity || !opportunity.id) return json(400, { error: "Provide an 'opportunity' object with an id." });

    const { content } = await callOpenRouter({
      model: MODEL,
      json: true,
      messages: [
        {
          role: "system",
          content:
            "You are a precise, skeptical grant-strategy analyst for a small Ugandan social enterprise founder. " +
            "You never inflate scores to be encouraging — false hope wastes application time. " +
            SCORING_RUBRIC
        },
        {
          role: "user",
          content:
            `SBE VENTURE PROFILES:\n${JSON.stringify(sbeProfile, null, 2)}\n\n` +
            `OPPORTUNITY TO SCORE:\n${JSON.stringify(opportunity, null, 2)}\n\n` +
            "Score this opportunity now."
        }
      ]
    });

    const result = extractJson(content);

    // Persist the score onto the stored opportunity if it exists there.
    const list = await loadOpportunities();
    const idx = list.findIndex((o) => o.id === opportunity.id);
    if (idx !== -1) {
      list[idx].score = { ...result, scoredAt: new Date().toISOString() };
      list[idx].lastUpdated = new Date().toISOString().slice(0, 10);
      await saveOpportunities(list);
    }

    return json(200, { score: result });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
