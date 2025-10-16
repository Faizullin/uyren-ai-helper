#!/bin/sh
set -e

# Function to wait for database
wait_for_db() {
    echo "⏳ Waiting for database connection..."
    until pnpm run db:health 2>/dev/null; do
        echo "Database not ready, waiting..."
        sleep 2
    done
    echo "✅ Database is ready!"
}

# Handle different commands
case "$1" in
    "server")
        echo "🚀 Starting web server..."
        exec node apps/web/server.js
        ;;
    "seed")
        echo "🌱 Running database seed..."
        wait_for_db
        exec pnpm run seed
        ;;
    "migrate")
        echo "🔄 Running database migrations..."
        wait_for_db
        exec pnpm run migrate
        ;;
    "health")
        echo "🏥 Running health check..."
        exec pnpm run health
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Available commands: server, seed, migrate, health"
        exit 1
        ;;
esac
