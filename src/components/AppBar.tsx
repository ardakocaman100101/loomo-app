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
      className={clsx(
        'sticky top-0 z-50 flex h-24 w-full flex-col justify-center transition-all duration-300',
        scrolled ? 'bg-[#131313]/80 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]' : 'bg-[#131313]'
      )}
    >
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6">
        
        {/* Left icon */}
        <div className="flex items-center gap-4 w-1/3">
          <Link to="/" className="flex items-center">
            <div className="flex items-center gap-2 transition hover:opacity-80">
              <div className="w-10 h-10 bg-[#a078ff] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(160,120,255,0.4)]">
                <Piano className="text-white w-6 h-6" />
              </div>
            </div>
          </Link>
        </div>

        {/* Center Logo */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center">
          <Link
            to={'/'}
            className="flex items-center gap-4 text-[#e5e2e1] transition hover:opacity-80"
          >
            <Logo height={48} width={48} className="h-10 w-10 sm:h-12 sm:w-12 text-[#d0bcff]" />
            <span className="text-2xl sm:text-4xl font-black tracking-tighter">loophesia</span>
          </Link>
        </div>

        {/* Right Nav */}
        <div className="flex w-1/3 justify-end items-center space-x-4 md:space-x-8">
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="/" active={location.pathname === '/'}>Home</NavLink>
            <NavLink href="/freeplay" active={location.pathname === '/freeplay'}>Practice</NavLink>
            <NavLink href="/songs" active={location.pathname === '/songs'}>Library</NavLink>
            <NavLink href="/studio" active={location.pathname === '/studio'}>Studio</NavLink>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ardakocaman100101/loophesia"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:block text-[#cbc3d7] transition hover:text-[#d0bcff]"
            >
              <Github size={20} />
            </a>
            <button className="hidden sm:block p-2 rounded-full hover:bg-[#3a3939] transition-colors duration-300 text-[#d0bcff] active:scale-95">
              <User className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
