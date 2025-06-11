"use client";

import { useState } from 'react';
import { Recording } from '@/components/recording/recording';
import { FileList } from '@/components/recording/file-list';
import { RecordMetadata } from '@/lib/types/recording';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Upload, List } from 'lucide-react';

export function RecordingDashboard() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importSource, setImportSource] = useState<'substack' | 'gmail'>('substack');
  const [importLoading, setImportLoading] = useState(false);

  // 録音完了時の処理
  const handleRecorded = async (blob: Blob, metadata: RecordMetadata) => {
    setIsUploading(true);
    
    try {
      // FormData を作成
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('metadata', JSON.stringify(metadata));

      // API に送信
      const response = await fetch('/api/recorded', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);

      // ファイル一覧を更新
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error('Upload error:', error);
      alert(`アップロードに失敗しました: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 外部ファイル取込
  const handleImport = async () => {
    if (!importUrl.trim()) {
      alert('URLを入力してください');
      return;
    }

    setImportLoading(true);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: importSource,
          url: importUrl.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const result = await response.json();
      console.log('Import successful:', result);

      // 入力をクリア
      setImportUrl('');

      // ファイル一覧を更新
      setRefreshTrigger(prev => prev + 1);

      alert('ファイルの取込を開始しました');

    } catch (error) {
      console.error('Import error:', error);
      alert(`取込に失敗しました: ${error}`);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <Tabs defaultValue="record" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="record" className="flex items-center space-x-2">
          <Mic className="h-4 w-4" />
          <span>録音</span>
        </TabsTrigger>
        <TabsTrigger value="import" className="flex items-center space-x-2">
          <Upload className="h-4 w-4" />
          <span>取込</span>
        </TabsTrigger>
        <TabsTrigger value="files" className="flex items-center space-x-2">
          <List className="h-4 w-4" />
          <span>ファイル一覧</span>
        </TabsTrigger>
      </TabsList>

      {/* 録音タブ */}
      <TabsContent value="record">
        <Card>
          <CardHeader>
            <CardTitle>ブラウザ録音</CardTitle>
            <CardDescription>
              マイクを使用して音声を録音し、クラウドストレージに保存します
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isUploading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">アップロード中...</p>
              </div>
            ) : (
              <Recording onRecorded={handleRecorded} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 外部取込タブ */}
      <TabsContent value="import">
        <Card>
          <CardHeader>
            <CardTitle>外部ファイル取込</CardTitle>
            <CardDescription>
              Substack や Gmail からの音声ファイルを取り込みます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source">取込元</Label>
              <Select 
                value={importSource} 
                onValueChange={(value: 'substack' | 'gmail') => setImportSource(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="取込元を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="substack">Substack</SelectItem>
                  <SelectItem value="gmail">Gmail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">音声ファイルURL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/audio.mp3"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={importLoading}
              />
            </div>

            <Button 
              onClick={handleImport} 
              disabled={importLoading || !importUrl.trim()}
              className="w-full"
            >
              {importLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  取込中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  ファイルを取り込む
                </>
              )}
            </Button>

            <div className="text-sm text-gray-500 mt-4">
              <p>対応フォーマット: MP3, WAV, M4A, WebM</p>
              <p>ファイルサイズ上限: 100MB</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ファイル一覧タブ */}
      <TabsContent value="files">
        <Card>
          <CardHeader>
            <CardTitle>録音ファイル管理</CardTitle>
            <CardDescription>
              録音・取込したファイルの一覧と処理状況を確認できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileList refreshTrigger={refreshTrigger} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
} 