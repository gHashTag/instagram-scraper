// Экспортируем адаптеры для разных типов хранилищ
export { createNeonStorageAdapter } from "./neon-adapter"
export { createMemoryStorageAdapter } from "./memory-adapter"
export { createSQLiteStorageAdapter } from "./sqlite-adapter"

// Импортируем и экспортируем функции из neonStorage-multitenant
// Используем условный импорт и заглушки для устойчивости к ошибкам
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let createMultitenantNeonStorageAdapter = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let createTables = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let dropTables = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let testNeonConnection = null

// Импортируем и экспортируем только если файл существует
import * as fs from "fs"
import * as path from "path"

const multitenantFilePath = path.resolve(
  __dirname,
  "./neonStorage-multitenant.ts"
)

// Если файл существует, экспортируем функции из него
if (fs.existsSync(multitenantFilePath)) {
  // Пути для динамического импорта
  // Поскольку мы не можем использовать require, создаем заглушки, которые
  // могут быть заменены при реальной сборке модуля
  export {
    createMultitenantNeonStorageAdapter,
    createTables,
    dropTables,
    testNeonConnection,
    // Экспортируем функции прямого доступа к Neon
    initializeNeonStorage,
    closeNeonStorage,
    createUser,
    getUserByTelegramId,
    createProject,
    getProjectsByUserId,
    addCompetitorAccount,
    getCompetitorAccounts,
    addTrackingHashtag,
    getTrackingHashtags,
    saveReels,
    getReels,
    getProjectStats,
    addToFavorites,
    removeFromFavorites,
    getFavoriteReels,
    hideReel,
    getReelInteraction,
    getParsingLogs,
    getAllActiveUsers,
    logParsingRun,
  } from "./neonStorage-multitenant"

  // Экспортируем типы из Neon
  export type {
    InstagramReel,
    User as NeonUser,
    Project as NeonProject,
    CompetitorAccount,
    TrackingHashtag,
    ParsingLog,
    ReelWithSource,
  } from "./neonStorage-multitenant"
}

// Экспортируем neon-adapter как основной адаптер хранилища по умолчанию
export { createNeonStorageAdapter as createDefaultStorageAdapter } from "./neon-adapter"

// В режиме разработки проверяем, есть ли переменная для SQLite
// и устанавливаем его как адаптер по умолчанию
if (
  process.env.NEON_DATABASE_URL &&
  process.env.NEON_DATABASE_URL.startsWith("sqlite:///")
) {
  const sqlitePath = process.env.NEON_DATABASE_URL.replace("sqlite:///", "")
  console.log(`🔄 Используется SQLite адаптер для разработки: ${sqlitePath}`)

  // Переопределяем createDefaultStorageAdapter для использования SQLite
  module.exports.createDefaultStorageAdapter =
    function createDefaultStorageAdapter() {
      return module.exports.createSQLiteStorageAdapter(sqlitePath)
    }
}
