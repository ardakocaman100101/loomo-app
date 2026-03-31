import { motion } from "motion/react";
import { User, Piano, Library, Settings, Home as HomeIcon, Upload, Play, Search, Plus, Activity, BarChart2, Cloud } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { UploadMidi, Sizer } from "@/components";
import { FeaturedSongsPreview } from "./FeaturedSongsPreview";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] selection:bg-[#d0bcff]/30">
      <Navbar />
      
      <main className="relative pt-48 pb-20 px-6 overflow-hidden min-h-screen flex flex-col items-center">
        {/* Deep Purple Perspective Gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[150%] h-1/2 glow-perspective" />
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#d0bcff]/10 blur-[120px] rounded-full" />
        </div>

        <Hero />
        
        <BentoGrid />

        <div className="w-full max-w-7xl mx-auto z-10 relative mt-12">
          <FeaturedSongsPreview marginTop={0} />
        </div>
      </main>

      <MobileNav />
      <FloatingActionButton />
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
          onUpload={(id) => navigate(`/play?id=${id}&source=upload`)}
          className="group relative px-8 py-4 bg-[#a078ff] text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(160,120,255,0.3)] hover:shadow-[0_0_40px_rgba(160,120,255,0.5)] transition-all active:scale-95 w-full sm:w-auto"
        />
        <Link to="/songs" className="w-full sm:w-auto text-center px-8 py-4 glass-card text-[#e5e2e1] rounded-xl font-medium text-lg hover:bg-[#3a3939] transition-all active:scale-95 block">
          Browse Library
        </Link>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 1 }}
        className="relative mt-20 group"
      >
        <div className="absolute -inset-1 bg-gradient-to-b from-[#d0bcff]/20 to-transparent blur-2xl opacity-50" />
        <div className="relative glass-card rounded-3xl overflow-hidden aspect-video shadow-2xl">
          <div className="absolute inset-0 bg-[#0e0e0e]">
            <div className="w-full h-full opacity-40 mix-blend-screen overflow-hidden relative">
              <div className="absolute bottom-0 w-full flex items-end justify-center gap-1 h-3/4 px-12">
                {[...Array(12)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [`${20 + Math.random() * 60}%`, `${30 + Math.random() * 60}%`, `${20 + Math.random() * 60}%`] }}
                    transition={{ repeat: Infinity, duration: 1.5 + Math.random(), ease: "easeInOut" }}
                    className={`w-2 rounded-t-full ${i % 3 === 0 ? 'bg-[#d0bcff]' : i % 3 === 1 ? 'bg-[#d0bcff]/60' : 'bg-[#a078ff]'}`}
                  />
                ))}
              </div>
              <img 
                alt="Studio Keyboard" 
                className="w-full h-full object-cover opacity-20 grayscale" 
                src="https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&q=80&w=1000" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Link to="/freeplay" className="w-20 h-20 rounded-full bg-[#d0bcff]/10 backdrop-blur-xl border border-[#d0bcff]/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Play className="text-[#d0bcff] w-10 h-10 fill-[#d0bcff]" />
              </Link>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-[#353534]">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "33%" }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                className="h-full bg-[#d0bcff] shadow-[0_0_10px_rgba(208,188,255,0.8)]" 
              />
            </div>
          </div>
        </div>

        {/* Floating Info Card */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute -bottom-6 -right-6 hidden md:block w-64 glass-card p-4 rounded-2xl shadow-xl border border-[#d0bcff]/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#a078ff] flex items-center justify-center">
              <Piano className="text-white w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[#e5e2e1]">Clair de Lune</p>
              <p className="text-[10px] text-[#cbc3d7] uppercase tracking-wider">Claude Debussy</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#d0bcff]">
            <span>Lvl: Advanced</span>
            <span>88 Keys Match</span>
          </div>
        </motion.div>
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
          className="md:col-span-2 glass-card p-8 rounded-3xl group cursor-pointer hover:bg-[#201f1f] transition-colors"
        >
          <div className="flex flex-col h-full justify-between gap-12">
            <div className="space-y-4 text-left">
              <h3 className="text-2xl font-bold">Intelligent Analysis</h3>
              <p className="text-[#cbc3d7] leading-relaxed">
                Loophesia breaks down your MIDI files into melodic layers, rhythmic structures, and harmonic movements automatically.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#3a3939] flex items-center justify-center">
                <BarChart2 className="text-[#d0bcff] w-6 h-6" />
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#3a3939] flex items-center justify-center">
                <Activity className="text-[#d0bcff] w-6 h-6" />
              </div>
            </div>
          </div>
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

function FloatingActionButton() {
  return (
    <button className="fixed right-6 bottom-24 md:bottom-8 w-14 h-14 bg-[#d0bcff] text-[#131313] rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40">
      <Plus className="w-8 h-8" />
    </button>
  );
}
