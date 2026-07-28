const { getStore } = require("@netlify/blobs");
const seed = require("../../data/opportunities-seed.json");

const STORE_NAME = "opportunities";
const KEY = "all";

function getOpportunityStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN;

  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }

  return getStore(STORE_NAME);
}

async function loadOpportunities() {
  const store = getOpportunityStore();
  const existing = await store.get(KEY, { type: "json" });

  if (existing && Array.isArray(existing)) return existing;

  await store.setJSON(KEY, seed);
  return seed;
}

async function saveOpportunities(list) {
  const store = getOpportunityStore();
  await store.setJSON(KEY, list);
  return list;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;

  const target = new Date(dateStr + "T00:00:00Z");

  if (isNaN(target.getTime())) return null;

  const now = new Date();

  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
                                                                                                                                                                          
  const diffMs = target.getTime() - todayUTC;

  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

module.exports = {
  getOpportunityStore,
  loadOpportunities,
  saveOpportunities,
  daysUntil,
  KEY,
  STORE_NAME
};
