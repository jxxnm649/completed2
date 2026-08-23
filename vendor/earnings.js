import { db } from "../firebase.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { guardVendorPage, wireLogout } from "./vendor-common.js";

wireLogout(document.getElementById("logoutBtn"));

const earningsList = document.getElementById("earningsList");
const statusFilter = document.getElementById("statusFilter");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const statTotal = document.getElementById("statTotal");
const statCollected = document.getElementById("statCollected");
const statPending = document.getElementById("statPending");

let allEntries = [];

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function toJsDate(ts) {
  if (!ts) return null;
  return ts?.toDate ? ts.toDate() : new Date(ts);
}

function formatDate(ts) {
  const d = toJsDate(ts);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function loadEarnings(vendorId) {

  try {

    const snapshot = await getDocs(
      query(collection(db, "commissions"), where("vendorId", "==", vendorId))
    );

    allEntries = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toJsDate(b.createdAt)?.getTime() || 0) - (toJsDate(a.createdAt)?.getTime() || 0));

    applyFilters();

  } catch (error) {
    console.error("Vendor earnings load error:", error);
    earningsList.innerHTML = `<div class="bf-card" style="padding:20px;">❌ Unable to load earnings.</div>`;
  }

}

function applyFilters() {

  const status = statusFilter.value;
  const from = fromDate.value ? new Date(fromDate.value + "T00:00:00") : null;
  const to = toDate.value ? new Date(toDate.value + "T23:59:59") : null;

  const filtered = allEntries.filter((c) => {
    const entryStatus = c.status === "Collected" ? "Collected" : "Pending";
    const matchesStatus = status === "All" || entryStatus === status;

    const d = toJsDate(c.createdAt);
    const matchesFrom = !from || (d && d >= from);
    const matchesTo = !to || (d && d <= to);

    return matchesStatus && matchesFrom && matchesTo;
  });

  const total = allEntries.reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
  const collected = allEntries.filter(c => c.status === "Collected").reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
  const pending = total - collected;

  statTotal.textContent = `₹${total.toLocaleString("en-IN")}`;
  statCollected.textContent = `₹${collected.toLocaleString("en-IN")}`;
  statPending.textContent = `₹${pending.toLocaleString("en-IN")}`;

  if (!filtered.length) {
    earningsList.innerHTML = `<div class="bf-card" style="padding:20px;">No entries for this filter.</div>`;
    return;
  }

  earningsList.innerHTML = filtered.map((c) => {

    const isCollected = c.status === "Collected";

    return `
      <div class="bf-card" style="padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;">₹${escapeHtml(String(c.commissionAmount ?? 0))} commission</div>
          <div style="font-size:12px;opacity:.65;margin-top:2px;">
            Order Value: ₹${escapeHtml(String(c.orderAmount ?? 0))} · Rate: ${escapeHtml(String(c.commissionRate ?? 0))}% · ${formatDate(c.createdAt)}
          </div>
          ${c.note ? `<div style="font-size:12px;opacity:.6;margin-top:2px;">📝 ${escapeHtml(c.note)}</div>` : ""}
        </div>
        <span class="bf-status-pill ${isCollected ? "bf-status-success" : "bf-status-pending"}">${isCollected ? "Collected" : "Pending"}</span>
      </div>
    `;

  }).join("");

}

statusFilter.addEventListener("change", applyFilters);
fromDate.addEventListener("change", applyFilters);
toDate.addEventListener("change", applyFilters);

guardVendorPage((user) => {
  loadEarnings(user.uid);
});
