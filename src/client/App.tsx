import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SystemsPage from './pages/SystemsPage';
import BlocksPage from './pages/BlocksPage';
import TemplateCVPage from './pages/TemplateCVPage';
import JobPostingsPage from './pages/JobPostingsPage';
import JobSearchPage from './pages/JobSearchPage';
import CompiledCVsPage from './pages/CompiledCVsPage';
import RedTeamPage from './pages/RedTeamPage';
import QuestionsPage from './pages/QuestionsPage';
import QuestionnairePage from './pages/QuestionnairePage';
import GitIntegrationPage from './pages/GitIntegrationPage';
import CoverLettersPage from './pages/CoverLettersPage';
import ProfilePage from './pages/ProfilePage';
import JobMatchPage from './pages/JobMatchPage';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="systems" element={<SystemsPage />} />
          <Route path="blocks" element={<BlocksPage />} />
          <Route path="template" element={<TemplateCVPage />} />
          <Route path="jobs" element={<JobPostingsPage />} />
          <Route path="job-search" element={<JobSearchPage />} />
          <Route path="compiled" element={<CompiledCVsPage />} />
          <Route path="red-team" element={<RedTeamPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="questionnaire" element={<QuestionnairePage />} />
          <Route path="git" element={<GitIntegrationPage />} />
          <Route path="cover-letters" element={<CoverLettersPage />} />
          <Route path="match" element={<JobMatchPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
