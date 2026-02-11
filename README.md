# TimeSheetApp - WebApp completa (offline-first)

Questa repository ora include una **webapp completa e testabile end-to-end** in `docs/`, progettata per coprire il flusso completo richiesto per consulenti esterni:

- gestione incarichi (regole contract-driven, duplicazione, stato)
- inserimento giornate e attività
- generazione periodi automatica (mensile/bimestrale/trimestrale + anchor)
- workflow stati periodo (draft/ready/submitted/approved/rejected/invoiced)
- generazione relazione con preview + export HTML/DOC/CSV/JSON
- registro fatture con scadenza DF/DFFM + stati pagamento
- documenti/checklist
- trasferte e spese
- audit trail completo
- backup/restore JSON
- dashboard fatturazione avanzata (giornate fatturate, guadagno e giornate rimanenti)
- menù laterale dedicato per navigazione più pulita

## Avvio rapido (100% locale)

```bash
python -m http.server 4173
```

Apri: `http://127.0.0.1:4173/docs/`

La webapp è completamente offline-first: salva dati in `localStorage` e funziona senza backend.

## Deploy su GitHub Pages

1. Push su GitHub.
2. In `Settings > Pages`, seleziona branch e cartella `/docs`.
3. Apri l'URL Pages generato.

## Nota su backend API

Nel repo è presente anche una base backend FastAPI (`app/`) utile per evoluzione architetturale e successiva conversione iOS native con sync server.

## Roadmap verso iOS nativa

Con questa base puoi:
1. validare UX e regole di business nella webapp;
2. stabilizzare model/use-case;
3. implementare client iOS nativo (MVVM/Clean) mantenendo stesse regole;
4. introdurre sync online/offline con backend esistente o evoluto.
