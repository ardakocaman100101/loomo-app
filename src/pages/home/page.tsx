import { motion, AnimatePresence } from "motion/react";
import { User, Piano, Library, Settings, Home as HomeIcon, Upload, Play, Search, Activity, BarChart2, Cloud } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { UploadMidi, Sizer } from "@/components";
import { Logo, Github } from "@/icons";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#16182c] text-[#e5e2e1] selection:bg-[#6c79f0]/30">
      <Navbar />

      <main className="relative pt-48 pb-20 px-6 overflow-visible min-h-screen flex flex-col items-center">
        {/* Volumetric Expanded Ambient Lighting Glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Main expanded periwinkle glow */}
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[1400px] h-[900px] rounded-full bg-[#6c79f0]/12 blur-[180px]" />
          {/* Inner soft secondary indigo glow */}
          <div className="absolute top-[50px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#9ba4ff]/8 blur-[120px]" />
        </div>

        <Hero />

        <BentoGrid />
      </main>

      <MobileNav />
    </div>
  );
}

function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#16182c]/85 backdrop-blur-xl border-b border-white/[0.03] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
      <div className="flex justify-between items-center px-6 h-24 w-full max-w-7xl mx-auto relative">

        {/* Empty left side to balance */}
        <div className="w-10 h-10" />

        {/* Centered Logo + Title */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-85">
            <Logo height={32} width={64} className="w-16 h-8 shadow-[0_0_20px_rgba(108,121,240,0.25)]" />
            <span className="text-3xl sm:text-4xl font-black tracking-tighter text-[#e5e2e1]">loomo</span>
          </Link>
        </div>

        {/* Right Side: GitHub Icon */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ardakocaman100101/loophesia"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full hover:bg-[#3a3939] transition-all duration-300 text-[#cbc3d7] hover:text-[#6c79f0] active:scale-95"
            title="GitHub Repository"
          >
            <Github size={24} />
          </a>
        </div>

      </div>
    </nav>
  );
}

function NavLink({ href, children, active = false }: { href: string, children: React.ReactNode, active?: boolean }) {
  return (
    <Link
      to={href}
      className={`font-medium py-1 transition-all ${active ? 'text-[#6c79f0] border-b-2 border-[#6c79f0]' : 'text-[#e5e2e1]/60 hover:text-[#6c79f0]'}`}
    >
      {children}
    </Link>
  );
}

const VERBS = ["make", "play", "learn"];

function Hero() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % VERBS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-10 w-full max-w-5xl text-center space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-center w-full text-lg md:text-xl font-medium tracking-[0.35em] text-white/70 uppercase mb-4 select-none gap-[0.35em]">
          <motion.span layout>just</motion.span>
          <motion.span
            layout
            className="relative inline-flex items-center justify-center h-[1.5em] overflow-visible text-[#6c79f0] font-bold"
            style={{ perspective: "1000px" }}
          >
            {/* Invisible mirror to hold the layout width of the current word */}
            <span className="invisible select-none pointer-events-none whitespace-nowrap">
              {VERBS[index]}
            </span>

            <AnimatePresence mode="popLayout">
              <motion.span
                key={index}
                initial={{ y: "80%", rotateX: 90, z: -40, opacity: 0 }}
                animate={{ y: "0%", rotateX: 0, z: 0, opacity: 1 }}
                exit={{ y: "-80%", rotateX: -90, z: -40, opacity: 0 }}
                transition={{
                  y: { type: "spring", stiffness: 220, damping: 20 },
                  rotateX: { type: "spring", stiffness: 220, damping: 20 },
                  z: { type: "spring", stiffness: 220, damping: 20 },
                  opacity: { duration: 0.15 }
                }}
                className="absolute transform-gpu whitespace-nowrap flex items-center justify-center"
                style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
              >
                {VERBS[index]}
              </motion.span>
            </AnimatePresence>
          </motion.span>
          <motion.span layout>music</motion.span>
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-none bg-gradient-to-b from-white to-[#cbc3d5] bg-clip-text text-transparent mt-2">
          loomo
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
      >
        <UploadMidi
          onUpload={(id) => navigate(`/studio?id=${id}&source=upload`)}
          className="group relative px-8 py-4 bg-[#6c79f0] text-black hover:bg-[#8591ff] rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(108,121,240,0.45)] hover:shadow-[0_0_40px_rgba(108,121,240,0.65)] transition-all active:scale-95 w-full sm:w-auto"
        >
          <Upload className="h-5 w-5" />
          <span>Upload</span>
        </UploadMidi>
        <Link to="/songs" className="w-full sm:w-auto text-center px-8 py-4 text-[#e5e2e1] rounded-xl font-bold text-xl border border-white/10 hover:border-white/20 bg-transparent hover:bg-white/5 hover:backdrop-blur-md transition-all active:scale-95 block">
          Library
        </Link>
        <Link to="/freeplay" className="w-full sm:w-auto text-center px-8 py-4 text-[#e5e2e1] rounded-xl font-bold text-xl border border-white/10 hover:border-white/20 bg-transparent hover:bg-white/5 hover:backdrop-blur-md transition-all active:scale-95 block">
          Practice
        </Link>
      </motion.div>
    </div>
  );
}

function BentoGrid() {
  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24 z-10 relative">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-8 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex flex-col items-center text-center justify-center gap-6"
        >
          <BarChart2 className="text-white w-16 h-16" strokeWidth={2} />
          <h3 className="text-3xl font-bold text-white">MIDI Processing</h3>
          <p className="text-white text-lg leading-relaxed">
            loomo splits MIDI music files into manageable layers
          </p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-8 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex flex-col items-center text-center justify-center gap-6"
        >
          <Activity className="text-white w-16 h-16" strokeWidth={2} />
          <h3 className="text-3xl font-bold text-white">Play</h3>
          <p className="text-white text-lg leading-relaxed">
            Plug your instrument and start playing
          </p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-8 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex flex-col items-center text-center justify-center gap-6"
        >
          <Cloud className="text-white w-16 h-16" strokeWidth={2} />
          <h3 className="text-3xl font-bold text-white">Studio</h3>
          <p className="text-white text-lg leading-relaxed">
            Edit, quantize and mix in loomo's simplified native DAW
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#131313]/40 backdrop-blur-2xl rounded-t-3xl border-t border-[#e5e2e1]/10 z-50 flex justify-around items-center px-4 pb-6 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <MobileNavItem icon={<HomeIcon className="w-6 h-6" />} label="Home" active href="/" />
      <MobileNavItem icon={<Library className="w-6 h-6" />} label="Library" href="/songs" />
      <MobileNavItem icon={<Piano className="w-6 h-6" />} label="Practice" href="/freeplay" />
      <MobileNavItem icon={<Settings className="w-6 h-6" />} label="Settings" href="#" />
    </nav>
  );
}

function MobileNavItem({ icon, label, active = false, href }: { icon: React.ReactNode, label: string, active?: boolean, href: string }) {
  return (
    <Link
      to={href}
      className={`flex flex-col items-center justify-center px-5 py-2 transition-all active:scale-90 ${active ? 'bg-gradient-to-tr from-[#9ba4ff]/20 to-[#6c79f0]/20 text-[#9ba4ff] rounded-2xl shadow-[0_0_15px_rgba(155,164,255,0.3)]' : 'text-[#e5e2e1]/40 hover:text-[#9ba4ff]'}`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-medium mt-1">{label}</span>
    </Link>
  );
}

