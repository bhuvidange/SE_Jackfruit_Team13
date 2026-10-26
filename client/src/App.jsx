import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
// --- question bank imports (stage 2)
import QuestionBank from './pages/QuestionBank';
// --- materials imports (stage 3)
import ProtectedRoute from './components/ProtectedRoute';
import Materials from './pages/Materials';
import NotFound from './pages/NotFound';
// --- quiz imports (stage 4)
import QuizAttempt from './pages/QuizAttempt';
import QuizCreate from './pages/QuizCreate';
import QuizList from './pages/QuizList';
import QuizResult from './pages/QuizResult';

const staff = ['instructor', 'admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* question bank routes (stage 2) */}
      <Route path="/questions" element={<ProtectedRoute roles={staff}><QuestionBank /></ProtectedRoute>} />

      {/* materials routes (stage 3) */}
      <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />

      {/* quiz routes (stage 4) */}
      <Route path="/quizzes" element={<ProtectedRoute roles={['student', 'instructor']}><QuizList /></ProtectedRoute>} />
      <Route path="/quizzes/new" element={<ProtectedRoute roles={['instructor']}><QuizCreate /></ProtectedRoute>} />
      <Route path="/quizzes/:id/attempt" element={<ProtectedRoute roles={['student']}><QuizAttempt /></ProtectedRoute>} />
      <Route path="/attempts/:attemptId" element={<ProtectedRoute roles={['student', 'instructor']}><QuizResult /></ProtectedRoute>} />
    </Routes>
  );
}
