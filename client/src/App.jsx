import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Video,
  Loader2,
  Send,
  Paperclip,
  Bot,
  User,
  LayoutDashboard,
} from "lucide-react";
import { AuthContext } from "./context/AuthContext";
import AuthForm from "./components/AuthForm";
import Dashboard from "./components/Dashboard";
import {
  uploadDirectlyToCloudinary,
  checkJobStatus,
  startVideoProcessingJob,
} from "./services/api";

export default function App() {
  const { user, token, logout, updateCredits } = useContext(AuthContext);
  const [currentView, setCurrentView] = useState("editor");
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
  const [activeVideoContext, setActiveVideoContext] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => scrollToBottom(), [messages]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setActiveVideoContext(null);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (
      !inputValue.trim() ||
      (!selectedFile && !activeVideoContext) ||
      isProcessing
    )
      return;

    const userPrompt = inputValue;
    const fileToProcess = selectedFile;
    const newUserMsg = {
      id: Date.now(),
      role: "user",
      text: userPrompt,
      fileName: fileToProcess ? fileToProcess.name : activeVideoContext.name,
    };

    const newAgentMsgId = Date.now() + 1;
    const initialAgentMsg = {
      id: newAgentMsgId,
      role: "agent",
      text: "Analyzing request...",
      status: "processing",
      progress: 0,
    };

    setMessages((prev) => [...prev, newUserMsg, initialAgentMsg]);
    setInputValue("");
    if (fileToProcess) setSelectedFile(null);
    setIsProcessing(true);

    try {
      let cloudData = activeVideoContext;
      if (!cloudData) {
        cloudData = await uploadDirectlyToCloudinary(
          fileToProcess,
          (percent) => {
            updateAgentMessage(newAgentMsgId, {
              text: `Uploading media securely to cloud storage...`,
              progress: percent,
            });
          },
          token,
        );
        setActiveVideoContext({
          videoUrl: cloudData.videoUrl,
          publicId: cloudData.publicId,
          name: fileToProcess.name,
        });
      } else {
        updateAgentMessage(newAgentMsgId, {
          text: `Accessing ${cloudData.name} from memory...`,
          progress: 5,
        });
      }
      const data = await startVideoProcessingJob(
        cloudData.videoUrl,
        cloudData.publicId,
        cloudData.name,
        userPrompt,
        token,
      );
      if (data.creditsRemaining !== undefined) {
        updateCredits(data.creditsRemaining);
      }
      pollJobProgress(data.jobId, newAgentMsgId, userPrompt);
    } catch (error) {
      updateAgentMessage(newAgentMsgId, {
        text: `Error: ${error.message}`,
        status: "error",
      });
      setIsProcessing(false);
    }
  };

  const pollJobProgress = (jobId, messageId, originalPrompt) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await checkJobStatus(jobId);
        let statusText = "Processing...";
        if (status.progress === 5)
          statusText = "Analyzing intent for fast-lane routing...";
        else if (status.progress === 10)
          statusText = "Downloading video to isolated processing tier...";
        else if (status.progress === 35)
          statusText = "Isolating and optimizing audio tracks...";
        else if (status.progress === 60)
          statusText = "Gemini AI Agent analyzing for exact timestamps...";
        else if (status.progress === 85)
          statusText = "Splicing and rendering final video...";

        updateAgentMessage(messageId, {
          text: statusText,
          progress: status.progress || 0,
        });

        if (status.state === "completed") {
          clearInterval(pollInterval);
          const agentMessage = status.result.insights
            ? status.result.insights
            : "Analysis and rendering complete! Here is your requested video:";

          updateAgentMessage(messageId, {
            text: agentMessage,
            status: "completed",
            videoUrl: status.result.editedVideoUrl,
          });
          setActiveVideoContext({
            videoUrl: status.result.editedVideoUrl,
            publicId: status.result.publicId || "edited_video",
            name: "edited_clip.mp4",
          });
          try {
            await fetch("http://localhost:5000/api/user/history", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                videoUrl: status.result.editedVideoUrl,
                publicId: status.result.publicId || "edited_video",
                prompt: originalPrompt,
              }),
            });
          } catch (err) {
            console.error("Failed to save to database history", err);
          }

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
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <Video size={40} />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-2">
            Video Architect
          </h1>
          <p className="text-slate-400 text-lg">Autonomous AI Editing Agent</p>
        </div>
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center text-slate-200">
      <header className="w-full border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex justify-between items-center shrink-0 z-50 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Video size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Video Architect</h1>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        <div className="hidden sm:flex bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setCurrentView("editor")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              currentView === "editor"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Agent Editor
          </button>
          <button
            onClick={() => setCurrentView("dashboard")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              currentView === "dashboard"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <LayoutDashboard size={16} />
            My Gallery
          </button>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">
            <span className="hidden sm:inline text-sm font-medium text-slate-300">
              Credits:
            </span>
            <span
              className={`text-sm font-bold ${user.credits > 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {user.credits}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {currentView === "dashboard" ? (
        <Dashboard />
      ) : (
        <div className="w-full max-w-4xl flex flex-col h-[calc(100vh-73px)]">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "agent" && (
                  <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mr-3 mt-1">
                    <Bot size={18} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm shadow-md"
                      : "bg-slate-900 border border-slate-700 text-slate-200 rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.fileName && (
                    <div className="flex items-center text-xs mb-3 bg-black/20 w-fit px-2.5 py-1.5 rounded-md border border-white/10">
                      <Paperclip size={12} className="mr-1.5 opacity-70" />
                      <span className="opacity-90 font-medium">
                        {msg.fileName}
                      </span>
                    </div>
                  )}

                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </p>

                  {msg.status === "processing" && (
                    <div className="mt-4">
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 relative"
                          style={{ width: `${msg.progress}%` }}
                        >
                          <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.status === "completed" && msg.videoUrl && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-slate-700 bg-black shadow-lg">
                      <video
                        src={msg.videoUrl}
                        controls
                        className="w-full max-h-[350px]"
                      />
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 text-slate-400 flex items-center justify-center shrink-0 ml-3 mt-1">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
            {selectedFile && (
              <div className="mb-3 px-4 py-2 bg-blue-900/30 text-blue-300 text-sm rounded-lg flex items-center w-fit border border-blue-500/30">
                <Video size={16} className="mr-2" />
                {selectedFile.name}
                <button
                  onClick={() => setSelectedFile(null)}
                  className="ml-3 text-blue-400 hover:text-blue-200 font-bold transition-colors"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-3"
            >
              <label
                className={`cursor-pointer p-3 rounded-xl transition-colors ${activeVideoContext ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" : "text-slate-400 hover:text-blue-400 hover:bg-slate-800"}`}
              >
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
                placeholder={
                  activeVideoContext
                    ? "Editing active video... e.g., 'Trim it by 2 seconds'"
                    : "Attach a video to begin..."
                }
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-5 py-3.5 text-slate-200 placeholder-slate-500 outline-none transition-all disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={
                  isProcessing ||
                  !inputValue.trim() ||
                  (!selectedFile && !activeVideoContext)
                }
                className="p-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md"
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
      )}
    </div>
  );
}
