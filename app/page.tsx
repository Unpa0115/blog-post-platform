import { RecordingDashboard } from '@/components/recording/recording-dashboard';

export default function HomePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Audio Recording Platform</h1>
        <p className="text-gray-600">音声録音と外部ファイル取込機能</p>
      </div>
      
      <RecordingDashboard />
    </div>
  );
}
