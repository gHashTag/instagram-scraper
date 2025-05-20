#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1${NC}"
}

log_info "🚀 Запуск Instagram Scraper Bot в режиме разработки..."
log_info "Текущая директория: $(pwd)"

# Проверка наличия файла .env
if [ -f .env ]; then
    log_info "Файл .env найден"
else
    log_warning "Файл .env не найден. Создаем пустой файл .env."
    touch .env
fi

# Проверка наличия файла run-bot.ts
if [ -f scripts/run-bot.ts ]; then
    log_info "Файл run-bot.ts найден"
else
    log_error "Файл scripts/run-bot.ts не найден. Проверьте структуру проекта."
    exit 1
fi

log_info "Запуск бота..."

# Запуск бота с помощью npx
npx tsx scripts/run-bot.ts

# Проверка кода возврата
if [ $? -eq 0 ]; then
    log_success "✅ Бот успешно запущен"
else
    log_error "❌ Бот остановлен с ошибкой (код возврата: $?)"
fi
