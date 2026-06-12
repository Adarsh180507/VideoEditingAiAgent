import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileVideo, X, Sparkles } from 'lucide-react';

export default function VideoUploader({ onSubmit }) {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');

  // Handle the drag-and-drop action
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    maxFiles: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file) {
      onSubmit(file, prompt);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  return (
    <div className="w-full">
      {!file ? (
        // Drag and Drop Area
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'}`}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`} />
          <p className="text-slate-700 font-medium text-lg mb-1">
            {isDragActive ? 'Drop your video here...' : 'Click or drag a video to upload'}
          </p>
          <p className="text-slate-500 text-sm">MP4, MOV, or AVI (Max 5GB)</p>
        </div>
      ) : (
        // File Selected State & AI Prompt Form
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 mb-6">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <FileVideo size={24} />
              </div>
              <div className="truncate">
                <p className="text-slate-700 font-medium truncate">{file.name}</p>
                <p className="text-slate-400 text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={clearFile}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-6">
            <label htmlFor="prompt" className="flex items-center text-slate-700 font-medium mb-2">
              <Sparkles size={16} className="text-blue-500 mr-2" />
              Editing Instructions
            </label>
            <textarea
              id="prompt"
              rows="3"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all"
              placeholder="e.g., Find the most exciting moments, funny jokes, or highest energy sections..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center"
          >
            Start AI Analysis
          </button>
        </form>
      )}
    </div>
  );
}