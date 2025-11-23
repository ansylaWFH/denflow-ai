import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
    Play, Square, Settings, FileText, Users,
    Activity, Terminal, Save, Upload, RefreshCw,
    Smartphone, Monitor, Send, Clock, Menu, X,
    Home, Mail, List, History as HistoryIcon, Cog, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import Auth from './Auth';

const API_URL = 'http://localhost:8000';

// Mobile-First App Component
function App() {
    const [session, setSession] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (!session) {
        return <Auth />;
    }

    return (
        <ErrorBoundary>
            <AppContent session={session} />
        </ErrorBoundary>
    );
}

function AppContent({ session }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    // ... rest of the component
    // Add Authorization header to axios requests
    useEffect(() => {
        if (session?.access_token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
        }
    }, [session]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await axios.post(`${API_URL}/upload_csv`, formData);
            alert("CSV Uploaded!");
            await fetchRecipients();
        } catch (err) {
            alert("Failed to upload CSV: " + err.message);
        }
    };

    const fetchRecipients = async () => {
        const res = await axios.get(`${API_URL}/recipients`);
        setRecipients(res.data.recipients);
    };

    const fetchTemplate = async () => {
        const res = await axios.get(`${API_URL}/template`);
        setTemplate(res.data.content);
    };

    const handleSaveTemplate = async () => {
        await axios.post(`${API_URL}/template`, { content: template });
        alert("Template saved!");
    };

    useEffect(() => {
        if (activeTab === 'template') fetchTemplate();
        if (activeTab === 'recipients') fetchRecipients();
    }, [activeTab]);

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Mail size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white">MailFlow</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Campaign Manager</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.status === 'RUNNING'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {status.status}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-20">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {activeTab === 'dashboard' && (
                            <DashboardMobile status={status} onStart={handleStart} onStop={handleStop} logsEndRef={logsEndRef} />
                        )}
                        {activeTab === 'template' && (
                            <TemplateMobile template={template} setTemplate={setTemplate} onSave={handleSaveTemplate} />
                        )}
                        {activeTab === 'recipients' && (
                            <RecipientsMobile recipients={recipients} onUpload={handleFileUpload} />
                        )}
                        {activeTab === 'history' && (
                            <HistoryMobile />
                        )}
                        {activeTab === 'settings' && (
                            <SettingsMobile configs={status.configs} onSave={handleSaveConfig} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-2 py-2 flex justify-around items-center z-20">
                <NavTab icon={Home} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                <NavTab icon={FileText} label="Template" active={activeTab === 'template'} onClick={() => setActiveTab('template')} />
                <NavTab icon={Users} label="Recipients" active={activeTab === 'recipients'} onClick={() => setActiveTab('recipients')} />
                <NavTab icon={HistoryIcon} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <NavTab icon={Cog} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
            </nav>
        </div>
    );
}

// Bottom Navigation Tab
const NavTab = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all min-w-[60px] ${active
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 dark:text-gray-400'
            }`}
    >
        <Icon size={22} className={active ? 'mb-1' : 'mb-1'} strokeWidth={active ? 2.5 : 2} />
        <span className={`text-xs font-medium ${active ? 'font-semibold' : ''}`}>{label}</span>
    </button>
);

// Dashboard Mobile View
const DashboardMobile = ({ status, onStart, onStop, logsEndRef }) => {
    const [analytics, setAnalytics] = useState({ opens: 0, unsubscribes: 0 });
    const [showScheduler, setShowScheduler] = useState(false);
    const [showUnsubscribes, setShowUnsubscribes] = useState(false);
    const [schedules, setSchedules] = useState([]);
    const [unsubscribeList, setUnsubscribeList] = useState([]);
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

    const fetchSchedules = async () => {
        try {
            const res = await axios.get(`${API_URL}/schedules`);
            setSchedules(res.data.schedules || []);
        } catch (e) {
            console.error("Failed to fetch schedules", e);
        }
    };

    const fetchUnsubscribes = async () => {
        try {
            const res = await axios.get(`${API_URL}/unsubscribes`);
            setUnsubscribeList(res.data.unsubscribes || []);
        } catch (e) {
            console.error("Failed to fetch unsubscribes", e);
        }
    };

    useEffect(() => {
        if (showScheduler) fetchSchedules();
    }, [showScheduler]);

    useEffect(() => {
        if (showUnsubscribes) fetchUnsubscribes();
    }, [showUnsubscribes]);

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

    const handleRemoveUnsubscribe = async (email) => {
        if (!confirm(`Remove ${email} from unsubscribe list?`)) return;
        try {
            await axios.post(`${API_URL}/unsubscribes/remove`, { email });
            fetchUnsubscribes();
            alert(`${email} removed from unsubscribe list`);
        } catch (e) {
            alert("Failed to remove: " + e.message);
        }
    };

    const progress = status.total_recipients > 0
        ? (status.current_index / status.total_recipients) * 100
        : 0;

    return (
        <div className="p-4 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatCardMobile label="Progress" value={`${status.current_index}/${status.total_recipients}`} color="blue" />
                <StatCardMobile label="Opens" value={analytics.opens} color="green" />
                <div onClick={() => setShowUnsubscribes(!showUnsubscribes)} className="cursor-pointer">
                    <StatCardMobile label="Unsubscribes" value={analytics.unsubscribes} color="red" />
                </div>
                <StatCardMobile label="Status" value={status.status} color="purple" />
            </div>

            {/* Unsubscribes Panel */}
            <AnimatePresence>
                {showUnsubscribes && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm overflow-hidden"
                    >
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Unsubscribed List</h3>
                            <button onClick={() => setShowUnsubscribes(false)}><X size={16} /></button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {unsubscribeList.length === 0 ? (
                                <div className="text-xs text-center text-gray-500 py-4">No unsubscribes found</div>
                            ) : (
                                unsubscribeList.map((email, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                                        <span className="text-xs font-mono">{email}</span>
                                        <button onClick={() => handleRemoveUnsubscribe(email)} className="text-red-500 text-xs">Remove</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Progress Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Campaign Progress</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={onStart}
                    disabled={status.status === 'RUNNING'}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg disabled:cursor-not-allowed transition-all"
                >
                    <Play size={20} fill="currentColor" />
                    <span>Start</span>
                </button>
                <button
                    onClick={onStop}
                    disabled={status.status !== 'RUNNING'}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg disabled:cursor-not-allowed transition-all"
                >
                    <Square size={20} fill="currentColor" />
                    <span>Stop</span>
                </button>
            </div>

            {/* Scheduler Toggle */}
            <button
                onClick={() => setShowScheduler(!showScheduler)}
                className="w-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-medium py-3 px-6 rounded-xl flex items-center justify-center space-x-2 border border-purple-200 dark:border-purple-800"
            >
                <Clock size={18} />
                <span>{showScheduler ? 'Hide Scheduler' : 'Schedule Campaign'}</span>
            </button>

            {/* Scheduler Panel */}
            <AnimatePresence>
                {showScheduler && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm overflow-hidden space-y-4"
                    >
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">New Schedule</h3>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Campaign Name"
                                value={newSchedule.name}
                                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            />
                            <input
                                type="datetime-local"
                                value={newSchedule.scheduled_time}
                                onChange={(e) => setNewSchedule({ ...newSchedule, scheduled_time: e.target.value.replace('T', ' ') + ':00' })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            />
                            <select
                                value={newSchedule.recurring}
                                onChange={(e) => setNewSchedule({ ...newSchedule, recurring: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            >
                                <option value="none">One-time</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                            <button onClick={handleCreateSchedule} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-lg text-sm">
                                Create Schedule
                            </button>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Scheduled Campaigns</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {schedules.length === 0 ? (
                                    <div className="text-xs text-center text-gray-500">No schedules</div>
                                ) : (
                                    schedules.map((sch) => (
                                        <div key={sch.id} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg flex justify-between items-start">
                                            <div>
                                                <div className="text-sm font-medium">{sch.name}</div>
                                                <div className="text-xs text-gray-500">{sch.scheduled_time}</div>
                                                <div className="text-xs text-purple-500 mt-1 capitalize">{sch.status}</div>
                                            </div>
                                            <button onClick={() => handleDeleteSchedule(sch.id)} className="text-red-500 p-1"><X size={16} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Logs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                        <Terminal size={16} className="mr-2" />
                        Live Logs
                    </h3>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                    {status.logs.slice(-10).map((log, i) => (
                        <div key={i} className="text-gray-600 dark:text-gray-400">{log}</div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};

// Stat Card Mobile
const StatCardMobile = ({ label, value, color }) => {
    const colors = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    };

    return (
        <div className={`${colors[color]} rounded-xl p-4 shadow-sm`}>
            <div className="text-xs font-medium opacity-75 mb-1">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
};

// Template Mobile View
const TemplateMobile = ({ template, setTemplate, onSave }) => {
    const [testEmail, setTestEmail] = useState("");

    const handleSendTest = async () => {
        if (!testEmail) return alert("Please enter an email address.");
        try {
            await axios.post(`${API_URL}/test-email`, { recipient: testEmail });
            alert(`Test email sent to ${testEmail}`);
        } catch (e) {
            alert("Failed to send test email: " + e.message);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Email Template</h2>
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <ReactQuill
                        theme="snow"
                        value={template}
                        onChange={setTemplate}
                        className="h-64"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Test Email</h3>
                <input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                />
                <button onClick={handleSendTest} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center space-x-2">
                    <Send size={18} />
                    <span>Send Test</span>
                </button>
            </div>

            <button onClick={onSave} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg">
                <Save size={20} />
                <span>Save Template</span>
            </button>
        </div>
    );
};

// Recipients Mobile View
const RecipientsMobile = ({ recipients, onUpload }) => (
    <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recipients</h2>
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl flex items-center space-x-2 cursor-pointer">
                    <Upload size={18} />
                    <span>Upload CSV</span>
                    <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
                </label>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Total: <span className="font-bold text-gray-900 dark:text-white">{recipients.length}</span> recipients
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {recipients.map((row, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        {Object.entries(row).map(([key, val]) => (
                            <div key={key} className="text-xs">
                                <span className="font-medium text-gray-500 dark:text-gray-400">{key}:</span>{' '}
                                <span className="text-gray-900 dark:text-white">{val}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// History Mobile View
const HistoryMobile = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        axios.get(`${API_URL}/history`).then(res => setLogs(res.data.logs));
    }, []);

    return (
        <div className="p-4 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Campaign History</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {logs.map((log, i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300">
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Settings Mobile View
const SettingsMobile = ({ configs, onSave }) => {
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
        if (!confirm("Remove this configuration?")) return;
        const newConfigs = localConfigs.filter((_, i) => i !== index);
        setLocalConfigs(newConfigs);
    };

    const handleSaveAll = async () => {
        await onSave(localConfigs);
        await axios.post(`${API_URL}/config/url`, { url: publicUrl });
    };

    return (
        <div className="p-4 space-y-6">
            {/* Public URL Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Public Tracking Domain</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Required for open tracking. Enter your Render URL (e.g., https://your-app.onrender.com)
                </p>
                <input
                    type="text"
                    placeholder="https://your-app.onrender.com"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                />
            </div>

            {/* SMTP Configs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">SMTP Configurations</h3>
                    <button
                        onClick={handleAddConfig}
                        className="text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-medium"
                    >
                        + Add New
                    </button>
                </div>

                {localConfigs.length === 0 && (
                    <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500">
                        No configurations yet. Click "Add New" to start.
                    </div>
                )}

                {localConfigs.map((config, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm space-y-3 relative">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Config #{idx + 1}</h3>
                            <button
                                onClick={() => handleRemoveConfig(idx)}
                                className="text-red-500 p-1 hover:bg-red-50 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">SMTP Server</label>
                                <input
                                    type="text"
                                    placeholder="smtp.gmail.com"
                                    value={config.SERVER}
                                    onChange={(e) => handleChange(idx, 'SERVER', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Port</label>
                                <input
                                    type="number"
                                    placeholder="587"
                                    value={config.PORT}
                                    onChange={(e) => handleChange(idx, 'PORT', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="you@gmail.com"
                                    value={config.EMAIL}
                                    onChange={(e) => handleChange(idx, 'EMAIL', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">App Password</label>
                                <input
                                    type="password"
                                    placeholder="xxxx xxxx xxxx xxxx"
                                    value={config.PASSWORD}
                                    onChange={(e) => handleChange(idx, 'PASSWORD', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Display Name</label>
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={config.DISPLAY_NAME}
                                    onChange={(e) => handleChange(idx, 'DISPLAY_NAME', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleSaveAll}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg sticky bottom-20 z-10"
            >
                <Save size={20} />
                <span>Save All Settings</span>
            </button>
        </div>
    );
};

// Error Boundary
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

export default App;
