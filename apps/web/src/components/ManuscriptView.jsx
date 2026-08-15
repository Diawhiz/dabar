import { useState, useEffect, useRef } from "react";
import Btn from "./Btn.jsx";

// Curated reference scripture dictionary for instant verification in sermons
const SCRIPTURE_TEXTS = {
  "John 3:16": "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
  "Romans 8:28": "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
  "Philippians 4:13": "I can do all this through him who gives me strength.",
  "Psalm 23:1": "The Lord is my shepherd, I lack nothing.",
  "Proverbs 3:5": "Trust in the Lord with all your heart and lean not on your own understanding.",
  "Matthew 6:33": "But seek first his kingdom and his righteousness, and all these things will be given to you as well.",
  "Isaiah 40:31": "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.",
  "Jeremiah 29:11": "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
  "Genesis 1:1": "In the beginning God created the heavens and the earth.",
  "2 Timothy 1:7": "For God gave us a spirit not of fear but of power and love and self-control.",
  "Hebrews 11:1": "Now faith is confidence in what we hope for and assurance about what we do not see.",
  "Galatians 5:22": "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness.",
};

function formatSeconds(secs) {
  if (!secs && secs !== 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ManuscriptView({
  segments = [],
  currentTime = 0,
  isPlaying = false,
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
  const containerRef = useRef(null);

  // Sync active segment with current audio/video playback time
  useEffect(() => {
    if (!segments.length) return;
    const foundIdx = segments.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    if (foundIdx !== -1 && foundIdx !== activeIdx) {
      setActiveIdx(foundIdx);
    }
  }, [currentTime, segments]);

  // Keyboard navigation for manuscript review
  useEffect(() => {
    function handleKeyDown(e) {
      // Don't intercept if user is typing in an input or textarea
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
    // Mark as confirmed
    setConfirmedSegments((prev) => ({ ...prev, [idx]: true }));
    setEditingIdx(null);
  }

  function handleConfirmSegment(idx) {
    setConfirmedSegments((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  // Detect scriptures mentioned in text (e.g. "John 3:16", "Romans 8:28")
  function detectScripture(text) {
    for (const key of Object.keys(SCRIPTURE_TEXTS)) {
      if (text.toLowerCase().includes(key.toLowerCase())) {
        return key;
      }
    }
    // Regex fallback for general Chapter:Verse
    const match = text.match(/\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)\s+(\d{1,3}):(\d{1,3})\b/i);
    return match ? match[0] : null;
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Keyboard Shortcuts Helper Strip */}
      <div className="flex flex-wrap items-center justify-between text-xs text-muted py-2 px-1 border-b border-border/50">
        <div className="flex items-center gap-4">
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono text-ink">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono text-ink">↑ ↓</kbd> Jump paragraph</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono text-ink">Enter</kbd> Edit / Confirm</span>
        </div>
        <span className="italic text-muted/80">Click any paragraph to play or illuminate text</span>
      </div>

      {/* Manuscript Container: Single Column with Quiet Left Margin */}
      <div className="space-y-6 max-w-3xl mx-auto font-body text-base">
        {segments.map((seg, idx) => {
          const isActive = activeIdx === idx;
          const isConfirmed = Boolean(confirmedSegments[idx]);
          const isKeyMoment = seg.is_highlight;
          const detectedRef = detectScripture(seg.text);
          const isRefConfirmed = detectedRef && confirmedScriptures[detectedRef];
          const isRefDismissed = detectedRef && dismissedScriptures[detectedRef];

          return (
            <div
              key={seg.id || idx}
              className={`group flex items-start gap-4 sm:gap-6 transition-all duration-200 rounded-lg p-2 ${
                isKeyMoment
                  ? "transcript-key-moment"
                  : isActive
                  ? "bg-surface/50"
                  : "hover:bg-surface/30"
              }`}
            >
              {/* Quiet Left Margin: Timestamp + Section Indicator */}
              <div className="w-14 sm:w-16 shrink-0 text-right pt-0.5 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setActiveIdx(idx);
                    if (onSeek) onSeek(seg.start);
                  }}
                  className={`text-xs font-mono transition-colors ${
                    isActive
                      ? "text-ember font-bold"
                      : "text-muted hover:text-ember"
                  }`}
                  title="Jump playback to this timestamp"
                >
                  {formatSeconds(seg.start)}
                </button>
              </div>

              {/* Center Manuscript Column */}
              <div className="flex-1 min-w-0">
                {/* Key Moment Label (if AI flagged) */}
                {isKeyMoment && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ember mb-1.5">
                    <i className="bx bxs-star text-xs" aria-hidden="true" />
                    <span>{seg.highlight_title || "Key teaching moment"}</span>
                  </div>
                )}

                {/* Paragraph Content (or inline editor) */}
                {editingIdx === idx ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full rounded-card border border-ember bg-paper p-3 text-sm text-ink outline-none focus:ring-1 focus:ring-ember font-body leading-relaxed"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Btn size="sm" variant="primary" onClick={() => handleSaveEdit(idx)}>
                        Save & Illuminate
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>
                        Cancel
                      </Btn>
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
                      className={`leading-relaxed transition-all duration-300 ${
                        isKeyMoment
                          ? "text-ink font-medium drop-shadow-xs"
                          : isConfirmed || isActive
                          ? "transcript-word-lit"
                          : "transcript-word-dim hover:text-ink/80"
                      }`}
                    >
                      {seg.text}
                    </p>
                  </div>
                )}

                {/* Key Moment Pastoral Rationale Line */}
                {isKeyMoment && seg.highlight_reason && (
                  <p className="text-xs text-muted italic mt-1.5 font-body">
                    ↳ Why flagged: {seg.highlight_reason}
                  </p>
                )}

                {/* Scripture Reference Verification Prompt (Side-by-side comparison) */}
                {detectedRef && !isRefDismissed && (
                  <div className="mt-3 rounded-card border border-ember/30 bg-ember/5 p-3 text-xs space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ember flex items-center gap-1">
                        <i className="bx bx-book text-sm" aria-hidden="true" />
                        Scripture detected: {detectedRef}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!isRefConfirmed ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmedScriptures((p) => ({ ...p, [detectedRef]: true }));
                              }}
                              className="px-2 py-0.5 rounded bg-ember text-white font-medium text-[11px] hover:opacity-90 transition-opacity"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDismissedScriptures((p) => ({ ...p, [detectedRef]: true }));
                              }}
                              className="px-2 py-0.5 rounded text-muted hover:text-ink text-[11px] transition-colors"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span className="text-ember font-semibold flex items-center gap-1 text-[11px]">
                            <i className="bx bx-check" aria-hidden="true" />
                            Confirmed in transcript
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comparison verse text */}
                    {SCRIPTURE_TEXTS[detectedRef] && (
                      <p className="text-muted italic border-l-2 border-ember/40 pl-2 mt-1">
                        "{SCRIPTURE_TEXTS[detectedRef]}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right hover action: Confirm / Edit */}
              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleConfirmSegment(idx)}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    isConfirmed ? "text-ember" : "text-muted hover:text-ember"
                  }`}
                  title={isConfirmed ? "Mark as unreviewed" : "Mark as confirmed (illuminate)"}
                  aria-label={isConfirmed ? "Mark unreviewed" : "Confirm text"}
                >
                  <i className={`bx ${isConfirmed ? "bxs-check-circle" : "bx-check-circle"} text-lg`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(idx, seg.text)}
                  className="p-1.5 rounded text-muted hover:text-ink text-xs"
                  title="Edit text"
                  aria-label="Edit paragraph"
                >
                  <i className="bx bx-edit text-base" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
