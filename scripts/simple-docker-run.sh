#!/bin/bash

echo "Запуск бота через Docker..."
docker run -it --rm -v "$(pwd):/app" -w /app oven/bun:latest bun run scripts/run-bot.ts
