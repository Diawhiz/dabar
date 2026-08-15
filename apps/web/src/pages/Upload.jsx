import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, pickMediaFile } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

export default function Upload() {
  const [sourceType, setSourceType] = useState("file"); // "file" | "youtube" | "gdrive"
  const [urlInput, setUrlInput] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  async function handleBrowseFile() {
    setErrorMessage("");
    try {
      const path = await pickMediaFile();
      if (path) {
        setSelectedFilePath(path);
      }
    } catch {
      setErrorMessage("Could not open file picker. Please try again.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    let source = "";
    if (sourceType === "file") {
      if (!selectedFilePath) {
        setErrorMessage("Please select a recording file from your computer.");
        return;
      }
      source = selectedFilePath;
    } else if (sourceType === "youtube") {
      const trimmed = urlInput.trim();
      if (!trimmed) {
        setErrorMessage("Please enter a YouTube link.");
        return;
      }
      if (!trimmed.includes("youtube.com/") && !trimmed.includes("youtu.be/")) {
        setErrorMessage("Please enter a valid YouTube video link.");
        return;
      }
      source = trimmed;
    } else if (sourceType === "gdrive") {
      const trimmed = urlInput.trim();
      if (!trimmed) {
        setErrorMessage("Please enter a Google Drive link.");
        return;
      }
      if (!trimmed.includes("drive.google.com/")) {
        setErrorMessage("Please enter a valid Google Drive share link.");
        return;
      }
      source = trimmed;
    }

    setIsProcessing(true);
    try {
      const result = await createSermon(source);
      navigate(`/processing/${result.id}`);
    } catch (err) {
      setErrorMessage(
        err.message || "Could not start processing. Please check the file or link and try again."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const fileName = selectedFilePath ? selectedFilePath.split(/[/\\]/).pop() : null;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="page-header">
        <div>
          <h1 className="text-base font-semibold text-primary">Add Sermon Recording</h1>
          <p className="text-xs text-secondary mt-0.5">
            Add an audio or video recording from your computer, YouTube, or Google Drive.
          </p>
        </div>
      </header>

      <div className="page-content flex justify-center py-10">
        <div className="w-full max-w-lg space-y-6">
          {/* ── Source Type Control ─────────────────────────────────── */}
          <div className="flex p-1 bg-surface border border-border rounded-md text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setSourceType("file");
                setErrorMessage("");
              }}
              className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors ${
                sourceType === "file"
                  ? "bg-surface-active text-primary font-semibold border border-border-strong"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <i className="bx bx-file text-sm" />
              <span>File on Computer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceType("youtube");
                setErrorMessage("");
              }}
              className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors ${
                sourceType === "youtube"
                  ? "bg-surface-active text-primary font-semibold border border-border-strong"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <i className="bx bxl-youtube text-sm text-red-500" />
              <span>YouTube Link</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceType("gdrive");
                setErrorMessage("");
              }}
              className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors ${
                sourceType === "gdrive"
                  ? "bg-surface-active text-primary font-semibold border border-border-strong"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <i className="bx bxs-cloud text-sm text-accent" />
              <span>Google Drive Link</span>
            </button>
          </div>

          {/* ── Form Body ─────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {sourceType === "file" && (
              <div
                onClick={handleBrowseFile}
                className="cursor-pointer border border-dashed border-border hover:border-accent bg-surface p-8 rounded-md text-center transition-colors flex flex-col items-center justify-center gap-2.5"
              >
                <div className="w-8 h-8 rounded bg-surface-hover text-accent flex items-center justify-center text-lg border border-border">
                  <i className={`bx ${selectedFilePath ? "bx-check text-accent" : "bx-upload"}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary">
                    {fileName || "Click to choose sermon file"}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Supports MP4, MOV, MP3, M4A, WAV audio and video
                  </p>
                </div>
                {selectedFilePath && (
                  <span className="text-[11px] text-accent font-mono truncate max-w-md mt-1 block">
                    {selectedFilePath}
                  </span>
                )}
              </div>
            )}

            {sourceType === "youtube" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">
                  YouTube Video Link
                </label>
                <div className="relative">
                  <i className="bx bx-link absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-surface border border-border rounded pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-muted outline-none focus:border-accent font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Audio will be automatically retrieved and prepared for transcription.
                </p>
              </div>
            )}

            {sourceType === "gdrive" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">
                  Google Drive Link
                </label>
                <div className="relative">
                  <i className="bx bx-link absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    className="w-full bg-surface border border-border rounded pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-muted outline-none focus:border-accent font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Make sure the link sharing is set to <strong>"Anyone with the link can view"</strong>.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="border border-danger/30 bg-danger-muted p-2.5 rounded text-xs text-danger flex items-center gap-2">
                <i className="bx bx-error-circle text-base shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="pt-2">
              <Btn
                type="submit"
                className="w-full"
                disabled={isProcessing || (sourceType === "file" && !selectedFilePath)}
              >
                {isProcessing ? (
                  <>
                    <i className="bx bx-loader-alt bx-spin text-sm" />
                    <span>Preparing Sermon…</span>
                  </>
                ) : (
                  <>
                    <i className="bx bx-play text-sm" />
                    <span>Transcribe Sermon</span>
                  </>
                )}
              </Btn>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
