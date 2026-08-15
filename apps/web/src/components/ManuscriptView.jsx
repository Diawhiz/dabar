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
  }, [currentTime, segments]);

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

  function detectScripture(text) {
    for (const key of Object.keys(SCRIPTURE_TEXTS)) {
      if (text.toLowerCase().includes(key.toLowerCase())) {
        return key;
      }
    }
    const match = text.match(/\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)\s+(\d{1,3}):(\d{1,3})\b/i);
    return match ? match[0] : null;
  }

  return (
    <div className="space-y-4">
      {/* ── Single Manuscript Column with Quiet Left Margin ─────── */}
      <div className="space-y-3 max-w-3xl font-body text-[16px] leading-[1.8]">
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
              className={`manuscript-row group ${
                isKeyMoment
                  ? "transcript-key-moment"
                  : isActive
                  ? "is-active"
                  : ""
              }`}
            >
              {/* Quiet Left Margin: Timestamp */}
              <div className="w-14 sm:w-16 shrink-0 text-right pt-0.5 select-none font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setActiveIdx(idx);
                    if (onSeek) onSeek(seg.start);
                  }}
                  className={`text-[11px] font-mono transition-colors ${
                    isActive
                      ? "text-accent font-bold"
                      : "text-secondary hover:text-accent"
                  }`}
                  title="Play from here"
                >
                  {formatSeconds(seg.start)}
                </button>
              </div>

              {/* Center Content Column */}
              <div className="flex-1 min-w-0">
                {isKeyMoment && (
                  <div className="flex items-center gap-1.5 text-xs font-sans font-semibold text-accent mb-1">
                    <i className="bx bxs-star text-xs" />
                    <span>{seg.highlight_title || "Key teaching moment"}</span>
                  </div>
                )}

                {editingIdx === idx ? (
                  <div className="space-y-2 font-sans">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-accent bg-surface p-3 text-sm text-primary outline-none font-serif leading-relaxed"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Btn size="sm" onClick={() => handleSaveEdit(idx)}>
                        Save & Confirm
                      </Btn>
                      <button
                        type="button"
                        onClick={() => setEditingIdx(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-secondary hover:text-primary transition-colors"
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
                      className={`transition-all duration-150 ${
                        isKeyMoment
                          ? "text-primary font-medium"
                          : isConfirmed || isActive
                          ? "transcript-lit"
                          : "transcript-dim hover:text-primary"
                      }`}
                    >
                      {seg.text}
                    </p>
                  </div>
                )}

                {/* Scripture Side-by-side verification */}
                {detectedRef && !isRefDismissed && (
                  <div className="mt-2.5 rounded-lg border border-border bg-surface p-3 text-xs space-y-1 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-accent flex items-center gap-1.5">
                        <i className="bx bx-book-open text-sm" />
                        Scripture Reference: {detectedRef}
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
                              className="px-2.5 py-0.5 rounded bg-accent text-white font-semibold text-[11px]"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDismissedScriptures((p) => ({ ...p, [detectedRef]: true }));
                              }}
                              className="px-2 py-0.5 rounded text-secondary hover:text-primary text-[11px]"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span className="text-accent font-semibold flex items-center gap-1 text-[11px]">
                            <i className="bx bxs-check-circle text-xs" />
                            Verified in transcript
                          </span>
                        )}
                      </div>
                    </div>

                    {SCRIPTURE_TEXTS[detectedRef] && (
                      <p className="text-secondary italic border-l-2 border-accent/40 pl-2 mt-1 font-serif">
                        "{SCRIPTURE_TEXTS[detectedRef]}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleConfirmSegment(idx)}
                  className={`p-1 rounded text-xs transition-colors ${
                    isConfirmed ? "text-accent" : "text-secondary hover:text-accent"
                  }`}
                  title={isConfirmed ? "Mark as unconfirmed" : "Mark as confirmed"}
                >
                  <i className={`bx ${isConfirmed ? "bxs-check-circle" : "bx-check-circle"} text-base`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(idx, seg.text)}
                  className="p-1 rounded text-secondary hover:text-primary text-xs"
                  title="Edit paragraph"
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
