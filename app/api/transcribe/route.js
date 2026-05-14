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

export async function POST(req) {
  const scriptPath = path.join(process.cwd(), "backend", "whisperx_transcribe.py");
  const encoder = new TextEncoder();

  const formData = await req.formData();
  const file = formData.get("file");
  const url = formData.get("url");
  const language = (formData.get("language") || "").trim();

  let inputArg;
  let tempFile = null;

  if (file && file.size > 0) {
    const ext = file.name?.split(".").pop() || "mp3";
    const id = crypto.randomBytes(8).toString("hex");
    tempFile = path.join(os.tmpdir(), `voicescript-${id}.${ext}`);
    await writeFile(tempFile, Buffer.from(await file.arrayBuffer()));
    inputArg = tempFile;
  } else if (url && url.trim()) {
    inputArg = url.trim();
  } else {
    return new Response(JSON.stringify({ error: "No input provided" }), { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const cleanup = () => {
        if (tempFile && existsSync(tempFile)) unlink(tempFile).catch(() => {});
      };

      const pythonArgs = [scriptPath, inputArg];
      if (language) pythonArgs.push(language);
      const python = spawn(getPythonPath(), pythonArgs);

      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch {}
      }, 4000);
      let stdout = "";
      let stderrBuf = "";

      python.stdout.on("data", (chunk) => { stdout += chunk.toString(); });

      python.stderr.on("data", (chunk) => {
        stderrBuf += chunk.toString();
        const lines = stderrBuf.split("\n");
        stderrBuf = lines.pop();
        for (const line of lines) {
          const m = line.trim().match(/^PROGRESS:(\d+):(.+)$/);
          if (m) send("progress", { pct: parseInt(m[1]), msg: m[2].trim() });
        }
      });

      python.on("close", () => {
        clearInterval(ping);
        cleanup();
        try {
          const start = stdout.indexOf("{");
          const end = stdout.lastIndexOf("}");
          if (start === -1 || end === -1) {
            send("error", { message: "No output from transcription process" });
          } else {
            const result = JSON.parse(stdout.substring(start, end + 1));
            if (result.error) send("error", { message: result.error });
            else send("result", { segments: result.segments });
          }
        } catch {
          send("error", { message: "Failed to parse transcription output" });
        }
        controller.close();
      });

      python.on("error", (err) => {
        clearInterval(ping);
        cleanup();
        send("error", { message: `Failed to start Python: ${err.message}` });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
