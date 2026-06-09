import { motion } from "motion/react";
import { User, Piano, Library, Settings, Home as HomeIcon, Upload, Play, Search, Activity, BarChart2, Cloud } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { UploadMidi, Sizer } from "@/components";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] selection:bg-[#d0bcff]/30">
      <Navbar />
      
      <main className="relative pt-48 pb-20 px-6 overflow-visible min-h-screen flex flex-col items-center">
        {/* Deep Purple Perspective Gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[150%] h-1/2 glow-perspective" />
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#d0bcff]/10 blur-[120px] rounded-full" />
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
    <nav className="fixed top-0 w-full z-50 bg-[#131313]/80 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
      <div className="flex justify-between items-center px-6 h-24 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#a078ff] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(160,120,255,0.4)]">
                <Piano className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-[#e5e2e1]">loophesia</span>
            </div>
          </Link>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          <NavLink href="/" active>Home</NavLink>
          <NavLink href="/freeplay">Practice</NavLink>
          <NavLink href="/songs">Library</NavLink>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-[#3a3939] transition-colors duration-300 text-[#d0bcff] active:scale-95">
            <User className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children, active = false }: { href: string, children: React.ReactNode, active?: boolean }) {
  return (
    <Link 
      to={href} 
      className={`font-medium py-1 transition-all ${active ? 'text-[#d0bcff] border-b-2 border-[#d0bcff]' : 'text-[#e5e2e1]/60 hover:text-[#d0bcff]'}`}
    >
      {children}
    </Link>
  );
}

function Hero() {
  const navigate = useNavigate();

  return (
    <div className="relative z-10 w-full max-w-5xl text-center space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-6"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.1] text-[#e5e2e1]">
          loophesia<br />
          <span className="text-[#d0bcff] italic">for </span>
          <span className="text-[#d0bcff] italic">MIDI Keyboards</span>
        </h1>
        <p className="text-[#cbc3d7] text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
          Open Source Live Looping Practice App
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
      >
        <UploadMidi
          onUpload={(id) => navigate(`/studio?id=${id}&source=upload`)}
          className="group relative px-8 py-4 bg-[#a078ff] text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(160,120,255,0.3)] hover:shadow-[0_0_40px_rgba(160,120,255,0.5)] transition-all active:scale-95 w-full sm:w-auto"
        />
        <Link to="/songs" className="w-full sm:w-auto text-center px-8 py-4 glass-card text-[#e5e2e1] rounded-xl font-medium text-lg hover:bg-[#3a3939] transition-all active:scale-95 block">
          Browse Library
        </Link>
        <Link to="/studio" className="w-full sm:w-auto text-center px-8 py-4 glass-card text-[#e5e2e1] rounded-xl font-medium text-lg hover:bg-[#3a3939] transition-all active:scale-95 block border border-[#d0bcff]/20">
          Open Studio
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
          className="glass-card p-8 rounded-3xl bg-gradient-to-br from-[#a078ff]/20 to-transparent flex flex-col items-center text-center justify-center gap-6"
        >
          <BarChart2 className="text-[#d0bcff] w-16 h-16" />
          <h3 className="text-2xl font-bold">Intelligent Analysis</h3>
          <p className="text-[#cbc3d7] leading-relaxed">
            loomo breaks down your MIDI files into melodic layers, rhythmic structures, and harmonic movements automatically.
          </p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="glass-card p-8 rounded-3xl bg-gradient-to-br from-[#a078ff]/20 to-transparent flex flex-col items-center text-center justify-center gap-6"
        >
          <Activity className="text-[#d0bcff] w-16 h-16" />
          <h3 className="text-2xl font-bold">Activity Insights</h3>
          <p className="text-[#cbc3d7] leading-relaxed">
            Loophesia provides activity metrics to help you understand your practice patterns.
          </p>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="glass-card p-8 rounded-3xl bg-gradient-to-br from-[#a078ff]/20 to-transparent flex flex-col items-center text-center justify-center gap-6"
        >
          <Cloud className="text-[#d0bcff] w-16 h-16" />
          <h3 className="text-xl font-bold">Cloud Sync</h3>
          <p className="text-sm text-[#cbc3d7]">
            Your library follows you. Access your custom practices on any device.
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
      className={`flex flex-col items-center justify-center px-5 py-2 transition-all active:scale-90 ${active ? 'bg-gradient-to-tr from-[#d0bcff]/20 to-[#a078ff]/20 text-[#d0bcff] rounded-2xl shadow-[0_0_15px_rgba(208,188,255,0.3)]' : 'text-[#e5e2e1]/40 hover:text-[#d0bcff]'}`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-medium mt-1">{label}</span>
    </Link>
  );
}

