-- Установка расширения pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Создание таблицы для хранения эмбеддингов расшифровок
CREATE TABLE IF NOT EXISTS transcript_embeddings (
  id SERIAL PRIMARY KEY,
  reel_id TEXT NOT NULL REFERENCES reels(instagram_id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска по векторам
CREATE INDEX IF NOT EXISTS transcript_embeddings_reel_id_idx ON transcript_embeddings(reel_id);
CREATE INDEX IF NOT EXISTS transcript_embeddings_embedding_idx ON transcript_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Создание таблицы для хранения истории чата
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  reel_id TEXT NOT NULL REFERENCES reels(instagram_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для быстрого поиска в истории чата
CREATE INDEX IF NOT EXISTS chat_history_user_id_idx ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS chat_history_reel_id_idx ON chat_history(reel_id);
CREATE INDEX IF NOT EXISTS chat_history_user_reel_idx ON chat_history(user_id, reel_id);

-- Функция для обновления timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для обновления timestamp updated_at в таблице transcript_embeddings
CREATE TRIGGER update_transcript_embeddings_updated_at
BEFORE UPDATE ON transcript_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Функция для поиска похожих расшифровок
CREATE OR REPLACE FUNCTION search_similar_transcripts(
  query_embedding vector(1536),
  similarity_threshold float,
  max_results int
)
RETURNS TABLE (
  id int,
  reel_id text,
  transcript text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.id,
    te.reel_id,
    te.transcript,
    1 - (te.embedding <=> query_embedding) AS similarity
  FROM transcript_embeddings te
  WHERE 1 - (te.embedding <=> query_embedding) > similarity_threshold
  ORDER BY te.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;
