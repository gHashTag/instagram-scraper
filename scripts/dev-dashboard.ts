/**
 * Instagram Scraper Bot - Визуальная Панель Разработки
 *
 * Этот скрипт запускает локальный веб-сервер с интерфейсом для управления
 * процессом разработки и тестирования модуля Instagram Scraper Bot.
 */

import express from "express";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import open from "open";
// import chalk from "chalk" // TS6133: 'chalk' is declared but its value is never read.
import { Database } from "bun:sqlite";
import dotenv from "dotenv";

// Initialize environment variables
dotenv.config();

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEV_DIR = path.resolve(ROOT_DIR, ".dev");
const SQLITE_DB_PATH = path.resolve(DEV_DIR, "sqlite.db");

// Make sure .dev directory exists
if (!fs.existsSync(DEV_DIR)) {
  fs.mkdirSync(DEV_DIR, { recursive: true });
}

// Create Express app
const app = express();
const PORT = 3456;

// Serve static files
app.use(express.static(path.join(ROOT_DIR, "public")));
app.use(express.json());

// Set up templating
app.set("view engine", "ejs");
app.set("views", path.join(ROOT_DIR, "views"));

// Create views directory if it doesn't exist
const viewsDir = path.join(ROOT_DIR, "views");
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

// Create public directory if it doesn't exist
const publicDir = path.join(ROOT_DIR, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create EJS template
const templatePath = path.join(viewsDir, "dashboard.ejs");
if (!fs.existsSync(templatePath)) {
  const templateContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instagram Scraper Bot - Панель Разработки</title>
  <style>
    :root {
      --primary-color: #5662f6;
      --secondary-color: #43a9ff;
      --dark-color: #333;
      --light-color: #f4f7f9;
      --success-color: #4caf50;
      --warning-color: #ff9800;
      --danger-color: #f44336;
      --border-radius: 8px;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    body {
      background-color: var(--light-color);
      color: var(--dark-color);
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      padding: 20px;
      border-radius: var(--border-radius);
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .tabs {
      display: flex;
      margin-bottom: 20px;
      background: white;
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .tab {
      padding: 15px 25px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;
    }
    
    .tab.active {
      background: var(--primary-color);
      color: white;
    }
    
    .tab:hover:not(.active) {
      background: rgba(86, 98, 246, 0.1);
    }
    
    .panel {
      background: white;
      border-radius: var(--border-radius);
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .panel-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    }
    
    .btn {
      padding: 10px 15px;
      border: none;
      border-radius: var(--border-radius);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .btn-primary {
      background: var(--primary-color);
      color: white;
    }
    
    .btn-success {
      background: var(--success-color);
      color: white;
    }
    
    .btn-warning {
      background: var(--warning-color);
      color: white;
    }
    
    .btn-danger {
      background: var(--danger-color);
      color: white;
    }
    
    .btn:hover {
      opacity: 0.9;
      transform: translateY(-2px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    
    .card {
      background: white;
      border-radius: var(--border-radius);
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .card-title {
      font-size: 18px;
      margin-bottom: 10px;
      color: var(--primary-color);
    }
    
    .status {
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      display: inline-block;
    }
    
    .status-success {
      background: rgba(76, 175, 80, 0.1);
      color: var(--success-color);
    }
    
    .status-warning {
      background: rgba(255, 152, 0, 0.1);
      color: var(--warning-color);
    }
    
    .status-danger {
      background: rgba(244, 67, 54, 0.1);
      color: var(--danger-color);
    }
    
    .db-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    .db-table th, .db-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    
    .db-table th {
      background: rgba(86, 98, 246, 0.1);
      font-weight: 500;
    }
    
    .db-schema {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 20px;
    }
    
    .db-table-card {
      border: 1px solid #eee;
      border-radius: var(--border-radius);
      padding: 15px;
      min-width: 250px;
    }
    
    .db-table-name {
      font-weight: 500;
      margin-bottom: 10px;
      color: var(--primary-color);
    }
    
    .db-column {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px dashed #eee;
    }
    
    .logs {
      background: var(--dark-color);
      color: white;
      font-family: 'Courier New', monospace;
      padding: 15px;
      border-radius: var(--border-radius);
      max-height: 300px;
      overflow-y: auto;
    }
    
    .action-btn-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    #status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .connected {
      background-color: var(--success-color);
    }
    
    .disconnected {
      background-color: var(--danger-color);
    }
    
    /* Graph styles */
    .db-relations {
      width: 100%;
      height: 300px;
      background: #f9f9f9;
      border-radius: var(--border-radius);
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Instagram Scraper Bot - Панель Разработки</h1>
      <div id="status-indicator">
        <div class="indicator <%= dbType === 'SQLite' ? 'connected' : 'disconnected' %>"></div>
        <span>
          <%= dbType === 'SQLite' ? 'SQLite активна' : 'SQLite не активна' %>
        </span>
        <div style="margin-left: 20px;"></div>
        <div class="indicator <%= dbType === 'Neon' ? 'connected' : 'disconnected' %>"></div>
        <span>
          <%= dbType === 'Neon' ? 'Neon активна' : 'Neon не активна' %>
        </span>
      </div>
    </header>
    
    <div class="tabs">
      <div class="tab active" data-tab="overview">Обзор</div>
      <div class="tab" data-tab="database">База Данных</div>
      <div class="tab" data-tab="testing">Тестирование</div>
      <div class="tab" data-tab="logs">Логи</div>
    </div>
    
    <div id="tab-content">
      <!-- Overview Tab -->
      <div class="tab-panel active" id="overview-panel">
        <div class="panel">
          <div class="panel-title">
            <h2>Статус системы</h2>
            <button class="btn btn-primary" id="refresh-status">Обновить</button>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="card-title">База данных</div>
              <div>
                <div><strong>Тип:</strong> <%= dbType %></div>
                <div><strong>URL:</strong> <%= dbUrl %></div>
                <div>
                  <span class="status <%= dbConnected ? 'status-success' : 'status-danger' %>">
                    <%= dbConnected ? 'Подключено' : 'Отключено' %>
                  </span>
                </div>
              </div>
              <div class="action-btn-group">
                <button class="btn btn-primary" id="switch-db-type">
                  Переключить на <%= dbType === 'SQLite' ? 'Neon' : 'SQLite' %>
                </button>
                <button class="btn btn-warning" id="reset-db">Сбросить БД</button>
              </div>
            </div>
            
            <div class="card">
              <div class="card-title">Тестовые данные</div>
              <div>
                <div><strong>Пользователей:</strong> <%= counts.users %></div>
                <div><strong>Проектов:</strong> <%= counts.projects %></div>
                <div><strong>Конкурентов:</strong> <%= counts.competitors %></div>
                <div><strong>Хэштегов:</strong> <%= counts.hashtags %></div>
                <div><strong>Reels:</strong> <%= counts.reels %></div>
              </div>
              <div class="action-btn-group">
                <button class="btn btn-success" id="generate-test-data">Генерировать данные</button>
              </div>
            </div>
            
            <div class="card">
              <div class="card-title">Модуль</div>
              <div>
                <div><strong>Версия:</strong> <%= moduleInfo.version %></div>
                <div><strong>Режим:</strong> <%= moduleInfo.mode %></div>
                <div>
                  <span class="status status-success">Готов к использованию</span>
                </div>
              </div>
              <div class="action-btn-group">
                <button class="btn btn-primary" id="run-build">Собрать модуль</button>
                <button class="btn btn-success" id="run-tests">Запустить тесты</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Database Tab -->
      <div class="tab-panel" id="database-panel">
        <div class="panel">
          <div class="panel-title">
            <h2>Схема базы данных</h2>
            <div>
              <button class="btn btn-primary" id="refresh-schema">Обновить</button>
              <button class="btn btn-success" id="show-relations">Показать связи</button>
            </div>
          </div>
          
          <div class="db-schema">
            <% tables.forEach(table => { %>
              <div class="db-table-card">
                <div class="db-table-name"><%= table.name %></div>
                <% table.columns.forEach(column => { %>
                  <div class="db-column">
                    <span><%= column.name %></span>
                    <span><%= column.type %></span>
                  </div>
                <% }) %>
              </div>
            <% }) %>
          </div>
          
          <div class="db-relations" id="relations-graph"></div>
        </div>
        
        <div class="panel">
          <div class="panel-title">
            <h2>Просмотр данных</h2>
            <select id="table-selector">
              <% tables.forEach(table => { %>
                <option value="<%= table.name %>"><%= table.name %></option>
              <% }) %>
            </select>
          </div>
          
          <div id="table-data">
            <table class="db-table">
              <thead>
                <tr>
                  <% if (selectedTable && selectedTable.columns) { %>
                    <% selectedTable.columns.forEach(column => { %>
                      <th><%= column.name %></th>
                    <% }) %>
                  <% } %>
                </tr>
              </thead>
              <tbody>
                <% if (selectedTable && selectedTable.rows) { %>
                  <% selectedTable.rows.forEach(row => { %>
                    <tr>
                      <% Object.values(row).forEach(value => { %>
                        <td><%= value %></td>
                      <% }) %>
                    </tr>
                  <% }) %>
                <% } %>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Testing Tab -->
      <div class="tab-panel" id="testing-panel">
        <div class="panel">
          <div class="panel-title">
            <h2>Запуск тестов</h2>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="card-title">Unit-тесты</div>
              <div>
                <div><strong>Статус:</strong> 
                  <span class="status <%= testResults.unit.status === 'success' ? 'status-success' : (testResults.unit.status === 'failed' ? 'status-danger' : 'status-warning') %>">
                    <%= testResults.unit.status === 'success' ? 'Успешно' : (testResults.unit.status === 'failed' ? 'Ошибка' : 'Не запущено') %>
                  </span>
                </div>
                <div><strong>Пройдено:</strong> <%= testResults.unit.passed %>/<%= testResults.unit.total %></div>
              </div>
              <div class="action-btn-group">
                <button class="btn btn-primary" id="run-unit-tests">Запустить</button>
              </div>
            </div>
            
            <div class="card">
              <div class="card-title">Интеграционные тесты</div>
              <div>
                <div><strong>Статус:</strong> 
                  <span class="status <%= testResults.integration.status === 'success' ? 'status-success' : (testResults.integration.status === 'failed' ? 'status-danger' : 'status-warning') %>">
                    <%= testResults.integration.status === 'success' ? 'Успешно' : (testResults.integration.status === 'failed' ? 'Ошибка' : 'Не запущено') %>
                  </span>
                </div>
                <div><strong>Пройдено:</strong> <%= testResults.integration.passed %>/<%= testResults.integration.total %></div>
              </div>
              <div class="action-btn-group">
                <button class="btn btn-primary" id="run-integration-tests">Запустить</button>
              </div>
            </div>
            
            <div class="card">
              <div class="card-title">Mock-проверка</div>
              <div>
                <div><strong>Статус:</strong> 
                  <span class="status <%= testResults.mocks.status === 'success' ? 'status-success' : (testResults.mocks.status === 'failed' ? 'status-danger' : 'status-warning') %>">
                    <%= testResults.mocks.status === 'success' ? 'Успешно' : (testResults.mocks.status === 'failed' ? 'Ошибка' : 'Не запущено') %>
                  </span>
                </div>
              </div>
              <div class="action-btn-group">
                <button class="btn btn-primary" id="test-mocks">Проверить моки</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="panel">
          <div class="panel-title">
            <h2>Результаты последнего запуска</h2>
          </div>
          
          <pre class="logs"><%= testLogs %></pre>
        </div>
      </div>
      
      <!-- Logs Tab -->
      <div class="tab-panel" id="logs-panel">
        <div class="panel">
          <div class="panel-title">
            <h2>Логи</h2>
            <div>
              <button class="btn btn-primary" id="refresh-logs">Обновить</button>
              <button class="btn btn-warning" id="clear-logs">Очистить</button>
            </div>
          </div>
          
          <pre class="logs"><%= logs %></pre>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-panel').classList.add('active');
      });
    });
    
    // API calls
    const apiCall = async (endpoint, method = 'GET', data = null) => {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch('/api/' + endpoint, options);
      return await response.json();
    };
    
    // Button event listeners
    document.getElementById('refresh-status').addEventListener('click', () => {
      window.location.reload();
    });
    
    document.getElementById('switch-db-type').addEventListener('click', async () => {
      await apiCall('switch-db', 'POST');
      window.location.reload();
    });
    
    document.getElementById('reset-db').addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите сбросить базу данных? Все данные будут потеряны.')) {
        await apiCall('reset-db', 'POST');
        window.location.reload();
      }
    });
    
    document.getElementById('generate-test-data').addEventListener('click', async () => {
      await apiCall('generate-test-data', 'POST');
      window.location.reload();
    });
    
    document.getElementById('run-build').addEventListener('click', async () => {
      const result = await apiCall('run-build', 'POST');
      alert(result.success ? 'Сборка успешна!' : 'Ошибка при сборке: ' + result.message);
    });
    
    document.getElementById('run-tests').addEventListener('click', async () => {
      const result = await apiCall('run-tests', 'POST');
      window.location.reload();
    });
    
    document.getElementById('run-unit-tests').addEventListener('click', async () => {
      const result = await apiCall('run-unit-tests', 'POST');
      window.location.reload();
    });
    
    document.getElementById('run-integration-tests').addEventListener('click', async () => {
      const result = await apiCall('run-integration-tests', 'POST');
      window.location.reload();
    });
    
    document.getElementById('test-mocks').addEventListener('click', async () => {
      const result = await apiCall('test-mocks', 'POST');
      window.location.reload();
    });
    
    document.getElementById('refresh-logs').addEventListener('click', async () => {
      const logs = await apiCall('logs');
      document.querySelector('#logs-panel pre').textContent = logs.data;
    });
    
    document.getElementById('clear-logs').addEventListener('click', async () => {
      await apiCall('clear-logs', 'POST');
      document.querySelector('#logs-panel pre').textContent = '';
    });
    
    // Table selector
    const tableSelector = document.getElementById('table-selector');
    if (tableSelector) {
      tableSelector.addEventListener('change', async () => {
        const table = tableSelector.value;
        const data = await apiCall('table-data/' + table);
        
        // Update table columns
        const headerRow = document.querySelector('#table-data thead tr');
        headerRow.innerHTML = '';
        
        data.columns.forEach(column => {
          const th = document.createElement('th');
          th.textContent = column.name;
          headerRow.appendChild(th);
        });
        
        // Update table rows
        const tbody = document.querySelector('#table-data tbody');
        tbody.innerHTML = '';
        
        data.rows.forEach(row => {
          const tr = document.createElement('tr');
          
          Object.values(row).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
          });
          
          tbody.appendChild(tr);
        });
      });
    }
  </script>
</body>
</html>
  `;

  fs.writeFileSync(templatePath, templateContent);
}

// Create css directory and file
const cssDir = path.join(publicDir, "css");
if (!fs.existsSync(cssDir)) {
  fs.mkdirSync(cssDir, { recursive: true });
}

// Интерфейсы для типизации
interface TableRow {
  name: string;
  [key: string]: any;
}

interface TableColumn {
  name: string;
  type: string;
}

interface CountQuery {
  count: number;
}

interface DatabaseTable {
  name: string;
  columns: TableColumn[];
  rows?: any[];
}

// Set up routes
app.get("/", async (_req, res) => {
  const dbType = process.env.NEON_DATABASE_URL?.startsWith("postgres")
    ? "Neon"
    : "SQLite";
  const dbUrl = process.env.NEON_DATABASE_URL || "sqlite:///.dev/sqlite.db";
  const dbConnected = true; // This would need to be checked for real

  // Get table information from SQLite database
  const tables: DatabaseTable[] = [];
  let selectedTable: DatabaseTable | null = null;
  const counts = {
    users: 0,
    projects: 0,
    competitors: 0,
    hashtags: 0,
    reels: 0,
  };
  const testResults = {
    unit: { status: "pending", passed: 0, total: 0 },
    integration: { status: "pending", passed: 0, total: 0 },
    mocks: { status: "pending" },
  };
  const testLogs = "";
  const logs = "";

  // Try to read from SQLite database if it exists
  if (fs.existsSync(SQLITE_DB_PATH)) {
    try {
      const db = new Database(SQLITE_DB_PATH);

      // Get table information
      const tableRows = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        .all() as TableRow[];

      for (const tableRow of tableRows) {
        const tableName = tableRow.name;
        const columnsQuery = db
          .prepare(`PRAGMA table_info(${tableName})`)
          .all() as TableColumn[];

        const columns = columnsQuery.map((col) => ({
          name: col.name,
          type: col.type,
        }));

        const countQuery = db
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .get() as CountQuery;

        tables.push({
          name: tableName,
          columns,
        });

        // Update counts
        if (tableName === "Users") counts.users = countQuery.count;
        if (tableName === "Projects") counts.projects = countQuery.count;
        if (tableName === "Competitors") counts.competitors = countQuery.count;
        if (tableName === "Hashtags") counts.hashtags = countQuery.count;
        if (tableName === "ReelsContent") counts.reels = countQuery.count;
      }

      // Get first table data for display
      if (tables.length > 0) {
        const firstTableName = tables[0].name;
        const rows = db
          .prepare(`SELECT * FROM ${firstTableName} LIMIT 10`)
          .all();

        selectedTable = {
          name: firstTableName,
          columns: tables[0].columns,
          rows,
        };
      }

      db.close();
    } catch (error: any) {
      console.error("Error accessing SQLite database:", error);
    }
  }

  // Get module info
  const moduleInfo = {
    version: "1.0.0", // This should be read from package.json
    mode: process.env.NODE_ENV || "development",
  };

  // Render the dashboard
  res.render("dashboard", {
    dbType,
    dbUrl,
    dbConnected,
    tables,
    selectedTable,
    counts,
    moduleInfo,
    testResults,
    testLogs,
    logs,
  });
});

// API Endpoints
app.post("/api/switch-db", (_req, res) => {
  const currentDbType = process.env.NEON_DATABASE_URL?.startsWith("postgres")
    ? "Neon"
    : "SQLite";

  if (currentDbType === "SQLite") {
    // Switch to Neon
    process.env.NEON_DATABASE_URL = "postgres://your-neon-connection-string";
  } else {
    // Switch to SQLite
    process.env.NEON_DATABASE_URL = "sqlite:///.dev/sqlite.db";
  }

  // Update .env file
  const envContent = `NEON_DATABASE_URL=${process.env.NEON_DATABASE_URL}\n`;
  fs.writeFileSync(path.join(ROOT_DIR, ".env.local"), envContent);

  res.json({ success: true });
});

app.post("/api/reset-db", (_req, res) => {
  // This is a destructive operation, be careful
  exec(
    `rm -f ${SQLITE_DB_PATH} && bun run drizzle-kit:generate && bun run drizzle-kit:migrate`,
    { cwd: ROOT_DIR },
    (error, _stdout, _stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        res.status(500).send("Error resetting database");
        return; // TS7030: Not all code paths return a value.
      }
      res.send("Database reset successfully");
      return; // TS7030: Not all code paths return a value.
    }
  );
});

app.post("/api/generate-test-data", (_req, res) => {
  exec(
    `cd ${ROOT_DIR} && bun run scripts/seed-db.ts`,
    (error, _stdout, _stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        res.status(500).send("Error generating test data");
        return; // TS7030: Not all code paths return a value.
      }
      res.send("Test data generated successfully");
      return; // TS7030: Not all code paths return a value.
    }
  );
});

app.post("/api/run-build", (_req, res) => {
  exec(`cd ${ROOT_DIR} && bun run build`, (error, _stdout, _stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      res.status(500).send("Error running build");
      return; // TS7030: Not all code paths return a value.
    }
    res.send("Build completed successfully");
    return; // TS7030: Not all code paths return a value.
  });
});

app.post("/api/run-tests", (_req, res) => {
  // Consider running specific test suites if needed
  exec(`cd ${ROOT_DIR} && bun vitest run`, (error, _stdout, _stderr) => {
    if (error) {
      console.error("Error running tests:", error);
      // Send the error and stderr to the client for more detailed feedback
      res.status(500).json({
        message: "Error running tests",
        error: error.message,
        // stderr: stderr, // stderr might be useful
      });
      return; // TS7030: Not all code paths return a value.
    }
    // Send stdout to the client to display test results
    res.json({
      message: "Tests completed",
      // output: stdout, // stdout contains the test results
    });
    return; // TS7030: Not all code paths return a value.
  });
});

app.post("/api/run-unit-tests", (_req, res) => {
  exec(
    `cd ${ROOT_DIR} && bun vitest run src/__tests__/unit`,
    (error, _stdout, _stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        res.status(500).send("Error running unit tests");
        return; // TS7030: Not all code paths return a value.
      }
      res.send("Unit tests completed successfully");
      return; // TS7030: Not all code paths return a value.
    }
  );
});

app.post("/api/run-integration-tests", (_req, res) => {
  exec(
    `cd ${ROOT_DIR} && bun vitest run src/__tests__/integration`,
    (error, _stdout, _stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        res.status(500).send("Error running integration tests");
        return; // TS7030: Not all code paths return a value.
      }
      res.send("Integration tests completed successfully");
      return; // TS7030: Not all code paths return a value.
    }
  );
});

app.post("/api/test-mocks", (_req, res) => {
  // This would be a placeholder for testing mock generation or specific mock behaviors
  res.send("Mock testing logic not yet implemented.");
});

app.get("/api/logs", (_req, res) => {
  // Read and return logs, e.g., from a log file or a logging service
  // This is a simplified example, you might want to stream logs or paginate them
  const logFilePath = path.join(DEV_DIR, "app.log"); // Example log file path
  if (fs.existsSync(logFilePath)) {
    const logs = fs.readFileSync(logFilePath, "utf-8");
    res.json({ success: true, data: logs });
  } else {
    res.json({ success: true, data: "No logs found" });
  }
});

app.post("/api/clear-logs", (_req, res) => {
  // Logic to clear logs, e.g., truncate a log file
  const logFilePath = path.join(DEV_DIR, "app.log"); // Example log file path
  if (fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, "");
  }
  res.json({ success: true });
});

app.get("/api/table-data/:table", (req, res) => {
  const tableName = req.params.table;

  if (fs.existsSync(SQLITE_DB_PATH)) {
    try {
      const db = new Database(SQLITE_DB_PATH);

      // Get table columns
      const columnsQuery = db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all() as TableColumn[];

      const columns = columnsQuery.map((col) => ({
        name: col.name,
        type: col.type,
      }));

      // Get table rows
      const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 50`).all();

      db.close();

      res.json({
        success: true,
        columns,
        rows,
      });
    } catch (error: any) {
      res.json({ success: false, message: error.message });
    }
  } else {
    res.json({ success: false, message: "Database not found" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(
    `✨ Instagram Scraper Bot - Панель Разработки запущена на http://localhost:${PORT}`
  );

  // Open in browser
  open(`http://localhost:${PORT}`);
});
