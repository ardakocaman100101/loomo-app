import { Github, Logo } from '@/icons'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Piano, User } from 'lucide-react'

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

export default function AppBar() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 w-full z-50 flex h-24 flex-col justify-center bg-[#16182c]/85 backdrop-blur-xl border-b border-white/[0.03] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-all duration-300"
    >
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6">

        {/* Empty left side to balance */}
        <div className="w-10 h-10" />

        {/* Centered Logo + Title */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-80">
            <Logo height={32} width={50} className="w-[50px] h-8 shadow-[0_0_20px_rgba(160,120,255,0.4)]" />
            <span className="text-3xl font-black tracking-tighter text-[#e5e2e1]">loomo</span>
          </Link>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ardakocaman100101/loophesia"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full hover:bg-[#3a3939] transition-all duration-300 text-[#cbc3d7] hover:text-[#d0bcff] active:scale-95"
            title="GitHub Repository"
          >
            <Github size={24} />
          </a>
        </div>

      </div>
    </nav>
  )
}
