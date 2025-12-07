import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { InteractiveAssessmentPage } from './pages/InteractiveAssessmentPage';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { CandidateSearchPage } from './pages/CandidateSearchPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/interactive" element={<InteractiveAssessmentPage />} />
        <Route path="/search" element={<CandidateSearchPage />} />
        <Route path="/results/:assessmentId" element={<RecruiterDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
