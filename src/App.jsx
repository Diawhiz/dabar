import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Archive from "./pages/Archive.jsx";
import ClipsReady from "./pages/ClipsReady.jsx";
import Highlights from "./pages/Highlights.jsx";
import Home from "./pages/Home.jsx";
import Processing from "./pages/Processing.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="/processing" element={<Processing />} />
        <Route path="/processing/:sermonId" element={<Processing />} />
        <Route path="/highlights" element={<Highlights />} />
        <Route path="/clips" element={<ClipsReady />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
