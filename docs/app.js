const STORAGE_KEY = "timesheetapp.lite.v1";

const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"engagements":[],"workdays":[]}');

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function renderEngagements() {
  const list = document.getElementById("engagement-list");
  const select = document.getElementById("engagement-select");
  list.innerHTML = "";
  select.innerHTML = "";

  for (const eng of state.engagements) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${eng.title}</strong> - ${eng.clientName} <span class="badge">€ ${eng.dailyRate}/g</span>`;
    list.appendChild(li);

    const option = document.createElement("option");
    option.value = eng.id;
    option.textContent = `${eng.title} (${eng.clientName})`;
    select.appendChild(option);
  }
}

function renderSummary() {
  const el = document.getElementById("summary");
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rows = state.engagements.map((eng) => {
    const days = state.workdays.filter(
      (w) => w.engagementId === eng.id && monthKey(w.date) === key && w.billable
    );
    return {
      title: eng.title,
      billableDays: days.length,
      amount: days.length * Number(eng.dailyRate),
    };
  });

  if (rows.length === 0) {
    el.innerHTML = "<p>Nessun incarico inserito.</p>";
    return;
  }

  el.innerHTML = rows
    .map((r) => `<p><strong>${r.title}</strong>: ${r.billableDays} gg rendicontabili, stimato € ${r.amount.toFixed(2)}</p>`)
    .join("");
}

function onEngagementSubmit(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const data = new FormData(form);
  state.engagements.push({
    id: crypto.randomUUID(),
    title: data.get("title"),
    clientName: data.get("clientName"),
    dailyRate: Number(data.get("dailyRate")),
  });
  persist();
  form.reset();
  renderEngagements();
  renderSummary();
}

function onWorkdaySubmit(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const data = new FormData(form);
  state.workdays.push({
    id: crypto.randomUUID(),
    engagementId: data.get("engagementId"),
    date: data.get("date"),
    worked: data.get("worked") === "on",
    billable: data.get("billable") === "on",
    activity: data.get("activity"),
  });
  persist();
  form.reset();
  renderSummary();
}

document.getElementById("engagement-form").addEventListener("submit", onEngagementSubmit);
document.getElementById("workday-form").addEventListener("submit", onWorkdaySubmit);

renderEngagements();
renderSummary();
