#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Запуск тестов для обработчика кнопок...${NC}"

# Запуск тестов
bun test src/__tests__/utils/button-handler.test.ts

# Получение статуса выполнения тестов
TEST_STATUS=$?

# Вывод результатов
if [ $TEST_STATUS -eq 0 ]; then
    echo -e "${GREEN}Тесты успешно пройдены.${NC}"
    exit 0
else
    echo -e "${RED}Тесты завершились с ошибками.${NC}"
    exit 1
fi
