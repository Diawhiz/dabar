import { useState, useEffect } from "react";
import Btn from "./Btn.jsx";

const SCRIPTURE_TEXTS = {
  "John 3:16": "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
  "Romans 8:28": "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
  "Philippians 4:13": "I can do all things through Christ who strengthens me.",
  "Psalm 23:1": "The Lord is my shepherd; I shall not want.",
  "Proverbs 3:5": "Trust in the Lord with all your heart, and do not lean on your own understanding.",
  "Matthew 6:33": "But seek first the kingdom of God and his righteousness, and all these things will be added to you.",
  "Isaiah 40:31": "They who wait for the Lord shall renew their strength; they shall mount up with wings like eagles.",
  "Jeremiah 29:11": "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
  "Genesis 1:1": "In the beginning, God created the heavens and the earth.",
  "2 Timothy 1:7": "For God gave us a spirit not of fear but of power and love and self-control.",
  "Hebrews 11:1": "Now faith is the assurance of things hoped for, the conviction of things not seen.",
  "Galatians 5:22": "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness.",
};

function formatSeconds(secs) {
  if (!secs && secs !== 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ManuscriptView({
  segments = [],
  currentTime = 0,
  isPlaying = false,
  clipRange = null,
  selectionMode = false,
  onSetRangeStart,
  onSetRangeEnd,
  onSeek,
  onTogglePlay,
  onUpdateSegmentText,
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmedScriptures, setConfirmedScriptures] = useState({});
  const [dismissedScriptures, setDismissedScriptures] = useState({});
  const [confirmedSegments, setConfirmedSegments] = useState({});

  useEffect(() => {
    if (!segments.length) return;
    const foundIdx = segments.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    if (foundIdx !== -1 && foundIdx !== activeIdx) {
      setActiveIdx(foundIdx);
    }
  }, [currentTime, segments, activeIdx]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (onTogglePlay) onTogglePlay();
      } else if (e.code === "ArrowDown" || e.code === "ArrowRight") {
        e.preventDefault();
        const next = Math.min(segments.length - 1, activeIdx + 1);
        setActiveIdx(next);
        if (segments[next] && onSeek) onSeek(segments[next].start);
      } else if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
        e.preventDefault();
        const prev = Math.max(0, activeIdx - 1);
        setActiveIdx(prev);
        if (segments[prev] && onSeek) onSeek(segments[prev].start);
      } else if (e.code === "Enter") {
        e.preventDefault();
        const seg = segments[activeIdx];
        if (seg) {
          setEditingIdx(activeIdx);
          setEditText(seg.text);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIdx, segments, onSeek, onTogglePlay]);

  function handleStartEdit(idx, text) {
    setEditingIdx(idx);
    setEditText(text);
  }

  function handleSaveEdit(idx) {
    if (onUpdateSegmentText) {
      onUpdateSegmentText(idx, editText);
    }
    setConfirmedSegments((prev) => ({ ...prev, [idx]: true }));
    setEditingIdx(null);
  }

  function handleConfirmSegment(idx) {
    setConfirmedSegments((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  return (
    <div className="space-y-4">
      {/* Keyboard Shortcuts Header */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-muted pb-3 border-b border-border font-mono-code">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-primary">Space</kbd> Play
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-primary">↑/↓</kbd> Seek
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-primary">Enter</kbd> Edit
          </span>
        </div>
        <span>Double-click any paragraph to edit</span>
      </div>

      {/* Spoken Paragraphs Stream */}
      <div className="divide-y divide-border/40">
        {segments.map((seg, idx) => {
          const isActive = idx === activeIdx;
          const isConfirmed = Boolean(confirmedSegments[idx]);
          const isInClipRange =
            clipRange &&
            clipRange.start !== null &&
            clipRange.end !== null &&
            seg.start >= clipRange.start &&
            seg.end <= clipRange.end;

          const detectedRef = Object.keys(SCRIPTURE_TEXTS).find((ref) =>
            seg.text.toLowerCase().includes(ref.toLowerCase())
          );
          const isRefConfirmed = Boolean(confirmedScriptures[detectedRef]);
          const isRefDismissed = Boolean(dismissedScriptures[detectedRef]);

          return (
            <div
              key={seg.id || idx}
              className={`manuscript-block group flex items-start gap-4 py-3.5 px-3 transition-all ${
                isActive ? "active-spoken" : ""
              } ${isInClipRange ? "bg-accent-muted/20 border-l-2 border-accent" : ""}`}
            >
              {/* Timestamp & Indicator */}
              <div className="shrink-0 font-mono-code text-xs text-muted flex flex-col items-center pt-0.5 select-none w-14">
                <span className={isActive ? "text-accent font-bold" : ""}>
                  {formatSeconds(seg.start)}
                </span>
                {isActive && isPlaying && (
                  <div className="audio-equalizer mt-1">
                    <span className="audio-equalizer-bar" />
                    <span className="audio-equalizer-bar" />
                    <span className="audio-equalizer-bar" />
                  </div>
                )}
              </div>

              {/* Text Block */}
              <div className="flex-1 min-w-0">
                {editingIdx === idx ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="field-input font-editorial text-sm leading-relaxed min-h-[80px]"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Btn size="sm" variant="primary" onClick={() => handleSaveEdit(idx)}>
                        Save Edit
                      </Btn>
                      <button
                        type="button"
                        onClick={() => setEditingIdx(null)}
                        className="px-2.5 py-1 rounded text-xs text-secondary hover:text-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setActiveIdx(idx);
                      if (onSeek) onSeek(seg.start);
                    }}
                    onDoubleClick={() => handleStartEdit(idx, seg.text)}
                    className="cursor-pointer"
                  >
                    <p
                      className={`font-editorial text-[15px] leading-relaxed transition-colors ${
                        isActive
                          ? "text-primary font-semibold drop-shadow-xs"
                          : isInClipRange
                          ? "text-accent font-medium"
                          : isConfirmed
                          ? "text-primary"
                          : "text-secondary hover:text-primary"
                      }`}
                    >
                      {seg.text}
                    </p>
                  </div>
                )}

                {/* Detected Scripture Marginalia */}
                {detectedRef && !isRefDismissed && (
                  <div className="mt-2 border border-accent/30 bg-accent-muted/20 p-3 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="scripture-badge">
                        <i className="bx bx-book-bookmark text-xs" />
                        Scripture Reference: {detectedRef}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!isRefConfirmed ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmedScriptures((p) => ({
                                  ...p,
                                  [detectedRef]: true,
                                }));
                              }}
                              className="px-2 py-0.5 rounded bg-accent text-accent-fg text-[10.5px] font-semibold"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDismissedScriptures((p) => ({
                                  ...p,
                                  [detectedRef]: true,
                                }));
                              }}
                              className="px-2 py-0.5 rounded text-muted hover:text-primary text-[10.5px]"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span className="text-success text-[10.5px] font-semibold flex items-center gap-1">
                            <i className="bx bxs-check-circle text-xs" />
                            Verified Reference
                          </span>
                        )}
                      </div>
                    </div>

                    {SCRIPTURE_TEXTS[detectedRef] && (
                      <p className="font-editorial text-xs italic text-secondary border-l-2 border-accent pl-2.5 mt-1 leading-relaxed">
                        "{SCRIPTURE_TEXTS[detectedRef]}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Hover Clip Controls */}
              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 flex items-center gap-1 pt-0.5">
                {onSetRangeStart && (
                  <button
                    type="button"
                    onClick={() => onSetRangeStart(seg.start)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-surface border border-border text-secondary hover:text-accent hover:border-accent transition-colors"
                    title="Set as clip start [in]"
                  >
                    Start
                  </button>
                )}
                {onSetRangeEnd && (
                  <button
                    type="button"
                    onClick={() => onSetRangeEnd(seg.end)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-surface border border-border text-secondary hover:text-accent hover:border-accent transition-colors"
                    title="Set as clip end [out]"
                  >
                    End
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleConfirmSegment(idx)}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    isConfirmed ? "text-success" : "text-muted hover:text-primary"
                  }`}
                  title={isConfirmed ? "Mark unconfirmed" : "Mark confirmed"}
                >
                  <i
                    className={`bx ${
                      isConfirmed ? "bxs-check-circle" : "bx-check-circle"
                    } text-sm`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(idx, seg.text)}
                  className="p-1.5 rounded-md text-muted hover:text-primary text-xs"
                  title="Edit text"
                >
                  <i className="bx bx-edit text-sm" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
