"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Recording } from '@/lib/types/recording';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, RefreshCw, Play, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface FileListProps {
  refreshTrigger?: number; // 外部からの更新トリガー
}

export function FileList({ refreshTrigger }: FileListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // ステータスバッジの色設定
  const getStatusBadge = (status: Recording['status']) => {
    switch (status) {
      case 'queued':
        return <Badge variant="secondary">待機中</Badge>;
      case 'processing':
        return <Badge variant="default">処理中</Badge>;
      case 'done':
        return <Badge variant="default" className="bg-green-500">完了</Badge>;
      case 'error':
        return <Badge variant="destructive">エラー</Badge>;
      default:
        return <Badge variant="secondary">不明</Badge>;
    }
  };

  // 録音ファイル一覧取得
  const fetchRecordings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setRecordings(data || []);
    } catch (err) {
      console.error('録音一覧取得エラー:', err);
      setError('録音一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ファイル削除
  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm('このファイルを削除しますか？')) return;

    try {
      // Storage からファイル削除
      const { error: storageError } = await supabase.storage
        .from('recordings')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage削除エラー:', storageError);
      }

      // DB からレコード削除
      const { error: dbError } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);

      if (dbError) {
        throw dbError;
      }

      // 一覧を更新
      setRecordings(prev => prev.filter(rec => rec.id !== id));
    } catch (err) {
      console.error('削除エラー:', err);
      alert('ファイルの削除に失敗しました');
    }
  };

  // 再試行
  const handleRetry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recordings')
        .update({ 
          status: 'queued',
          error_message: null,
          started_at: null,
          finished_at: null
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // 一覧を更新
      fetchRecordings();
    } catch (err) {
      console.error('再試行エラー:', err);
      alert('再試行の設定に失敗しました');
    }
  };

  // ファイルダウンロード
  const handleDownload = async (filePath: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('recordings')
        .download(filePath);

      if (error) {
        throw error;
      }

      // Blob URLを作成してダウンロード
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ダウンロードエラー:', err);
      alert('ファイルのダウンロードに失敗しました');
    }
  };

  // ファイル再生
  const handlePlay = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('recordings')
        .createSignedUrl(filePath, 3600); // 1時間有効

      if (error) {
        throw error;
      }

      // 新しいウィンドウで音声プレイヤーを開く
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('再生エラー:', err);
      alert('ファイルの再生に失敗しました');
    }
  };

  // 時間フォーマット
  const formatDuration = (durationMs: number) => {
    const seconds = Math.floor(durationMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // リアルタイム更新の設定
  useEffect(() => {
    const channel = supabase
      .channel('recordings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings'
        },
        () => {
          fetchRecordings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 初期データ取得
  useEffect(() => {
    fetchRecordings();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchRecordings} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          再読み込み
        </Button>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>録音ファイルがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">録音ファイル ({recordings.length})</h3>
        <Button onClick={fetchRecordings} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          更新
        </Button>
      </div>

      <div className="grid gap-4">
        {recordings.map((recording) => (
          <Card key={recording.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-medium">
                  {recording.source === 'web' ? 'ブラウザ録音' : 
                   recording.source === 'substack' ? 'Substack' : 'Gmail'} 録音
                </CardTitle>
                {getStatusBadge(recording.status)}
              </div>
              <p className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(recording.created_at), { 
                  addSuffix: true, 
                  locale: ja 
                })}
              </p>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">時間:</span>{' '}
                  {formatDuration(recording.metadata.durationMs)}
                </div>
                <div>
                  <span className="text-gray-500">サイズ:</span>{' '}
                  {recording.metadata.fileSize ? 
                    formatFileSize(recording.metadata.fileSize) : 'N/A'}
                </div>
              </div>

              {recording.error_message && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {recording.error_message}
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePlay(recording.file_path)}
                >
                  <Play className="mr-1 h-3 w-3" />
                  再生
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(
                    recording.file_path, 
                    `recording-${recording.id}.webm`
                  )}
                >
                  <Download className="mr-1 h-3 w-3" />
                  DL
                </Button>

                {recording.status === 'error' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry(recording.id)}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    再試行
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(recording.id, recording.file_path)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  削除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 