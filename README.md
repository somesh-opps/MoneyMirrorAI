<div align="center">

<br/>

# 💸 MoneyMirror AI

### _Your intelligent, AI-driven personal financial twin and analytics platform._

<br/>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Try_It_Now!-4ade80?style=for-the-badge&logo=vercel&logoColor=white)](https://money-mirror-ai.vercel.app/)
&nbsp;
[![GitHub Stars](https://img.shields.io/github/stars/somesh-opps/MoneyMirrorAI?style=for-the-badge&logo=github&color=facc15)](https://github.com/somesh-opps/MoneyMirrorAI)
&nbsp;
[![MIT License](https://img.shields.io/badge/License-MIT-a78bfa?style=for-the-badge)](./LICENSE)

<br/>

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

<br/>

> **MoneyMirror** transforms raw bank transactions into a living, breathing financial portrait — complete with AI diagnostics, a simulated financial twin, subscription intelligence, and a voice-powered chatbot.

<br/>

</div>

---

## 📸 At a Glance

| Dashboard | Financial Doctor | Subscription Radar |
|:---------:|:----------------:|:-----------------:|
| Interactive charts & KPIs | AI-powered health scoring | Auto-detected recurring costs |
| Zustand + React Query | Heuristic + ML engine | Pattern-matching algorithms |

---

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🏥 Financial Doctor</h3>
      <p>Automatically diagnoses your financial health by analyzing spending habits, savings rate, and expense ratios — delivering a personalized health score with actionable recovery steps.</p>
    </td>
    <td width="50%">
      <h3>👯 Financial Twin</h3>
      <p>Generates a simulated "twin" profile from your data to project future financial trajectories, helping you visualize and plan your ideal financial path.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📉 Subscription Radar</h3>
      <p>Automatically detects recurring subscriptions buried in your transactions. Uncover hidden costs and optimize your monthly cash flow effortlessly.</p>
    </td>
    <td width="50%">
      <h3>🎙️ Voice AI Chatbot</h3>
      <p>Talk to your finances naturally. Powered by <code>faster-whisper</code>, the chatbot understands complex financial queries and responds with real-time, conversational insights.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔐 Secure Persistence</h3>
      <p>User-scoped financial data is securely stored in MongoDB with robust JWT authentication, ensuring your data is always safe, synced, and private.</p>
    </td>
    <td width="50%">
      <h3>📊 Dynamic Dashboards</h3>
      <p>Beautiful, responsive, and interactive charts built with <strong>Recharts</strong> and <strong>Radix UI</strong> — giving you a crystal-clear view of your financial world.</p>
    </td>
  </tr>
</table>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        MoneyMirror AI                            │
│                                                                  │
│   ┌─────────────────────┐       ┌────────────────────────────┐  │
│   │   React 19 + Vite   │──────▶│   Flask API Gateway        │  │
│   │   (SPA Frontend)    │       │   Auth · Upload · Session  │  │
│   │   TanStack Router   │       └────────────┬───────────────┘  │
│   │   Zustand · Recharts│                    │                  │
│   └─────────────────────┘                    ▼                  │
│                                 ┌────────────────────────────┐  │
│                                 │   FastAPI Compute Engine   │  │
│                                 │   Whisper · NumPy · Pandas │  │
│                                 │   Financial Algorithms     │  │
│                                 └────────────┬───────────────┘  │
│                                              │                  │
│                                              ▼                  │
│                                 ┌────────────────────────────┐  │
│                                 │       MongoDB Atlas         │  │
│                                 │   Users · Transactions ·   │  │
│                                 │   Subscriptions · Analysis │  │
│                                 └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- **Frontend** — Lightning-fast SPA with React 19, Vite, and TanStack Router. State managed by Zustand & React Query.
- **API Gateway (Flask)** — Handles auth, file uploads, and session management for the entire platform.
- **Compute Engine (FastAPI)** — High-performance Python backend for ML inference, financial algorithms, and heavy data processing.
- **Database (MongoDB)** — Persistent, user-scoped storage for transactions, subscriptions, and all analysis results.

---

## 🛠️ Tech Stack

### 🎨 Frontend

| Category | Technology |
|---|---|
| Framework | React 19 + Vite |
| Routing | TanStack Router |
| Styling | Tailwind CSS v4, Radix UI Primitives |
| Animation | Framer Motion (via tw-animate-css) |
| Charts | Recharts |
| State Management | Zustand, React Query |
| Forms & Validation | React Hook Form + Zod |

### ⚙️ Backend

| Category | Technology |
|---|---|
| API Gateway | Flask |
| Compute Engine | FastAPI + Uvicorn |
| Database | MongoDB (PyMongo) |
| Data Science | NumPy, Pandas |
| AI / Speech | `faster-whisper` (Whisper model) |
| Audio Processing | FFmpeg, PyAV, python-multipart |

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18+
- **Python** 3.10+
- **MongoDB** URI (local or [Atlas](https://www.mongodb.com/atlas))
- **FFmpeg** — required for voice processing ([install guide](https://ffmpeg.org/download.html))

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/somesh-opps/MoneyMirrorAI.git
cd MoneyMirrorAI
```

---

### 2️⃣ Frontend Setup

```bash
cd MoneyMirrorweb
npm install
npm run dev
```

> The frontend will be available at **`http://localhost:5173`**

---

### 3️⃣ Backend Setup

It is highly recommended to use a virtual environment.

```bash
cd MoneyMirrorBackend/backend

# Create and activate a virtual environment
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
# venv\Scripts\activate

pip install -r requirements.txt
```

Start both servers:

```bash
# FastAPI Computation Engine
uvicorn main:app --reload --port 8000

# Flask API Gateway (in a separate terminal)
python app.py
```

---

## ⚙️ Environment Variables

Create `.env` files in both directories before starting the servers.

### Backend — `MoneyMirrorBackend/backend/.env`

```env
MONGO_URI=your_mongodb_connection_string
SECRET_KEY=your_flask_secret_key
GEMINI_API_KEY=your_gemini_api_key
```

### Frontend — `MoneyMirrorweb/.env.local`

```env
VITE_API_URL=http://localhost:5000   # Points to the Flask Gateway
```

---

## 🧠 Core Algorithms

The proprietary computation engine at the heart of MoneyMirror powers:

| Module | What It Does |
|---|---|
| **Data Normalization** | Standardizes diverse transaction formats (CSV, JSON) into a unified, actionable schema |
| **Financial Doctor** | Scores financial health using heuristic rules across savings rate, expense ratios, and spending velocity |
| **Financial Twin** | Simulates a personalized future financial projection using your historical patterns |
| **Subscription Detection** | Uses pattern-matching and frequency analysis to surface recurring charges automatically |
| **Recovery Yield Logic** | Calculates potential monthly savings by eliminating unnecessary subscriptions and optimizing ratios |

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">

<br/>

**MoneyMirror AI** — _Built to make personal finance intelligent, transparent, and manageable._

<br/>

[![Made with ❤️](https://img.shields.io/badge/Made_with-❤️-ff6b6b?style=flat-square)](https://money-mirror-ai.vercel.app/)
&nbsp;
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel)](https://money-mirror-ai.vercel.app/)

<br/>

</div>
