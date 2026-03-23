import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sha256 } from '@/lib/crypto'
import { useAuthStore } from '@/stores/authStore'
import { useMealStore } from '@/stores/mealStore'

export default function SettingsPage() {
  const username = useAuthStore(s => s.username)
  const geminiApiKey = useMealStore(s => s.geminiApiKey)
  const geminiModelName = useMealStore(s => s.geminiModelName)
  const saveGeminiKey = useMealStore(s => s.saveGeminiKey)
  const saveGeminiModelName = useMealStore(s => s.saveGeminiModelName)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ message: '', show: false, error: false })

  // Gemini APIキー
  const [geminiInput, setGeminiInput] = useState('')
  const [geminiLoading, setGeminiLoading] = useState(false)

  // Geminiモデル名
  const [modelInput, setModelInput] = useState('')
  const [modelLoading, setModelLoading] = useState(false)

  const showToast = (message: string, error = false) => {
    setToast({ message, show: true, error })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2600)
  }

  const handleSaveGeminiKey = async () => {
    if (!geminiInput.trim()) return
    setGeminiLoading(true)
    try {
      await saveGeminiKey(geminiInput.trim())
      setGeminiInput('')
      showToast('APIキーを保存しました')
    } catch {
      showToast('APIキーの保存に失敗しました', true)
    } finally {
      setGeminiLoading(false)
    }
  }

  const handleSaveModelName = async () => {
    if (!modelInput.trim()) return
    setModelLoading(true)
    try {
      await saveGeminiModelName(modelInput.trim())
      setModelInput('')
      showToast('モデル名を保存しました')
    } catch {
      showToast('モデル名の保存に失敗しました', true)
    } finally {
      setModelLoading(false)
    }
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

      {/* Gemini APIキーカード */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI設定（献立管理）</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Groq Cloud で取得した API キーを登録してください。献立の提案・レシピURL取込に使用します（無料）。
            <br />
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'var(--shota)' }}
            >
              → Groq Console で API キーを取得
            </a>
          </p>

          {geminiApiKey && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
            >
              <span>✅ APIキー設定済み</span>
              <span className="font-mono">{geminiApiKey.slice(0, 8)}••••</span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              placeholder={geminiApiKey ? '新しいキーを入力して上書きできます' : 'gsk_...'}
              value={geminiInput}
              onChange={e => setGeminiInput(e.target.value)}
              disabled={geminiLoading}
              className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSaveGeminiKey}
              disabled={geminiLoading || !geminiInput.trim()}
              className="px-4 h-9 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--miyu)' }}
            >
              {geminiLoading ? '保存中...' : '保存'}
            </button>
          </div>

          {/* モデル名設定 */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              使用するモデル名（デフォルト: llama-3.3-70b-versatile）
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
              空欄の場合は llama-3.3-70b-versatile が使われます。<br />
              他の選択肢: <code style={{ fontFamily: 'monospace' }}>llama-3.1-8b-instant</code>、
              <code style={{ fontFamily: 'monospace' }}>gemma2-9b-it</code> など
            </p>
            {geminiModelName && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-2"
                style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
              >
                <span>✅ モデル設定済み:</span>
                <span className="font-mono">{geminiModelName}</span>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="llama-3.3-70b-versatile"
                value={modelInput}
                onChange={e => setModelInput(e.target.value)}
                disabled={modelLoading}
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none font-mono"
                style={inputStyle}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleSaveModelName}
                disabled={modelLoading || !modelInput.trim()}
                className="px-4 h-9 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--miyu)' }}
              >
                {modelLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
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
