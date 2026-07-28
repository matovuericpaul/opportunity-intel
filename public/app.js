const FN = (name) => `/.netlify/functions/${name}`;

let allOpportunities = [];
let state = { venture: "all", status: "all", showArchived: false, sort: "deadline" };

const grid = document.getElementById("grid");
const statsStrip = document.getElementById("statsStrip");
const toastEl = document.getElementById("toast");

function toast(msg, ms = 3800) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toastEl.hidden = true), ms);
}

async function api(path, opts = {}) {
  const res = await fetch(FN(path), {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- Contour-ring score badge (signature visual element) ---------- */
function scoreRingSvg(score) {
  const val = typeof score === "number" ? score : null;
  const color = val === null ? "#9CB3AC" : val >= 95 ? "#4FA98A" : val >= 80 ? "#7ee0b8" : val >= 65 ? "#D9803F" : "#E2574C";
  const rings = [17, 13, 9, 5]; // depth contours
  const filledCount = val === null ? 0 : Math.max(1, Math.round((val / 100) * rings.length));
  const circles = rings
    .map((r, i) => {
      const isFilled = i >= rings.length - filledCount;
      return `<circle cx="20" cy="20" r="${r}" stroke="${color}" opacity="${isFilled ? 0.9 - i * 0.12 : 0.18}" />`;
    })
    .join("");
  return `<svg width="40" height="40" viewBox="0 0 40 40">${circles}</svg>`;
}

/* ---------- Rendering ---------- */
function deadlineBadgeClass(days) {
  if (days === null || days === undefined) return "";
  if (days <= 7) return "urgent";
  if (days <= 21) return "soon";
  return "ok";
}

function statusClass(status) {
  return "status-" + (status || "not started").toLowerCase().replace(/\s+/g, "-");
}

function renderStats(list) {
  const active = list.filter((o) => !o.archived);
  const withinWindow = active.filter((o) => o.daysUntilDeadline !== null && o.daysUntilDeadline >= 0 && o.daysUntilDeadline <= 21);
  const awarded = active.filter((o) => o.status === "awarded");
  const avgScore = (() => {
    const scored = active.filter((o) => o.score && typeof o.score.score === "number");
    if (!scored.length) return "—";
    return Math.round(scored.reduce((s, o) => s + o.score.score, 0) / scored.length);
  })();

  statsStrip.innerHTML = `
    <div class="stat"><div class="num">${active.length}</div><div class="label">Tracked opportunities</div></div>
    <div class="stat"><div class="num">${withinWindow.length}</div><div class="label">Deadlines within 21 days</div></div>
    <div class="stat"><div class="num">${awarded.length}</div><div class="label">Awarded</div></div>
    <div class="stat"><div class="num">${avgScore}</div><div class="label">Avg. AI fit score</div></div>
  `;
}

function applyFiltersAndSort(list) {
  let out = list.filter((o) => (state.showArchived ? true : !o.archived));
  if (state.venture !== "all") out = out.filter((o) => (o.ventureFit || []).includes(state.venture));
  if (state.status !== "all") out = out.filter((o) => (o.status || "not started") === state.status);

  if (state.sort === "deadline") {
    out = out.sort((a, b) => {
      const da = a.daysUntilDeadline === null ? Infinity : a.daysUntilDeadline;
      const db = b.daysUntilDeadline === null ? Infinity : b.daysUntilDeadline;
      return da - db;
    });
  } else if (state.sort === "score") {
    out = out.sort((a, b) => (b.score?.score || -1) - (a.score?.score || -1));
  } else if (state.sort === "added") {
    out = out.sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));
  }
  return out;
}

function amountLabel(o) {
  if (!o.amountMin && !o.amountMax) return "Amount unspecified";
  const cur = o.currency || "USD";
  if (o.amountMin && o.amountMax && o.amountMin !== o.amountMax) return `${cur} ${fmt(o.amountMin)}–${fmt(o.amountMax)}`;
  return `${cur} ${fmt(o.amountMax || o.amountMin)}`;
}
function fmt(n) { return Number(n).toLocaleString(); }

function render() {
  const filtered = applyFiltersAndSort(allOpportunities);
  renderStats(allOpportunities);

  if (!filtered.length) {
    grid.innerHTML = `<p class="loading">No opportunities match these filters yet.</p>`;
    return;
  }

  grid.innerHTML = filtered
    .map((o) => {
      const days = o.daysUntilDeadline;
      const deadlineText = o.deadline ? `${days}d · ${o.deadline}` : "No deadline on file";
      return `
      <article class="card" data-id="${o.id}">
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHtml(o.name)}</h3>
            <p class="card-funder">${escapeHtml(o.funder)}</p>
          </div>
          <div class="score-ring" title="${o.score ? o.score.band : "Not yet scored"}">
            ${scoreRingSvg(o.score ? o.score.score : null)}
            <span class="score-num">${o.score ? o.score.score : "—"}</span>
          </div>
        </div>
        <div class="venture-tags">
          ${(o.ventureFit || []).map((v) => `<span class="tag ${v}">${v === "aquafarm" ? "Aquafarm" : "FBT"}</span>`).join("")}
          ${o.source === "ai-found" ? `<span class="tag">AI-found</span>` : ""}
          ${o.archived ? `<span class="tag">Archived</span>` : ""}
        </div>
        <div class="card-meta">
          <span class="deadline-badge ${deadlineBadgeClass(days)}">${deadlineText}</span>
          <span class="status-pill ${statusClass(o.status)}">${o.status || "not started"}</span>
        </div>
        <div class="card-meta"><span>${amountLabel(o)}</span><span>${escapeHtml(o.type || "")}</span></div>
      </article>`;
    })
    .join("");

  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
  });
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Data loading ---------- */
async function loadOpportunities() {
  grid.innerHTML = `<p class="loading">Loading opportunities…</p>`;
  try {
    const data = await api("opportunities-get");
    allOpportunities = data.opportunities;
    render();
  } catch (err) {
    grid.innerHTML = `<p class="loading">Couldn't load opportunities: ${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- Detail panel ---------- */
const detailOverlay = document.getElementById("detailOverlay");
const detailContent = document.getElementById("detailContent");

function openDetail(id) {
  const o = allOpportunities.find((x) => x.id === id);
  if (!o) return;
  detailContent.innerHTML = `
    <h2 id="detailTitle">${escapeHtml(o.name)}</h2>
    <p class="muted">${escapeHtml(o.funder)} · ${escapeHtml(o.type || "")} · ${amountLabel(o)}</p>
    <p><strong>Deadline:</strong> ${o.deadline ? `${o.deadline} (${o.daysUntilDeadline}d)` : "Not on file"} &nbsp; <strong>Opens:</strong> ${o.openingDate || "—"}</p>
    <p><strong>Eligibility:</strong> ${eligibilityText(o.eligibility)}</p>
    ${o.requirements ? `<p><strong>Requirements:</strong> ${escapeHtml(o.requirements)}</p>` : ""}
    ${o.applicationLink ? `<p><a href="${escapeHtml(o.applicationLink)}" target="_blank" rel="noopener">Application link →</a></p>` : ""}
    ${o.notes ? `<p class="muted">${escapeHtml(o.notes)}</p>` : ""}

    <div class="detail-actions">
      <button class="btn btn-primary" id="scoreBtn">Score fit (AI)</button>
      <button class="btn btn-ghost" id="adviceBtn">Get proposal advice</button>
      <button class="btn btn-ghost" id="editBtn">Edit</button>
      <button class="btn btn-ghost" id="archiveBtn">${o.archived ? "Unarchive" : "Archive"}</button>
    </div>

    <div id="statusRow">
      <label class="muted" style="display:flex;gap:8px;align-items:center;">Status:
        <select id="statusSelect">
          ${["not started", "in progress", "submitted", "awarded", "rejected"]
            .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
      </label>
    </div>

    ${o.score ? `<h3>AI fit score — ${o.score.band}</h3><div class="score-output">${escapeHtml(o.score.reasoning || "")}\n\nEligibility concerns: ${escapeHtml(o.score.eligibilityConcerns || "None noted")}</div>` : ""}
    <div id="scoreArea"></div>
    <div id="adviceArea"></div>
  `;
  detailOverlay.hidden = false;

  document.getElementById("scoreBtn").addEventListener("click", () => runScore(o));
  document.getElementById("adviceBtn").addEventListener("click", () => runAdvice(o));
  document.getElementById("editBtn").addEventListener("click", () => { closeDetail(); openForm(o); });
  document.getElementById("archiveBtn").addEventListener("click", () => toggleArchive(o));
  document.getElementById("statusSelect").addEventListener("change", (e) => updateStatus(o, e.target.value));
}

function eligibilityText(e) {
  if (!e) return "Not documented — verify.";
  const parts = [];
  if (e.individualsAllowed !== undefined) parts.push(`Individuals allowed: ${e.individualsAllowed}`);
  if (e.orgRequired !== undefined) parts.push(`Org required: ${e.orgRequired}`);
  if (e.ageRange) parts.push(`Age: ${e.ageRange}`);
  if (e.geography) parts.push(`Geography: ${e.geography}`);
  return parts.length ? parts.join(" · ") : "Not documented — verify.";
}

document.getElementById("closeDetail").addEventListener("click", closeDetail);
detailOverlay.addEventListener("click", (e) => { if (e.target === detailOverlay) closeDetail(); });
function closeDetail() { detailOverlay.hidden = true; }

async function runScore(o) {
  const area = document.getElementById("scoreArea");
  area.innerHTML = `<p class="muted">Scoring…</p>`;
  try {
    const data = await api("score-opportunity", { method: "POST", body: JSON.stringify({ opportunity: o }) });
    area.innerHTML = `<h3>AI fit score — ${data.score.band}</h3><div class="score-output">${escapeHtml(data.score.reasoning)}\n\nEligibility concerns: ${escapeHtml(data.score.eligibilityConcerns || "None noted")}\n\nTop strengths: ${(data.score.topStrengths || []).join(", ")}\nTop risks: ${(data.score.topRisks || []).join(", ")}</div>`;
    await loadOpportunities();
  } catch (err) {
    area.innerHTML = `<p class="muted">Scoring failed: ${escapeHtml(err.message)}</p>`;
  }
}

async function runAdvice(o) {
  const area = document.getElementById("adviceArea");
  area.innerHTML = `<p class="muted">Drafting advice…</p>`;
  try {
    const data = await api("proposal-advice", { method: "POST", body: JSON.stringify({ opportunity: o }) });
    const flag = data.terminologyGuidanceApplied
      ? `<p class="muted" style="margin-top:10px;">⚑ US federal funder — funder-appropriate phrasing options included below, factually adapted (see note in the advice text).</p>`
      : "";
    area.innerHTML = `<h3>Proposal-writing advice</h3><div class="advice-output">${escapeHtml(data.advice)}</div>${flag}`;
  } catch (err) {
    area.innerHTML = `<p class="muted">Advice generation failed: ${escapeHtml(err.message)}</p>`;
  }
}

async function toggleArchive(o) {
  try {
    if (o.archived) {
      await api(`custom-opportunities`, { method: "PUT", body: JSON.stringify({ id: o.id, archived: false }) });
    } else {
      await api(`custom-opportunities?id=${encodeURIComponent(o.id)}`, { method: "DELETE" });
    }
    toast(o.archived ? "Unarchived." : "Archived.");
    closeDetail();
    await loadOpportunities();
  } catch (err) { toast("Failed: " + err.message); }
}

async function updateStatus(o, status) {
  try {
    await api("custom-opportunities", { method: "PUT", body: JSON.stringify({ id: o.id, status }) });
    toast("Status updated.");
    await loadOpportunities();
  } catch (err) { toast("Failed: " + err.message); }
}

/* ---------- Add / edit form ---------- */
const formOverlay = document.getElementById("formOverlay");
const oppForm = document.getElementById("oppForm");

function openForm(existing) {
  oppForm.reset();
  document.getElementById("formTitle").textContent = existing ? "Edit opportunity" : "Add opportunity";
  oppForm.elements.id.value = existing?.id || "";
  if (existing) {
    oppForm.elements.name.value = existing.name || "";
    oppForm.elements.funder.value = existing.funder || "";
    oppForm.elements.type.value = existing.type || "grant";
    oppForm.elements.currency.value = existing.currency || "USD";
    oppForm.elements.amountMin.value = existing.amountMin || "";
    oppForm.elements.amountMax.value = existing.amountMax || "";
    oppForm.elements.deadline.value = existing.deadline || "";
    oppForm.elements.openingDate.value = existing.openingDate || "";
    oppForm.elements.applicationLink.value = existing.applicationLink || "";
    oppForm.elements.requirements.value = existing.requirements || "";
    oppForm.elements.eligibilityNotes.value = eligibilityText(existing.eligibility);
    oppForm.elements.sdgs.value = (existing.sdgs || []).join(", ");
    oppForm.elements.pastWinners.value = existing.pastWinners || "";
    oppForm.elements.reviewTimeline.value = existing.reviewTimeline || "";
    oppForm.elements.status.value = existing.status || "not started";
    oppForm.elements.notes.value = existing.notes || "";
    [...oppForm.elements.ventureFit.options].forEach((opt) => (opt.selected = (existing.ventureFit || []).includes(opt.value)));
  }
  formOverlay.hidden = false;
}
document.getElementById("addBtn").addEventListener("click", () => openForm(null));
document.getElementById("closeForm").addEventListener("click", () => (formOverlay.hidden = true));
formOverlay.addEventListener("click", (e) => { if (e.target === formOverlay) formOverlay.hidden = true; });

oppForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(oppForm);
  const ventureFit = [...oppForm.elements.ventureFit.selectedOptions].map((o) => o.value);
  const payload = {
    id: fd.get("id") || undefined,
    name: fd.get("name"),
    funder: fd.get("funder"),
    type: fd.get("type"),
    currency: fd.get("currency"),
    amountMin: fd.get("amountMin") ? Number(fd.get("amountMin")) : null,
    amountMax: fd.get("amountMax") ? Number(fd.get("amountMax")) : null,
    deadline: fd.get("deadline") || null,
    openingDate: fd.get("openingDate") || null,
    applicationLink: fd.get("applicationLink") || null,
    requirements: fd.get("requirements"),
    sdgs: (fd.get("sdgs") || "").split(",").map((s) => s.trim()).filter(Boolean),
    pastWinners: fd.get("pastWinners"),
    reviewTimeline: fd.get("reviewTimeline"),
    ventureFit,
    status: fd.get("status"),
    notes: fd.get("notes")
  };
  try {
    if (payload.id) {
      await api("custom-opportunities", { method: "PUT", body: JSON.stringify(payload) });
      toast("Opportunity updated.");
    } else {
      await api("custom-opportunities", { method: "POST", body: JSON.stringify(payload) });
      toast("Opportunity added.");
    }
    formOverlay.hidden = true;
    await loadOpportunities();
  } catch (err) {
    toast("Save failed: " + err.message);
  }
});

/* ---------- Scan (live search) ---------- */
document.getElementById("scanBtn").addEventListener("click", async () => {
  const btn = document.getElementById("scanBtn");
  const statusBox = document.getElementById("scanStatus");
  btn.disabled = true;
  statusBox.hidden = false;
  statusBox.textContent = "Scanning the web for open opportunities matching SBE Aquafarm & SBE FBT…";
  try {
    const data = await api("find-opportunities", { method: "POST", body: JSON.stringify({ focus: "both ventures" }) });
    if (data.mode === "online") {
      statusBox.textContent = `Scan complete — added ${data.addedCount} new opportunit${data.addedCount === 1 ? "y" : "ies"}.`;
      await loadOpportunities();
    } else {
      statusBox.textContent = `Live search unavailable (${data.error || "unknown error"}) — showing offline fallback suggestions in the notes of seed opportunities. Check OPENROUTER_API_KEY / OPENROUTER_MODEL_ONLINE.`;
    }
  } catch (err) {
    statusBox.textContent = "Scan failed: " + err.message;
  } finally {
    btn.disabled = false;
    setTimeout(() => (statusBox.hidden = true), 9000);
  }
});

/* ---------- Digest test ---------- */
document.getElementById("digestBtn").addEventListener("click", async () => {
  const secret = prompt("Enter DIGEST_SECRET to send a test digest to your alert inbox:");
  if (!secret) return;
  try {
    const data = await api("send-test-digest", { method: "POST", body: JSON.stringify({ secret }) });
    toast(`Test digest sent — ${data.itemCount} opportunit${data.itemCount === 1 ? "y" : "ies"} within window.`);
  } catch (err) {
    toast("Digest failed: " + err.message);
  }
});

/* ---------- Filter controls ---------- */
document.querySelectorAll("[data-filter-venture]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-filter-venture]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.venture = btn.dataset.filterVenture;
    render();
  });
});
document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; render(); });
document.getElementById("showArchived").addEventListener("change", (e) => { state.showArchived = e.target.checked; render(); });
document.getElementById("sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; render(); });

loadOpportunities();
