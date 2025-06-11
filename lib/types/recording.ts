export interface RecordMetadata {
  durationMs: number;
  sampleRate: number;
  channels: number;
  fileSize?: number;
}

export interface Recording {
  id: string;
  user_id: string;
  file_path: string;
  source: 'web' | 'substack' | 'gmail';
  metadata: RecordMetadata;
  status: 'queued' | 'processing' | 'done' | 'error';
  created_at: string;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
}

export interface RecordingFormData {
  file: Blob;
  metadata: RecordMetadata;
}

export interface ImportRequest {
  source: 'substack' | 'gmail';
  url: string;
  user_id: string;
} 