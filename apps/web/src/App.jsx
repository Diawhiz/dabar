import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import Shell from "./components/Shell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Processing from "./pages/Processing.jsx";
import Transcript from "./pages/Transcript.jsx";
import Clips from "./pages/Clips.jsx";
import ClipReview from "./pages/ClipReview.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/processing/:sermonId" element={<Processing />} />
          <Route path="/transcript/:sermonId" element={<Transcript />} />
          <Route path="/clips/:sermonId" element={<ClipReview />} />
          <Route path="/chapters/:sermonId" element={<Clips />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
