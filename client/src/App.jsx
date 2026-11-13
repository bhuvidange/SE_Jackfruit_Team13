
import { Route, Routes } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import QuestionBank from './pages/QuestionBank';
import ProtectedRoute from './components/ProtectedRoute';
import Materials from './pages/Materials';
import NotFound from './pages/NotFound';
import QuizAttempt from './pages/QuizAttempt';
import QuizCreate from './pages/QuizCreate';
import QuizList from './pages/QuizList';
import QuizResult from './pages/QuizResult';
import AdminUsers from './pages/AdminUsers';
import StudentDashboard from './pages/StudentDashboard';
import AdminModeration from './pages/AdminModeration';

const staff = ['instructor', 'admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Student dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Question bank routes */}
      <Route
        path="/questions"
        element={
          <ProtectedRoute roles={staff}>
            <QuestionBank />
          </ProtectedRoute>
        }
      />

      {/* Materials routes */}
      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <Materials />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />

      {/* Quiz routes */}
      <Route
        path="/quizzes"
        element={
          <ProtectedRoute roles={['student', 'instructor']}>
            <QuizList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quizzes/new"
        element={
          <ProtectedRoute roles={['instructor']}>
            <QuizCreate />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quizzes/:id/attempt"
        element={
          <ProtectedRoute roles={['student']}>
            <QuizAttempt />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attempts/:attemptId"
        element={
          <ProtectedRoute roles={['student', 'instructor']}>
            <QuizResult />
          </ProtectedRoute>
        }
      />

      
      <Route path="/admin/moderation" element={<ProtectedRoute roles={['admin']}><AdminModeration /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
