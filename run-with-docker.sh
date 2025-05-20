#!/bin/bash

# Скрипт для запуска Instagram Scraper Bot с помощью Docker
echo "🚀 Запуск Instagram Scraper Bot с помощью Docker..."
echo "📝 Логи будут выводиться ниже. Для остановки бота нажмите Ctrl+C"
echo "-----------------------------------------------------------"

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не найден. Пожалуйста, установите Docker:"
    echo "❌ https://docs.docker.com/get-docker/"
    exit 1
fi

# Проверяем наличие docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не найден. Пожалуйста, установите Docker Compose:"
    echo "❌ https://docs.docker.com/compose/install/"
    exit 1
fi

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "⚠️ Файл .env не найден. Создаем его из .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Файл .env создан из .env.example"
    else
        echo "❌ Файл .env.example не найден. Пожалуйста, создайте файл .env вручную."
        exit 1
    fi
fi

# Запускаем бота с помощью Docker Compose
echo "🔄 Запускаем бота с помощью Docker Compose..."
docker-compose up --build
