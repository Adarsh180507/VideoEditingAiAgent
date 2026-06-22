import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Video, Calendar, Loader2, Download } from "lucide-react";
import axios from "axios";

export default function Dashboard() {
  const { token } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/user/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistory(res.data);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchHistory();
  }, [token]);

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-73px)] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-slate-400">Loading your gallery...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-73px)] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-slate-800/50 rounded-full mb-4 border border-slate-700">
          <Video size={48} className="text-slate-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Your Gallery is Empty
        </h2>
        <p className="text-slate-400 max-w-md">
          You haven't generated any videos yet. Switch back to the Agent Editor
          to create your first masterpiece!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 sm:p-8 h-[calc(100vh-73px)] overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">My Gallery</h2>
        <p className="text-slate-400 mt-1">
          All your AI-generated edits in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {history.map((item, index) => (
          <div
            key={index}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg hover:border-slate-700 transition-colors flex flex-col"
          >
            <div className="aspect-video bg-black relative">
              <video
                src={item.videoUrl}
                controls
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-5 flex flex-col flex-1">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-slate-300 line-clamp-2 flex-1 pr-4 font-medium">
                  "{item.prompt}"
                </p>
                <a
                  href={item.videoUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors shrink-0"
                  title="Download Video"
                >
                  <Download size={16} />
                </a>
              </div>

              <div className="mt-auto flex items-center text-xs text-slate-500">
                <Calendar size={14} className="mr-1.5" />
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
