import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoginPage from '@/features/auth/LoginPage'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import CalculatePage from '@/features/account/CalculatePage'
import DataPage from '@/features/account/DataPage'
import SettingsPage from '@/pages/SettingsPage'
import MealPage from '@/features/meal/MealPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter basename="/Lifolio">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="account/calculate" element={<CalculatePage />} />
          <Route path="account/data" element={<DataPage />} />
          <Route path="meal/plan" element={<MealPage />} />
          <Route path="meal/recipes" element={<MealPage />} />
          <Route path="meal/preferences" element={<MealPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
