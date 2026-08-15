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
      setErrorMessage("Could not open file explorer. Please try again.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    let source = "";
    if (sourceType === "youtube") {
      const trimmed = youtubeUrl.trim();
      if (!trimmed) {
        setErrorMessage("Please paste a valid YouTube sermon link.");
        return;
      }
      if (!trimmed.includes("youtube.com/") && !trimmed.includes("youtu.be/")) {
        setErrorMessage("That doesn't look like a valid YouTube video link.");
        return;
      }
      source = trimmed;
    } else {
      if (!selectedFilePath) {
        setErrorMessage("Please choose a sermon recording from your computer.");
        return;
      }
      source = selectedFilePath;
    }

    setIsProcessing(true);
    try {
      const result = await createSermon(source);
      navigate(`/processing/${result.id}`);
    } catch (err) {
      setErrorMessage(err.message || "Could not begin processing this sermon. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  const fileName = selectedFilePath ? selectedFilePath.split(/[/\\]/).pop() : null;

  return (
    <div className="mx-auto max-w-xl py-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Add a Sermon
        </h1>
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
          Select a recording from your computer or paste a YouTube link. Dabar will transcribe, structure the manuscript, and highlight key clips.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex p-1 rounded-xl bg-surface border border-border/80 font-sans max-w-md mx-auto">
        <button
          type="button"
          onClick={() => { setSourceType("file"); setErrorMessage(""); }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            sourceType === "file"
              ? "bg-paper text-ink shadow-xs border border-border/60"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bx-folder text-base" />
          File on this Computer
        </button>

        <button
          type="button"
          onClick={() => { setSourceType("youtube"); setErrorMessage(""); }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            sourceType === "youtube"
              ? "bg-paper text-ink shadow-xs border border-border/60"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bxl-youtube text-base text-red-600" />
          YouTube Link
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {sourceType === "file" ? (
          <div
            onClick={handleBrowseFile}
            className="group cursor-pointer rounded-2xl border-2 border-dashed border-border hover:border-amber/80 bg-paper hover:bg-surface/40 p-8 text-center transition-all flex flex-col items-center justify-center gap-3.5 shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-surface group-hover:bg-amber/10 flex items-center justify-center text-amber text-2xl transition-colors shadow-xs">
              <i className={`bx ${selectedFilePath ? "bx-check-circle" : "bx-cloud-upload"}`} />
            </div>

            <div className="space-y-1">
              <p className="font-display text-base font-semibold text-ink">
                {fileName || "Click to select sermon file"}
              </p>
              <p className="text-xs text-muted font-sans">
                Supports video (MP4, MOV, MKV) and audio (MP3, WAV, M4A)
              </p>
            </div>

            {selectedFilePath && (
              <div className="mt-1 px-3 py-1 rounded-full bg-surface border border-border text-[11px] text-amber font-mono font-medium truncate max-w-sm">
                {selectedFilePath}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 font-sans">
            <label className="text-xs font-semibold text-ink block">
              YouTube Video Link
            </label>
            <div className="relative">
              <i className="bx bx-link-alt absolute left-4 top-1/2 -translate-y-1/2 text-muted text-base" />
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-xl border border-border bg-paper pl-11 pr-4 py-3 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors focus:border-amber"
              />
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div className="rounded-xl border border-amber/30 bg-amber-light px-4 py-3 text-xs text-[#8C5516] flex items-center gap-2.5 font-sans">
            <i className="bx bx-error-circle text-base shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit CTA */}
        <Btn
          type="submit"
          className="w-full shadow-sm"
          size="lg"
          disabled={isProcessing || (sourceType === "file" && !selectedFilePath)}
        >
          {isProcessing ? (
            <>
              <i className="bx bx-loader-alt bx-spin text-lg" />
              Opening Sermon…
            </>
          ) : (
            <>
              <i className="bx bx-sparkles text-lg" />
              Begin Transcribing & Finding Clips
            </>
          )}
        </Btn>
      </form>

      {/* Helpful reassurance note */}
      <div className="rounded-xl bg-surface/60 border border-border/70 p-4 text-xs text-muted leading-relaxed font-sans text-center space-y-1">
        <p className="font-semibold text-ink-secondary">
          🔒 Private & Local
        </p>
        <p>
          Your sermon recordings remain safe on your device. Audio is turned into text, Bible citations are matched, and clips are prepared directly on your computer.
        </p>
      </div>
    </div>
  );
}
