import React, { useState, useEffect } from 'react';
import { Filter, Search, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AnalyticsCards from '../../components/admin/AnalyticsCards';
import TicketsTable from '../../components/admin/TicketsTable';
import TicketDetailsPanel from '../../components/admin/TicketDetailsPanel';
import FilterPanel from '../../components/admin/FilterPanel';
import DashboardLoader from '../../components/admin/DashboardLoader';
import '../../styles/admin/AdminDashboard.css';

const AdminDashboard = ({ config }) => {
  const [selectedTicket, setSelectedTicket] = useState(null);

  /* Two independent loading flags — loader hides when BOTH are ready */
  const [statsReady, setStatsReady] = useState(false);
  const [ticketsReady, setTicketsReady] = useState(false);
  const dashboardLoading = !statsReady || !ticketsReady;

  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    pendingTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0,
    slaCompliance: 0,
  });

  const [filter, setFilter] = useState({
    status: 1,
    flag: 'OPEN',
    tabName: 'Open Tickets',
  });

  const [advancedFilters, setAdvancedFilters] = useState({
    user: '',
    priority: '',
    category: '',
    slaStatus: '',
    ticketNumber: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [allTickets, setAllTickets] = useState([]);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('grv-admin-theme') === 'dark';
  });

  const refresh = () => setRefreshKey((k) => k + 1);
  const activeFilterCount = Object.values(advancedFilters).filter(Boolean).length;

  /* ---------- Theme ---------- */
  useEffect(() => {
    document.body.classList.toggle('grv-admin-dark', darkMode);
    localStorage.setItem('grv-admin-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('grv-admin-dark');
    };
  }, []);

  /* ---------- Reset readiness on filter change so loader re-arms ---------- */
  useEffect(() => {
    setStatsReady(false);
    setTicketsReady(false);
  }, [filter.status, filter.flag, refreshKey]);

  /* ---------- Safety timeout: force-hide after 8s ---------- */
  useEffect(() => {
    if (!dashboardLoading) return;
    const t = setTimeout(() => {
      setStatsReady(true);
      setTicketsReady(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [dashboardLoading]);

  /* ---------- Callbacks ---------- */
  const handleStatsLoaded = () => setStatsReady(true);

  const handleDataLoad = (tickets) => {
    setAllTickets(tickets);
    setTicketsReady(true);
  };

  return (
    <div className={`admin-wrapper ${darkMode ? 'grv-admin-dark' : ''}`}>
      {/* Full-page loader */}
      <DashboardLoader loading={dashboardLoading} text="Loading dashboard..." />

      {/* ============================== HERO ============================== */}
      <motion.div
        className="admin-hero"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="admin-hero-left">
          <h1>HelpDesk Admin Dashboard</h1>
          <p>Manage, track, and resolve tickets efficiently</p>
        </div>

        <div className="admin-hero-right">
          <div className="hero-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search tickets, agents, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            className="hero-icon-btn"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className={`hero-btn ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="hero-btn-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </motion.div>

      {/* ============================== STAT CARDS ============================== */}
      <AnalyticsCards
        stats={stats}
        activeStatus={filter.status}
        onStatsLoaded={handleStatsLoaded}
        onSelect={(status, flag, tabName) => {
          setFilter({ status, flag, tabName });
          setSelectedTicket(null);
        }}
      />

      {/* ============================== MAIN BODY ============================== */}
      <div className="admin-body">
        <div className={`admin-table-col ${selectedTicket ? 'shrunk' : 'full'}`}>
          <TicketsTable
            config={config}
            filter={filter}
            refreshKey={refreshKey}
            onStatsUpdate={setStats}
            onTicketClick={setSelectedTicket}
            advancedFilters={advancedFilters}
            searchQuery={searchQuery}
            onDataLoad={handleDataLoad}
          />
        </div>

        <AnimatePresence mode="wait">
          {selectedTicket && (
            <motion.div
              key={selectedTicket}
              className="admin-detail-col"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <TicketDetailsPanel
                config={config}
                ticketId={selectedTicket}
                onClose={() => setSelectedTicket(null)}
                onUpdated={refresh}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================== FILTER PANEL ============================== */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        tickets={allTickets}
        users={[]}
        categories={[]}
        onFilterChange={setAdvancedFilters}
      />
    </div>
  );
};

export default AdminDashboard;