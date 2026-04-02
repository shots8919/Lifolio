import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'

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

      {/* サイドバー（左メニュー：ログアウト等） */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* モバイルヘッダー（ハンバーガーメニュー） */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {/* lg未満ではボトムナビ分の余白を確保 */}
          <div className="p-4 pb-20 lg:p-6 lg:pb-20 max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ボトムナビゲーション（モバイル固定） */}
      <BottomNav />
    </div>
  )
}
