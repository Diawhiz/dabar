import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import SermonRow from "../components/SermonRow.jsx";
import { archiveSermons } from "../data/mockData.js";

export default function Archive() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return archiveSermons;
    return archiveSermons.filter((sermon) =>
      [sermon.title, sermon.speaker, sermon.clipCount, sermon.date].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl py-8">
      <PageHeader
        eyebrow="Archive"
        title="Past sermon projects"
        description="Search the messages your team has already prepared and keep the church media library close at hand."
      />

      <section>
        <div className="mb-8">
          <label className="relative block">
            <span className="sr-only">Search archive</span>
            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, pastor, date, or clip count"
              className="h-14 w-full rounded-full bg-cream pl-12 pr-5 text-base text-umber shadow-soft outline-none transition placeholder:text-walnut/55 focus:ring-2 focus:ring-gold/35"
            />
          </label>
        </div>
        {filtered.length > 0 ? (
          filtered.map((sermon) => <SermonRow key={sermon.id} sermon={sermon} />)
        ) : (
          <div className="px-4 py-12 text-center text-sm text-walnut">No sermons match your search.</div>
        )}
      </section>
    </div>
  );
}
