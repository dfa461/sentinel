import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AssessmentPage } from './pages/AssessmentPage';
import { InteractiveAssessmentPage } from './pages/InteractiveAssessmentPage';
import { RecruiterDashboard } from './pages/RecruiterDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/interactive" replace />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/interactive" element={<InteractiveAssessmentPage />} />
        <Route path="/results/:assessmentId" element={<RecruiterDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
