"use client";

import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setEmail('');
  };

  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">
      
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0a] to-black" />
        <div className="absolute inset-0 opacity-30" 
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)' }} 
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5" 
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} 
        />
      </div>

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        
        {/* Glow Effect Behind Title */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-yellow-500/20 blur-[120px] rounded-full" />
        
        <div className="mb-8">
          <span className="inline-block px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-500 text-xs font-bold tracking-[4px] uppercase">
            Planet H.I.P.H.O.P. Presents
          </span>
        </div>
        
        <h1 className="relative text-6xl md:text-8xl font-black mb-6 tracking-tight z-10">
          <span className="bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
            THE ARTIST
          </span>
          <br />
          <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]">
            ARCADE
          </span>
        </h1>
        
        <p className="relative text-zinc-400 text-xl md:text-2xl max-w-xl mb-10 z-10">
          Where skill decides everything. 
          <span className="text-white block mt-2">Compete. Judge. Win.</span>
        </p>

        <div className="relative z-10 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-1 rounded-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-6 py-4 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all w-full sm:w-72"
              required
            />
            <button
              type="submit"
              className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-xl transition-all hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] hover:scale-105 active:scale-95"
            >
              Join Waitlist
            </button>
          </form>
        </div>

        {submitted && (
          <div className="mt-6 text-green-400 font-bold text-lg animate-pulse">
            ✓ You're in. We'll be in touch.
          </div>
        )}

        <div className="absolute bottom-10 text-zinc-600 text-sm">
          Coming 2026
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-32 px-6 bg-gradient-to-b from-transparent to-zinc-950">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          How It <span className="text-yellow-500">Works</span>
        </h2>
        
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            { num: "1️⃣", title: "Enter", desc: "Pay the entry fee. Get the beat. Submit your track." },
            { num: "2️⃣", title: "Get Judged", desc: "Other artists judge your work blind. You judge theirs." },
            { num: "3️⃣", title: "Win", desc: "Advance through rounds. Champion takes the prize." }
          ].map((item, i) => (
            <div key={i} className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-yellow-500/50 transition-all hover:shadow-[0_0_40px_rgba(251,191,36,0.1)]">
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl mb-4">{item.num}</div>
              <h3 className="text-xl font-bold text-yellow-500 mb-3">{item.title}</h3>
              <p className="text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Challenge Types */}
      <section className="relative z-10 py-32 px-6 bg-black">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
          Challenge <span className="text-yellow-500">Types</span>
        </h2>
        <p className="text-zinc-500 text-center mb-16 max-w-2xl mx-auto">
          Multiple ways to compete. Every format tests different skills.
        </p>
        
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          {[
            { title: "Lyrical Onslaught" },
            { title: "Story Mode" },
            { title: "Let the Beat Talk" },
            { title: "Persona Pen" },
            { title: "Brand Ambassador" }
          ].map((item, i) => (
            <div key={i} className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-yellow-500/30 transition-all hover:bg-zinc-800/50">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-500 to-amber-600 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-lg font-bold text-yellow-500">{item.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Fair System */}
      <section className="relative z-10 py-32 px-6 bg-gradient-to-b from-zinc-950 to-black">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Built <span className="text-yellow-500">Fair</span>
        </h2>
        
        <div className="max-w-2xl mx-auto space-y-4">
          {[
            { title: "Skill-Based", desc: "Winners decided by peer evaluation, not popularity or followers." },
            { title: "Blind Judging", desc: "Judges don't know who they're voting for. No bias." },
            { title: "Transparent Rules", desc: "Everyone knows the rules before they enter." }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-yellow-500/30 transition-all">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-bold">✓</div>
              <div>
                <h3 className="font-bold text-white">{item.title}</h3>
                <p className="text-zinc-500 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-32 px-6 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-yellow-500/10 blur-[100px] rounded-full" />
        
        <h2 className="relative text-4xl md:text-6xl font-black mb-6">
          Ready to <span className="text-yellow-500">Compete?</span>
        </h2>
        <p className="relative text-zinc-400 mb-10 max-w-md mx-auto">
          Join the waitlist. Be first to know when we launch.
        </p>
        
        <div className="relative inline-block bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-1 rounded-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-6 py-4 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 transition-all"
              required
            />
            <button
              type="submit"
              className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-xl transition-all hover:shadow-[0_0_30px_rgba(251,191,36,0.5)]"
            >
              Join Waitlist
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 px-6 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p className="font-bold text-zinc-500 mb-2">© 2026 The Artist Arcade | Planet H.I.P.H.O.P.</p>
        <p>Skill. Fairness. Excellence.</p>
      </footer>
    </main>
  );
}
