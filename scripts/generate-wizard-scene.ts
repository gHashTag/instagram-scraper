#!/usr/bin/env bun

/**
 * Скрипт для генерации новой Wizard-сцены на основе шаблона
 * 
 * Использование:
 * bun run scripts/generate-wizard-scene.ts <имя-сцены>
 * 
 * Пример:
 * bun run scripts/generate-wizard-scene.ts my-feature
 * 
 * Результат:
 * Создаст файл src/scenes/my-feature-wizard-scene.ts на основе шаблона
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для преобразования строки в PascalCase
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Функция для преобразования строки в camelCase
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Функция для преобразования строки в snake_case
function toSnakeCase(str: string): string {
  return str.replace(/-/g, '_');
}

// Функция для преобразования строки в UPPER_SNAKE_CASE
function toUpperSnakeCase(str: string): string {
  return toSnakeCase(str).toUpperCase();
}

// Функция для генерации новой Wizard-сцены
async function generateWizardScene(sceneName: string): Promise<void> {
  // Проверяем, что имя сцены задано
  if (!sceneName) {
    console.error('Ошибка: Не указано имя сцены');
    console.log('Использование: bun run scripts/generate-wizard-scene.ts <имя-сцены>');
    process.exit(1);
  }

  // Формируем имена для различных частей сцены
  const pascalCaseName = toPascalCase(sceneName);
  const camelCaseName = toCamelCase(sceneName);
  const snakeCaseName = toSnakeCase(sceneName);
  const upperSnakeCaseName = toUpperSnakeCase(sceneName);
  
  // Пути к файлам
  const templatePath = path.join(__dirname, '..', 'src', 'templates', 'wizard-scene-template.ts');
  const outputPath = path.join(__dirname, '..', 'src', 'scenes', `${sceneName}-wizard-scene.ts`);
  
  // Проверяем, существует ли шаблон
  if (!fs.existsSync(templatePath)) {
    console.error(`Ошибка: Шаблон не найден по пути ${templatePath}`);
    process.exit(1);
  }
  
  // Проверяем, существует ли уже файл с таким именем
  if (fs.existsSync(outputPath)) {
    console.error(`Ошибка: Файл ${outputPath} уже существует`);
    process.exit(1);
  }
  
  // Читаем шаблон
  let templateContent = fs.readFileSync(templatePath, 'utf-8');
  
  // Заменяем все вхождения шаблонных имен на реальные
  templateContent = templateContent
    .replace(/TemplateWizardScene/g, `${pascalCaseName}WizardScene`)
    .replace(/template_wizard/g, `${snakeCaseName}_wizard`)
    .replace(/\[TemplateWizard\]/g, `[${pascalCaseName}Wizard]`)
    .replace(/TEMPLATE_STEP_1/g, `${upperSnakeCaseName}_STEP_1`)
    .replace(/TEMPLATE_STEP_2/g, `${upperSnakeCaseName}_STEP_2`)
    .replace(/setupTemplateWizard/g, `setup${pascalCaseName}Wizard`)
    .replace(/\/template/g, `/${snakeCaseName}`)
    .replace(/'Шаблон'/g, `'${pascalCaseName}'`)
    .replace(/\[описание функциональности\]/g, `${sceneName}`);
  
  // Записываем результат в новый файл
  fs.writeFileSync(outputPath, templateContent);
  
  console.log(`✅ Wizard-сцена успешно создана: ${outputPath}`);
  
  // Проверяем, нужно ли добавить новые шаги в ScraperSceneStep
  const typesPath = path.join(__dirname, '..', 'src', 'types.ts');
  
  if (fs.existsSync(typesPath)) {
    let typesContent = fs.readFileSync(typesPath, 'utf-8');
    
    // Проверяем, есть ли уже шаги для этой сцены
    if (!typesContent.includes(`${upperSnakeCaseName}_STEP_1`)) {
      // Находим последнюю строку в enum ScraperSceneStep
      const enumMatch = typesContent.match(/export enum ScraperSceneStep \{[\s\S]*?\}/);
      
      if (enumMatch) {
        const enumContent = enumMatch[0];
        const lastLine = enumContent.split('\n').slice(-2)[0];
        
        // Создаем новые строки для шагов
        const newSteps = `  ${upperSnakeCaseName}_STEP_1 = "${upperSnakeCaseName}_STEP_1", // Шаг 1 для ${sceneName}
  ${upperSnakeCaseName}_STEP_2 = "${upperSnakeCaseName}_STEP_2" // Шаг 2 для ${sceneName}`;
        
        // Заменяем последнюю строку на последнюю строку + новые шаги
        const updatedEnum = enumContent.replace(
          lastLine,
          `${lastLine}\n${newSteps}`
        );
        
        // Обновляем файл types.ts
        typesContent = typesContent.replace(enumContent, updatedEnum);
        fs.writeFileSync(typesPath, typesContent);
        
        console.log(`✅ Шаги для сцены добавлены в ScraperSceneStep`);
      }
    }
  }
  
  console.log('\n🎉 Генерация завершена!');
  console.log('\nДля использования сцены:');
  console.log(`1. Импортируйте сцену в index.ts:`);
  console.log(`   import { ${pascalCaseName}WizardScene, setup${pascalCaseName}Wizard } from "./src/scenes/${sceneName}-wizard-scene";`);
  console.log(`2. Добавьте сцену в список сцен:`);
  console.log(`   new ${pascalCaseName}WizardScene(storageAdapter),`);
  console.log(`3. Настройте обработчики:`);
  console.log(`   setup${pascalCaseName}Wizard(bot);`);
}

// Получаем имя сцены из аргументов командной строки
const sceneName = process.argv[2];

// Запускаем генерацию
generateWizardScene(sceneName).catch(console.error);
