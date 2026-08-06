import { useState } from "react";
import Btn from "../components/Btn.jsx";
import Waveform from "../components/Waveform.jsx";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("account");
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your studio account, team members, and export defaults.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 text-sm font-medium">
        {[
          { key: "account", label: "Account" },
          { key: "team", label: "Team members" },
          { key: "integrations", label: "Integrations" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 transition-colors relative ${
              activeTab === tab.key
                ? "text-ember font-semibold border-b-2 border-ember"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "account" && (
        <form onSubmit={handleSave} className="space-y-6 max-w-md">
          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Ministry / Church name</span>
            <input
              type="text"
              defaultValue="Grace Community Media"
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Contact email</span>
            <input
              type="email"
              defaultValue="media@gracecommunity.org"
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Default video aspect ratio</span>
            <select
              defaultValue="9:16"
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember"
            >
              <option value="9:16">Vertical (9:16) — Reels, Shorts, TikTok</option>
              <option value="1:1">Square (1:1) — Instagram Feed</option>
              <option value="16:9">Landscape (16:9) — YouTube</option>
            </select>
          </label>

          {saved && (
            <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-2.5 text-sm text-ember flex items-center gap-2">
              <i className="bx bx-check-circle text-lg" aria-hidden="true" />
              <span>Settings saved.</span>
            </div>
          )}

          <Btn type="submit">Save changes</Btn>
        </form>
      )}

      {activeTab === "team" && (
        <div className="space-y-6">
          <div className="rounded-card border border-border divide-y divide-border overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Pastor Daniel Okoye</p>
                <p className="text-xs text-muted">daniel@gracecommunity.org</p>
              </div>
              <span className="text-xs font-medium text-ember bg-surface px-2.5 py-1 rounded">Owner</span>
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Sarah Jenkins</p>
                <p className="text-xs text-muted">sarah.j@gracecommunity.org</p>
              </div>
              <span className="text-xs font-medium text-muted bg-surface px-2.5 py-1 rounded">Media Volunteer</span>
            </div>
          </div>

          <Btn variant="outline" size="sm">
            <i className="bx bx-user-plus text-base" aria-hidden="true" />
            Invite team member
          </Btn>
        </div>
      )}

      {activeTab === "integrations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-card bg-paper">
            <div className="flex items-center gap-3">
              <i className="bx bxl-youtube text-2xl text-red-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">YouTube Studio</p>
                <p className="text-xs text-muted">Connected as Grace Community YouTube Channel</p>
              </div>
            </div>
            <span className="text-xs text-ember font-medium">Connected</span>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-card bg-paper">
            <div className="flex items-center gap-3">
              <i className="bx bxl-instagram text-2xl text-pink-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">Instagram Reels</p>
                <p className="text-xs text-muted">Push clips directly to Instagram Business account</p>
              </div>
            </div>
            <Btn variant="outline" size="sm">Connect</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
