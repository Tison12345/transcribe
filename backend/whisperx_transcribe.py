import whisperx
import sys
import json
import os
import yt_dlp
import torch


def progress(pct, msg):
    sys.stderr.write(f"PROGRESS:{pct}:{msg}\n")
    sys.stderr.flush()



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
    language_arg = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ("", "auto") else None
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

    lang_label = language_arg if language_arg else "auto"
    progress(35, f"Transcribing speech ({lang_label})...")
    result = model.transcribe(audio_array, language=language_arg)

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
        progress(75, "Loading speaker ID model...")
        try:
            import threading
            from whisperx.diarize import DiarizationPipeline  # type: ignore[import-untyped]

            diarize_model = None
            for model_name in ["pyannote/speaker-diarization-3.1", "pyannote/speaker-diarization-community-1"]:
                try:
                    diarize_model = DiarizationPipeline(model_name=model_name, token=hf_token, device=device)
                    break
                except Exception as e:
                    err_str = str(e)
                    if "403" in err_str or "GatedRepo" in err_str or "gated" in err_str.lower():
                        sys.stderr.write(f"DIARIZE_GATED:{model_name}\n")
                    continue

            if diarize_model is None:
                raise RuntimeError(
                    "Speaker diarization models are gated. "
                    "Visit https://huggingface.co/pyannote/speaker-diarization-3.1 "
                    "and https://huggingface.co/pyannote/speaker-diarization-community-1 "
                    "while logged in to accept the terms, then retry."
                )

            progress(78, "Identifying speakers (this can take a few minutes)...")

            # Run diarization in a thread so we can send heartbeat progress
            cur_pct = [78]
            diarize_result = [None]
            diarize_error = [None]

            def run_diarize():
                try:
                    diarize_result[0] = diarize_model(audio_array)
                except Exception as e:
                    diarize_error[0] = e

            t = threading.Thread(target=run_diarize, daemon=True)
            t.start()
            while t.is_alive():
                t.join(timeout=8)
                if t.is_alive() and cur_pct[0] < 92:
                    cur_pct[0] += 2
                    progress(cur_pct[0], "Identifying speakers...")

            if diarize_error[0]:
                raise diarize_error[0]

            result = whisperx.assign_word_speakers(diarize_result[0], result)
            diarized = True
        except Exception as e:
            sys.stderr.write(f"Diarization skipped: {e}\n")
            if "gated" in str(e).lower() or "403" in str(e) or "GatedRepo" in str(e):
                progress(80, "Speaker ID needs HuggingFace access — see README")

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
