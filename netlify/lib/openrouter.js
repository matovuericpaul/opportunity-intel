const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Calls OpenRouter's chat completions endpoint.
 * @param {Object} opts
 * @param {string} opts.model - OpenRouter model slug. Append ':online' to enable web search grounding.
 * @param {Array} opts.messages - [{role, content}]
 * @param {boolean} [opts.json] - if true, requests JSON-mode output.
 * @param {number} [opts.maxTokens]
 */
async function callOpenRouter({ model, messages, json = false, maxTokens = 1600 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in the environment.");
  }

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.4
  };
  if (json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter asks for these for attribution/rate-limit purposes; harmless if the values are generic.
      "HTTP-Referer": process.env.PUBLIC_SITE_URL || "https://opportunity-intel.netlify.app",
      "X-Title": "Opportunity Intelligence Platform"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content.");
  }
  return { content, raw: data };
}

function extractJson(text) {
  // Models sometimes wrap JSON in prose or code fences — pull out the first {...} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output.");
  return JSON.parse(candidate.slice(start, end + 1));
}

module.exports = { callOpenRouter, extractJson };
