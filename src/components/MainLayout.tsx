import { MarketingFooter } from './MarketingFooter'
import AppBar from './AppBar'
import { Outlet, useLocation } from 'react-router'

export default function MainLayout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      {!isHome && <AppBar />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!isHome && <MarketingFooter />}
    </div>
  )
}
