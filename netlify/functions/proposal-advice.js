const { callOpenRouter } = require("../lib/openrouter");
const { getTerminologyGuidance } = require("../lib/terminology");
const { json, options } = require("../lib/http");
const sbeProfile = require("../../data/sbe-profile.json");

const MODEL = process.env.OPENROUTER_MODEL_ADVICE || "anthropic/claude-sonnet-4.5";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options();
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  try {
    const body = JSON.parse(event.body || "{}");
    const opportunity = body.opportunity;
    if (!opportunity || !opportunity.name) return json(400, { error: "Provide an 'opportunity' object." });
    const question = body.question || null; // optional: a specific application question to answer

    const terminologyGuidance = getTerminologyGuidance(opportunity.funder || "");

    const systemPrompt = [
      "You are a grant-writing strategist helping a Ugandan founder (Eric) tailor real applications for SBE Aquafarm and SBE FBT.",
      "Ground every recommendation in the venture profile data given — real numbers, real named partners (Syliah Kagiiga, Agnes, Grace, Ronnie), real milestones. Never invent statistics that aren't in the profile.",
      "Be direct and concrete: give specific sentences/angles to use, not generic grant-writing platitudes.",
      "Flag eligibility risk plainly if the venture's unregistered status is a concern for this funder.",
      "Match the advice format to the opportunity's type: for a grant/fellowship/prize/challenge fund, focus on eligibility, budget narrative, and proposal structure. For a conference, focus on abstract or session-proposal angles and how attending builds visibility or partnerships. For a partnership/MOU, focus on framing mutual value and a clear, specific ask for that partner. For a strategic collaboration, focus on shared goals and what each side contributes.",
      terminologyGuidance
        ? "This funder is a US federal agency. Apply the supplied terminology guidance: offer meaning-preserving phrasing alternatives for flagged terms, presented as practical adaptation, not as a value judgment either way. Always let the applicant choose."
        : "This funder does not appear to be a US federal agency — no special terminology adaptation is needed."
    ].join("\n");

    const userContent = [
      `SBE VENTURE PROFILES:\n${JSON.stringify(sbeProfile, null, 2)}`,
      `OPPORTUNITY:\n${JSON.stringify(opportunity, null, 2)}`,
      terminologyGuidance ? `TERMINOLOGY GUIDANCE FOR THIS FUNDER:\n${JSON.stringify(terminologyGuidance, null, 2)}` : "",
      question
        ? `Focus specifically on answering this application question with a tailored draft angle (not a full essay, a strong outline + key sentences to build from):\n"${question}"`
        : "Give: (1) the single strongest angle/thesis for this application, (2) 3-5 concrete proof points to lead with, (3) key risks/gaps to address head-on, (4) one thing to NOT do."
    ].filter(Boolean).join("\n\n");

    const { content } = await callOpenRouter({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      maxTokens: 1400
    });

    return json(200, {
      advice: content,
      terminologyGuidanceApplied: !!terminologyGuidance,
      terminologyGuidance: terminologyGuidance || null
    });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
