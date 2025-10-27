# Uyren AI Helper - Backend

FastAPI backend with Supabase (PostgreSQL) and Redis.

## Requirements

- [Docker](https://www.docker.com/)
- [Supabase Account](https://supabase.com)

## Quick Setup

1. **Configure environment**
   ```bash
   cp example.env .env
   # Edit .env with your Supabase credentials
   ```

2. **Start services**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. **Setup database** (first time only)
   ```bash
   # Run migrations
   docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head
   
   # Create initial admin user
   docker-compose -f docker-compose.dev.yml exec backend python app/initial_data.py
   ```

4. **Access**
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - Redis: localhost:6379

## Docker Development

### Start Services
```bash
docker-compose -f docker-compose.dev.yml up
```

### Stop Services
```bash
docker-compose -f docker-compose.dev.yml down
```

### View Logs
```bash
docker-compose -f docker-compose.dev.yml logs -f backend
```

### Execute Commands in Container
```bash
# Open bash shell
docker-compose -f docker-compose.dev.yml exec backend bash

# Run migrations
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head

# Create migration
docker-compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "description"

# Create initial data
docker-compose -f docker-compose.dev.yml exec backend python app/initial_data.py
```

### Rebuild After Dependency Changes
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Database Migrations

### Setup Vector Store (First Time Only)

Before running migrations, enable pgvector in **Supabase SQL Editor**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS vector_store;
GRANT USAGE ON SCHEMA vector_store TO postgres, service_role;
```

### Create Migration
```bash
docker-compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "Add new model"
```

### Apply Migrations
```bash
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

### Rollback Migration
```bash
docker-compose -f docker-compose.dev.yml exec backend alembic downgrade -1
```

## Project Structure

```
backend/
├── app/
│   ├── api/            # API routes
│   ├── core/           # Config, DB, Security, Redis, Supabase
│   ├── alembic/        # Database migrations
│   ├── models.py       # SQLModel models
│   ├── crud.py         # CRUD operations
│   └── main.py         # FastAPI app
├── scripts/            # Utility scripts
├── docker-compose.dev.yml
├── Dockerfile
└── example.env
```

## Environment Variables

See `example.env` for all configuration options. Required:

```env
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
SECRET_KEY=your_secret_key
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=changethis
```

## Technology Stack

- **Framework**: FastAPI
- **Database**: Supabase (PostgreSQL)
- **ORM**: SQLModel
- **Cache**: Redis
- **Auth**: JWT
- **Package Manager**: uv

## Docker Deployment

_Coming soon_

## Docker Hosting

_Coming soon_
