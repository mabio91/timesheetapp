# TimeSheetApp - WebApp completa (offline-first)

Questa repository ora include una **webapp completa e testabile end-to-end** in `docs/`, progettata per coprire il flusso completo richiesto per consulenti esterni:

- gestione incarichi (regole contract-driven, duplicazione, stato)
- inserimento giornate e attività
- modifica incarichi/giornate esistenti
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
- view calendario mensile con evidenza lavorative/non lavorative e soli festivi italiani 2026-2027 configurati

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

## iOS nativa (SwiftUI) - avvio locale

È stato aggiunto uno scaffold nativo in `ios/TimeSheetAppiOS` con:

- App SwiftUI (`TimeSheetAppiOSApp`)
- Store offline-first locale con persistenza JSON in Documents
- Modelli dominio (incarichi, giornate, audit)
- Edit completo incarichi/giornate
- Calendario mensile con festivi italiani 2026-2027 (lista esplicita)

### Come provarla in locale (macOS)

1. Apri Xcode.
2. Crea un nuovo progetto iOS App chiamato `TimeSheetAppiOS` (SwiftUI).
3. Copia dentro il progetto i file da `ios/TimeSheetAppiOS/` mantenendo la struttura cartelle.
4. Imposta target iOS 17+ (consigliato).
5. Esegui su simulatore iPhone.

> Nota: in questo ambiente Linux non è disponibile Xcode, quindi non posso compilare/eseguire direttamente il target iOS, ma il codice SwiftUI è pronto per integrazione locale su Mac.
