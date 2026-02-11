const STORAGE_KEY = "timesheetapp.full.v1";

const initialState = {
  profile: { name: "", email: "", vat: "", iban: "", language: "it", timezone: "Europe/Rome", pinEnabled: false },
  engagements: [],
  workdays: [],
  periods: [],
  reports: [],
  invoices: [],
  documents: [],
  travels: [],
  auditLogs: [],
};

const state = loadState();
const tabs = [
  ["dashboard", "Dashboard"],
  ["engagements", "Incarichi"],
  ["calendar", "Calendario"],
  ["periods", "Periodi"],
  ["reports", "Relazioni"],
  ["invoices", "Fatture"],
  ["documents", "Documenti"],
  ["travels", "Trasferte"],
  ["audit", "Audit"],
  ["settings", "Impostazioni"],
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);
    return { ...structuredClone(initialState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(initialState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function id() {
  return crypto.randomUUID();
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("it-IT");
}

function endOfMonth(isoDate) {
  const d = new Date(isoDate);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(dateObj, n) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}



const ITALIAN_HOLIDAYS = {
  "2026-01-01": "Capodanno",
  "2026-01-06": "Epifania",
  "2026-04-05": "Pasqua",
  "2026-04-06": "Lunedì di Pasqua (Pasquetta)",
  "2026-04-25": "Liberazione Italia",
  "2026-05-01": "Festa del lavoro",
  "2026-06-02": "Festa della Repubblica Italia",
  "2026-08-15": "Ferragosto",
  "2026-10-04": "Festa di San Francesco d’Assisi",
  "2026-11-01": "Tutti i santi",
  "2026-12-08": "Immacolata Concezione",
  "2026-12-25": "Natale",
  "2026-12-26": "Santo Stefano",
  "2027-01-01": "Capodanno",
  "2027-01-06": "Epifania",
  "2027-03-28": "Pasqua",
  "2027-03-29": "Lunedì di Pasqua (Pasquetta)",
  "2027-04-25": "Liberazione Italia",
  "2027-05-01": "Festa del lavoro",
  "2027-06-02": "Festa della Repubblica Italia",
  "2027-08-15": "Ferragosto",
  "2027-10-04": "Festa di San Francesco d’Assisi",
  "2027-11-01": "Tutti i santi",
  "2027-12-08": "Immacolata Concezione",
  "2027-12-25": "Natale",
  "2027-12-26": "Santo Stefano",
};

function getItalianHolidayName(dateValue) {
  return ITALIAN_HOLIDAYS[dateValue] || null;
}

function isItalianHoliday(dateValue) {
  return Boolean(getItalianHolidayName(dateValue));
}

function addAudit(entityType, entityId, event, reason = "") {
  state.auditLogs.unshift({ id: id(), entityType, entityId, event, reason, ts: new Date().toISOString() });
}

function getEngagementById(engagementId) {
  return state.engagements.find((e) => e.id === engagementId);
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function calcBillableCount(engagementId) {
  return state.workdays.filter((w) => w.engagementId === engagementId && w.billable && w.status === "worked").length;
}

function calcPeriodTotals(period) {
  const engagement = getEngagementById(period.engagementId);
  const rows = state.workdays.filter((w) => w.engagementId === period.engagementId && w.date >= period.startDate && w.date <= period.endDate);
  const worked = rows.filter((w) => w.status === "worked").length;
  const billable = rows.filter((w) => w.status === "worked" && w.billable).length;
  return { worked, billable, amount: billable * Number(engagement?.dailyRate || 0) };
}

function dueDate(invoiceDate, type, days) {
  const base = new Date(`${invoiceDate}T00:00:00`);
  if (type === "DF") return toISO(addDays(base, Number(days || 0)));
  const end = endOfMonth(base);
  return toISO(addDays(end, Number(days || 0)));
}

function periodMonthsStep(freq) {
  if (freq === "bimonthly") return 2;
  if (freq === "quarterly") return 3;
  return 1;
}

function calculatePeriods(engagement, throughDate) {
  const step = periodMonthsStep(engagement.reportingFrequency);
  const start = new Date(`${engagement.startDate}T00:00:00`);
  const end = new Date(`${engagement.endDate}T00:00:00`);
  const through = new Date(`${throughDate}T00:00:00`);
  const maxDate = end < through ? end : through;

  const generated = [];
  let cursor = start;

  while (cursor <= maxDate) {
    const periodStart = new Date(cursor.getFullYear(), cursor.getMonth(), engagement.reportingAnchorDay || 1);
    if (periodStart < start) periodStart.setTime(start.getTime());

    const nextAnchor = new Date(periodStart.getFullYear(), periodStart.getMonth() + step, engagement.reportingAnchorDay || 1);
    const periodEnd = addDays(nextAnchor, -1);
    if (periodEnd > maxDate) periodEnd.setTime(maxDate.getTime());

    if (periodStart <= periodEnd) {
      generated.push({
        id: id(),
        engagementId: engagement.id,
        startDate: toISO(periodStart),
        endDate: toISO(periodEnd),
        status: "draft",
        notes: "",
      });
    }

    cursor = addDays(periodEnd, 1);
  }

  return generated;
}

function download(filename, content, contentType = "text/plain") {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setActiveTab(tabId) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === tabId));
  document.querySelectorAll(".menu-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
}


function setupMenuToggle() {
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  if (!toggle || !sidebar) return;
  toggle.onclick = () => sidebar.classList.toggle("open");
}

function renderTabs() {
  const container = document.getElementById("tabs");
  container.innerHTML = tabs
    .map(([id, label]) => `<li><button class="menu-btn" data-tab="${id}">${label}</button></li>`)
    .join("");
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
    if (window.innerWidth <= 1080) document.getElementById("sidebar")?.classList.remove("open");
  });
}

function renderDashboard() {
  const root = document.getElementById("dashboard");
  const active = state.engagements.filter((e) => e.status === "active").length;
  const dueInvoices = state.invoices.filter((i) => i.status !== "paid" && i.computedDueDate < toISO(new Date())).length;
  const openPeriods = state.periods.filter((p) => ["draft", "ready", "submitted"].includes(p.status)).length;

  const invoicedPeriods = state.periods.filter((p) => p.status === "invoiced");
  const invoicedDays = invoicedPeriods.reduce((sum, period) => sum + calcPeriodTotals(period).billable, 0);
  const invoicedAmountFromPeriods = invoicedPeriods.reduce((sum, period) => sum + calcPeriodTotals(period).amount, 0);
  const invoicedAmountFromInvoices = state.invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const invoicedAmount = Math.max(invoicedAmountFromPeriods, invoicedAmountFromInvoices);

  const billableTotal = state.workdays.filter((w) => w.billable && w.status === "worked").length;
  const maxBillableTotal = state.engagements.reduce((sum, e) => sum + Number(e.maxBillableDays || 0), 0);
  const remainingDays = maxBillableTotal > 0 ? Math.max(maxBillableTotal - billableTotal, 0) : null;

  const engagementRows = state.engagements.map((e) => {
    const billedDays = calcBillableCount(e.id);
    const billedValue = billedDays * Number(e.dailyRate || 0);
    const remaining = e.maxBillableDays ? Math.max(e.maxBillableDays - billedDays, 0) : null;
    const pct = e.maxBillableDays ? Math.min(Math.round((billedDays / e.maxBillableDays) * 100), 100) : null;
    return { ...e, billedDays, billedValue, remaining, pct };
  });

  root.innerHTML = `
    <section class="hero-card card">
      <div>
        <h2>Panoramica fatturazione</h2>
        <p class="small">Stato immediato delle giornate fatturate e delle giornate residue disponibili.</p>
      </div>
      <div class="hero-values">
        <div>
          <div class="small">Giornate fatturate</div>
          <p class="kpi">${invoicedDays}</p>
        </div>
        <div>
          <div class="small">Guadagno fatturato</div>
          <p class="kpi">€ ${invoicedAmount.toFixed(2)}</p>
        </div>
        <div>
          <div class="small">Giornate rimanenti</div>
          <p class="kpi">${remainingDays === null ? "N/D" : remainingDays}</p>
        </div>
      </div>
    </section>

    <div class="metrics-grid">
      <article class="card metric-card"><h3>Incarichi attivi</h3><p class="kpi">${active}</p></article>
      <article class="card metric-card"><h3>Periodi aperti</h3><p class="kpi">${openPeriods}</p></article>
      <article class="card metric-card"><h3>Fatture scadute</h3><p class="kpi">${dueInvoices}</p></article>
      <article class="card metric-card"><h3>Giornate fatturabili totali</h3><p class="kpi">${billableTotal}</p></article>
    </div>

    <div class="grid">
      <article class="card">
        <h3>Avanzamento per incarico</h3>
        <ul class="list dashboard-list">
          ${engagementRows
            .map(
              (e) => `<li>
                <div class="list-header">
                  <strong>${e.title}</strong>
                  <span class="badge ${e.status === "active" ? "ok" : "warn"}">${e.status}</span>
                </div>
                <div class="small">${e.clientName} · € ${e.dailyRate}/giorno</div>
                <div class="progress-wrap">
                  <div class="progress-bar" style="width:${e.pct || 0}%"></div>
                </div>
                <div class="small">Fatturate: <strong>${e.billedDays}</strong> · Guadagno: <strong>€ ${e.billedValue.toFixed(2)}</strong> · Rimanenti: <strong>${e.remaining === null ? "N/D" : e.remaining}</strong></div>
              </li>`
            )
            .join("") || "<li>Nessun incarico disponibile</li>"}
        </ul>
      </article>

      <article class="card">
        <h3>Promemoria operativi</h3>
        <ul class="list dashboard-list">
          ${state.periods
            .filter((p) => p.status === "draft")
            .slice(0, 6)
            .map((p) => `<li>Periodo in bozza: ${formatDate(p.startDate)} - ${formatDate(p.endDate)}</li>`)
            .join("") || "<li>Nessun promemoria</li>"}
          ${state.invoices
            .filter((i) => i.status !== "paid" && i.computedDueDate < toISO(new Date()))
            .slice(0, 4)
            .map((i) => `<li>Fattura scaduta: ${i.invoiceNumber} (${formatDate(i.computedDueDate)})</li>`)
            .join("")}
        </ul>
      </article>
    </div>
  `;
}

function renderEngagements() {
  const root = document.getElementById("engagements");
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3 id="eng-form-title">Nuovo incarico</h3>
        <form id="eng-form">
          <input type="hidden" name="editingId" />
          <div class="row"><div><label>Titolo</label><input name="title" required></div><div><label>Committente</label><input name="clientName" required></div></div>
          <label>Oggetto</label><textarea name="subject"></textarea>
          <div class="row-3">
            <div><label>Inizio</label><input type="date" name="startDate" required></div>
            <div><label>Fine</label><input type="date" name="endDate" required></div>
            <div><label>Tariffa giornaliera</label><input type="number" min="1" name="dailyRate" required></div>
          </div>
          <div class="row-3">
            <div><label>Frequenza</label><select name="reportingFrequency"><option>monthly</option><option>bimonthly</option><option>quarterly</option></select></div>
            <div><label>Anchor day</label><input type="number" name="reportingAnchorDay" min="1" max="28" value="1"></div>
            <div><label>Max giorni fatturabili</label><input type="number" name="maxBillableDays" min="1"></div>
          </div>
          <div class="row">
            <label><input type="checkbox" name="weekendAllowed"> Weekend consentiti</label>
            <label><input type="checkbox" name="holidaysAllowed"> Festivi consentiti</label>
          </div>
          <div class="row">
            <button class="primary" id="eng-submit-btn" type="submit">Salva incarico</button>
            <button type="button" id="eng-cancel-edit">Annulla modifica</button>
          </div>
        </form>
      </article>
      <article class="card">
        <h3>Elenco incarichi</h3>
        <ul class="list" id="eng-list"></ul>
      </article>
    </div>
  `;

  const form = root.querySelector("#eng-form");
  const submitBtn = root.querySelector("#eng-submit-btn");
  const titleEl = root.querySelector("#eng-form-title");

  function resetForm() {
    form.reset();
    form.elements.editingId.value = "";
    submitBtn.textContent = "Salva incarico";
    titleEl.textContent = "Nuovo incarico";
  }

  root.querySelector("#eng-cancel-edit").onclick = resetForm;

  form.onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const editingId = String(fd.get("editingId") || "");
    const payload = {
      title: fd.get("title"),
      clientName: fd.get("clientName"),
      subject: fd.get("subject"),
      startDate: fd.get("startDate"),
      endDate: fd.get("endDate"),
      dailyRate: Number(fd.get("dailyRate")),
      reportingFrequency: fd.get("reportingFrequency"),
      reportingAnchorDay: Number(fd.get("reportingAnchorDay") || 1),
      maxBillableDays: fd.get("maxBillableDays") ? Number(fd.get("maxBillableDays")) : null,
      weekendAllowed: fd.get("weekendAllowed") === "on",
      holidaysAllowed: fd.get("holidaysAllowed") === "on",
    };

    if (editingId) {
      const row = getEngagementById(editingId);
      if (!row) return alert("Incarico non trovato");
      Object.assign(row, payload);
      addAudit("engagement", row.id, "updated");
    } else {
      const engagement = { id: id(), ...payload, status: "active" };
      state.engagements.unshift(engagement);
      addAudit("engagement", engagement.id, "created");
    }
    persist();
    renderAll();
  };

  root.querySelector("#eng-list").innerHTML = state.engagements
    .map((e) => {
      const billable = calcBillableCount(e.id);
      const pct = e.maxBillableDays ? Math.round((billable / e.maxBillableDays) * 100) : null;
      const warn = pct && pct >= 80 ? `<span class="badge warn">${pct}% max</span>` : "";
      return `<li>
        <strong>${e.title}</strong> · ${e.clientName} ${warn}<br>
        <span class="small">${formatDate(e.startDate)} - ${formatDate(e.endDate)} · € ${e.dailyRate}/giorno · ${e.reportingFrequency}</span><br>
        <div class="row-3" style="margin-top:.4rem">
          <button data-action="edit" data-id="${e.id}">Modifica</button>
          <button data-action="duplicate" data-id="${e.id}">Duplica</button>
          <button data-action="toggle" data-id="${e.id}">${e.status === "active" ? "Chiudi" : "Riapri"}</button>
        </div>
      </li>`;
    })
    .join("") || "<li>Nessun incarico</li>";

  root.querySelector("#eng-list").onclick = (ev) => {
    const btn = ev.target.closest("button[data-id]");
    if (!btn) return;
    const engagement = getEngagementById(btn.dataset.id);
    if (!engagement) return;
    if (btn.dataset.action === "edit") {
      form.elements.editingId.value = engagement.id;
      form.elements.title.value = engagement.title;
      form.elements.clientName.value = engagement.clientName;
      form.elements.subject.value = engagement.subject || "";
      form.elements.startDate.value = engagement.startDate;
      form.elements.endDate.value = engagement.endDate;
      form.elements.dailyRate.value = engagement.dailyRate;
      form.elements.reportingFrequency.value = engagement.reportingFrequency;
      form.elements.reportingAnchorDay.value = engagement.reportingAnchorDay || 1;
      form.elements.maxBillableDays.value = engagement.maxBillableDays || "";
      form.elements.weekendAllowed.checked = !!engagement.weekendAllowed;
      form.elements.holidaysAllowed.checked = !!engagement.holidaysAllowed;
      submitBtn.textContent = "Aggiorna incarico";
      titleEl.textContent = "Modifica incarico";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (btn.dataset.action === "duplicate") {
      const copy = { ...engagement, id: id(), title: `${engagement.title} (copy)`, status: "active" };
      state.engagements.unshift(copy);
      addAudit("engagement", copy.id, "duplicated_from", engagement.id);
    } else {
      engagement.status = engagement.status === "active" ? "closed" : "active";
      addAudit("engagement", engagement.id, `status_${engagement.status}`);
    }
    persist();
    renderAll();
  };
}

function renderCalendar() {
  const root = document.getElementById("calendar");
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3 id="workday-form-title">Nuova giornata</h3>
        <form id="workday-form">
          <input type="hidden" name="editingId" />
          <label>Incarico</label>
          <select name="engagementId" required>${state.engagements.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}</select>
          <div class="row">
            <div><label>Data</label><input type="date" name="date" required></div>
            <div><label>Status</label><select name="status"><option>worked</option><option>non-worked</option><option>blocked</option><option>holiday</option><option>weekend</option></select></div>
          </div>
          <div class="row">
            <label><input type="checkbox" name="billable" checked> Fatturabile</label>
            <label><input type="checkbox" name="includeInExport" checked> Includi in export</label>
          </div>
          <label>Attività (separate da ;)</label>
          <textarea name="activities" placeholder="Analisi requisiti; Meeting con cliente"></textarea>
          <label>Note interne</label>
          <textarea name="internalNote"></textarea>
          <div class="row">
            <button class="primary" id="workday-submit-btn" type="submit">Salva giornata</button>
            <button type="button" id="workday-cancel-edit">Annulla modifica</button>
          </div>
        </form>
      </article>
      <article class="card">
        <h3>Calendario mensile</h3>
        <div class="row">
          <div><label>Mese</label><input type="month" id="month-view" value="${defaultMonth}" /></div>
          <div><label>Incarico</label><select id="month-engagement">${state.engagements.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}</select></div>
        </div>
        <div class="calendar-grid" id="month-calendar"></div>
        <p class="small">Legenda: <span class="badge ok">worked</span> <span class="badge warn">non worked</span> <span class="badge danger">blocked</span> <span class="badge">festivo IT</span></p>
      </article>
      <article class="card">
        <h3>Giornate inserite</h3>
        <ul class="list" id="workday-list"></ul>
      </article>
    </div>
  `;

  const form = root.querySelector("#workday-form");
  const submitBtn = root.querySelector("#workday-submit-btn");
  const titleEl = root.querySelector("#workday-form-title");

  function resetWorkdayForm() {
    form.reset();
    form.elements.editingId.value = "";
    submitBtn.textContent = "Salva giornata";
    titleEl.textContent = "Nuova giornata";
  }

  function renderMonthCalendar() {
    const monthInput = root.querySelector("#month-view").value || defaultMonth;
    const engagementId = root.querySelector("#month-engagement").value;
    const [y, m] = monthInput.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const firstWeekday = (start.getDay() + 6) % 7;

    const map = new Map(
      state.workdays
        .filter((w) => w.engagementId === engagementId && w.date >= toISO(start) && w.date <= toISO(end))
        .map((w) => [w.date, w])
    );

    const cells = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => `<div class="cal-head">${d}</div>`);
    for (let i = 0; i < firstWeekday; i++) cells.push('<div class="cal-day empty"></div>');

    for (let day = 1; day <= end.getDate(); day++) {
      const dt = new Date(y, m - 1, day);
      const iso = toISO(dt);
      const item = map.get(iso);
      const weekend = [0, 6].includes(dt.getDay());
      const holiday = isItalianHoliday(iso);
      let cls = "";
      let label = "-";
      if (item) {
        cls = `status-${item.status}`;
        label = item.status;
      } else if (holiday) {
        cls = "status-holiday-it";
        label = getItalianHolidayName(iso) || "festivo IT";
      } else if (weekend) {
        cls = "status-weekend";
        label = "weekend";
      }
      cells.push(`<div class="cal-day ${cls}" data-date="${iso}"><div class="cal-num">${day}</div><div class="cal-label">${label}</div></div>`);
    }
    root.querySelector("#month-calendar").innerHTML = cells.join("");
  }

  root.querySelector("#workday-cancel-edit").onclick = resetWorkdayForm;

  form.onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const editingId = String(fd.get("editingId") || "");
    const engagement = getEngagementById(fd.get("engagementId"));
    const dateValue = fd.get("date");
    const status = fd.get("status");
    const weekDay = new Date(`${dateValue}T00:00:00`).getDay();

    if (!engagement) return alert("Incarico non trovato");
    if (status === "worked" && !engagement.weekendAllowed && [0, 6].includes(weekDay)) return alert("Weekend bloccato per questo incarico.");
    if (status === "worked" && !engagement.holidaysAllowed && isItalianHoliday(dateValue)) return alert("Festivo italiano bloccato per questo incarico.");

    const billable = fd.get("billable") === "on";
    const currentBillables = state.workdays.filter((w) => w.engagementId === engagement.id && w.billable && w.status === "worked" && w.id !== editingId).length;
    if (billable && engagement.maxBillableDays && currentBillables >= engagement.maxBillableDays) return alert("Max giorni fatturabili raggiunto.");

    const payload = {
      engagementId: engagement.id,
      date: dateValue,
      status,
      billable,
      internalNote: fd.get("internalNote"),
      activities: String(fd.get("activities") || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title) => ({ id: id(), title, includeInExport: fd.get("includeInExport") === "on", category: "general", tags: [] })),
    };

    if (editingId) {
      const row = state.workdays.find((w) => w.id === editingId);
      if (!row) return alert("Giornata non trovata");
      Object.assign(row, payload);
      addAudit("workday", row.id, "updated");
    } else {
      const workday = { id: id(), ...payload };
      state.workdays.unshift(workday);
      addAudit("workday", workday.id, "created");
    }
    persist();
    renderAll();
  };

  root.querySelector("#workday-list").innerHTML = state.workdays
    .slice(0, 100)
    .map((w) => {
      const e = getEngagementById(w.engagementId);
      const statusBadge = w.status === "worked" ? "ok" : w.status === "blocked" ? "danger" : "warn";
      return `<li>
        <strong>${formatDate(w.date)}</strong> - ${e?.title || "N/A"} <span class="badge ${statusBadge}">${w.status}</span>
        <div class="small">${w.activities.map((a) => a.title).join(", ") || "No attività"}</div>
        <div class="row" style="margin-top:.4rem">
          <button data-edit="${w.id}">Modifica</button>
          <button data-delete="${w.id}" class="danger">Elimina</button>
        </div>
      </li>`;
    })
    .join("") || "<li>Nessuna giornata</li>";

  root.querySelector("#workday-list").onclick = (ev) => {
    const editBtn = ev.target.closest("button[data-edit]");
    const delBtn = ev.target.closest("button[data-delete]");

    if (editBtn) {
      const row = state.workdays.find((w) => w.id === editBtn.dataset.edit);
      if (!row) return;
      form.elements.editingId.value = row.id;
      form.elements.engagementId.value = row.engagementId;
      form.elements.date.value = row.date;
      form.elements.status.value = row.status;
      form.elements.billable.checked = !!row.billable;
      form.elements.includeInExport.checked = row.activities.every((a) => a.includeInExport);
      form.elements.activities.value = row.activities.map((a) => a.title).join("; ");
      form.elements.internalNote.value = row.internalNote || "";
      submitBtn.textContent = "Aggiorna giornata";
      titleEl.textContent = "Modifica giornata";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (delBtn) {
      const idx = state.workdays.findIndex((w) => w.id === delBtn.dataset.delete);
      if (idx >= 0) {
        addAudit("workday", state.workdays[idx].id, "deleted");
        state.workdays.splice(idx, 1);
        persist();
        renderAll();
      }
    }
  };

  root.querySelector("#month-view").onchange = renderMonthCalendar;
  root.querySelector("#month-engagement").onchange = renderMonthCalendar;
  if (state.engagements.length > 0) renderMonthCalendar();
}

function renderPeriods() {
  const root = document.getElementById("periods");
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3>Genera periodi automatici</h3>
        <form id="period-gen-form">
          <label>Incarico</label><select name="engagementId">${state.engagements.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}</select>
          <label>Genera fino al</label><input type="date" name="throughDate" required>
          <button class="primary" type="submit">Genera</button>
        </form>
      </article>
      <article class="card">
        <h3>Lista periodi</h3>
        <ul id="period-list" class="list"></ul>
      </article>
    </div>
  `;

  root.querySelector("#period-gen-form").onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const engagement = getEngagementById(fd.get("engagementId"));
    if (!engagement) return;

    const generated = calculatePeriods(engagement, fd.get("throughDate"));
    const existingKeys = new Set(state.periods.map((p) => `${p.engagementId}|${p.startDate}|${p.endDate}`));
    generated.forEach((p) => {
      const key = `${p.engagementId}|${p.startDate}|${p.endDate}`;
      if (!existingKeys.has(key)) {
        state.periods.push(p);
        addAudit("period", p.id, "generated");
      }
    });
    persist();
    renderAll();
  };

  root.querySelector("#period-list").innerHTML = state.periods
    .slice()
    .sort((a, b) => (a.startDate > b.startDate ? -1 : 1))
    .map((p) => {
      const e = getEngagementById(p.engagementId);
      const totals = calcPeriodTotals(p);
      return `<li>
        <strong>${e?.title || "N/A"}</strong> · ${formatDate(p.startDate)} - ${formatDate(p.endDate)}
        <div class="small">worked: ${totals.worked}, fatturabili: ${totals.billable}, stimato: € ${totals.amount.toFixed(2)}</div>
        <div class="row-3" style="margin-top:.4rem">
          <select data-status-id="${p.id}">
            ${["draft", "ready", "submitted", "approved", "rejected", "invoiced"].map((s) => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <button data-action="set-status" data-id="${p.id}">Aggiorna stato</button>
          <button data-action="delete" data-id="${p.id}" class="danger">Elimina</button>
        </div>
      </li>`;
    })
    .join("") || "<li>Nessun periodo</li>";

  root.querySelector("#period-list").onclick = (ev) => {
    const btn = ev.target.closest("button[data-id]");
    if (!btn) return;
    const period = state.periods.find((p) => p.id === btn.dataset.id);
    if (!period) return;

    if (btn.dataset.action === "delete") {
      state.periods = state.periods.filter((p) => p.id !== period.id);
      addAudit("period", period.id, "deleted");
    } else {
      const nextStatus = root.querySelector(`select[data-status-id='${period.id}']`).value;
      const totals = calcPeriodTotals(period);
      if (nextStatus === "submitted" && totals.billable === 0) {
        const yes = confirm("Periodo a zero fatturabili. Vuoi forzare submit con motivazione?");
        if (!yes) return;
        const reason = prompt("Motivazione override periodo a zero:", "periodo a zero concordato") || "override zero period";
        addAudit("period", period.id, "submit_zero_override", reason);
      }
      if (period.status !== "draft" && nextStatus === "draft") {
        const reason = prompt("Motivo riapertura periodo:", "correzione dati");
        if (!reason) return alert("Motivazione obbligatoria");
        addAudit("period", period.id, "reopened", reason);
      }
      period.status = nextStatus;
      addAudit("period", period.id, `status_${nextStatus}`);
    }
    persist();
    renderAll();
  };
}

function renderReports() {
  const root = document.getElementById("reports");
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3>Genera relazione</h3>
        <form id="report-form">
          <label>Periodo</label>
          <select name="periodId">${state.periods.map((p) => `<option value="${p.id}">${formatDate(p.startDate)} - ${formatDate(p.endDate)} (${getEngagementById(p.engagementId)?.title || "N/A"})</option>`).join("")}</select>
          <label>Introduzione</label><textarea name="cover" placeholder="Sintesi periodo"></textarea>
          <button class="primary" type="submit">Genera preview</button>
        </form>
        <div class="row" style="margin-top:.6rem">
          <button id="exp-html">Export HTML</button>
          <button id="exp-doc">Export DOC (testo)</button>
        </div>
        <div class="row" style="margin-top:.6rem">
          <button id="exp-csv">Export CSV</button>
          <button id="exp-json">Export JSON</button>
        </div>
      </article>
      <article class="card">
        <h3>Preview</h3>
        <pre id="report-preview">Nessuna preview</pre>
      </article>
    </div>
  `;

  let latest = null;
  root.querySelector("#report-form").onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const period = state.periods.find((p) => p.id === fd.get("periodId"));
    if (!period) return;
    const engagement = getEngagementById(period.engagementId);
    const days = state.workdays.filter((w) => w.engagementId === period.engagementId && w.date >= period.startDate && w.date <= period.endDate);
    const visibleDays = days.map((d) => ({ ...d, activities: d.activities.filter((a) => a.includeInExport) }));

    latest = {
      id: id(),
      periodId: period.id,
      createdAt: new Date().toISOString(),
      title: `Relazione ${engagement?.title || "N/A"}`,
      cover: fd.get("cover") || "",
      lines: visibleDays,
      totals: calcPeriodTotals(period),
    };
    state.reports.unshift(latest);
    addAudit("report", latest.id, "generated");
    persist();

    root.querySelector("#report-preview").textContent = [
      latest.title,
      `Periodo: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`,
      `Committente: ${engagement?.clientName || "-"}`,
      `Intro: ${latest.cover}`,
      "",
      ...latest.lines.map((d) => `${d.date}: ${(d.activities || []).map((a) => a.title).join(", ") || "-"}`),
      "",
      `Totale giorni worked: ${latest.totals.worked}`,
      `Totale giorni fatturabili: ${latest.totals.billable}`,
      `Compenso stimato: € ${latest.totals.amount.toFixed(2)}`,
    ].join("\n");
  };

  function requireLatest() {
    if (!latest) {
      alert("Genera prima una preview relazione.");
      return false;
    }
    return true;
  }

  root.querySelector("#exp-html").onclick = () => {
    if (!requireLatest()) return;
    download(`relazione-${latest.periodId}.html`, `<pre>${root.querySelector("#report-preview").textContent}</pre>`, "text/html");
  };
  root.querySelector("#exp-doc").onclick = () => {
    if (!requireLatest()) return;
    download(`relazione-${latest.periodId}.doc`, root.querySelector("#report-preview").textContent, "application/msword");
  };
  root.querySelector("#exp-csv").onclick = () => {
    if (!requireLatest()) return;
    const csv = ["date,activities", ...latest.lines.map((l) => `${l.date},"${l.activities.map((a) => a.title).join(" | ")}"`)].join("\n");
    download(`relazione-${latest.periodId}.csv`, csv, "text/csv");
  };
  root.querySelector("#exp-json").onclick = () => {
    if (!requireLatest()) return;
    download(`relazione-${latest.periodId}.json`, JSON.stringify(latest, null, 2), "application/json");
  };
}

function renderInvoices() {
  const root = document.getElementById("invoices");
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3>Nuova fattura</h3>
        <form id="invoice-form">
          <label>Periodo</label>
          <select name="periodId">${state.periods.map((p) => `<option value="${p.id}">${formatDate(p.startDate)} - ${formatDate(p.endDate)} [${p.status}]</option>`).join("")}</select>
          <div class="row">
            <div><label>Numero fattura</label><input name="invoiceNumber" required></div>
            <div><label>Data fattura</label><input type="date" name="invoiceDate" required></div>
          </div>
          <div class="row-3">
            <div><label>Importo</label><input type="number" name="amount" min="0" step="0.01" required></div>
            <div><label>Termine</label><select name="paymentTermType"><option>DF</option><option>DFFM</option></select></div>
            <div><label>Giorni</label><input type="number" name="paymentTermDays" value="30"></div>
          </div>
          <label>Override motivo (se periodo non approved)</label><input name="overrideReason" />
          <button class="primary" type="submit">Crea fattura</button>
        </form>
      </article>
      <article class="card">
        <h3>Registro fatture</h3>
        <ul class="list" id="invoice-list"></ul>
      </article>
    </div>
  `;

  root.querySelector("#invoice-form").onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const period = state.periods.find((p) => p.id === fd.get("periodId"));
    if (!period) return;
    const overrideReason = String(fd.get("overrideReason") || "").trim();

    if (period.status !== "approved" && !overrideReason) {
      return alert("Periodo non approved: inserire motivazione override.");
    }

    const invoice = {
      id: id(),
      periodId: period.id,
      engagementId: period.engagementId,
      invoiceNumber: fd.get("invoiceNumber"),
      invoiceDate: fd.get("invoiceDate"),
      amount: Number(fd.get("amount")),
      currency: "EUR",
      paymentTermType: fd.get("paymentTermType"),
      paymentTermDays: Number(fd.get("paymentTermDays") || 0),
      computedDueDate: dueDate(fd.get("invoiceDate"), fd.get("paymentTermType"), fd.get("paymentTermDays")),
      status: "prepared",
      notes: overrideReason,
    };

    state.invoices.unshift(invoice);
    period.status = "invoiced";
    addAudit("invoice", invoice.id, "created", overrideReason);
    addAudit("period", period.id, "status_invoiced", overrideReason);
    persist();
    renderAll();
  };

  root.querySelector("#invoice-list").innerHTML = state.invoices
    .map((inv) => {
      const overdue = inv.status !== "paid" && inv.computedDueDate < toISO(new Date());
      const badge = overdue ? "danger" : inv.status === "paid" ? "ok" : "warn";
      return `<li>
        <strong>${inv.invoiceNumber}</strong> - € ${inv.amount.toFixed(2)}
        <span class="badge ${badge}">${overdue ? "overdue" : inv.status}</span>
        <div class="small">Data: ${formatDate(inv.invoiceDate)} · Scadenza: ${formatDate(inv.computedDueDate)} · ${inv.paymentTermType}+${inv.paymentTermDays}</div>
        <div class="row-3" style="margin-top:.4rem">
          <select data-status="${inv.id}">${["prepared", "sent", "paid", "overdue"].map((s) => `<option ${inv.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <button data-update="${inv.id}">Aggiorna stato</button>
          <button data-delete="${inv.id}" class="danger">Elimina</button>
        </div>
      </li>`;
    })
    .join("") || "<li>Nessuna fattura</li>";

  root.querySelector("#invoice-list").onclick = (ev) => {
    const update = ev.target.closest("button[data-update]");
    const del = ev.target.closest("button[data-delete]");
    if (update) {
      const inv = state.invoices.find((i) => i.id === update.dataset.update);
      if (!inv) return;
      inv.status = root.querySelector(`select[data-status='${inv.id}']`).value;
      addAudit("invoice", inv.id, `status_${inv.status}`);
      persist();
      renderAll();
    }
    if (del) {
      const idx = state.invoices.findIndex((i) => i.id === del.dataset.delete);
      if (idx >= 0) {
        addAudit("invoice", state.invoices[idx].id, "deleted");
        state.invoices.splice(idx, 1);
        persist();
        renderAll();
      }
    }
  };
}

function renderDocuments() {
  const root = document.getElementById("documents");
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3>Checklist documenti</h3>
        <form id="doc-form">
          <label>Incarico (opzionale)</label><select name="engagementId"><option value="">Globale</option>${state.engagements.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}</select>
          <div class="row"><div><label>Tipo</label><input name="type" placeholder="NDA, ID, dichiarazione" required></div><div><label>Scadenza</label><input type="date" name="expiry"></div></div>
          <label>Stato</label><select name="status"><option>to_do</option><option>signed</option><option>sent</option><option>accepted</option></select>
          <label>Note/metadata</label><textarea name="metadata"></textarea>
          <button class="primary" type="submit">Aggiungi documento</button>
        </form>
      </article>
      <article class="card">
        <h3>Elenco documenti</h3>
        <ul id="doc-list" class="list"></ul>
      </article>
    </div>
  `;

  root.querySelector("#doc-form").onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const doc = {
      id: id(),
      engagementId: fd.get("engagementId") || null,
      type: fd.get("type"),
      expiry: fd.get("expiry") || null,
      status: fd.get("status"),
      metadata: fd.get("metadata"),
    };
    state.documents.unshift(doc);
    addAudit("document", doc.id, "created");
    persist();
    renderAll();
  };

  root.querySelector("#doc-list").innerHTML = state.documents
    .map((d) => {
      const exp = d.expiry && d.expiry < toISO(new Date()) ? `<span class="badge danger">scaduto</span>` : "";
      return `<li><strong>${d.type}</strong> ${exp}<br><span class="small">${d.status} · ${d.engagementId ? getEngagementById(d.engagementId)?.title || "-" : "globale"} · scad: ${formatDate(d.expiry)}</span></li>`;
    })
    .join("") || "<li>Nessun documento</li>";
}

function renderTravels() {
  const root = document.getElementById("travels");
  root.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3>Nuova trasferta</h3>
        <form id="travel-form">
          <label>Incarico</label><select name="engagementId">${state.engagements.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}</select>
          <div class="row"><div><label>Dal</label><input type="date" name="from" required></div><div><label>Al</label><input type="date" name="to" required></div></div>
          <label>Autorizzazione</label><select name="approval"><option>requested</option><option>approved</option></select>
          <label>Spese (formato: tipo:importo; tipo:importo)</label><input name="expenses" placeholder="treno:120; hotel:300">
          <button class="primary" type="submit">Salva trasferta</button>
        </form>
      </article>
      <article class="card">
        <h3>Elenco trasferte</h3>
        <ul id="travel-list" class="list"></ul>
      </article>
    </div>
  `;

  root.querySelector("#travel-form").onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const items = String(fd.get("expenses") || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((raw) => {
        const [type, amount] = raw.split(":");
        return { type: (type || "spesa").trim(), amount: Number(amount || 0) };
      });
    const travel = {
      id: id(),
      engagementId: fd.get("engagementId"),
      from: fd.get("from"),
      to: fd.get("to"),
      approval: fd.get("approval"),
      items,
    };
    state.travels.unshift(travel);
    addAudit("travel", travel.id, "created");
    persist();
    renderAll();
  };

  root.querySelector("#travel-list").innerHTML = state.travels
    .map((t) => {
      const total = t.items.reduce((s, i) => s + i.amount, 0);
      return `<li><strong>${getEngagementById(t.engagementId)?.title || "-"}</strong><br><span class="small">${formatDate(t.from)} - ${formatDate(t.to)} · ${t.approval} · totale € ${total.toFixed(2)}</span></li>`;
    })
    .join("") || "<li>Nessuna trasferta</li>";
}

function renderAudit() {
  const root = document.getElementById("audit");
  root.innerHTML = `
    <article class="card">
      <h3>Audit trail</h3>
      <ul class="list">
        ${state.auditLogs.slice(0, 200).map((l) => `<li><strong>${l.event}</strong> · ${l.entityType} · ${formatDate(l.ts)}<br><span class="small">${l.reason || "-"}</span></li>`).join("") || "<li>Nessun evento</li>"}
      </ul>
    </article>
  `;
}

function renderSettings() {
  const root = document.getElementById("settings");
  root.innerHTML = `
    <article class="card">
      <h3>Profilo e sicurezza</h3>
      <form id="profile-form">
        <div class="row"><div><label>Nome</label><input name="name" value="${state.profile.name || ""}"></div><div><label>Email</label><input name="email" value="${state.profile.email || ""}"></div></div>
        <div class="row"><div><label>P.IVA</label><input name="vat" value="${state.profile.vat || ""}"></div><div><label>IBAN</label><input name="iban" value="${state.profile.iban || ""}"></div></div>
        <div class="row"><div><label>Lingua</label><input name="language" value="${state.profile.language || "it"}"></div><div><label>Timezone</label><input name="timezone" value="${state.profile.timezone || "Europe/Rome"}"></div></div>
        <label><input type="checkbox" name="pinEnabled" ${state.profile.pinEnabled ? "checked" : ""}> PIN/Biometria richiesta (flag)</label>
        <button class="primary" type="submit">Salva impostazioni</button>
      </form>
    </article>
  `;
  root.querySelector("#profile-form").onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    state.profile = {
      name: fd.get("name"),
      email: fd.get("email"),
      vat: fd.get("vat"),
      iban: fd.get("iban"),
      language: fd.get("language"),
      timezone: fd.get("timezone"),
      pinEnabled: fd.get("pinEnabled") === "on",
    };
    addAudit("profile", "self", "updated");
    persist();
    alert("Impostazioni salvate");
  };
}

function setupBackupRestore() {
  document.getElementById("export-backup-btn").onclick = () => {
    download(`timesheetapp-backup-${toISO(new Date())}.json`, JSON.stringify(state, null, 2), "application/json");
  };

  document.getElementById("restore-input").onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, { ...structuredClone(initialState), ...data });
      addAudit("system", "restore", "backup_restored");
      persist();
      renderAll();
      alert("Backup ripristinato con successo");
    } catch {
      alert("File JSON non valido");
    }
  };
}

function renderAll() {
  renderDashboard();
  renderEngagements();
  renderCalendar();
  renderPeriods();
  renderReports();
  renderInvoices();
  renderDocuments();
  renderTravels();
  renderAudit();
  renderSettings();
}

renderTabs();
setupMenuToggle();
setupBackupRestore();
renderAll();
setActiveTab("dashboard");
