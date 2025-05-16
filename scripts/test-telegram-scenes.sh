#!/bin/bash

# Скрипт для запуска тестов Telegram сцен

# Цвета для вывода
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}🧪 Запуск тестов для Telegram сцен...${NC}"

# Запуск тестов для Telegram сцен
bun test 'src/__tests__/unit/scenes' 'src/__tests__/unit/components' 'src/__tests__/examples' 'src/__tests__/framework/tests' --no-cache

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Тесты для Telegram сцен не пройдены. Исправьте ошибки и попробуйте снова.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Тесты для Telegram сцен пройдены успешно.${NC}"
exit 0
