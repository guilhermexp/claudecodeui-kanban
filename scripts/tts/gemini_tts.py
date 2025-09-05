#!/usr/bin/env python3
# Requires: pip install google-genai

import os
import sys
import base64
import struct
import mimetypes
import google.generativeai as genai
from google.generativeai import types

def parse_audio_mime_type(mime_type: str):
    bits_per_sample = 16
    rate = 24000
    parts = mime_type.split(";")
    for param in parts:
        p = param.strip()
        if p.lower().startswith("rate="):
            try:
                rate = int(p.split("=", 1)[1])
            except Exception:
                pass
        elif p.startswith("audio/L"):
            try:
                bits_per_sample = int(p.split("L", 1)[1])
            except Exception:
                pass
    return {"bits_per_sample": bits_per_sample, "rate": rate}

def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    params = parse_audio_mime_type(mime_type)
    bits_per_sample = params["bits_per_sample"]
    sample_rate = params["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + audio_data

def main():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(2)

    # Read input text for summarization
    summarization_prompt = os.environ.get("INPUT_TEXT")
    if not summarization_prompt:
        summarization_prompt = sys.stdin.read()
    if not summarization_prompt:
        print("ERROR: No input text provided", file=sys.stderr)
        sys.exit(2)

    voice_name = os.environ.get("VOICE_NAME", "Zephyr")

    genai.configure(api_key=api_key)

    # --- Step 1: Summarization ---
    try:
        summarization_model = genai.GenerativeModel('gemini-1.5-flash-latest')
        response = summarization_model.generate_content(summarization_prompt)
        summarized_text = response.text
    except Exception as e:
        print(f"ERROR: Failed to generate summary: {e}", file=sys.stderr)
        # Fallback to using the original text if summarization fails
        summarized_text = summarization_prompt.split("TEXTO:\n")[-1]

    # --- Step 2: Text-to-Speech ---
    try:
        tts_model = genai.GenerativeModel('gemini-2.5-flash-preview-tts') # Using the new fast TTS model
        
        # Generate audio from the summarized text
        audio_response = tts_model.generate_content(
            summarized_text,
            generation_config=genai.types.GenerationConfig(
                response_modalities=["audio"],
                speech_config=genai.types.SpeechConfig(
                    voice_config=genai.types.VoiceConfig(
                        prebuilt_voice_config=genai.types.PrebuiltVoiceConfig(voice_name=voice_name)
                    )
                ),
            )
        )
        
        # --- Step 3: Process and Output Audio ---
        audio_chunks = []
        mime_type = None
        for chunk in audio_response:
            try:
                cand = chunk.candidates
                if not cand:
                    continue
                parts = cand[0].content.parts
                if not parts:
                    continue
                inline = parts[0].inline_data
                if inline and inline.data:
                    if mime_type is None:
                        mime_type = inline.mime_type or "audio/wav"
                    audio_chunks.append(inline.data)
            except Exception:
                continue

        if not audio_chunks:
            print("ERROR: No audio returned by TTS model", file=sys.stderr)
            sys.exit(3)

        raw_audio = b"".join(audio_chunks)
        if (mime_type or "").lower() != "audio/wav":
            raw_audio = convert_to_wav(raw_audio, mime_type or "audio/L16;rate=24000")

        b64 = base64.b64encode(raw_audio).decode("ascii")
        print(b64)

    except Exception as e:
        print(f"ERROR: Failed to generate audio: {e}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()