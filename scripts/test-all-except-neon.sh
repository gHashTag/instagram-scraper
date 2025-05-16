#!/bin/bash

# Скрипт для запуска всех тестов, кроме тестов для neon-adapter

# Цвета для вывода
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}🧪 Запуск всех тестов, кроме тестов для neon-adapter...${NC}"

# Запуск всех тестов, кроме тестов для neon-adapter
bun test 'src/__tests__/unit/scenes' 'src/__tests__/unit/utils' 'src/__tests__/unit/components' 'src/__tests__/framework/tests' 'src/__tests__/integration/bot-integration.test.ts' 'src/__tests__/integration/bot-adapter-integration.test.ts' 'src/__tests__/unit/index.test.ts' --no-cache

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Тесты не пройдены. Исправьте ошибки и попробуйте снова.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Тесты пройдены успешно.${NC}"
exit 0
