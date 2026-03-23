import { useState } from 'react'
import { useMealStore } from '@/stores/mealStore'
import {
  PREFERENCE_CATEGORIES,
  type PreferencePerson,
  type PreferenceType,
  type PreferenceCategory,
} from '@/types/meal'

const PERSON_LABELS: Record<PreferencePerson, { label: string; color: string; bg: string; bd: string }> = {
  shota: { label: 'Shota', color: 'var(--shota)', bg: 'var(--shota-bg)', bd: 'var(--shota-bd)' },
  miyu:  { label: 'Miyu',  color: 'var(--miyu)',  bg: 'var(--miyu-bg)',  bd: 'var(--miyu-bd)'  },
}

const TYPE_LABELS: { value: PreferenceType; label: string; emoji: string }[] = [
  { value: 'love',    label: '大好物', emoji: '❤️' },
  { value: 'dislike', label: '苦手',   emoji: '🙅' },
]

interface AddFormState {
  category: PreferenceCategory
  name: string
}

function defaultAddForm(): AddFormState {
  return { category: '肉類', name: '' }
}

interface PersonCardProps {
  person: PreferencePerson
}

function PersonCard({ person }: PersonCardProps) {
  const theme = PERSON_LABELS[person]
  const preferences = useMealStore(s => s.preferences)
  const addPreference = useMealStore(s => s.addPreference)
  const deletePreference = useMealStore(s => s.deletePreference)

  const [addingType, setAddingType] = useState<PreferenceType | null>(null)
  const [form, setForm] = useState<AddFormState>(defaultAddForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const getItems = (type: PreferenceType) =>
    preferences.filter(p => p.person === person && p.type === type)

  const handleAdd = async (type: PreferenceType) => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      await addPreference({
        person,
        type,
        category: form.category,
        name: form.name.trim(),
      })
      setForm(defaultAddForm())
      setAddingType(null)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePreference(id)
    } catch {
      setError('削除に失敗しました')
    }
  }

  const inputStyle = {
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'var(--surface)',
  }

  return (
    <div
      className="rounded-xl overflow-hidden flex-1 min-w-0"
      style={{ background: 'var(--surface)', border: `1px solid ${theme.bd}` }}
    >
      {/* ヘッダー */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: theme.bg, borderBottom: `1px solid ${theme.bd}` }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: theme.color }}
        >
          {theme.label[0]}
        </div>
        <span className="font-semibold text-sm" style={{ color: theme.color }}>
          {theme.label}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {TYPE_LABELS.map(({ value: typeVal, label, emoji }) => {
          const items = getItems(typeVal)
          const isAdding = addingType === typeVal

          return (
            <div key={typeVal}>
              {/* セクションタイトル */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  {emoji} {label}
                </span>
                {!isAdding && (
                  <button
                    onClick={() => {
                      setAddingType(typeVal)
                      setForm(defaultAddForm())
                      setError('')
                    }}
                    className="text-xs px-2 py-0.5 rounded-md transition-colors hover:opacity-80"
                    style={{ color: theme.color, background: theme.bg, border: `1px solid ${theme.bd}` }}
                  >
                    ＋ 追加
                  </button>
                )}
              </div>

              {/* タグ一覧 */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {items.length === 0 && !isAdding && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>未登録</span>
                )}
                {items.map(item => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{
                      background: theme.bg,
                      border: `1px solid ${theme.bd}`,
                      color: theme.color,
                    }}
                  >
                    <span className="text-[10px] opacity-60">{item.category}</span>
                    {item.name}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* 追加フォーム */}
              {isAdding && (
                <div
                  className="mt-2 p-3 rounded-lg space-y-2"
                  style={{ background: theme.bg, border: `1px solid ${theme.bd}` }}
                >
                  <div className="flex gap-2">
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value as PreferenceCategory }))}
                      className="h-8 px-2 rounded-md text-xs outline-none"
                      style={inputStyle}
                    >
                      {PREFERENCE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="食材・料理名を入力"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd(typeVal) }}
                      className="flex-1 h-8 px-2 rounded-md text-xs outline-none"
                      style={inputStyle}
                      autoFocus
                      disabled={saving}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdd(typeVal)}
                      disabled={saving || !form.name.trim()}
                      className="px-3 py-1 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: theme.color }}
                    >
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => { setAddingType(null); setError('') }}
                      className="px-3 py-1 rounded-md text-xs transition-colors hover:bg-black/5"
                      style={{ color: 'var(--muted)' }}
                    >
                      キャンセル
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PreferencesPage() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>好み設定</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          登録した好み・苦手はAIの献立提案に反映されます
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <PersonCard person="shota" />
        <PersonCard person="miyu" />
      </div>
    </div>
  )
}
