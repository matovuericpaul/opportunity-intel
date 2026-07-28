// Practical, non-partisan grant-writing adaptation notes.
//
// Background (as of mid-2026): multiple US federal agencies — including NSF, NIH, USDA, DOE
// and DOD — have been reported (per court filings, agency memos, and reporting from
// Higher Ed Dive, Grist, NPR and others) to screen award language for certain terms when
// reviewing or terminating grants. This module is descriptive, not prescriptive: it exists
// only so the app can offer factual, practical phrasing alternatives for applicants targeting
// USfederal or US-federal-adjacent funders, while preserving the applicant's actual meaning.
// It is not applied unless the funder looks like a US federal agency, and it never changes
// the substance of what SBE Aquafarm / SBE FBT actually does.

const US_FEDERAL_FUNDER_SIGNALS = [
  "national science foundation", "nsf",
  "national institutes of health", "nih",
  "usda", "united states department of agriculture", "agricultural research service",
  "department of energy", "doe ",
  "department of defense", "dod ", "defense advanced research",
  "environmental protection agency", "epa",
  "usaid", "u.s. agency for international development",
  "state department", "department of state",
  "national oceanic and atmospheric administration", "noaa"
];

function looksLikeUSFederalFunder(funderName = "") {
  const n = ` ${funderName.toLowerCase()} `;
  return US_FEDERAL_FUNDER_SIGNALS.some((signal) => n.includes(signal));
}

// Term -> neutral, meaning-preserving alternates that have been reported in use by
// applicants/agencies navigating this environment. These are suggestions, not mandates —
// the app should always give the applicant the option to keep original language.
const TERM_ALTERNATES = {
  "climate change": ["extreme weather", "weather variability", "changing environmental conditions"],
  "climate resilience": ["resilience to weather extremes", "environmental resilience"],
  "decarbonization": ["emissions reduction", "efficiency improvements"],
  "clean energy": ["alternative energy", "energy diversification", "low-cost energy sources"],
  "green energy": ["alternative energy", "domestic energy sources"],
  "sustainability": ["long-term durability", "long-term viability", "resilience"],
  "sustainable": ["durable", "long-lasting", "resource-efficient"],
  "carbon neutrality": ["emissions reduction targets"],
  "environmental justice": ["community environmental health", "local environmental quality"],
  "equity": ["access", "opportunity", "fair participation"],
  "diversity": ["broad community participation", "representation across the community"],
  "underserved communities": ["low-income communities", "rural communities", "communities with limited infrastructure"],
  "gender equality": ["equal participation of men and women", "broad household participation"],
  "women-led": ["household-led", "community-led, with strong participation from women"],
  "pollution control": ["water quality management", "runoff management"],
  "air quality management": ["local air conditions monitoring"]
};

/**
 * Returns adaptation guidance for a piece of proposal text, only when the funder
 * matches a US federal signal. Always returns the original meaning intact —
 * this only offers phrasing options.
 */
function getTerminologyGuidance(funderName) {
  if (!looksLikeUSFederalFunder(funderName)) return null;
  return {
    applies: true,
    note:
      "This funder is a US federal agency. Multiple US federal agencies have, as of 2025-2026, been reported to " +
      "screen grant applications for certain terms (per court records and reporting from outlets including Higher Ed " +
      "Dive, Grist, and NPR). This is presented here as a practical, factual grant-writing consideration — not a " +
      "political stance — and none of these substitutions change what the project actually does.",
    suggestedAlternates: TERM_ALTERNATES
  };
}

module.exports = { looksLikeUSFederalFunder, getTerminologyGuidance, TERM_ALTERNATES };
