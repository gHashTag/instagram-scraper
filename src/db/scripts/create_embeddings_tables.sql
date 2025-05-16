-- Включение расширения pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Создание таблицы для хранения эмбеддингов расшифровок
CREATE TABLE IF NOT EXISTS transcript_embeddings (
  id SERIAL PRIMARY KEY,
  reel_id TEXT NOT NULL,
  transcript TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска по векторам
CREATE INDEX IF NOT EXISTS transcript_embeddings_reel_id_idx ON transcript_embeddings (reel_id);

-- Создание индекса для векторного поиска
CREATE INDEX IF NOT EXISTS transcript_embeddings_embedding_idx ON transcript_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Создание таблицы для хранения истории чата
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  reel_id TEXT NOT NULL,
  message TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска истории чата
CREATE INDEX IF NOT EXISTS chat_history_user_id_idx ON chat_history (user_id);
CREATE INDEX IF NOT EXISTS chat_history_reel_id_idx ON chat_history (reel_id);
