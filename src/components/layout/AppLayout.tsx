import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* モバイル用オーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* モバイルヘッダー */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <div className="p-4 lg:p-6 max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
