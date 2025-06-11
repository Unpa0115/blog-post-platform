-- recordings テーブルの作成
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'substack', 'gmail')),
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

-- インデックスの作成
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);

-- Row Level Security (RLS) ポリシーの設定
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のレコードのみアクセス可能
CREATE POLICY "Users can view own recordings" 
ON recordings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings" 
ON recordings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings" 
ON recordings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings" 
ON recordings FOR DELETE 
USING (auth.uid() = user_id); 