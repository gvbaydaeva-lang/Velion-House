const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const settingsForm = document.getElementById("settingsForm");
const offerForm = document.getElementById("offerForm");
const offersList = document.getElementById("offersList");
const leadsTableWrap = document.getElementById("leadsTableWrap");

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

async function uploadImage(file) {
  if (!file) return "";
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка загрузки изображения");
  return data.url;
}

function setAuthUI(isAuth) {
  loginCard.classList.toggle("hidden", isAuth);
  dashboard.classList.toggle("hidden", !isAuth);
}

async function loadLeads() {
  const leads = await api("/api/admin/leads");
  if (!leads.length) {
    leadsTableWrap.innerHTML = "<p>Заявок пока нет.</p>";
    return;
  }
  const rows = leads
    .map(
      (lead) => `<tr>
        <td>${new Date(lead.createdAt).toLocaleString("ru-RU")}</td>
        <td>${lead.name}</td>
        <td>${lead.phone}</td>
        <td>${lead.message || "-"}</td>
        <td>
          <select data-lead-id="${lead.id}" class="lead-status">
            <option value="new" ${lead.status === "new" ? "selected" : ""}>Новая</option>
            <option value="in_progress" ${lead.status === "in_progress" ? "selected" : ""}>В работе</option>
            <option value="done" ${lead.status === "done" ? "selected" : ""}>Закрыта</option>
          </select>
        </td>
      </tr>`
    )
    .join("");
  leadsTableWrap.innerHTML = `<table>
    <thead><tr><th>Дата</th><th>Имя</th><th>Телефон</th><th>Комментарий</th><th>Статус</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  document.querySelectorAll(".lead-status").forEach((select) => {
    select.addEventListener("change", async (e) => {
      await api(`/api/admin/leads/${e.target.dataset.leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: e.target.value }),
      });
    });
  });
}

async function loadSettings() {
  const settings = await api("/api/admin/settings");
  document.getElementById("companyName").value = settings.companyName || "";
  document.getElementById("companyPhone").value = settings.phone || "";
  document.getElementById("heroTitle").value = settings.heroTitle || "";
  document.getElementById("heroSubtitle").value = settings.heroSubtitle || "";
  document.getElementById("heroImageUrl").value = settings.heroImage || "";
}

async function loadOffers() {
  const offers = await api("/api/admin/offers");
  offersList.innerHTML = offers
    .map(
      (offer) => `<article class="offer-item">
        <strong>${offer.title}</strong>
        <p>${offer.description}</p>
        ${offer.image ? `<img src="${offer.image}" alt="${offer.title}" />` : ""}
        <small>Статус: ${offer.active ? "Опубликовано" : "Скрыто"}</small>
        <div class="row">
          <button data-action="toggle" data-id="${offer.id}" class="ghost">${offer.active ? "Скрыть" : "Показать"}</button>
          <button data-action="delete" data-id="${offer.id}">Удалить</button>
        </div>
      </article>`
    )
    .join("") || "<p>Акций пока нет.</p>";

  offersList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "delete") {
        await api(`/api/admin/offers/${id}`, { method: "DELETE" });
      } else {
        const offersNow = await api("/api/admin/offers");
        const item = offersNow.find((x) => x.id === id);
        if (item) {
          await api(`/api/admin/offers/${id}`, {
            method: "PUT",
            body: JSON.stringify({ ...item, active: !item.active }),
          });
        }
      }
      await loadOffers();
    });
  });
}

async function loadDashboard() {
  await Promise.all([loadLeads(), loadOffers(), loadSettings()]);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        login: document.getElementById("login").value.trim(),
        password: document.getElementById("password").value,
      }),
    });
    setAuthUI(true);
    await loadDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  setAuthUI(false);
});

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const heroFile = document.getElementById("heroImageFile").files[0];
  const heroUrl = document.getElementById("heroImageUrl").value.trim();
  const uploadedUrl = heroFile ? await uploadImage(heroFile) : "";
  await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify({
      companyName: document.getElementById("companyName").value.trim(),
      phone: document.getElementById("companyPhone").value.trim(),
      heroTitle: document.getElementById("heroTitle").value.trim(),
      heroSubtitle: document.getElementById("heroSubtitle").value.trim(),
      heroImage: uploadedUrl || heroUrl,
    }),
  });
  alert("Настройки сохранены");
});

offerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("offerImageFile").files[0];
  const urlField = document.getElementById("offerImageUrl").value.trim();
  const uploaded = file ? await uploadImage(file) : "";
  await api("/api/admin/offers", {
    method: "POST",
    body: JSON.stringify({
      title: document.getElementById("offerTitle").value.trim(),
      description: document.getElementById("offerDescription").value.trim(),
      image: uploaded || urlField,
      active: document.getElementById("offerActive").checked,
    }),
  });
  offerForm.reset();
  document.getElementById("offerActive").checked = true;
  await loadOffers();
});

async function init() {
  try {
    const me = await api("/api/admin/me");
    setAuthUI(me.isAdmin);
    if (me.isAdmin) await loadDashboard();
  } catch {
    setAuthUI(false);
  }
}

init();
