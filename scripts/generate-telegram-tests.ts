#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import readline from 'readline';

// Создаем интерфейс для чтения ввода пользователя
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Функция для запроса ввода от пользователя
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Функция для преобразования имени файла в имя класса
function fileNameToClassName(fileName: string): string {
  return fileName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// Функция для создания директории, если она не существует
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Шаблон для теста обработчика входа в сцену
function generateEnterHandlerTest(sceneName: string, sceneFileName: string): string {
  return `import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { SceneTester, generateEnterHandlerTests } from "../../../__tests__/helpers/telegram";
import { ${sceneName} } from "../../../scenes/${sceneFileName}";

describe("${sceneName} - Enter Handler", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "${sceneName}",
    sceneFilePath: "../../../scenes/${sceneFileName}",
    sceneConstructor: ${sceneName}
  });

  // Генерируем тесты для обработчика входа в сцену
  generateEnterHandlerTests(sceneTester);

  // Дополнительные тесты можно добавить здесь
});`;
}

// Шаблон для теста обработчиков действий
function generateActionHandlerTest(sceneName: string, sceneFileName: string, actionName: string): string {
  return `import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { SceneTester, generateActionHandlerTests } from "../../../__tests__/helpers/telegram";
import { ${sceneName} } from "../../../scenes/${sceneFileName}";

describe("${sceneName} - Action Handlers", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "${sceneName}",
    sceneFilePath: "../../../scenes/${sceneFileName}",
    sceneConstructor: ${sceneName}
  });

  // Генерируем тесты для обработчика действия
  generateActionHandlerTests(
    sceneTester,
    "handle${actionName}Action" as keyof ${sceneName},
    "${actionName.toLowerCase()}"
  );

  // Дополнительные тесты для других обработчиков действий можно добавить здесь
});`;
}

// Шаблон для теста обработчиков текстовых сообщений
function generateTextHandlerTest(sceneName: string, sceneFileName: string, stepName: string): string {
  return `import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { SceneTester, generateTextHandlerTests } from "../../../__tests__/helpers/telegram";
import { ${sceneName} } from "../../../scenes/${sceneFileName}";
import { ScraperSceneStep } from "../../../types";

describe("${sceneName} - Text Input Handler", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "${sceneName}",
    sceneFilePath: "../../../scenes/${sceneFileName}",
    sceneConstructor: ${sceneName}
  });

  // Генерируем тесты для обработчика текстовых сообщений
  generateTextHandlerTests(
    sceneTester,
    "handle${sceneName}Text" as keyof ${sceneName},
    "${stepName}",
    ScraperSceneStep.${stepName}
  );

  // Дополнительные тесты можно добавить здесь
});`;
}

// Шаблон для теста последовательности действий
function generateSequenceTest(sceneName: string, sceneFileName: string): string {
  return `import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { SceneTester, SceneSequenceTester, expectSceneStep, expectMessageContaining } from "../../../__tests__/helpers/telegram";
import { ${sceneName} } from "../../../scenes/${sceneFileName}";
import { ScraperSceneStep } from "../../../types";

describe("${sceneName} - Sequence Test", () => {
  it("должен обрабатывать полную последовательность действий", async () => {
    // Создаем тестер сцены
    const sceneTester = new SceneTester({
      sceneName: "${sceneName}",
      sceneFilePath: "../../../scenes/${sceneFileName}",
      sceneConstructor: ${sceneName}
    });

    // Настраиваем моки
    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true }),
      // Добавьте другие необходимые моки
    });

    // Создаем тестер последовательностей
    const sequenceTester = new SceneSequenceTester(sceneTester);

    // Добавляем шаги в последовательность
    sequenceTester
      .addSceneEnter(
        "Вход в сцену",
        "enterHandler",
        {},
        (tester) => {
          // Добавьте проверки для первого шага
          expectMessageContaining(tester.getContext(), "Добро пожаловать");
        }
      )
      // Добавьте другие шаги последовательности

    // Запускаем последовательность
    await sequenceTester.run();
  });
});`;
}

// Функция для генерации тестов
async function generateTest(
  template: string,
  outputPath: string
): Promise<void> {
  // Создаем директорию для выходного файла, если она не существует
  ensureDirectoryExists(path.dirname(outputPath));

  // Записываем сгенерированный тест в файл
  fs.writeFileSync(outputPath, template);

  console.log(`Тест успешно сгенерирован: ${outputPath}`);

  // Форматируем файл с помощью prettier
  try {
    spawnSync('bunx', ['prettier', '--write', outputPath], { stdio: 'inherit' });
    console.log(`Файл отформатирован с помощью prettier: ${outputPath}`);
  } catch (error) {
    console.warn(`Не удалось отформатировать файл с помощью prettier: ${error}`);
  }
}

// Основная функция для генерации тестов
async function main(): Promise<void> {
  console.log('🧪 Генератор тестов для Telegram-сцен 🧪');
  console.log('----------------------------------------');
  console.log('Используется фреймворк для тестирования Telegram-сцен из src/__tests__/helpers/telegram');

  // Запрашиваем имя файла сцены
  const sceneFileName = await prompt('Введите имя файла сцены (например, project-scene): ');

  // Проверяем, существует ли файл сцены
  const sceneFilePath = path.join(process.cwd(), 'src', 'scenes', `${sceneFileName}.ts`);
  if (!fs.existsSync(sceneFilePath)) {
    console.error(`Файл сцены не найден: ${sceneFilePath}`);
    rl.close();
    return;
  }

  // Получаем имя класса сцены
  const sceneClassName = fileNameToClassName(sceneFileName);

  // Запрашиваем, какие типы тестов нужно сгенерировать
  console.log('\nВыберите типы тестов для генерации:');
  console.log('1. Тесты для обработчика входа в сцену');
  console.log('2. Тесты для обработчиков действий');
  console.log('3. Тесты для обработчиков текстовых сообщений');
  console.log('4. Тесты для последовательности действий');
  console.log('5. Все типы тестов');

  const testTypesInput = await prompt('Введите номера типов тестов через запятую (например, 1,2,3): ');
  const testTypes = testTypesInput.split(',').map(type => type.trim());

  // Определяем, какие типы тестов нужно сгенерировать
  const generateEnterTests = testTypes.includes('1') || testTypes.includes('5');
  const generateActionTests = testTypes.includes('2') || testTypes.includes('5');
  const generateTextTests = testTypes.includes('3') || testTypes.includes('5');
  const generateSequenceTests = testTypes.includes('4') || testTypes.includes('5');

  // Генерируем тесты для обработчика входа в сцену
  if (generateEnterTests) {
    const enterTestPath = path.join(
      process.cwd(),
      'src',
      '__tests__',
      'unit',
      'scenes',
      `${sceneFileName}-enter.test.ts`
    );

    await generateTest(
      generateEnterHandlerTest(sceneClassName, sceneFileName),
      enterTestPath
    );
  }

  // Генерируем тесты для обработчиков действий
  if (generateActionTests) {
    const actionTestPath = path.join(
      process.cwd(),
      'src',
      '__tests__',
      'unit',
      'scenes',
      `${sceneFileName}-actions.test.ts`
    );

    // Запрашиваем имя действия
    const actionName = await prompt('Введите имя действия (например, CreateProject): ');

    await generateTest(
      generateActionHandlerTest(sceneClassName, sceneFileName, actionName),
      actionTestPath
    );
  }

  // Генерируем тесты для обработчиков текстовых сообщений
  if (generateTextTests) {
    const textTestPath = path.join(
      process.cwd(),
      'src',
      '__tests__',
      'unit',
      'scenes',
      `${sceneFileName}-ontext.test.ts`
    );

    // Запрашиваем имя шага
    const stepName = await prompt('Введите имя шага (например, CREATE_PROJECT): ');

    await generateTest(
      generateTextHandlerTest(sceneClassName, sceneFileName, stepName),
      textTestPath
    );
  }

  // Генерируем тесты для последовательности действий
  if (generateSequenceTests) {
    const sequenceTestPath = path.join(
      process.cwd(),
      'src',
      '__tests__',
      'unit',
      'scenes',
      `${sceneFileName}-sequence.test.ts`
    );

    await generateTest(
      generateSequenceTest(sceneClassName, sceneFileName),
      sequenceTestPath
    );
  }

  console.log('\n✅ Генерация тестов завершена!');
  rl.close();
}

// Запускаем основную функцию
main().catch(error => {
  console.error('Произошла ошибка:', error);
  rl.close();
});
