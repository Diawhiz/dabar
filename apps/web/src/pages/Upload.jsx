import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, pickMediaFile } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

export default function Upload() {
  const [sourceType, setSourceType] = useState("file"); // "file" | "youtube"
  const [youtubeUrl, setYoutubeUrl] = useState("");
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
    } catch (err) {
      setErrorMessage("Could not open file picker. Please try again.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    let source = "";
    if (sourceType === "youtube") {
      const trimmed = youtubeUrl.trim();
      if (!trimmed) {
        setErrorMessage("Please enter a YouTube video link.");
        return;
      }
      if (!trimmed.includes("youtube.com/") && !trimmed.includes("youtu.be/")) {
        setErrorMessage("That doesn't look like a valid YouTube video link.");
        return;
      }
      source = trimmed;
    } else {
      if (!selectedFilePath) {
        setErrorMessage("Please select a sermon file from your computer.");
        return;
      }
      source = selectedFilePath;
    }

    setIsProcessing(true);
    try {
      const result = await createSermon(source);
      navigate(`/processing/${result.id}`);
    } catch (err) {
      setErrorMessage(err.message || "Could not start processing. Please check connection and try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  const fileName = selectedFilePath ? selectedFilePath.split(/[/\\]/).pop() : null;

  return (
    <div className="mx-auto max-w-lg py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold text-primary">
          Add a Sermon
        </h1>
        <p className="text-xs text-secondary font-sans mt-0.5">
          Select a recording file on your computer or paste a YouTube link.
        </p>
      </div>

      {/* ── Mode Selection ──────────────────────────────────────── */}
      <div className="flex border-b border-border gap-6 text-xs font-semibold font-sans">
        <button
          type="button"
          onClick={() => { setSourceType("file"); setErrorMessage(""); }}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            sourceType === "file"
              ? "text-accent border-b-2 border-accent"
              : "text-secondary hover:text-primary"
          }`}
        >
          <i className="bx bx-upload text-sm" />
          File on this Computer
        </button>

        <button
          type="button"
          onClick={() => { setSourceType("youtube"); setErrorMessage(""); }}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            sourceType === "youtube"
              ? "text-accent border-b-2 border-accent"
              : "text-secondary hover:text-primary"
          }`}
        >
          <i className="bx bx-link text-sm" />
          YouTube Link
        </button>
      </div>

      {/* ── Form ────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5 font-sans">
        {sourceType === "file" ? (
          <div
            onClick={handleBrowseFile}
            className="cursor-pointer rounded-xl border border-dashed border-border hover:border-accent bg-surface p-8 text-center transition-colors flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-base text-accent flex items-center justify-center text-xl border border-border">
              <i className={`bx ${selectedFilePath ? "bx-check text-accent" : "bx-cloud-upload"}`} />
            </div>

            <p className="text-xs font-semibold text-primary">
              {fileName || "Click to browse computer"}
            </p>
            <p className="text-[11px] text-secondary">
              Supports MP4, MOV, MKV, MP3, WAV, M4A
            </p>

            {selectedFilePath && (
              <span className="text-[11px] text-accent font-mono truncate max-w-xs mt-1 block">
                {selectedFilePath}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-primary block">
              YouTube Video URL
            </label>
            <div className="relative">
              <i className="bx bx-link absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm" />
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-2 text-xs text-primary placeholder:text-secondary outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-accent/40 bg-surface p-3 text-xs text-primary flex items-center gap-2">
            <i className="bx bx-error-circle text-accent text-base shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Btn
          type="submit"
          className="w-full"
          size="md"
          disabled={isProcessing || (sourceType === "file" && !selectedFilePath)}
        >
          {isProcessing ? (
            <>
              <i className="bx bx-loader-alt bx-spin text-base" />
              Starting…
            </>
          ) : (
            <>
              <i className="bx bx-play text-base" />
              Transcribe Sermon
            </>
          )}
        </Btn>
      </form>
    </div>
  );
}
