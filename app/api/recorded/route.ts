import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RecordMetadata } from '@/lib/types/recording';

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

    // FormData から file と metadata を取得
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadataStr = formData.get('metadata') as string;

    if (!file || !metadataStr) {
      return NextResponse.json(
        { error: 'Missing file or metadata' },
        { status: 400 }
      );
    }

    let metadata: RecordMetadata;
    try {
      metadata = JSON.parse(metadataStr);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid metadata format' },
        { status: 400 }
      );
    }

    // ファイルパスを生成（ユーザーID/年/月/日/UUID.webm）
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const uuid = crypto.randomUUID();
    const filePath = `${user.id}/${year}/${month}/${day}/${uuid}.webm`;

    // Supabase Storage にファイルアップロード
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, file, {
        contentType: 'audio/webm',
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

    // データベースにレコード追加
    const { data: recordData, error: dbError } = await supabase
      .from('recordings')
      .insert({
        user_id: user.id,
        file_path: filePath,
        source: 'web',
        metadata: {
          ...metadata,
          fileSize: file.size
        },
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

    // TODO: ここで Webhook を発火して自動化ジョブをキューに登録
    // await triggerAutomationJob(recordData.id);

    return NextResponse.json({
      id: recordData.id,
      status: 'queued',
      message: 'Recording uploaded successfully'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 