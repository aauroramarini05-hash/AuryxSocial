# AuryxSocial

AuryxSocial è un esempio completo di social network con API REST e chat in tempo reale costruito con [FastAPI](https://fastapi.tiangolo.com/).

## Funzionalità principali

- Registrazione e login utenti con token JWT
- Profili pubblici, follow/unfollow e suggerimenti
- Creazione post con feed globale, like e commenti
- Chat in tempo reale con conversazioni multiutente e gestione partecipanti
- Stato "sta scrivendo", conferma di lettura e notifiche in tempo reale via WebSocket

## Avvio rapido

1. Installare le dipendenze (si consiglia un virtual environment):
   ```bash
   pip install -r requirements.txt
   ```
2. Avviare il server di sviluppo:
   ```bash
   uvicorn app.main:app --reload
   ```
3. Aprire la documentazione interattiva:
   - Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

Il database SQLite `social.db` verrà creato automaticamente alla prima esecuzione.

## Struttura del progetto

- `app/main.py`: entrypoint FastAPI
- `app/models.py`: modelli SQLAlchemy
- `app/schemas.py`: schemi Pydantic
- `app/routes/`: router modulari per autenticazione, utenti, post e chat
- `app/chat_manager.py`: gestione connessioni WebSocket e messaggi in tempo reale

## Testing

Per eseguire i test manuali si consiglia di utilizzare la Swagger UI o strumenti come `httpie` / `curl`.

## Licenza

Distribuito secondo la licenza MIT (vedi `LICENSE`).
