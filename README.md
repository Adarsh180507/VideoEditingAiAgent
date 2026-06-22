Video Architect 🎥
Your autonomous AI-powered Video Editing Agent.

I built this project to solve a recurring problem: manually editing raw footage into highlights is tedious, repetitive, and time-consuming. Video Architect leverages the power of Gemini AI to understand natural language prompts, analyze video content, and automate the cutting and rendering process, giving you back your time.

What it does
Intelligent Analysis: Send a raw video and a plain-English request (e.g., "Find the most energetic part"), and the AI does the heavy lifting.

Seamless Pipeline: Uploads directly to Cloudinary, queues processing with BullMQ/Redis, and delivers the final edit back to your dashboard.

SaaS-Ready: Built-in credit system, secure user authentication, and a private gallery to manage your generated clips.

Built With
Frontend: React, Tailwind CSS, Lucide Icons

Backend: Node.js, Express, MongoDB

AI/Processing: Gemini AI, BullMQ (Redis), Cloudinary

Deployment Architecture: Monorepo structure with automated worker nodes
