import React, { useState, useRef, useEffect } from "react";
import {
  Video,
  Loader2,
  Send,
  Paperclip,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  uploadDirectlyToCloudinary,
  startVideoProcessingJob,
  checkJobStatus,
} from "./services/api";

function App() {
  // The heart of the Agent interface: A growing list of messages
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "agent",
      text: "Hello! I am your AI Video Architect. Attach a raw video and tell me how you'd like me to edit it.",
      status: "idle",
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => scrollToBottom(), [messages]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedFile || isProcessing) return;

    const userPrompt = inputValue;
    const fileToProcess = selectedFile;

    // 1. Add User Message to Chat
    const newUserMsg = {
      id: Date.now(),
      role: "user",
      text: userPrompt,
      fileName: fileToProcess.name,
    };

    // 2. Add Initial Agent Response (Processing State)
    const newAgentMsgId = Date.now() + 1;
    const initialAgentMsg = {
      id: newAgentMsgId,
      role: "agent",
      text: "Uploading video and analyzing intent...",
      status: "processing",
      progress: 0,
    };

    setMessages((prev) => [...prev, newUserMsg, initialAgentMsg]);
    setInputValue("");
    setSelectedFile(null);
    setIsProcessing(true);

    try {
      // 3. Start the Pipeline
      const cloudData = await uploadDirectlyToCloudinary(
        fileToProcess,
        (percent) => {
          updateAgentMessage(newAgentMsgId, {
            text: `Uploading media securely to cloud storage...`,
            progress: percent,
          });
        },
      );

      const jobId = await startVideoProcessingJob(
        cloudData.videoUrl,
        cloudData.publicId,
        fileToProcess.name,
        userPrompt,
      );

      pollJobProgress(jobId, newAgentMsgId);
    } catch (error) {
      updateAgentMessage(newAgentMsgId, {
        text: `Error: ${error.message}`,
        status: "error",
      });
      setIsProcessing(false);
    }
  };

  const pollJobProgress = (jobId, messageId) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await checkJobStatus(jobId);
        let statusText = "Processing...";

        if (status.progress === 10)
          statusText = "Downloading video to isolated processing tier...";
        if (status.progress === 35)
          statusText = "Isolating and optimizing audio tracks...";
        if (status.progress === 60)
          statusText = "Gemini AI Agent analyzing for exact timestamps...";
        if (status.progress === 85)
          statusText = "Splicing and rendering final video...";

        updateAgentMessage(messageId, {
          text: statusText,
          progress: status.progress || 0,
        });

        if (status.state === "completed") {
          clearInterval(pollInterval);
          updateAgentMessage(messageId, {
            text: "Analysis and rendering complete! Here is your requested video:",
            status: "completed",
            videoUrl: status.result.editedVideoUrl,
          });
          setIsProcessing(false);
        } else if (status.state === "failed") {
          clearInterval(pollInterval);
          updateAgentMessage(messageId, {
            text: `Processing failed: ${status.failedReason}`,
            status: "error",
          });
          setIsProcessing(false);
        }
      } catch (error) {
        clearInterval(pollInterval);
        updateAgentMessage(messageId, {
          text: "Lost connection to agent.",
          status: "error",
        });
        setIsProcessing(false);
      }
    }, 2000);
  };

  const updateAgentMessage = (id, updates) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[85vh] overflow-hidden">
        {/* Chat Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center shrink-0">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3">
            <Video size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              Video Architect
            </h1>
            <p className="text-sm text-slate-500">Autonomous Editing Agent</p>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* Agent Avatar */}
              {msg.role === "agent" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mr-3 mt-1">
                  <Bot size={18} />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                }`}
              >
                {/* User Attachment Tag */}
                {msg.fileName && (
                  <div className="flex items-center text-blue-100 text-xs mb-2 bg-blue-700/50 w-fit px-2 py-1 rounded">
                    <Paperclip size={12} className="mr-1" /> {msg.fileName}
                  </div>
                )}

                <p className="text-[15px] leading-relaxed">{msg.text}</p>

                {/* Agent Loading Bar */}
                {msg.status === "processing" && (
                  <div className="mt-4">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${msg.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Rendered Video Result */}
                {msg.status === "completed" && msg.videoUrl && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-black">
                    <video
                      src={msg.videoUrl}
                      controls
                      className="w-full max-h-[300px]"
                    />
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 ml-3 mt-1">
                  <User size={18} />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          {selectedFile && (
            <div className="mb-3 px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center w-fit border border-blue-100">
              <Video size={16} className="mr-2" />
              {selectedFile.name}
              <button
                onClick={() => setSelectedFile(null)}
                className="ml-3 text-blue-400 hover:text-blue-600 font-bold"
              >
                ×
              </button>
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            className="flex items-center space-x-2"
          >
            <label className="cursor-pointer p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              <Paperclip size={24} />
            </label>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isProcessing}
              placeholder="e.g., 'Trim the first 10 seconds' or 'Find the most energetic part'"
              className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl px-5 py-3 text-slate-700 placeholder-slate-400 outline-none transition-all disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isProcessing || !inputValue.trim() || !selectedFile}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-sm"
            >
              {isProcessing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Send size={24} />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
