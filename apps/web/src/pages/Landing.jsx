import { Link } from "react-router-dom";
import Btn from "../components/Btn.jsx";
import Waveform from "../components/Waveform.jsx";

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body overflow-x-hidden">
      {/* Header bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <span className="font-display text-2xl font-bold tracking-tight">DABAR</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-muted hover:text-ink transition-colors">
            Sign in
          </Link>
          <Link to="/signup">
            <Btn size="sm">Create account</Btn>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-16">
        {/* Background waveform */}
        <div className="absolute inset-x-0 top-8 sm:top-12 pointer-events-none">
          <Waveform mode="hero" barCount={64} />
        </div>

        <div className="relative max-w-2xl">
          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight sm:text-6xl sm:leading-[1.1]">
            One sermon.{" "}
            <span className="text-ember">A hundred ways to share it.</span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-muted max-w-lg">
            Paste a YouTube link. Dabar finds the moments worth sharing and
            cuts them into vertical clips, ready for Reels, Shorts, and
            TikTok.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/upload">
              <Btn size="lg">
                <i className="bx bx-upload text-lg" aria-hidden="true" />
                Upload your first sermon
              </Btn>
            </Link>
            <Link to="/login">
              <Btn size="lg" variant="outline">Sign in</Btn>
            </Link>
          </div>
        </div>
      </section>

      {/* Waveform divider */}
      <Waveform mode="divider" barCount={64} className="mx-auto max-w-6xl px-5 sm:px-8 my-4" />

      {/* How it works — three short paragraphs, not icon-cards */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          How Dabar works
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="bx bx-link-alt text-xl text-ember" aria-hidden="true" />
              <h3 className="font-body text-base font-semibold text-ink">
                Paste your sermon link
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Drop in any YouTube URL. Dabar pulls the audio and creates
              a complete transcript — word by word, timestamped, and
              punctuated.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="bx bx-analyse text-xl text-ember" aria-hidden="true" />
              <h3 className="font-body text-base font-semibold text-ink">
                Dabar finds the moments
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              The preaching points that hit hardest, the quotes your
              congregation will screenshot, the 45-second stretches that
              work as standalone clips. Dabar surfaces them automatically.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="bx bx-movie-play text-xl text-ember" aria-hidden="true" />
              <h3 className="font-body text-base font-semibold text-ink">
                Download or share
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Vertical MP4 clips, ready for upload. Or copy a timestamped
              share link. Either way, your sermon is already formatted for
              the feed.
            </p>
          </div>
        </div>
      </section>

      {/* Waveform divider */}
      <Waveform mode="divider" barCount={64} className="mx-auto max-w-6xl px-5 sm:px-8" />

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-5 py-12 sm:px-8 text-center">
        <p className="font-display text-sm text-muted">
          Dabar — The Word, taking new shape.
        </p>
      </footer>
    </div>
  );
}
