# TimeSheetApp (bootstrap)

Prima base tecnica per il prodotto descritto: API FastAPI con domain model iniziale per:

- Engagement/Incarichi
- WorkDay/Giornate
- Activity/Attività
- ReportingPeriod/Periodi

## Avvio locale

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Cosa include questa iterazione

- Schema SQLAlchemy per le entità principali richieste nel primo blocco di sviluppo.
- CRUD iniziale per engagement, workdays, activities, periods.
- Prime regole contract-driven:
  - blocco weekend quando `weekend_allowed = false`.
  - blocco superamento `max_billable_days`.
- Calcolo `total_worked_days`, `total_billable_days`, `amount_estimated` su creazione periodo.

## Prossimi step

1. Calcolo automatico periodi in base a frequenza e ancoraggio.
2. Workflow stati periodo con audit trail.
3. Modulo fatture (DF/DFFM) e reminder.
4. UI web (dashboard, calendario, periodo).
