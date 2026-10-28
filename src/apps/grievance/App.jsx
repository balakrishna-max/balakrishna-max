import React from 'react';
import { Toaster } from 'react-hot-toast';

import Grievance from './pages/grievance/Grievance';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserDashboard from './pages/user/UserDashboard';
import DeptGrievanceDashboard from './pages/deptGrievance/DeptGrievanceDashboard';
import DeptDashboard from './pages/deptDashboard/DeptDashboard';
import './App.css';

/**
 * The JSP picks the page with config.page:
 *   ADMIN_DASHBOARD | USER_DASHBOARD | DEPT_GRIEVANCE | DEPT_DASHBOARD | TICKET_RAISE (default)
 */
const PAGES = {
  ADMIN_DASHBOARD: AdminDashboard,
  USER_DASHBOARD: UserDashboard,
  DEPT_GRIEVANCE: DeptGrievanceDashboard,
  DEPT_DASHBOARD: DeptDashboard,
  TICKET_RAISE: Grievance,
};

function App({ config }) {
  if (!config) {
    return <div style={{ padding: 20, color: 'red' }}>Error: Config missing.</div>;
  }

  const Page = PAGES[config.page] || Grievance;

  return (
    <>
      <Page config={config} />
      <Toaster position="top-right" />
    </>
  );
}

export default App;
