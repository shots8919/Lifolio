import { defineConfig } from 'vitest/config'
import path from 'path'

// ユニットテスト専用の設定（本番ビルドの vite.config.ts とは分離）。
// 現状は純粋ロジック（transferCalc 等）のみを対象とするため environment=node。
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
