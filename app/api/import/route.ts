import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImportRequest } from '@/lib/types/recording';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ImportRequest = await request.json();
    const { source, url } = body;

    // バリデーション
    if (!source || !url || !['substack', 'gmail'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source or url' },
        { status: 400 }
      );
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // 外部URLからファイルを取得
    let audioResponse: Response;
    try {
      audioResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: 'follow'
      });

      if (!audioResponse.ok) {
        throw new Error(`HTTP ${audioResponse.status}: ${audioResponse.statusText}`);
      }

      // Content-Type チェック
      const contentType = audioResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('audio')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
    } catch (fetchError) {
      console.error('Failed to fetch audio file:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch audio file from URL' },
        { status: 400 }
      );
    }

    // ファイルをBlobとして取得
    const audioBlob = await audioResponse.blob();
    
    // ファイルパスを生成
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const uuid = crypto.randomUUID();
    
    // ファイル拡張子を推定
    const contentType = audioResponse.headers.get('content-type') || '';
    let extension = 'audio';
    if (contentType.includes('mp3')) extension = 'mp3';
    else if (contentType.includes('wav')) extension = 'wav';
    else if (contentType.includes('m4a')) extension = 'm4a';
    else if (contentType.includes('webm')) extension = 'webm';
    
    const filePath = `${user.id}/${year}/${month}/${day}/${uuid}_${source}.${extension}`;

    // Supabase Storage にファイルアップロード
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, audioBlob, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'File upload failed' },
        { status: 500 }
      );
    }

    // 基本的なメタデータを作成（詳細は後で取得）
    const metadata = {
      durationMs: 0, // 後で音声解析で更新
      sampleRate: 0, // 後で音声解析で更新
      channels: 0,   // 後で音声解析で更新
      fileSize: audioBlob.size,
      originalUrl: url
    };

    // データベースにレコード追加
    const { data: recordData, error: dbError } = await supabase
      .from('recordings')
      .insert({
        user_id: user.id,
        file_path: filePath,
        source: source,
        metadata: metadata,
        status: 'queued'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      
      // DB 登録に失敗した場合はアップロードしたファイルを削除
      await supabase.storage
        .from('recordings')
        .remove([filePath]);

      return NextResponse.json(
        { error: 'Database insert failed' },
        { status: 500 }
      );
    }

    // TODO: ここで音声解析とVoicy自動化ジョブをキューに登録
    // await triggerAudioAnalysis(recordData.id);
    // await triggerAutomationJob(recordData.id);

    return NextResponse.json({
      id: recordData.id,
      status: 'queued',
      message: 'Audio file imported successfully'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 