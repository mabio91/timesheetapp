# TimeSheetApp

Implementazione iniziale del prodotto con due componenti:

1. **Backend API (FastAPI + SQLAlchemy)** per dominio e workflow contract-driven.
2. **Frontend Lite statico (`docs/`)** pubblicabile su GitHub Pages per test rapido UX offline-first.

## Stato rispetto alla richiesta

Non è ancora il prodotto completo end-to-end di tutte le sezioni richieste (documenti, trasferte, export PDF/DOCX avanzati, iOS), ma ora include il nucleo operativo richiesto per iniziare in modo strutturato:

- Domain model e CRUD per incarichi, giornate, attività, periodi.
- Generazione periodi automatica in base a frequenza/anchor.
- Regole hard principali: blocco weekend, max giornate billable.
- Workflow stato periodo con audit log e vincolo periodo a zero.
- Registro fatture con scadenza `DF/DFFM` e blocco fatturazione senza approvazione (override motivato).
- Demo web statica testabile da GitHub Pages.

## Backend - avvio locale

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Frontend Lite (GitHub Pages)

La cartella `docs/` contiene una mini-webapp offline-first con `localStorage`.

- In locale:

```bash
python -m http.server 4173
```

poi apri `http://127.0.0.1:4173/docs/`.

- Su GitHub Pages: abilita Pages sulla branch e directory `/docs`.

> Nota: la demo `docs/` è autonoma (no backend) e serve a testare rapidamente inserimento/riepilogo. Per workflow completo usare API backend.

## Endpoint principali aggiunti

- `POST /engagements/{id}/periods/generate?through_date=YYYY-MM-DD`
- `POST /periods/{id}/status`
- `POST /invoices`
- `GET /invoices`
- `GET /audit-logs`

## Prossimi step consigliati

1. UI web completa (dashboard + calendario + periodo + fatture collegate alle API).
2. Export report (HTML template + PDF/DOCX lato server).
3. Modulo documenti/checklist + allegati.
4. Trasferte/rimborsi.
5. Client iOS offline-first con sync sulle stesse API.
