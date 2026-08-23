import { auth, db } from "./firebase.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc
}
from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const form = document.getElementById("profileForm");

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {

    const data = docSnap.data();

    document.getElementById("name").value = data.name || "";
    document.getElementById("email").value = data.email || "";
    document.getElementById("mobile").value = data.mobile || "";
    document.getElementById("address").value = data.address || "";

  }

  form.addEventListener("submit", async (e) => {

    e.preventDefault();

    await updateDoc(docRef, {
      name: document.getElementById("name").value,
      mobile: document.getElementById("mobile").value,
      address: document.getElementById("address").value
    });

    alert("Profile Updated Successfully ✅");

  });

});
