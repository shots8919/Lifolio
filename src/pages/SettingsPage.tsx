import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sha256 } from '@/lib/crypto'
import { useAuthStore } from '@/stores/authStore'

export default function SettingsPage() {
  const username = useAuthStore(s => s.username)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ message: '', show: false, error: false })

  const showToast = (message: string, error = false) => {
    setToast({ message, show: true, error })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2600)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) return
    if (newPassword !== confirmPassword) {
      showToast('新しいパスワードが一致しません', true)
      return
    }
    if (newPassword.length < 4) {
      showToast('新しいパスワードは4文字以上で入力してください', true)
      return
    }
    if (!username) {
      showToast('セッションが古いため変更できません。再ログインしてください', true)
      return
    }

    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'auth_hash')
        .single()

      if (fetchError || !data) {
        throw new Error('認証情報の取得に失敗しました')
      }

      const currentHash = await sha256(`${username}:${currentPassword}`)
      if (currentHash !== data.value) {
        showToast('現在のパスワードが正しくありません', true)
        return
      }

      const newHash = await sha256(`${username}:${newPassword}`)
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ value: newHash })
        .eq('key', 'auth_hash')

      if (updateError) throw new Error('パスワードの更新に失敗しました')

      showToast('パスワードを変更しました')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '予期せぬエラーが発生しました', true)
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)' }
  const inputStyle = { border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>設定</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>システム設定</p>
      </div>

      {/* パスワード変更カード */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>パスワード変更</span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              現在のパスワード
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full max-w-xs h-9 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              新しいパスワード
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full max-w-xs h-9 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              新しいパスワード（確認）
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full max-w-xs h-9 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--shota)' }}
            >
              {loading ? '変更中...' : '変更する'}
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg z-50 pointer-events-none transition-all duration-300 ${
          toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{ background: toast.error ? 'var(--danger)' : '#1f2937' }}
      >
        {toast.message}
      </div>
    </div>
  )
}
