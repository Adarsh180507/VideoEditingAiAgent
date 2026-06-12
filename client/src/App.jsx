import React, { useState } from 'react';
import { Video, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import VideoUploader from './components/VideoUploader';
import { uploadDirectlyToCloudinary, startVideoProcessingJob, checkJobStatus } from './services/api';

function App() {
  const [appState, setAppState] = useState('idle'); // 'idle', 'uploading', 'processing', 'completed', 'error'
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleStartProcessing = async (file, prompt) => {
    try {
      // 1. Start Direct Cloudinary Upload
      setAppState('uploading');
      setStatusText('Encrypting and uploading raw footage to cloud storage...');
      setProgress(0);
      
      const cloudData = await uploadDirectlyToCloudinary(file, (percent) => {
        setProgress(percent);
      });

      // 2. Initialize the AI Background Worker
      setAppState('processing');
      setStatusText('Initializing AI Agent orchestrator...');
      setProgress(0);

      const jobId = await startVideoProcessingJob(
        cloudData.videoUrl, 
        cloudData.publicId, 
        file.name, 
        prompt
      );

      // 3. Start Polling the Queue Status
      pollJobProgress(jobId);

    } catch (error) {
      setAppState('error');
      setErrorMessage(error.message);
    }
  };

  const pollJobProgress = (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await checkJobStatus(jobId);
        
        setProgress(status.progress || 0);

        if (status.progress === 10) setStatusText('Downloading video to isolated processing tier...');
        if (status.progress === 35) setStatusText('Isolating and optimizing audio tracks...');
        if (status.progress === 60) setStatusText('Gemini AI Agent analyzing audio for highlights...');
        if (status.progress === 85) setStatusText('Splicing and rendering final highlight reel...');

        if (status.state === 'completed') {
          clearInterval(pollInterval);
          setFinalVideoUrl(status.result.editedVideoUrl);
          setAppState('completed');
        } else if (status.state === 'failed') {
          clearInterval(pollInterval);
          setAppState('error');
          setErrorMessage(status.failedReason || 'The AI agent encountered a critical error.');
        }

      } catch (error) {
        clearInterval(pollInterval);
        setAppState('error');
        setErrorMessage('Lost connection to the processing queue.');
      }
    }, 2000); // Check progress every 2 seconds
  };

  const resetApp = () => {
    setAppState('idle');
    setProgress(0);
    setFinalVideoUrl(null);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-3xl w-full flex flex-col items-center mb-12">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl mb-4">
          <Video size={32} />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
          AI Video Architect
        </h1>
        <p className="mt-2 text-slate-500 text-center">
          Upload your raw footage. Let the AI agent extract the best moments instantly.
        </p>
      </div>

      {/* Main Content Area */}
      <main className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 min-h-[400px] flex flex-col justify-center">
        
        {appState === 'idle' && (
          <VideoUploader onSubmit={handleStartProcessing} />
        )}

        {(appState === 'uploading' || appState === 'processing') && (
          <div className="w-full flex flex-col items-center py-10">
            <Loader2 size={48} className="text-blue-500 animate-spin mb-6" />
            <h3 className="text-xl font-medium text-slate-800 mb-2">
              {appState === 'uploading' ? 'Uploading Media' : 'Agentic Processing Active'}
            </h3>
            <p className="text-slate-500 text-center mb-8 h-6">{statusText}</p>
            
            {/* Progress Bar */}
            <div className="w-full max-w-md bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium text-slate-400">{progress}% Complete</p>
          </div>
        )}

        {appState === 'completed' && (
          <div className="w-full flex flex-col items-center py-6">
            <div className="p-4 bg-green-50 text-green-500 rounded-full mb-6">
              <CheckCircle size={48} />
            </div>
            <h3 className="text-2xl font-medium text-slate-800 mb-2">Analysis Complete</h3>
            <p className="text-slate-500 text-center mb-8">Your highlights have been successfully extracted and rendered.</p>
            
            <video 
              src={finalVideoUrl} 
              controls 
              className="w-full rounded-xl border border-slate-200 bg-black mb-8 shadow-sm"
              style={{ maxHeight: '400px' }}
            />

            <div className="flex space-x-4 w-full">
              <a 
                href={finalVideoUrl} 
                download
                target="_blank" rel="noopener noreferrer"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center"
              >
                <Download size={20} className="mr-2" />
                Download Reel
              </a>
              <button 
                onClick={resetApp}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Process Another Video
              </button>
            </div>
          </div>
        )}

        {appState === 'error' && (
          <div className="w-full flex flex-col items-center py-10">
            <div className="p-4 bg-red-50 text-red-500 rounded-full mb-6">
              <AlertCircle size={48} />
            </div>
            <h3 className="text-xl font-medium text-slate-800 mb-2">Processing Failed</h3>
            <p className="text-red-500 text-center mb-8 max-w-md bg-red-50 p-4 rounded-lg border border-red-100">
              {errorMessage}
            </p>
            <button 
              onClick={resetApp}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-8 rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;