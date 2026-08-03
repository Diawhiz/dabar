import { Search, X, Filter, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import SermonRow from "../components/SermonRow.jsx";
import { archiveSermons } from "../data/mockData.js";

const speakers = ["All Speakers", "Pastor Daniel Okoye", "Pastor Miriam Cole", "Rev. Samuel Hart"];

export default function Archive() {
  const [query, setQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("All Speakers");

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();

    return archiveSermons.filter((sermon) => {
      const matchesSpeaker =
        selectedSpeaker === "All Speakers" || sermon.speaker === selectedSpeaker;

      const matchesQuery =
        !normalized ||
        [sermon.title, sermon.speaker, sermon.clipCount, sermon.date].some((value) =>
          value.toLowerCase().includes(normalized),
        );

      return matchesSpeaker && matchesQuery;
    });
  }, [query, selectedSpeaker]);

  return (
    <div className="mx-auto max-w-5xl py-6">
      <PageHeader
        eyebrow="Media Library"
        title="Past Sermon Projects"
        description="Browse, search, and access all sermon teachings and clip packages created for your church channels."
      />

      {/* SEARCH AND FILTER CONTROLS */}
      <section className="mb-8 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, speaker, date, or keyword..."
            className="h-14 w-full rounded-2xl border border-linen bg-cream pl-13 pr-12 text-base font-medium text-umber shadow-soft outline-none transition-all focus:border-gold/50 focus:shadow-glow"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-walnut/60 hover:bg-parchment hover:text-navy"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Speaker Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-walnut">
            <Filter size={14} className="text-gold" />
            <span>Speaker:</span>
          </div>
          {speakers.map((speaker) => (
            <button
              key={speaker}
              onClick={() => setSelectedSpeaker(speaker)}
              className={[
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200",
                selectedSpeaker === speaker
                  ? "bg-navy text-cream shadow-navyGlow"
                  : "bg-cream text-walnut hover:bg-parchment hover:text-navy border border-linen",
              ].join(" ")}
            >
              {speaker}
            </button>
          ))}
        </div>
      </section>

      {/* RESULTS LIST */}
      <section>
        <div className="mb-4 flex items-center justify-between px-1 text-xs font-semibold text-walnut">
          <span>Showing {filtered.length} sermon projects</span>
          <span>Sorted by recent date</span>
        </div>

        {filtered.length > 0 ? (
          filtered.map((sermon) => <SermonRow key={sermon.id} sermon={sermon} />)
        ) : (
          <div className="rounded-3xl border border-linen bg-cream px-6 py-16 text-center shadow-soft">
            <BookOpen size={36} className="mx-auto text-gold/60" />
            <p className="mt-4 font-serif text-xl font-semibold text-navy">No sermons match your criteria</p>
            <p className="mt-1 text-sm text-walnut">Try clearing your search term or selecting "All Speakers".</p>
            <button
              onClick={() => {
                setQuery("");
                setSelectedSpeaker("All Speakers");
              }}
              className="mt-4 rounded-full bg-parchment px-5 py-2 text-xs font-bold text-navy hover:bg-gold/20"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
