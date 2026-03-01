# DrawTform

Next.js full-stack app to **upload a folder of Terraform modules** (as a zip), parse them, and **visualize module/resource dependencies** as a DAG (Directed Acyclic Graph) from env (e.g. prod/staging/main) down to providers. The backend stores the graph in **PostgreSQL** using **Prisma** with migrations; the UI shows each node with **thumbnails** (e.g. AWS RDS, GCP Cloud SQL).

## Stack

- **Next.js** (App Router, latest)
- **PostgreSQL** + **Prisma** (migrations)
- **Common DTOs** in `common/` for API contracts (BE/FE)
- **DAG** for Terraform dependency structure
- **React Flow** for the canvas; custom nodes with resource thumbnails

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Database (PostgreSQL via Docker Compose)**

   - Start Postgres:

     ```bash
     docker compose up -d
     ```

   - Copy env and use the URL that matches `docker-compose.yml`:

     ```bash
     cp .env.example .env
     ```

     `.env.example` already has:

     `DATABASE_URL="postgresql://drawtform:drawtform@localhost:5432/drawtform"`

   - Run migrations:

     ```bash
     npx prisma migrate deploy
     ```

     Or for development (creates migration if needed):

     ```bash
     npx prisma migrate dev
     ```

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Commands to run the app (quick reference)

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Copy env (DATABASE_URL already set for Docker Postgres)
cp .env.example .env

# 4. Apply migrations
npx prisma migrate deploy

# 5. Start the Next.js app
npm run dev
```

Then open **http://localhost:3000**.

## Usage

1. **Upload**: Zip a folder containing `.tf` files (e.g. `terraform-modules.zip`). Optionally set an environment name (e.g. `prod`, `staging`, `main`).
2. **View graph**: After upload, the app shows the dependency graph: env → modules → resources → providers, with thumbnails (e.g. AWS RDS, GCP Cloud SQL, generic module/provider).
3. **Saved graphs**: Use “Load saved graphs” and the dropdown to open a previously uploaded graph.

## Project structure

- `common/dto/` – Shared API types and DTOs (upload, graph, types).
- `prisma/` – Schema and migrations (Graph, GraphNode, GraphEdge).
- `src/app/api/` – API routes: `POST /api/upload`, `GET /api/graphs`, `GET /api/graph/[id]`.
- `src/lib/` – Terraform parser, DAG builder, thumbnail mapping, Prisma client.
- `src/components/` – Upload UI, graph canvas (React Flow), resource thumbnail component.

## Scripts

- `npm run dev` – Start dev server (Turbopack).
- `npm run build` – Production build.
- `npm run start` – Start production server.
- `npx prisma migrate dev` – Apply/create migrations (dev).
- `npx prisma migrate deploy` – Apply migrations (production).
- `npx prisma generate` – Regenerate Prisma client.
