import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  initializeDBConnection,
  closeDBConnection,
  getCompetitorAccountsByProjectId,
  getProjectsByUserId,
  getDB,
} from "../src/db/neonDB";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devEnvPath = path.join(__dirname, "../.env.development");
const prodEnvPath = path.join(__dirname, "../.env");

const dev = fs.existsSync(devEnvPath);
const envPath = dev ? devEnvPath : prodEnvPath;
dotenv.config({ path: envPath });
console.log(`Используется файл окружения: ${envPath}`);

const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
if (!vaultPath) {
  console.error("Не указан путь OBSIDIAN_VAULT_PATH в .env");
  process.exit(1);
}

async function main() {
  const userId = process.env.EXPORT_USER_ID;
  const projectIdArg = process.argv[2];

  if (!userId && !projectIdArg) {
    console.error(
      "Укажите EXPORT_USER_ID в .env или передайте projectId как аргумент"
    );
    process.exit(1);
  }

  await initializeDBConnection();
  const db = getDB();

  let projectId = projectIdArg ? parseInt(projectIdArg, 10) : undefined;
  if (!projectId && userId) {
    const projects = await getProjectsByUserId(userId, true);
    if (projects.length === 0) {
      console.error(`Нет проектов для пользователя ${userId}`);
      await closeDBConnection();
      return;
    }
    projectId = projects[0].id;
    console.log(`Используется первый проект ID ${projectId}`);
  }

  if (!projectId) {
    console.error("Не удалось определить projectId");
    await closeDBConnection();
    return;
  }

  const competitors = await getCompetitorAccountsByProjectId(projectId, false);

  if (competitors.length === 0) {
    console.log("Конкуренты не найдены");
    await closeDBConnection();
    return;
  }

  let content = `# Конкуренты проекта ${projectId}\n\n`;
  competitors.forEach((c, idx) => {
    const url = c.profile_url || "";
    const username = c.username || `competitor-${idx + 1}`;
    content += `- [${username}](${url})\n`;
  });

  const outDir = path.join(vaultPath, "competitors");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `project-${projectId}.md`);
  fs.writeFileSync(outPath, content, "utf8");
  console.log(`✅ Экспортировано: ${outPath}`);

  await closeDBConnection();
}

main().catch(async (err) => {
  console.error("Ошибка выполнения скрипта", err);
  await closeDBConnection();
});
