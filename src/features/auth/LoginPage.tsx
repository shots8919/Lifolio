import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { sha256 } from '@/lib/crypto'
import { useAuthStore } from '@/stores/authStore'
import NekoIcon from '@/components/ui/NekoIcon'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const login = useAuthStore(s => s.login)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'auth_hash')
        .single()

      if (fetchError || !data) {
        throw new Error('認証情報の取得に失敗しました。Supabaseの設定を確認してください。')
      }

      const inputHash = await sha256(`${username}:${password}`)
      if (inputHash === data.value) {
        login(username)
        navigate('/', { replace: true })
      } else {
        setError('ユーザー名またはパスワードが正しくありません')
        setPassword('')
        triggerShake()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--nav-bg)' }}
    >
      <div
        className={`w-full max-w-sm rounded-2xl p-8 shadow-2xl ${shake ? 'animate-shake' : ''}`}
        style={{ background: 'var(--surface)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'var(--shota)' }}
          >
            <NekoIcon size={26} />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Lifo<span style={{ color: 'var(--shota)' }}>lio</span>
          </h1>
          <p className="text-[11px] mt-1 tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            HOME MANAGEMENT SYSTEM
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              ユーザー名
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
            style={{ background: 'var(--shota)' }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>

    </div>
  )
}
