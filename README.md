# Dabar (דָּבָר) 🎙️✨

Dabar is a premium AI-powered sermon transcription and highlight extraction pipeline built using a **Django REST Framework** backend and a **React + Vite + TailwindCSS** frontend. Dabar automatically downloads YouTube audio, transcribes it using high-accuracy **Whisper (via Groq)**, identifies key teaching moments, and prepares beautifully formatted 9:16 vertical clips ready for social media dissemination (Instagram Reels, YouTube Shorts, TikTok).

---

## Features 🚀

- **Automated YouTube Pipeline**: Paste any sermon link; Dabar downloads and extracts high-fidelity audio streams bypassing anti-bot measures.
- **Whisper Transcription Engine**: Uses Groq's high-speed Whisper Large (`whisper-large-v3`) API to generate detailed, timestamped transcripts.
- **AI Moment & Highlight Detection**: Segments teachings into thematic points and conviction-heavy passages.
- **Interactive Clip Studio**: Customize captions with dynamic visual themes (Gold Focus, Kinetic Bold, Minimal Dark, Clean Light) and resize output aspect ratios (9:16 vertical, 1:1 square, 16:9 landscape).
- **Graceful Async Processing**: Processes sermons in Celery task queues in production, with an automatic background-thread fallback for zero-dependency local development.
- **Vibrant & Elevated Aesthetics**: Glassmorphic dashboards, live progress tracking indicators, gold gradient typography, and audio previewers.

---

## Tech Stack 🛠️

### Backend
- **Core**: Django 5.0, Django REST Framework (DRF)
- **AI/Transcription**: Groq API (Whisper-large-v3)
- **Background Tasks**: Celery, Redis (with daemon Thread fallbacks)
- **Audio Extraction**: yt-dlp

### Frontend
- **Core**: React 19, React Router DOM v7
- **Bundler**: Vite 6
- **Styling**: TailwindCSS 3.4
- **Icons**: Lucide React

---

## Getting Started ⚙️

### Prerequisites
- **Python**: 3.14+
- **Node.js**: 18+
- A **Groq API Key** (Get one at [console.groq.com](https://console.groq.com))

---

### Backend Setup

1. **Create and Activate Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```

2. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   DEBUG=True
   SECRET_KEY=your-django-secret-key
   GROQ_API_KEY=your_groq_api_key_here
   TRANSCRIPTION_BACKEND=groq
   ```

4. **Run Migrations & Start Django Server**:
   ```bash
   python manage.py migrate
   python manage.py runserver
   ```
   The backend server runs at: `http://127.0.0.1:8000`

---

### Frontend Setup

1. **Install Node Packages**:
   ```bash
   npm install
   ```

2. **Run Vite Development Server**:
   ```bash
   npm run dev
   ```
   The frontend application runs at: `http://localhost:5173`

3. **Build for Production**:
   ```bash
   npm run build
   ```

---

## CLI Management Commands 💻

You can also run transcription manually from the terminal:
```bash
python manage.py transcribe_sermon <sermon_id_or_youtube_url>
```

---

## Running Unit Tests 🧪

To verify the Django REST endpoints and transcription models:
```bash
python manage.py test
```
