import { NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import crypto from "crypto";

function getPythonPath() {
  const venvPath = path.join(process.cwd(), "backend", "venv", "Scripts", "python.exe");
  return existsSync(venvPath) ? venvPath : "python";
}

function runPython(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const python = spawn(getPythonPath(), [scriptPath, ...args]);
    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    python.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    python.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `Python exited with code ${code}`));
        return;
      }
      const start = stdout.indexOf("{");
      const end = stdout.lastIndexOf("}");
      if (start === -1 || end === -1) {
        reject(new Error("No JSON in Python output. stderr: " + stderr.trim()));
        return;
      }
      try {
        resolve(JSON.parse(stdout.substring(start, end + 1)));
      } catch {
        reject(new Error("Failed to parse Python JSON output"));
      }
    });

    python.on("error", (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

export async function POST(req) {
  const scriptPath = path.join(process.cwd(), "backend", "whisperx_transcribe.py");
  let tempFile = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const url = formData.get("url");

    let inputArg;

    if (file && file.size > 0) {
      const ext = file.name?.split(".").pop() || "mp3";
      const id = crypto.randomBytes(8).toString("hex");
      tempFile = path.join(os.tmpdir(), `voicescript-${id}.${ext}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempFile, buffer);
      inputArg = tempFile;
    } else if (url && url.trim()) {
      inputArg = url.trim();
    } else {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    const result = await runPython(scriptPath, [inputArg]);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ transcript: result.segments });

  } catch (err) {
    console.error("Transcription error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (tempFile && existsSync(tempFile)) {
      await unlink(tempFile).catch(() => {});
    }
  }
}
