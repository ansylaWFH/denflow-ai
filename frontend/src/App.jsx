import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  Play, Square, Settings, FileText, Users,
  Activity, Terminal, Save, Upload, RefreshCw,
  Smartphone, Monitor, Send, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'http://localhost:8000';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <pre className="bg-black/20 p-4 rounded">{this.state.error?.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState({
    status: 'IDLE',
    current_index: 0,
    total_recipients: 0,
    logs: [],
    configs: []
  });
  const [template, setTemplate] = useState('');
  const [recipients, setRecipients] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [status.logs]);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/status`);
      setStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch status", err);
    }
  };

  const handleStart = async () => {
    await axios.post(`${API_URL}/start`);
    fetchStatus();
  };

  const handleStop = async () => {
    await axios.post(`${API_URL}/stop`);
    fetchStatus();
  };

  const handleSaveConfig = async (newConfigs) => {
    await axios.post(`${API_URL}/config`, { configs: newConfigs });
    alert("Configurations saved!");
  };

  const handleSaveTemplate = async () => {
    await axios.post(`${API_URL}/template`, { content: template });
    alert("Template saved!");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API_URL}/upload_csv`, formData);
      alert("CSV Uploaded!");
      await fetchRecipients(); // Refresh the list
    } catch (err) {
      alert("Failed to upload CSV: " + err.message);
    }
  };

  const fetchTemplate = async () => {
    const res = await axios.get(`${API_URL}/template`);
    setTemplate(res.data.content);
  };

  const fetchRecipients = async () => {
    const res = await axios.get(`${API_URL}/recipients`);
    setRecipients(res.data.recipients);
  };

  useEffect(() => {
    if (activeTab === 'template') fetchTemplate();
    if (activeTab === 'recipients') fetchRecipients();
  }, [activeTab]);

  return (
    <div className="flex h-screen w-full max-w-[1600px] mx-auto text-white overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sidebar */}
      <div className="w-72 m-6 flex flex-col space-y-6">
        <div className="glass-panel p-6 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Send size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MailFlow AI</h1>
            <div className="text-xs text-gray-400 font-medium">v2.0 Premium</div>
          </div>
        </div>

        <div className="glass-panel flex-1 p-4 space-y-2">
          <NavButton icon={Activity} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={FileText} label="Template" active={activeTab === 'template'} onClick={() => setActiveTab('template')} />
          <NavButton icon={Users} label="Recipients" active={activeTab === 'recipients'} onClick={() => setActiveTab('recipients')} />
          <NavButton icon={Clock} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <div className="h-px bg-white/10 my-2 mx-2"></div>
          <NavButton icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 pl-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {activeTab === 'dashboard' && (
              <Dashboard
                status={status}
                onStart={handleStart}
                onStop={handleStop}
                logsEndRef={logsEndRef}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsPanel configs={status.configs} onSave={handleSaveConfig} />
            )}
            {activeTab === 'template' && (
              <TemplateEditor template={template} setTemplate={setTemplate} onSave={handleSaveTemplate} />
            )}
            {activeTab === 'recipients' && (
              <RecipientsView recipients={recipients} onUpload={handleFileUpload} />
            )}
            {activeTab === 'history' && (
              <HistoryView />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${active
      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25'
      : 'hover:bg-white/5 text-gray-400 hover:text-white'
      }`}
  >
    <Icon size={20} className={`transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-gray-500 group-hover:text-indigo-400'}`} />
    <span className="font-medium">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
  </button>
);

const Dashboard = ({ status, onStart, onStop, logsEndRef }) => {
  const [analytics, setAnalytics] = useState({ opens: 0, unsubscribes: 0 });
  const [unsubscribeList, setUnsubscribeList] = useState([]);
  const [showUnsubscribes, setShowUnsubscribes] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    scheduled_time: "",
    recurring: "none"
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API_URL}/analytics`);
        setAnalytics(res.data);
      } catch (e) { }
    };
    const interval = setInterval(fetchAnalytics, 5000);
    fetchAnalytics();
    return () => clearInterval(interval);
  }, []);

  const fetchUnsubscribes = async () => {
    try {
      const res = await axios.get(`${API_URL}/unsubscribes`);
      setUnsubscribeList(res.data.unsubscribes || []);
    } catch (e) {
      console.error("Failed to fetch unsubscribes", e);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${API_URL}/schedules`);
      setSchedules(res.data.schedules || []);
    } catch (e) {
      console.error("Failed to fetch schedules", e);
    }
  };

  const handleRemoveUnsubscribe = async (email) => {
    if (!confirm(`Remove ${email} from unsubscribe list? They will receive future emails.`)) return;
    try {
      await axios.post(`${API_URL}/unsubscribes/remove`, { email });
      fetchUnsubscribes();
      alert(`${email} removed from unsubscribe list`);
    } catch (e) {
      alert("Failed to remove: " + e.message);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.name || !newSchedule.scheduled_time) {
      alert("Please fill in all fields");
      return;
    }
    try {
      await axios.post(`${API_URL}/schedules`, newSchedule);
      setNewSchedule({ name: "", scheduled_time: "", recurring: "none" });
      fetchSchedules();
      alert("Schedule created successfully!");
    } catch (e) {
      alert("Failed to create schedule: " + e.message);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!confirm("Delete this scheduled campaign?")) return;
    try {
      await axios.delete(`${API_URL}/schedules/${scheduleId}`);
      fetchSchedules();
    } catch (e) {
      alert("Failed to delete: " + e.message);
    }
  };

  useEffect(() => {
    if (showUnsubscribes) {
      fetchUnsubscribes();
    }
  }, [showUnsubscribes]);

  useEffect(() => {
    if (showScheduler) {
      fetchSchedules();
    }
  }, [showScheduler]);

  const progress = status.total_recipients > 0
    ? (status.current_index / status.total_recipients) * 100
    : 0;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          label="Status"
          value={status.status}
          icon={Activity}
          color={status.status === 'RUNNING' ? 'text-emerald-400' : 'text-amber-400'}
          subtext="System State"
        />
        <StatCard
          label="Progress"
          value={`${status.current_index} / ${status.total_recipients}`}
          icon={Send}
          subtext={`${progress.toFixed(1)}% Completed`}
        />
        <StatCard
          label="Opens"
          value={analytics.opens}
          icon={Monitor}
          color="text-blue-400"
          subtext="Total Reads"
        />
        <div
          onClick={() => setShowUnsubscribes(!showUnsubscribes)}
          className="cursor-pointer"
        >
          <StatCard
            label="Unsubscribes"
            value={analytics.unsubscribes}
            icon={Users}
            color="text-rose-400"
            subtext={showUnsubscribes ? "Click to hide" : "Click to view"}
          />
        </div>
      </div>

      {/* Unsubscribe List Panel */}
      {showUnsubscribes && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-panel p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users size={20} className="text-rose-400" />
              Unsubscribed Emails ({unsubscribeList.length})
            </h3>
            <button
              onClick={() => setShowUnsubscribes(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto bg-black/20 rounded-lg border border-white/10">
            {unsubscribeList.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No unsubscribes yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {unsubscribeList.map((email, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                    <span className="text-sm text-gray-300 font-mono">{email}</span>
                    <button
                      onClick={() => handleRemoveUnsubscribe(email)}
                      className="text-xs px-3 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Controls & Progress */}
      <div className="glass-panel p-8 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex space-x-4 z-10">
          <button onClick={onStart} disabled={status.status === 'RUNNING'} className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Play size={20} fill="currentColor" /> <span>Start Campaign</span>
          </button>
          <button onClick={onStop} disabled={status.status !== 'RUNNING'} className="btn-danger flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Square size={20} fill="currentColor" /> <span>Stop</span>
          </button>
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all border border-purple-500/30 flex items-center space-x-2"
          >
            <Clock size={20} /> <span>{showScheduler ? 'Hide' : 'Schedule'}</span>
          </button>
        </div>

        <div className="flex-1 ml-12 z-10">
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-gray-400">Campaign Progress</span>
            <span className="text-white">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-gray-800/50 rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
            />
          </div>
        </div>
      </div>

      {/* Scheduler Panel */}
      {showScheduler && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-panel p-6"
        >
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Clock size={20} className="text-purple-400" />
            Schedule Campaign
          </h3>

          <div className="grid grid-cols-2 gap-6">
            {/* Create Schedule Form */}
            <div className="bg-black/20 rounded-lg border border-white/10 p-4">
              <h4 className="text-sm font-semibold mb-3 text-purple-200">New Schedule</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm"
                    placeholder="e.g., Monday Morning Blast"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Scheduled Time</label>
                  <input
                    type="datetime-local"
                    value={newSchedule.scheduled_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, scheduled_time: e.target.value.replace('T', ' ') + ':00' })}
                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Recurring</label>
                  <select
                    value={newSchedule.recurring}
                    onChange={(e) => setNewSchedule({ ...newSchedule, recurring: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm"
                  >
                    <option value="none">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <button
                  onClick={handleCreateSchedule}
                  className="w-full btn-primary text-sm py-2"
                >
                  Create Schedule
                </button>
              </div>
            </div>

            {/* Scheduled Campaigns List */}
            <div className="bg-black/20 rounded-lg border border-white/10 p-4">
              <h4 className="text-sm font-semibold mb-3 text-purple-200">Scheduled Campaigns ({schedules.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {schedules.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-8">No scheduled campaigns</div>
                ) : (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-sm font-medium text-white">{schedule.name}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {schedule.scheduled_time}
                            {schedule.recurring && <span className="ml-2 px-2 py-0.5 bg-purple-500/20 rounded text-purple-300">↻ {schedule.recurring}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded inline-block ${schedule.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                        schedule.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                        {schedule.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Logs Console */}
      <div className="glass-panel p-0 flex-1 flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
          <div className="flex items-center space-x-2 text-gray-300">
            <Terminal size={18} className="text-indigo-400" />
            <span className="font-medium text-sm">Live System Logs</span>
          </div>
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 p-4 bg-[#0a0a0a]/50">
          {status.logs.map((log, i) => (
            <div key={i} className="text-gray-400 border-b border-white/5 pb-1 last:border-0 hover:bg-white/5 hover:text-gray-200 transition-colors px-2 rounded">
              <span className="text-indigo-500 mr-2">➜</span> {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subtext, color = 'text-white', icon: Icon }) => (
  <div className="glass-panel p-6 relative overflow-hidden group hover:bg-white/10 transition-colors">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
      {Icon && <Icon size={64} />}
    </div>
    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</h3>
    <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
    {subtext && <div className="text-xs text-gray-500 font-medium">{subtext}</div>}
  </div>
);

const SettingsPanel = ({ configs, onSave }) => {
  const [localConfigs, setLocalConfigs] = useState(configs);
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    if (configs.length > 0) setLocalConfigs(configs);
    axios.get(`${API_URL}/config`).then(res => {
      if (res.data.public_url) setPublicUrl(res.data.public_url);
    });
  }, [configs]);

  const handleChange = (index, field, value) => {
    const newConfigs = [...localConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: value };
    setLocalConfigs(newConfigs);
  };

  const handleAddConfig = () => {
    const newConfig = {
      SERVER: "smtp.gmail.com",
      PORT: 587,
      EMAIL: "",
      PASSWORD: "",
      DISPLAY_NAME: ""
    };
    setLocalConfigs([...localConfigs, newConfig]);
  };

  const handleRemoveConfig = (index) => {
    if (localConfigs.length <= 1) {
      alert("You must have at least one SMTP configuration");
      return;
    }
    if (!confirm("Remove this SMTP configuration?")) return;
    const newConfigs = localConfigs.filter((_, i) => i !== index);
    setLocalConfigs(newConfigs);
  };

  const handleSave = async () => {
    await onSave(localConfigs);
    await axios.post(`${API_URL}/config/url`, { url: publicUrl });
  };

  return (
    <div className="glass-panel p-8 h-full overflow-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-gray-400 text-sm mt-1">Manage your SMTP servers and tracking configuration.</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={handleAddConfig} className="px-4 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all border border-green-500/30 flex items-center space-x-2">
            <span className="text-xl">+</span> <span>Add Config</span>
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center space-x-2">
            <Save size={18} /> <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div className="mb-8 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 p-6 rounded-2xl border border-indigo-500/30 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-lg font-semibold mb-2 text-indigo-200 flex items-center gap-2">
            <Activity size={18} /> Public Tracking Domain
          </h3>
          <p className="text-sm text-indigo-200/70 mb-4 max-w-2xl">
            Required for Open Tracking and Unsubscribe links to work correctly.
            Use Ngrok or your own domain (e.g., <code>https://my-app.ngrok-free.app</code>).
          </p>
          <input
            type="text"
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-black/30 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none shadow-inner"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {localConfigs.map((config, idx) => (
          <div key={idx} className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-colors relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Configuration {idx + 1}</h3>
              <div className="flex items-center space-x-2">
                <div className="px-2 py-1 rounded bg-white/10 text-xs font-mono text-gray-400">SMTP</div>
                {localConfigs.length > 1 && (
                  <button
                    onClick={() => handleRemoveConfig(idx)}
                    className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-all"
                    title="Remove this config"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-5">
              <InputGroup label="Server Host" value={config.SERVER} onChange={(v) => handleChange(idx, 'SERVER', v)} />
              <InputGroup label="Port" value={config.PORT} onChange={(v) => handleChange(idx, 'PORT', v)} />
              <InputGroup label="Email Address" value={config.EMAIL} onChange={(v) => handleChange(idx, 'EMAIL', v)} />
              <InputGroup label="Password" value={config.PASSWORD} type="password" onChange={(v) => handleChange(idx, 'PASSWORD', v)} />
              <InputGroup label="Display Name" value={config.DISPLAY_NAME} onChange={(v) => handleChange(idx, 'DISPLAY_NAME', v)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-colors"
    />
  </div>
);

const TemplateEditor = ({ template, setTemplate, onSave }) => {
  const [testEmail, setTestEmail] = useState("");
  const [viewMode, setViewMode] = useState("desktop"); // desktop | mobile
  const [editorMode, setEditorMode] = useState("visual"); // visual | code
  const [showMergeTags, setShowMergeTags] = useState(false);
  const [availableFields, setAvailableFields] = useState([]);

  // Fetch available CSV fields
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const res = await axios.get(`${API_URL}/recipients`);
        if (res.data.recipients && res.data.recipients.length > 0) {
          const fields = Object.keys(res.data.recipients[0]);
          setAvailableFields(fields);
        }
      } catch (e) {
        console.error("Failed to fetch fields", e);
      }
    };
    fetchFields();
  }, []);

  const handleSendTest = async () => {
    if (!testEmail) return alert("Please enter an email address.");
    try {
      await axios.post(`${API_URL}/test-email`, { recipient: testEmail });
      alert(`Test email sent to ${testEmail}`);
    } catch (e) {
      alert("Failed to send test email: " + e.message);
    }
  };

  const copyMergeTag = (field) => {
    const tag = `{${field}}`;
    navigator.clipboard.writeText(tag);
    alert(`Copied: ${tag}`);
  };

  return (
    <div className="flex h-full gap-4">
      {/* Editor Column */}
      <div className="glass-panel p-6 flex-1 flex flex-col min-w-[500px]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold">Editor</h2>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setEditorMode('visual')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${editorMode === 'visual' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Visual
              </button>
              <button
                onClick={() => setEditorMode('code')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${editorMode === 'code' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                HTML
              </button>
            </div>
            <button
              onClick={() => setShowMergeTags(!showMergeTags)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all border border-purple-500/30"
            >
              {showMergeTags ? '✕ Hide' : '📋 Merge Tags'}
            </button>
          </div>

          <div className="flex space-x-2">
            <button onClick={() => setViewMode('desktop')} className={`p-2 rounded ${viewMode === 'desktop' ? 'bg-indigo-600' : 'bg-white/10'}`}>
              <Monitor size={16} />
            </button>
            <button onClick={() => setViewMode('mobile')} className={`p-2 rounded ${viewMode === 'mobile' ? 'bg-indigo-600' : 'bg-white/10'}`}>
              <Smartphone size={16} />
            </button>
          </div>
        </div>

        {editorMode === 'visual' && (
          <div className="mb-3 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg text-amber-200 text-xs">
            <strong>💡 Tip:</strong> For email campaigns with buttons and advanced styling, switch to <strong>HTML mode</strong> and paste your complete email HTML code. Visual mode is for basic text editing only.
          </div>
        )}

        {/* Merge Tags Panel */}
        {showMergeTags && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-3 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg"
          >
            <h3 className="text-sm font-bold text-purple-200 mb-2">📋 Available Merge Tags</h3>
            <p className="text-xs text-purple-300/70 mb-3">Click to copy, then paste in your email template</p>
            <div className="flex flex-wrap gap-2">
              {availableFields.length === 0 ? (
                <div className="text-xs text-gray-500">Upload a CSV to see available fields</div>
              ) : (
                availableFields.map((field) => (
                  <button
                    key={field}
                    onClick={() => copyMergeTag(field)}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-mono border border-purple-500/30 transition-all hover:scale-105"
                  >
                    {`{${field}}`}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}

        <div className="flex-1 bg-white text-black rounded-lg overflow-hidden flex flex-col">
          {editorMode === 'visual' ? (
            <ReactQuill
              theme="snow"
              value={template}
              onChange={setTemplate}
              className="h-full flex flex-col"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, false] }],
                  ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                  [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
                  ['link', 'image'],
                  ['clean']
                ],
              }}
            />
          ) : (
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-300 resize-none outline-none border-none"
              placeholder="<html>...</html>"
            />
          )}
        </div>

        <div className="mt-4 flex justify-between items-center pt-4 border-t border-white/10">
          <div className="flex space-x-2">
            <input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="bg-black/20 border border-white/10 rounded px-3 py-2 text-sm w-64"
            />
            <button onClick={handleSendTest} className="btn-primary flex items-center space-x-2 text-sm py-1">
              <Send size={14} /> <span>Test</span>
            </button>
          </div>
          <button onClick={onSave} className="btn-primary flex items-center space-x-2">
            <Save size={18} /> <span>Save Template</span>
          </button>
        </div>
      </div>

      {/* Preview Column */}
      <div className="glass-panel p-0 flex flex-col bg-black/40 w-[650px] relative overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">
            {viewMode} Preview
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'desktop' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
            >
              <Monitor size={16} />
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'mobile' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
            >
              <Smartphone size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 relative bg-gradient-to-br from-black/20 to-black/40">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
          </div>

          {viewMode === 'mobile' ? (
            // iPhone Frame - Realistic mobile view
            <div className="relative bg-black rounded-[50px] shadow-2xl border-[14px] border-gray-900 ring-1 ring-white/20" style={{ width: '375px', height: '667px' }}>
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140px] h-[30px] bg-black rounded-b-[20px] z-20"></div>
              {/* Screen - scrollable */}
              <div className="w-full h-full bg-white overflow-y-auto overflow-x-hidden rounded-[36px]" style={{ scrollbarWidth: 'thin' }}>
                <iframe
                  srcDoc={`<!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <meta charset="UTF-8">
                        <style>
                          body { margin: 0; padding: 0; background: #fff; }
                          .email-container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        </style>
                      </head>
                      <body>
                        <div class="email-container">${template}</div>
                      </body>
                    </html>`}
                  title="Mobile Preview"
                  className="w-full h-full border-none"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          ) : (
            // Desktop Browser Frame - Gmail-style centered view
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10" style={{ width: '600px', height: '500px' }}>
              {/* Browser Toolbar */}
              <div className="h-10 bg-[#f3f4f6] border-b border-gray-300 flex items-center px-4 space-x-3 flex-shrink-0">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                </div>
                <div className="flex-1 bg-white h-6 rounded-md border border-gray-300 text-[10px] text-gray-500 flex items-center px-3 font-mono">
                  inbox/campaign-preview
                </div>
              </div>
              {/* Email Content - Gmail-style centered */}
              <div className="flex-1 bg-white overflow-y-auto overflow-x-hidden">
                <iframe
                  srcDoc={`<!DOCTYPE html>
                    <html>
                      <head>
                        <meta charset="UTF-8">
                        <style>
                          body { margin: 0; padding: 20px; background: #fff; }
                          .email-container { max-width: 600px; margin: 0 auto; }
                        </style>
                      </head>
                      <body>
                        <div class="email-container">${template}</div>
                      </body>
                    </html>`}
                  title="Desktop Preview"
                  className="w-full border-none"
                  style={{ minHeight: '450px', height: '100%' }}
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RecipientsView = ({ recipients, onUpload }) => (
  <div className="glass-panel p-0 h-full flex flex-col overflow-hidden">
    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
      <div>
        <h2 className="text-xl font-bold">Recipients List</h2>
        <p className="text-sm text-gray-400 mt-1">Manage your target audience.</p>
      </div>
      <label className="btn-primary flex items-center space-x-2 cursor-pointer shadow-lg shadow-indigo-500/20">
        <Upload size={18} />
        <span>Upload CSV</span>
        <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
      </label>
    </div>

    <div className="flex-1 overflow-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-white/5 text-gray-400 sticky top-0 backdrop-blur-md z-10">
          <tr>
            {recipients.length > 0 && Object.keys(recipients[0]).map((key) => (
              <th key={key} className="p-4 font-semibold border-b border-white/10 uppercase tracking-wider text-xs">{key}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {recipients.map((row, i) => (
            <tr key={i} className="hover:bg-white/5 transition-colors group">
              {Object.values(row).map((val, j) => (
                <td key={j} className="p-4 text-gray-300 group-hover:text-white transition-colors">{val}</td>
              ))}
            </tr>
          ))}
          {recipients.length === 0 && (
            <tr><td className="p-12 text-center text-gray-500" colSpan="100%">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Users size={32} className="text-gray-600" />
                </div>
                <p>No recipients found. Upload a CSV file to get started.</p>
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
    <div className="p-3 border-t border-white/10 bg-white/5 text-xs text-gray-500 text-right font-mono">
      {recipients.length} Total Rows • Showing All
    </div>
  </div>
);

const HistoryView = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/history`).then(res => setLogs(res.data.logs));
  }, []);

  return (
    <div className="glass-panel p-0 h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
        <div>
          <h2 className="text-xl font-bold">Campaign History</h2>
          <p className="text-sm text-gray-400 mt-1">Audit logs of past executions.</p>
        </div>
        <button onClick={() => axios.get(`${API_URL}/history`).then(res => setLogs(res.data.logs))} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <RefreshCw size={20} className="text-gray-400 hover:text-white" />
        </button>
      </div>
      <div className="flex-1 overflow-auto font-mono text-sm space-y-1 p-6 bg-[#0a0a0a]/30">
        {logs.map((log, i) => (
          <div key={i} className="text-gray-400 border-b border-white/5 pb-2 last:border-0 flex gap-3">
            <span className="text-indigo-500/50 select-none">{i + 1}.</span>
            <span>{log}</span>
          </div>
        ))}
        {logs.length === 0 && <div className="text-gray-600 text-center p-12">No history found.</div>}
      </div>
    </div>
  );
};

export default App;
