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

  function detectScripture(text) {
    for (const key of Object.keys(SCRIPTURE_TEXTS)) {
      if (text.toLowerCase().includes(key.toLowerCase())) {
        return key;
      }
    }
    const match = text.match(
      /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)\s+(\d{1,3}):(\d{1,3})\b/i
    );
    return match ? match[0] : null;
  }

  return (
    <div className="space-y-1 max-w-3xl">
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
            {/* Timestamp Gutter */}
            <div className="w-12 shrink-0 text-right pt-0.5 select-none font-mono">
              <button
                type="button"
                onClick={() => {
                  setActiveIdx(idx);
                  if (onSeek) onSeek(seg.start);
                }}
                className={`text-[11px] transition-colors ${
                  isActive
                    ? "text-accent font-bold"
                    : "text-muted hover:text-accent"
                }`}
                title="Play from timestamp"
              >
                {formatSeconds(seg.start)}
              </button>
            </div>

            {/* Paragraph Text Body */}
            <div className="flex-1 min-w-0">
              {isKeyMoment && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-accent mb-0.5">
                  <i className="bx bxs-star text-xs" />
                  <span>{seg.highlight_title || "Key teaching moment"}</span>
                </div>
              )}

              {editingIdx === idx ? (
                <div className="space-y-2 py-1">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="field-input text-xs leading-relaxed"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Btn size="sm" onClick={() => handleSaveEdit(idx)}>
                      Save Edit
                    </Btn>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(null)}
                      className="px-2 py-1 rounded text-xs text-secondary hover:text-primary"
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
                    className={`text-xs leading-relaxed transition-colors ${
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

              {/* Scripture Verification Banner */}
              {detectedRef && !isRefDismissed && (
                <div className="mt-2 border border-border bg-surface p-2.5 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-accent flex items-center gap-1">
                      <i className="bx bx-book-open text-xs" />
                      Scripture: {detectedRef}
                    </span>
                    <div className="flex items-center gap-1">
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
                            className="px-2 py-0.5 rounded bg-accent text-white text-[10px] font-medium"
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
                            className="px-1.5 py-0.5 rounded text-muted hover:text-primary text-[10px]"
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <span className="text-success text-[10px] font-medium flex items-center gap-0.5">
                          <i className="bx bxs-check-circle text-xs" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {SCRIPTURE_TEXTS[detectedRef] && (
                    <p className="text-muted italic border-l border-accent/40 pl-2 mt-1 text-[11px]">
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
                className="p-1 rounded text-muted hover:text-primary text-xs"
                title="Edit text"
              >
                <i className="bx bx-edit text-sm" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
