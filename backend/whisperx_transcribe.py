import whisperx
import sys
import json
import os
import yt_dlp
import torch
import torchaudio


def load_audio_tensor(audio_path):
    """Load audio as a pyannote-compatible dict (for diarization)."""
    waveform, sample_rate = torchaudio.load(audio_path)
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    return {"waveform": waveform, "sample_rate": sample_rate}


def download_youtube(url):
    opts = {
        "format": "bestaudio/best",
        "outtmpl": "yt_audio.%(ext)s",
        "quiet": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        base = os.path.splitext(ydl.prepare_filename(info))[0]
        return base + ".wav"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio input provided"}))
        sys.exit(1)

    audio_input = sys.argv[1]
    device = "cpu"

    if audio_input.startswith("http"):
        audio_path = download_youtube(audio_input)
    else:
        audio_path = audio_input

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
        sys.exit(1)

    # whisperx.load_audio returns a float32 numpy array at 16kHz mono
    audio_array = whisperx.load_audio(audio_path)

    model = whisperx.load_model("base", device=device, compute_type="int8")
    result = model.transcribe(audio_array)

    language = result.get("language", "en")
    try:
        align_model, metadata = whisperx.load_align_model(language_code=language, device=device)
        result = whisperx.align(result["segments"], align_model, metadata, audio_array, device)
    except Exception as e:
        sys.stderr.write(f"Alignment skipped: {e}\n")

    # Diarization is optional — requires HF_TOKEN and accepted model terms
    hf_token = os.environ.get("HF_TOKEN")
    diarized = False
    if hf_token:
        try:
            # pyannote diarization needs audio as a tensor dict
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

    segments = []
    for i, seg in enumerate(result["segments"]):
        speaker = seg.get("speaker") if diarized else f"Speaker {i + 1}"
        segments.append({
            "speaker": speaker or "Speaker 1",
            "start": round(seg["start"], 3),
            "end": round(seg["end"], 3),
            "text": seg["text"].strip(),
        })

    print(json.dumps({"segments": segments}))


if __name__ == "__main__":
    main()
