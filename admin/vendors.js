import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  openModal,
  closeModal,
  showToast
} from "../design-system.js";

import { logAdminAction } from "./audit.js";


const form = document.getElementById("vendorForm");
const vendorsList = document.getElementById("vendorsList");
const vendorCount = document.getElementById("vendorCount");
const vendorSearch = document.getElementById("vendorSearch");
const vendorStatusFilter = document.getElementById("vendorStatusFilter");

const addVendorBtn = document.getElementById("addVendorBtn");
const vendorFormModal = document.getElementById("vendorFormModal");
const vendorFormCloseBtn = document.getElementById("vendorFormCloseBtn");
const vendorFormTitle = document.getElementById("vendorFormTitle");
const vendorFormSubmitBtn = document.getElementById("vendorFormSubmitBtn");

let editMode = false;
let editVendorId = null;
let allVendors = [];


/* =========================
   HELPERS
========================= */

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function statusPillClass(status) {
  if (status === "Blocked") return "bf-status-danger";
  if (status === "Active") return "bf-status-success";
  return "bf-status-pending";
}


/* =========================
   MODAL OPEN / CLOSE
========================= */

function resetForm() {
  form.reset();
  document.getElementById("vendorStatus").value = "Pending";
  document.getElementById("commissionRate").value = 10;
  editMode = false;
  editVendorId = null;
  vendorFormTitle.textContent = "Add Vendor";
  vendorFormSubmitBtn.textContent = "Save Vendor";
}

if (addVendorBtn) {
  addVendorBtn.addEventListener("click", () => {
    resetForm();
    openModal("vendorFormModal");
  });
}

if (vendorFormCloseBtn) {
  vendorFormCloseBtn.addEventListener("click", () => {
    closeModal("vendorFormModal");
  });
}


/* =========================
   SUBMIT (ADD / UPDATE)
========================= */

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  vendorFormSubmitBtn.disabled = true;
  vendorFormSubmitBtn.textContent = editMode ? "Updating..." : "Saving...";

  try {

    const vendorData = {
      shopName: document.getElementById("shopName").value.trim(),
      ownerName: document.getElementById("ownerName").value.trim(),
      email: document.getElementById("vendorEmail").value.trim(),
      phone: document.getElementById("vendorPhone").value.trim(),
      category: document.getElementById("vendorCategory").value.trim(),
      address: document.getElementById("vendorAddress").value.trim(),
      commissionRate: Number(document.getElementById("commissionRate").value) || 0,
      status: document.getElementById("vendorStatus").value
    };

    if (editMode) {

      await updateDoc(doc(db, "vendors", editVendorId), vendorData);
      await logAdminAction("Updated vendor", "Vendors", {
        vendorId: editVendorId,
        shopName: vendorData.shopName
      });
      showToast("Vendor updated", "success");

    } else {

      const newDoc = await addDoc(collection(db, "vendors"), {
        ...vendorData,
        createdAt: serverTimestamp()
      });
      await logAdminAction("Added vendor", "Vendors", {
        vendorId: newDoc.id,
        shopName: vendorData.shopName
      });
      showToast("Vendor added", "success");

    }

    closeModal("vendorFormModal");
    resetForm();
    loadVendors();

  } catch (error) {

    console.error("Vendor save error:", error);
    showToast(error.message || "Failed to save vendor.", "danger");

  } finally {

    vendorFormSubmitBtn.disabled = false;
    vendorFormSubmitBtn.textContent = editMode ? "Update Vendor" : "Save Vendor";

  }

});


/* =========================
   LOAD & RENDER
========================= */

async function loadVendors() {

  try {

    const snapshot = await getDocs(collection(db, "vendors"));

    allVendors = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderVendorList();

  } catch (error) {

    console.error("Vendors loading error:", error);

    vendorsList.innerHTML = `
      <div class="bf-card" style="padding:20px;">
        ❌ Unable to load vendors.
      </div>
    `;

  }

}

function getFilteredVendors() {

  const term = vendorSearch.value.trim().toLowerCase();
  const statusFilter = vendorStatusFilter.value;

  return allVendors.filter((vendor) => {

    const shop = (vendor.shopName || "").toLowerCase();
    const owner = (vendor.ownerName || "").toLowerCase();
    const phone = (vendor.phone || "").toLowerCase();
    const status = vendor.status || "Pending";

    const matchesTerm = !term || shop.includes(term) || owner.includes(term) || phone.includes(term);
    const matchesStatus = statusFilter === "All" || status === statusFilter;

    return matchesTerm && matchesStatus;

  });

}

function renderVendorList() {

  const filtered = getFilteredVendors();

  vendorCount.textContent = `Total Vendors: ${allVendors.length}`;

  if (!filtered.length) {
    vendorsList.innerHTML = `
      <div class="bf-card" style="padding:20px;">
        No vendors found.
      </div>
    `;
    return;
  }

  vendorsList.innerHTML = filtered.map((vendor) => {

    const status = vendor.status || "Pending";

    return `
      <div class="bf-card" style="padding:16px; display:flex; flex-direction:column; gap:6px;">

        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="font-weight:700; font-size:15px;">
            ${escapeHtml(vendor.shopName || "Unnamed shop")}
            ${vendor.userId ? `<span class="bf-status-pill bf-status-pending" style="margin-left:6px;font-size:10px;">🏪 Self-signup</span>` : ""}
          </div>

          <span class="bf-status-pill ${statusPillClass(status)}">${escapeHtml(status)}</span>
        </div>

        <div style="font-size:13px; opacity:.75;">
          👤 ${escapeHtml(vendor.ownerName || "Not available")}
        </div>

        <div style="font-size:13px; opacity:.75;">
          📞 ${escapeHtml(vendor.phone || "Not available")}
        </div>

        <div style="font-size:13px; opacity:.75;">
          ✉️ ${escapeHtml(vendor.email || "Not available")}
        </div>

        ${vendor.category ? `
          <div style="font-size:12px; opacity:.6;">
            ${escapeHtml(vendor.category)}
          </div>
        ` : ""}

        <div style="font-size:13px; margin-top:4px;">
          Commission: <b>${escapeHtml(String(vendor.commissionRate ?? 0))}%</b>
        </div>

        <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">

          <button
            type="button"
            class="bf-btn bf-btn-ghost bf-btn-sm edit-vendor-btn"
            data-id="${escapeHtml(vendor.id)}"
            style="flex:1;">
            ✏️ Edit
          </button>

          ${status === "Pending" ? `
            <button
              type="button"
              class="bf-btn bf-btn-ghost bf-btn-sm approve-vendor-btn"
              data-id="${escapeHtml(vendor.id)}"
              style="flex:1; color:#2F7A4F;">
              ✅ Approve
            </button>
          ` : `
            <button
              type="button"
              class="bf-btn bf-btn-ghost bf-btn-sm toggle-block-vendor-btn"
              data-id="${escapeHtml(vendor.id)}"
              data-blocked="${status === "Blocked"}"
              style="flex:1;">
              ${status === "Blocked" ? "Unblock" : "Block"}
            </button>
          `}

          <button
            type="button"
            class="bf-btn bf-btn-ghost bf-btn-sm delete-vendor-btn"
            data-id="${escapeHtml(vendor.id)}"
            data-name="${escapeHtml(vendor.shopName || "this vendor")}"
            style="flex:1; color:#c62828;">
            🗑️ Delete
          </button>

        </div>

      </div>
    `;

  }).join("");

}

if (vendorSearch) {
  vendorSearch.addEventListener("input", renderVendorList);
}

if (vendorStatusFilter) {
  vendorStatusFilter.addEventListener("change", renderVendorList);
}


/* =========================
   EDIT / BLOCK / DELETE
========================= */

async function editVendor(id) {

  try {

    const vendorRef = doc(db, "vendors", id);
    const vendorSnap = await getDoc(vendorRef);

    if (!vendorSnap.exists()) {
      showToast("Vendor not found", "danger");
      return;
    }

    const vendor = vendorSnap.data();

    document.getElementById("shopName").value = vendor.shopName || "";
    document.getElementById("ownerName").value = vendor.ownerName || "";
    document.getElementById("vendorEmail").value = vendor.email || "";
    document.getElementById("vendorPhone").value = vendor.phone || "";
    document.getElementById("vendorCategory").value = vendor.category || "";
    document.getElementById("vendorAddress").value = vendor.address || "";
    document.getElementById("commissionRate").value = vendor.commissionRate ?? 10;
    document.getElementById("vendorStatus").value = vendor.status || "Pending";

    editMode = true;
    editVendorId = id;

    vendorFormTitle.textContent = "Edit Vendor";
    vendorFormSubmitBtn.textContent = "Update Vendor";

    openModal("vendorFormModal");

  } catch (error) {

    console.error("Edit vendor error:", error);
    showToast(error.message || "Failed to load vendor.", "danger");

  }

}

async function approveVendor(id) {

  try {

    await updateDoc(doc(db, "vendors", id), { status: "Active" });

    await logAdminAction("Approved vendor", "Vendors", { vendorId: id });

    const idx = allVendors.findIndex(v => v.id === id);
    if (idx !== -1) {
      allVendors[idx] = { ...allVendors[idx], status: "Active" };
      renderVendorList();
    }

    showToast("Vendor approved — they now have dashboard access", "success");

  } catch (error) {

    console.error("Vendor approve error:", error);
    showToast(error.message || "Failed to approve vendor.", "danger");

  }

}

async function toggleBlockVendor(id, isCurrentlyBlocked) {

  const nextStatus = isCurrentlyBlocked ? "Active" : "Blocked";

  const confirmMsg = isCurrentlyBlocked
    ? "Unblock this vendor and restore their access?"
    : "Block this vendor? They will no longer be able to sell on Bestify.";

  if (!window.confirm(confirmMsg)) return;

  try {

    await updateDoc(doc(db, "vendors", id), { status: nextStatus });

    await logAdminAction(
      nextStatus === "Blocked" ? "Blocked vendor" : "Unblocked vendor",
      "Vendors",
      { vendorId: id }
    );

    const idx = allVendors.findIndex(v => v.id === id);
    if (idx !== -1) {
      allVendors[idx] = { ...allVendors[idx], status: nextStatus };
      renderVendorList();
    }

    showToast(nextStatus === "Blocked" ? "Vendor blocked" : "Vendor unblocked", "success");

  } catch (error) {

    console.error("Vendor block/unblock error:", error);
    showToast(error.message || "Failed to update vendor status.", "danger");

  }

}

async function deleteVendor(id, name) {

  const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
  if (!ok) return;

  try {

    await deleteDoc(doc(db, "vendors", id));

    await logAdminAction("Deleted vendor", "Vendors", { vendorId: id, name });

    allVendors = allVendors.filter(v => v.id !== id);
    renderVendorList();

    showToast("Vendor deleted", "success");

  } catch (error) {

    console.error("Delete vendor error:", error);
    showToast(error.message || "Failed to delete vendor.", "danger");

  }

}

if (vendorsList) {
  vendorsList.addEventListener("click", (e) => {

    const editBtn = e.target.closest(".edit-vendor-btn");
    if (editBtn) {
      editVendor(editBtn.dataset.id);
      return;
    }

    const approveBtn = e.target.closest(".approve-vendor-btn");
    if (approveBtn) {
      approveVendor(approveBtn.dataset.id);
      return;
    }

    const blockBtn = e.target.closest(".toggle-block-vendor-btn");
    if (blockBtn) {
      toggleBlockVendor(blockBtn.dataset.id, blockBtn.dataset.blocked === "true");
      return;
    }

    const deleteBtn = e.target.closest(".delete-vendor-btn");
    if (deleteBtn) {
      deleteVendor(deleteBtn.dataset.id, deleteBtn.dataset.name);
    }

  });
}


/* =========================
   APP INIT (ADMIN CHECK)
========================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
      alert("Access Denied ❌");
      window.location.href = "home.html";
      return;
    }

  } catch (error) {
    console.error("Admin check error:", error);
    window.location.href = "home.html";
    return;
  }

  loadVendors();

});
