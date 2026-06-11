import { Download, Instagram, MessageCircle, Play, Send, Youtube } from "lucide-react";
import Button from "../components/Button.jsx";
import { clips } from "../data/mockData.js";

export default function ClipsReady() {
  const featuredClip = clips[0];

  return (
    <div className="mx-auto max-w-5xl py-8 text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gold">Clips ready</p>
      <h1 className="mx-auto max-w-3xl font-serif text-5xl font-semibold leading-tight text-navy sm:text-6xl">
        {featuredClip.title}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-walnut">
        A vertical sermon clip prepared for the platforms your church uses to disciple beyond Sunday.
      </p>

      <section className="mt-10">
        <div className="mx-auto grid aspect-[9/16] max-h-[640px] max-w-[360px] place-items-center overflow-hidden rounded-[2rem] bg-[linear-gradient(165deg,#f7ead7,#fffdf8_40%,#d8c397)] shadow-warm">
          <div className="px-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-navy text-cream shadow-soft">
              <Play fill="currentColor" size={25} />
            </div>
            <p className="mt-7 font-serif text-3xl font-semibold leading-tight text-navy">
              God develops depth before visibility.
            </p>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-gold">00:48 · 9:16</p>
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-3">
          {featuredClip.platforms.map((platform) => (
            <span key={platform} className="rounded-full bg-parchment px-4 py-2 text-sm font-semibold text-navy">
              {platform}
            </span>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button className="h-14 px-8">
            <Download size={17} />
            Download Clip
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-3xl border-t border-linen pt-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">Share options</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Instagram", icon: Instagram },
            { label: "TikTok", icon: Send },
            { label: "YouTube", icon: Youtube },
            { label: "WhatsApp", icon: MessageCircle },
          ].map(({ label, icon: Icon }) => (
            <Button key={label} variant="secondary" className="justify-center">
              <Icon size={16} />
              {label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
