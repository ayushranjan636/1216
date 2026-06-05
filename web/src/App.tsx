import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { ChatPage } from '@/pages/ChatPage';
import { SnapsPage } from '@/pages/SnapsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MemoriesPage } from '@/pages/MemoriesPage';
import { DailyNotePage } from '@/pages/DailyNotePage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { CallLogsPage } from '@/pages/CallLogsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/snaps" element={<SnapsPage />} />
          <Route path="/calls" element={<CallLogsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/memories" element={<MemoriesPage />} />
          <Route path="/daily-note" element={<DailyNotePage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
