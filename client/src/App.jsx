import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
// --- question bank imports (stage 2)
import QuestionBank from './pages/QuestionBank';

// --- materials imports (stage 3)

// --- quiz imports (stage 4)

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* question bank routes (stage 2) */}
      <Route path="/questions" element={<QuestionBank />} />

      {/* materials routes (stage 3) */}

      {/* quiz routes (stage 4) */}
    </Routes>
  );
}
