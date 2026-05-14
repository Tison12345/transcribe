# VoiceScript

Speaker-aware audio transcription powered by [WhisperX](https://github.com/m-bain/whisperX). Upload an audio file or paste a YouTube URL and get a timestamped, speaker-labeled transcript you can export as TXT, JSON, or SRT.

---

## Features

- **File upload** — drag & drop or browse (MP3, WAV, M4A, FLAC, OGG, WebM, up to 200 MB)
- **YouTube support** — paste any public YouTube URL; audio is extracted automatically via yt-dlp
- **Speaker diarization** — identifies and color-codes individual speakers (requires HF token)
- **Timestamp alignment** — word-level timestamps aligned to the audio timeline
- **Speaker filter** — click any speaker in the sidebar to filter the transcript
- **Full-text search** — search across all segments instantly
- **Export** — download the transcript as TXT, JSON, or SRT subtitles

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend (API) | Next.js App Router API routes (Node.js) |
| Transcription | WhisperX (`base` model, CPU) |
| Diarization | pyannote/speaker-diarization (optional) |
| YouTube audio | yt-dlp + ffmpeg |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.10–3.12 (with the project's venv)
- **ffmpeg** on your system PATH ([install guide](https://ffmpeg.org/download.html))
- A **Hugging Face token** (only needed for speaker diarization)

---

## Setup

### 1. Clone & install Node dependencies

```bash
git clone https://github.com/Tison12345/transcribe.git
cd transcribe
npm install
```

### 2. Set up the Python virtual environment

```bash
# Create venv
python -m venv backend/venv

# Activate (Windows)
backend\venv\Scripts\activate

# Activate (macOS / Linux)
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Configure environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

`.env.local`:

```env
# Required for speaker diarization
# Get a token at https://huggingface.co/settings/tokens
# Then accept model terms at https://huggingface.co/pyannote/speaker-diarization-3.1
HF_TOKEN=hf_your_token_here
```

> **Note:** Transcription works without `HF_TOKEN`. Speaker labels are skipped and segments are numbered sequentially instead.

---

## Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The Next.js server handles both the frontend and the `/api/transcribe` route, which spawns the Python backend as a subprocess.

---

## How It Works

```text
User uploads file / pastes YouTube URL
        │
        ▼
POST /api/transcribe  (Next.js API route)
        │
        ├── File upload → saved to OS temp dir
        └── YouTube URL → passed directly to Python
                │
                ▼
        whisperx_transcribe.py
                │
                ├─ 1. Download YouTube audio (yt-dlp) — if URL
                ├─ 2. Load audio (whisperx.load_audio)
                ├─ 3. Transcribe (WhisperX base model)
                ├─ 4. Align timestamps (word-level)
                └─ 5. Diarize speakers (pyannote) — if HF_TOKEN set
                │
                ▼
        JSON { segments: [{ speaker, start, end, text }] }
                │
                ▼
        TranscriptViewer renders speaker-colored segments
```

---

## Project Structure

```text
transcribe/
├── app/
│   ├── api/transcribe/route.js     # API route — spawns Python subprocess
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── UploadBox.jsx           # File dropzone + YouTube input
│   │   └── TranscriptViewer.jsx    # Segments, filter, search, export
│   ├── globals.css
│   ├── layout.tsx
│   └── page.jsx
├── backend/
│   ├── whisperx_transcribe.py      # Core transcription + diarization
│   ├── requirements.txt
│   └── venv/                       # Python virtual environment
├── public/
├── .env.example
└── package.json
```

---

## Export Formats

| Format | Contents |
| --- | --- |
| **TXT** | `[start – end] Speaker N:` followed by segment text |
| **JSON** | `{ "segments": [{ "speaker", "start", "end", "text" }] }` |
| **SRT** | Standard subtitle format with `[Speaker N]` prefix per cue |

---

## Troubleshooting

### Transcription returns empty or fails silently

- Check the browser console and Next.js terminal for error output
- Confirm the venv Python path: `backend/venv/Scripts/python.exe` (Windows) or `backend/venv/bin/python` (macOS/Linux)
- Make sure all Python dependencies are installed: `pip install -r backend/requirements.txt`

### Speaker diarization is skipped

- Ensure `HF_TOKEN` is set in `.env.local`
- Accept the pyannote model terms at [huggingface.co/pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
- Restart `npm run dev` after updating `.env.local`

### YouTube download fails

- Verify yt-dlp is installed in the venv: `pip install yt-dlp`
- Verify ffmpeg is on your PATH: `ffmpeg -version`
- Only public YouTube videos are supported

---

## License

MIT
