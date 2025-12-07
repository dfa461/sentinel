import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { InteractiveAssessmentPage } from './pages/InteractiveAssessmentPage';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { AssessmentTokenPage } from './pages/AssessmentTokenPage';
import { ThankYouPage } from './pages/ThankYouPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/interactive" element={<InteractiveAssessmentPage />} />
        <Route path="/assessment/:token" element={<AssessmentTokenPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/results/:assessmentId" element={<RecruiterDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
