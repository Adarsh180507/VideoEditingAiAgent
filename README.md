# 🎬 AI-Powered Video Editing SaaS

A highly scalable, full-stack SaaS platform that automates video editing and content highlighting. Built for performance, this application leverages Gemini AI for intelligent analysis, an asynchronous Redis/BullMQ task queue for heavy video rendering, and a secure, credit-based paywall system.

## ✨ Key Features

* **🤖 Autonomous Content Pipeline:** Engineered an intelligent video editing pipeline using **Gemini AI** and **Cloudinary** to automate content highlighting and processing.
* **⚡ Asynchronous Processing:** Implemented **BullMQ** and **Redis** for task queuing, enabling non-blocking, scalable performance for compute-intensive video rendering.
* **🔒 Scalable SaaS Architecture:** Designed a secure backend featuring **JWT-based authentication**, a credit-consumption paywall, and **MongoDB** for efficient asset metadata management.
* **☁️ Media Workflow Optimization:** Streamlined data flow using **direct-to-cloud upload patterns**, significantly reducing server bandwidth and processing overhead.

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MongoDB, Mongoose
* **Caching & Message Broker:** Redis, BullMQ
* **AI & Media Infrastructure:** Google Gemini AI, Cloudinary API
* **Security:** JWT (JSON Web Tokens), bcrypt

## ⚙️ System Architecture

1. **Direct-to-Cloud Uploads:** The client requests a secure, signed signature from the Node.js server and uploads massive video files *directly* to Cloudinary. This prevents Node.js memory bottlenecks and reduces server bandwidth.
2. **Event-Driven Queuing:** Once the media is uploaded, the backend enqueues a video-processing job into **BullMQ**.
3. **Background Workers:** **Redis** manages the task queue while background worker processes interface with the **Gemini AI API** to analyze video context and generate highlight timestamps.
4. **Credit Paywall:** Every successful AI generation dynamically deducts from the user's credit balance in **MongoDB**, guarded by strict JWT authorization middlewares.

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
* [Node.js](https://nodejs.org/) (v18+)
* [MongoDB](https://www.mongodb.com/) (Local or Atlas)
* [Redis](https://redis.io/) (Running locally or via Docker)
* Cloudinary Account & API Keys
* Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Adarsh180507/VideoEditingAiAgent.git
   cd VideoEditingAiAgent
   ```

2. **Install dependencies:**
   ```bash
   # Install backend dependencies
   npm install

   # Install frontend dependencies
   cd client
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory and configure the following variables:

   ```env
   # Server
   PORT=8000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000

   # Database & Redis
   MONGODB_URI=your_mongodb_connection_string
   REDIS_URL=redis://localhost:6379

   # Authentication
   ACCESS_TOKEN_SECRET=your_super_secret_jwt_key
   ACCESS_TOKEN_EXPIRY=1d

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # AI Integration
   GEMINI_API_KEY=your_google_gemini_api_key
   ```

4. **Start the Application:**
   ```bash
   # Start backend server and background workers
   npm run dev

   # Start frontend client
   cd client
   npm run start
   ```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
