#!/bin/bash

# Скрипт для запуска Instagram Scraper Bot в режиме разработки
echo "🚀 Запуск Instagram Scraper Bot в режиме разработки..."
echo "📝 Логи будут выводиться ниже. Для остановки бота нажмите Ctrl+C"
echo "-----------------------------------------------------------"

# Проверяем наличие Bun
if command -v bun &> /dev/null; then
    echo "✅ Bun найден, запускаем с помощью Bun..."
    bun run scripts/run-bot.ts
elif command -v npx &> /dev/null; then
    echo "⚠️ Bun не найден, но найден NPX. Запускаем с помощью TSX..."
    echo "⚠️ Примечание: Для полной совместимости рекомендуется установить Bun:"
    echo "⚠️ curl -fsSL https://bun.sh/install | bash"
    echo "-----------------------------------------------------------"

    # Проверяем, установлен ли tsx
    if ! npx tsx --version &> /dev/null; then
        echo "🔄 TSX не установлен. Устанавливаем..."
        npm install -g tsx
    fi

    npx tsx scripts/run-bot.ts
elif command -v docker &> /dev/null; then
    echo "⚠️ Bun и Node.js не найдены, но найден Docker. Запускаем с помощью Docker..."
    echo "⚠️ Примечание: Для полной совместимости рекомендуется установить Bun:"
    echo "⚠️ curl -fsSL https://bun.sh/install | bash"
    echo "-----------------------------------------------------------"

    # Проверяем наличие образа
    if ! docker images | grep -q "instagram-scraper-bot"; then
        echo "🔄 Образ не найден, создаем временный Dockerfile..."
        cat > Dockerfile.temp << EOF
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "scripts/run-bot.ts"]
EOF
        echo "🔄 Собираем Docker-образ..."
        docker build -t instagram-scraper-bot -f Dockerfile.temp .
        rm Dockerfile.temp
    fi

    echo "🔄 Запускаем контейнер..."
    docker run --rm -it -v $(pwd):/app instagram-scraper-bot
else
    echo "❌ Ни Bun, ни Node.js, ни Docker не найдены."
    echo "❌ Пожалуйста, установите Bun для запуска бота:"
    echo "❌ curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
