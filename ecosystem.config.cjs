module.exports = {
  apps: [
    {
      name: "drizzle-studio",
      script: "bun",
      args: "run exec-drizzle-studio",
      watch: false,
      autorestart: false, // Обычно студию не нужно перезапускать автоматически
      cwd: "./",
      env_development: {
        NODE_ENV: "development",
      },
    },
    {
      name: "vitest-ui",
      script: "bunx",
      args: "vitest --ui --api.port 51205 --open false", // Указываем порт для API и отключаем авто-открытие
      watch: ["./__tests__", "./src"], // Можно настроить более гранулярно
      ignore_watch: ["node_modules", "dist", ".dev"],
      autorestart: true,
      env_development: {
        NODE_ENV: "development",
      },
    },
    // {
    //   name: 'instagram-scraper-bot', // Название вашего основного приложения
    //   script: 'bun',
    //   args: 'run src/index.ts', // ЗАМЕНИТЕ ЭТО НА ВАШУ РЕАЛЬНУЮ КОМАНДУ ЗАПУСКА
    //   watch: ['./src', './db'], // Директории для отслеживания изменений
    //   ignore_watch: ['node_modules', 'dist', '.dev', './__tests__'],
    //   autorestart: true,
    //   env_development: {
    //     NODE_ENV: 'development',
    //     // PORT: 3000, // Если ваше приложение использует порт
    //   },
    //   env_production: {
    //     NODE_ENV: 'production',
    //     // PORT: 8080,
    //   },
    // },
  ],
}
