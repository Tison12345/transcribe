import whisperx
import sys
import json
import os
import yt_dlp
import torch
import torchaudio


def progress(pct, msg):
    sys.stderr.write(f"PROGRESS:{pct}:{msg}\n")
    sys.stderr.flush()


def load_audio_tensor(audio_path):
    waveform, sample_rate = torchaudio.load(audio_path)
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    return {"waveform": waveform, "sample_rate": sample_rate}


def download_youtube(url):
    # cookies.txt (Netscape format) placed next to this script takes priority
    cookies_file = os.path.join(os.path.dirname(__file__), "cookies.txt")

    node_path = "C:\\Program Files\\nodejs\\node.exe"
    base_opts = {
        "format": "bestaudio/bestvideo/best",
        "outtmpl": "yt_audio.%(ext)s",
        "quiet": True,
        "js_runtimes": {"node": {"path": node_path}} if os.path.exists(node_path) else {},
        "remote_components": ["ejs:github"],
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }],
    }

    if os.path.exists(cookies_file):
        attempts = [{"cookiefile": cookies_file}]
    else:
        # Background processes can't read browser cookies on Windows via DPAPI,
        # so skip browser attempts and go straight to unauthenticated.
        attempts = [{}]

    last_err = None
    for extra in attempts:
        opts = {**base_opts, **extra}
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                base = os.path.splitext(ydl.prepare_filename(info))[0]
                return base + ".wav"
        except Exception as e:
            last_err = e
            continue

    # Surface a helpful message
    msg = str(last_err)
    if "Sign in" in msg or "bot" in msg or "429" in msg:
        raise RuntimeError(
            "YouTube blocked the download (bot check). "
            "Export your YouTube cookies to backend/cookies.txt and retry. "
            "Use the 'Get cookies.txt LOCALLY' Chrome extension: "
            "open youtube.com while logged in, click the extension, save as backend/cookies.txt"
        )
    raise last_err


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio input provided"}))
        sys.exit(1)

    audio_input = sys.argv[1]
    device = "cpu"

    if audio_input.startswith("http"):
        progress(5, "Downloading YouTube audio...")
        try:
            audio_path = download_youtube(audio_input)
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
    else:
        audio_path = audio_input

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
        sys.exit(1)

    progress(10, "Loading audio...")
    audio_array = whisperx.load_audio(audio_path)

    progress(20, "Loading transcription model...")
    model = whisperx.load_model("base", device=device, compute_type="int8")

    progress(35, "Transcribing speech...")
    result = model.transcribe(audio_array)

    language = result.get("language", "en")

    progress(60, "Aligning timestamps...")
    try:
        align_model, metadata = whisperx.load_align_model(language_code=language, device=device)
        result = whisperx.align(result["segments"], align_model, metadata, audio_array, device)
    except Exception as e:
        sys.stderr.write(f"Alignment skipped: {e}\n")

    hf_token = os.environ.get("HF_TOKEN")
    diarized = False
    if hf_token:
        progress(75, "Identifying speakers...")
        try:
            audio_dict = load_audio_tensor(audio_path)
            try:
                from whisperx.diarize import DiarizationPipeline  # type: ignore[import-untyped]
                diarize_model = DiarizationPipeline(token=hf_token, device=device)
            except (ImportError, TypeError):
                diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_token, device=device)  # type: ignore[attr-defined]

            try:
                diarize_segments = diarize_model(audio_dict)
            except Exception:
                diarize_segments = diarize_model(audio_path)

            result = whisperx.assign_word_speakers(diarize_segments, result)
            diarized = True
        except Exception as e:
            sys.stderr.write(f"Diarization skipped: {e}\n")

    progress(95, "Building transcript...")
    segments = []
    for seg in result["segments"]:
        speaker = seg.get("speaker") if diarized else "Speaker 1"
        segments.append({
            "speaker": speaker or "Speaker 1",
            "start": round(seg["start"], 3),
            "end": round(seg["end"], 3),
            "text": seg["text"].strip(),
        })

    print(json.dumps({"segments": segments}))


if __name__ == "__main__":
    main()
