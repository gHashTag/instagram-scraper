#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import readline from 'readline';

// Добавляем комментарий для TypeScript, чтобы игнорировать ошибки типов в шаблонах
// @ts-ignore

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

// Функция для генерации тестов на основе шаблона
async function generateTest(
  templatePath: string,
  outputPath: string,
  replacements: Record<string, string>
): Promise<void> {
  // Проверяем, существует ли шаблон
  if (!fs.existsSync(templatePath)) {
    console.error(`Шаблон не найден: ${templatePath}`);
    return;
  }

  // Читаем содержимое шаблона
  let templateContent = fs.readFileSync(templatePath, 'utf-8');

  // Заменяем плейсхолдеры на реальные значения
  for (const [key, value] of Object.entries(replacements)) {
    templateContent = templateContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Создаем директорию для выходного файла, если она не существует
  ensureDirectoryExists(path.dirname(outputPath));

  // Записываем сгенерированный тест в файл
  fs.writeFileSync(outputPath, templateContent);

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
  console.log('4. Все типы тестов');

  const testTypesInput = await prompt('Введите номера типов тестов через запятую (например, 1,2,3): ');
  const testTypes = testTypesInput.split(',').map(type => type.trim());

  // Определяем, какие типы тестов нужно сгенерировать
  const generateEnterTests = testTypes.includes('1') || testTypes.includes('4');
  const generateActionTests = testTypes.includes('2') || testTypes.includes('4');
  const generateTextTests = testTypes.includes('3') || testTypes.includes('4');

  // Базовые замены для всех шаблонов
  const baseReplacements = {
    SCENE_NAME: sceneClassName,
    SCENE_FILE_NAME: sceneFileName,
  };

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
      path.join(process.cwd(), 'scripts', 'templates', 'tests', 'scene-enter-handler.template.txt'),
      enterTestPath,
      baseReplacements
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
      path.join(process.cwd(), 'scripts', 'templates', 'tests', 'scene-actions.template.txt'),
      actionTestPath,
      { ...baseReplacements, ACTION_NAME: actionName }
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
      path.join(process.cwd(), 'scripts', 'templates', 'tests', 'scene-ontext.template.txt'),
      textTestPath,
      { ...baseReplacements, STEP_NAME: stepName }
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
