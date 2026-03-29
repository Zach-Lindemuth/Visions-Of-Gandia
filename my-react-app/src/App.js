import './App.css';
import Home from './views/Home';
import Login from './views/Login';
import Register from './views/Register';
import CreateCharacter from './views/CreateCharacter';
import CharacterSheet from './views/CharacterSheet';
import PendingApproval from './views/PendingApproval';
import AdminPortal from './views/AdminPortal';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import RequireAdmin from './auth/RequireAdmin';
import { ThemeProvider } from './theme/ThemeContext';
import AppLayout from "./layouts/AppLayout";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppLayout>
                    <Home />
                  </AppLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/characters/new"
              element={
                <RequireAuth>
                  <AppLayout>
                    <CreateCharacter />
                  </AppLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/characters/:id"
              element={
                <RequireAuth>
                  <AppLayout>
                    <CharacterSheet />
                  </AppLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AppLayout>
                    <AdminPortal />
                  </AppLayout>
                </RequireAdmin>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;