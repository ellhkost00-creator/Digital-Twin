# Digital Twin Lab

A web-based Digital Twin platform for power-network simulation using SimBench and OpenDSS/pandapower networks.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.10+ | Backend & simulation pipeline |
| Node.js | 18+ | Frontend 
| Docker Desktop | latest | Runs the PostgreSQL database |

---

## 1 — Start the Database (Docker)

The backend requires a PostgreSQL instance. The easiest way is Docker.

**Start PostgreSQL:**
```bash
docker run -d \
  --name dtlab-postgres \
  -e POSTGRES_USER=simbench \
  -e POSTGRES_PASSWORD=simbench \
  -e POSTGRES_DB=simbench \
  -p 5432:5432 \
  postgres:16
```

> The database URL used by the backend is:
> `postgresql+psycopg2://simbench:simbench@localhost:5432/simbench`
> This matches the default in `simbench-backend/.env`. Change it there if needed.

---

## 2 — Backend

### Install dependencies

```bash
cd simbench-backend
pip install -r requirements.txt
```

`requirements.txt` includes:
- `fastapi`, `uvicorn` — API server
- `simbench`, `pandapower` — power network simulation
- `sqlalchemy`, `psycopg2-binary` — PostgreSQL ORM
- `python-jose[cryptography]`, `bcrypt`, `python-multipart` — authentication

### Configure environment

The file `simbench-backend/.env` already contains the default database URL:

```env
DATABASE_URL=postgresql+psycopg2://simbench:simbench@localhost:5432/simbench
```

Edit it if your database credentials differ.

### Run the backend

```bash
cd simbench-backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**.  
Interactive docs: **http://localhost:8000/docs**

On first startup the backend automatically:
- Creates all database tables
- Seeds the default networks and users

---

## 3 — Frontend

### Install dependencies

```bash
cd digital-twin-lab
npm install
```

### Run the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:8080** (or the port printed in the terminal).

### Build for production


---



```
1. docker run ← PostgreSQL
2. uvicorn main:app --reload --host 0.0.0.0 --port 8000     ← Backend  (http://localhost:8000)
3. npm run dev             ← Frontend (http://localhost:8080)
```


