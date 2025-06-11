"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import RecordRTC from 'recordrtc';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { RecordMetadata } from '@/lib/types/recording';
import { cn } from '@/lib/utils';

interface RecordingProps {
  onRecorded: (blob: Blob, metadata: RecordMetadata) => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'preview';

export function Recording({ onRecorded }: RecordingProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recordRTCRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 音声の可視化
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      if (state === 'recording') {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
  }, [state]);

  // タイマー開始
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // タイマー停止
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 録音開始
  const startRecording = async () => {
    try {
      setIsLoading(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Web Audio API で波形解析用のセットアップ
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // RecordRTC 初期化
      recordRTCRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 44100,
      });

      recordRTCRef.current.startRecording();
      setState('recording');
      setDuration(0);
      startTimer();
      drawWaveform();
    } catch (error) {
      console.error('録音開始エラー:', error);
      alert('マイクへのアクセスが許可されていません。');
    } finally {
      setIsLoading(false);
    }
  };

  // 録音停止
  const stopRecording = () => {
    if (recordRTCRef.current && streamRef.current) {
      recordRTCRef.current.stopRecording(() => {
        const blob = recordRTCRef.current!.getBlob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // ストリーム停止
        streamRef.current!.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        // アニメーション停止
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }

        setState('preview');
      });
      stopTimer();
    }
  };

  // 録音完了処理
  const handleComplete = () => {
    if (recordRTCRef.current && audioUrl) {
      const blob = recordRTCRef.current.getBlob();
      const metadata: RecordMetadata = {
        durationMs: duration * 1000,
        sampleRate: 44100,
        channels: 2,
        fileSize: blob.size,
      };

      onRecorded(blob, metadata);
      
      // クリーンアップ
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setDuration(0);
      setState('idle');
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setDuration(0);
    setState('idle');
  };

  // 時間フォーマット
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopTimer();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, stopTimer]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">音声録音</h2>
        <div className="text-3xl font-mono text-blue-600">
          {formatTime(duration)}
        </div>
      </div>

      {/* 波形表示 */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={300}
          height={100}
          className={cn(
            "border rounded-lg bg-black",
            state === 'recording' ? "border-red-500" : "border-gray-300"
          )}
        />
      </div>

      {/* 録音コントロール */}
      <div className="flex justify-center space-x-4">
        {state === 'idle' && (
          <Button
            onClick={startRecording}
            disabled={isLoading}
            size="lg"
            className="bg-red-500 hover:bg-red-600"
          >
            <Mic className="mr-2 h-5 w-5" />
            録音開始
          </Button>
        )}

        {state === 'recording' && (
          <Button
            onClick={stopRecording}
            size="lg"
            variant="outline"
          >
            <Square className="mr-2 h-4 w-4" />
            録音停止
          </Button>
        )}

        {state === 'preview' && (
          <>
            <Button onClick={handleCancel} variant="outline">
              キャンセル
            </Button>
            <Button onClick={handleComplete} className="bg-green-500 hover:bg-green-600">
              完了
            </Button>
          </>
        )}
      </div>

      {/* プレビュー再生 */}
      {state === 'preview' && audioUrl && (
        <div className="flex justify-center">
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="w-full"
          />
        </div>
      )}
    </div>
  );
} 