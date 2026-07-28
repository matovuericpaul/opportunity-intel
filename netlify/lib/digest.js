const { loadOpportunities, daysUntil } = require("./store");

const DEADLINE_WINDOW_DAYS = 21;

function buildDigestList(opportunities) {
  return opportunities
    .filter((o) => !o.archived)
    .map((o) => ({ ...o, daysUntilDeadline: daysUntil(o.deadline) }))
    .filter((o) => o.daysUntilDeadline !== null && o.daysUntilDeadline >= 0 && o.daysUntilDeadline <= DEADLINE_WINDOW_DAYS)
    .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
}

function renderEmailHtml(items, { isTest = false } = {}) {
  const rows = items
    .map(
      (o) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #2A3B36;">
          <strong>${escapeHtml(o.name)}</strong><br/>
          <span style="color:#9CB3AC;font-size:13px;">${escapeHtml(o.funder)} · ${escapeHtml(o.type || "")}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #2A3B36;text-align:center;">
          <strong style="color:${o.daysUntilDeadline <= 7 ? "#D9803F" : "#4FA98A"};">${o.daysUntilDeadline}d</strong><br/>
          <span style="color:#9CB3AC;font-size:12px;">${escapeHtml(o.deadline || "")}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #2A3B36;">
          ${o.applicationLink ? `<a href="${escapeHtml(o.applicationLink)}" style="color:#4FA98A;">Application link</a>` : "<span style=\"color:#6b8079;\">No link on file</span>"}
        </td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Georgia,serif;background:#0F1A17;color:#ECEAE2;padding:24px;">
    <h1 style="font-size:20px;margin:0 0 4px;">${isTest ? "Test digest — " : ""}Opportunity deadlines within ${DEADLINE_WINDOW_DAYS} days</h1>
    <p style="color:#9CB3AC;font-size:13px;margin:0 0 20px;">SBE Opportunity Intelligence Platform · ${new Date().toISOString().slice(0, 10)}</p>
    ${
      items.length === 0
        ? `<p>No tracked opportunities have deadlines within the next ${DEADLINE_WINDOW_DAYS} days.</p>`
        : `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
            <thead>
              <tr style="text-align:left;color:#9CB3AC;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">
                <th style="padding:8px 12px;border-bottom:1px solid #2A3B36;">Opportunity</th>
                <th style="padding:8px 12px;border-bottom:1px solid #2A3B36;">Deadline</th>
                <th style="padding:8px 12px;border-bottom:1px solid #2A3B36;">Link</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
    }
  </div>`;
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sendDigestEmail({ isTest = false } = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  const from = process.env.DIGEST_FROM_EMAIL || "Opportunity Digest <digest@resend.dev>";
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  if (!to) throw new Error("ALERT_EMAIL is not set.");

  const opportunities = await loadOpportunities();
  const items = buildDigestList(opportunities);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${isTest ? "[TEST] " : ""}${items.length} opportunity deadline${items.length === 1 ? "" : "s"} within ${DEADLINE_WINDOW_DAYS} days`,
      html: renderEmailHtml(items, { isTest })
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${text.slice(0, 500)}`);
  }

  return { sent: true, itemCount: items.length, items };
}

module.exports = { buildDigestList, sendDigestEmail, DEADLINE_WINDOW_DAYS };
