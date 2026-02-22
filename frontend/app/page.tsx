'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Wallet, 
  Settings, 
  Activity, 
  CreditCard, 
  ShieldCheck, 
  ArrowRightLeft, 
  Database,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  ChevronRight,
  Code2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

// --- Types ---

type Tab = 'dashboard' | 'request' | 'pool' | 'admin';

type LoanStatus = 'pending' | 'approved' | 'rejected' | 'repaid';

interface LoanRequest {
  id: string;
  amount: number;
  status: LoanStatus;
  creditScore?: number;
  interestRate?: number;
  timestamp: number;
  borrower: string;
}

interface LogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  hash?: string;
}

// --- Mock Data ---

const INITIAL_LIQUIDITY = 1250000;
const MOCK_POOL_DATA = [
  { name: 'Jan', liquidity: 800000 },
  { name: 'Feb', liquidity: 950000 },
  { name: 'Mar', liquidity: 900000 },
  { name: 'Apr', liquidity: 1100000 },
  { name: 'May', liquidity: 1150000 },
  { name: 'Jun', liquidity: 1250000 },
];

// --- Components ---

const Navbar = ({ activeTab, setActiveTab, isConnected, connectWallet }: { 
  activeTab: Tab; 
  setActiveTab: (t: Tab) => void;
  isConnected: boolean;
  connectWallet: () => void;
}) => (
  <nav className="terminal-panel sticky top-0 z-50 w-full h-16 px-6 flex items-center justify-between bg-black">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-[#00ff9d]/10 flex items-center justify-center border border-[#00ff9d]">
        <Terminal className="w-5 h-5 text-[#00ff9d]" />
      </div>
      <span className="font-bold text-lg tracking-tight text-[#00ff9d] uppercase">Credit_Oracle_v1.0</span>
    </div>

    <div className="hidden md:flex items-center gap-6">
      {[
        { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
        { id: 'request', label: 'REQ_LOAN', icon: CreditCard },
        { id: 'pool', label: 'LIQUIDITY', icon: Database },
        { id: 'admin', label: 'ADMIN_NODE', icon: Settings },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as Tab)}
          className={cn(
            "px-2 py-1 text-sm font-medium transition-all duration-200 flex items-center gap-2 border-b-2",
            activeTab === tab.id 
              ? "border-[#00ff9d] text-[#00ff9d]" 
              : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700"
          )}
        >
          <span className="opacity-50 text-[10px] mr-1">0{['dashboard', 'request', 'pool', 'admin'].indexOf(tab.id) + 1}</span>
          {tab.label}
        </button>
      ))}
    </div>

    <button
      onClick={connectWallet}
      className={cn(
        "flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all border",
        isConnected 
          ? "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]" 
          : "bg-transparent text-gray-400 border-gray-600 hover:border-[#00ff9d] hover:text-[#00ff9d]"
      )}
    >
      <Wallet className="w-4 h-4" />
      {isConnected ? "[ 0x71...3A92 ]" : "CONNECT_WALLET"}
    </button>
  </nav>
);

const StatCard = ({ label, value, subtext, icon: Icon, trend }: { 
  label: string; 
  value: string; 
  subtext?: string; 
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="terminal-card p-6 relative overflow-hidden group">
    <div className="absolute top-2 right-2 opacity-20">
      <Icon className="w-16 h-16 text-gray-800" />
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <div className="w-2 h-2 bg-gray-500"></div>
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-3xl font-bold text-[#e5e5e5] mb-1 font-mono">{value}</div>
      {subtext && (
        <div className={cn(
          "text-xs font-medium font-mono",
          trend === 'up' ? "text-[#00ff9d]" : trend === 'down' ? "text-red-500" : "text-gray-500"
        )}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'} {subtext}
        </div>
      )}
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: LoanStatus }) => {
  const styles = {
    pending: "text-yellow-500 border-yellow-500",
    approved: "text-[#00ff9d] border-[#00ff9d]",
    rejected: "text-red-500 border-red-500",
    repaid: "text-cyan-500 border-cyan-500",
  };

  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase border tracking-wider", styles[status])}>
      [{status}]
    </span>
  );
};

const OracleVisualizer = ({ isProcessing }: { isProcessing: boolean }) => {
  if (!isProcessing) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed bottom-8 right-8 z-50"
    >
      <div className="bg-black border border-[#00ff9d] p-4 shadow-[4px_4px_0px_0px_rgba(0,255,157,0.2)] min-w-[320px]">
        <div className="flex items-center gap-3 mb-2 border-b border-gray-800 pb-2">
          <div className="animate-spin">
            <Loader2 className="w-4 h-4 text-[#00ff9d]" />
          </div>
          <h4 className="text-xs font-bold text-[#00ff9d] uppercase">Oracle_Link :: Processing</h4>
        </div>
        <div className="font-mono text-[10px] text-gray-400 space-y-1">
          <p>&gt; Initializing secure handshake...</p>
          <p>&gt; Verifying off-chain credentials...</p>
          <p className="animate-pulse">&gt; Awaiting ZK-proof generation...</p>
        </div>
      </div>
    </motion.div>
  );
};

const EventLogPanel = ({ logs }: { logs: LogEvent[] }) => (
  <div className="terminal-card p-0 h-full flex flex-col">
    <div className="flex items-center gap-2 p-3 border-b border-gray-800 bg-gray-900/30">
      <Terminal className="w-3 h-3 text-gray-400" />
      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">System_Logs</h3>
    </div>
    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar max-h-[300px] font-mono text-[10px]">
      {logs.length === 0 ? (
        <div className="text-gray-600 italic px-2">&gt; No events recorded.</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="flex gap-2 hover:bg-white/5 p-1">
            <span className="text-gray-600">[{log.timestamp}]</span>
            <span className={cn(
              "font-medium",
              log.type === 'success' ? "text-[#00ff9d]" :
              log.type === 'error' ? "text-red-500" :
              log.type === 'warning' ? "text-yellow-500" : "text-gray-300"
            )}>
              {log.type.toUpperCase()}: {log.message}
            </span>
          </div>
        ))
      )}
      <div className="animate-pulse text-[#00ff9d] mt-2">_</div>
    </div>
  </div>
);

// --- Main Page Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [amount, setAmount] = useState('');
  
  // Derived state
  const activeLoan = loans.find(l => l.status === 'approved' || l.status === 'pending');
  const creditScore = activeLoan?.creditScore || 750; // Default demo score

  const addLog = (type: LogEvent['type'], message: string) => {
    const newLog: LogEvent = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      hash: '0x' + Math.random().toString(16).substring(2, 10) + '...'
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleConnect = () => {
    setIsConnected(true);
    addLog('success', 'Wallet connected: 0x71...3A92');
  };

  const handleRequestLoan = () => {
    if (!amount || isNaN(Number(amount))) return;
    
    setIsProcessing(true);
    addLog('info', `Initiating loan request for $${amount}...`);
    
    // Simulate Oracle Delay
    setTimeout(() => {
      addLog('info', 'Oracle Request Sent: Chainlink Function #4291');
    }, 1500);

    setTimeout(() => {
      const score = Math.floor(Math.random() * (850 - 600) + 600);
      const isApproved = score > 680;
      const rate = isApproved ? (Math.random() * (8 - 3) + 3).toFixed(2) : undefined;
      
      const newLoan: LoanRequest = {
        id: Math.random().toString(36).substring(7).toUpperCase(),
        amount: Number(amount),
        status: isApproved ? 'approved' : 'rejected',
        creditScore: score,
        interestRate: rate ? Number(rate) : undefined,
        timestamp: Date.now(),
        borrower: '0x71...3A92'
      };

      setLoans(prev => [newLoan, ...prev]);
      setIsProcessing(false);
      
      if (isApproved) {
        addLog('success', `Loan Approved! Credit Score: ${score}. Rate: ${rate}%`);
        setActiveTab('dashboard');
      } else {
        addLog('error', `Loan Rejected. Credit Score: ${score} (Min: 680)`);
      }
      setAmount('');
    }, 4000);
  };

  const handleRepay = (id: string) => {
    setIsProcessing(true);
    addLog('info', `Processing repayment for Loan #${id}...`);
    
    setTimeout(() => {
      setLoans(prev => prev.map(l => l.id === id ? { ...l, status: 'repaid' } : l));
      setIsProcessing(false);
      addLog('success', `Loan #${id} repaid successfully.`);
    }, 2000);
  };

  return (
    <div className="min-h-screen pb-20 bg-[#050505] font-mono">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isConnected={isConnected} 
        connectWallet={handleConnect} 
      />

      <main className="max-w-7xl mx-auto px-6 pt-8">
        <AnimatePresence mode="wait">
          
          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  label="Available Liquidity" 
                  value={`$${INITIAL_LIQUIDITY.toLocaleString()}`} 
                  subtext="+2.4% / 30d"
                  trend="up"
                  icon={Database} 
                />
                <StatCard 
                  label="Active Loan" 
                  value={activeLoan ? `$${activeLoan.amount.toLocaleString()}` : "$0.00"} 
                  subtext={activeLoan ? `${activeLoan.interestRate}% APR` : "NO ACTIVE LOANS"}
                  trend="neutral"
                  icon={Activity} 
                />
                <StatCard 
                  label="Credit Score" 
                  value={activeLoan?.creditScore?.toString() || "---"} 
                  subtext={activeLoan ? "VERIFIED BY ORACLE" : "CONNECT TO VERIFY"}
                  trend={activeLoan?.creditScore && activeLoan.creditScore > 700 ? 'up' : 'neutral'}
                  icon={ShieldCheck} 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                <div className="lg:col-span-2 terminal-card p-6">
                  <h3 className="text-xs font-bold text-[#00ff9d] uppercase mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Liquidity_Pool_Depth_Analytics
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={MOCK_POOL_DATA}>
                        <defs>
                          <linearGradient id="colorLiquidity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#00ff9d" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="name" stroke="#4b5563" tick={{fontSize: 10, fontFamily: 'monospace'}} tickLine={false} axisLine={false} />
                        <YAxis stroke="#4b5563" tick={{fontSize: 10, fontFamily: 'monospace'}} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '0px', fontFamily: 'monospace' }}
                          itemStyle={{ color: '#00ff9d' }}
                        />
                        <Area type="step" dataKey="liquidity" stroke="#00ff9d" strokeWidth={2} fillOpacity={1} fill="url(#colorLiquidity)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="lg:col-span-1">
                  <EventLogPanel logs={logs} />
                </div>
              </div>

              {activeLoan && activeLoan.status === 'approved' && (
                <div className="terminal-card p-6 border-l-4 border-l-[#00ff9d]">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">ACTIVE LOAN #{activeLoan.id}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400 font-mono">
                        <span>RATE: <span className="text-[#00ff9d]">{activeLoan.interestRate}%</span></span>
                        <span>DUE: <span className="text-gray-300">30 DAYS</span></span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRepay(activeLoan.id)}
                      className="bg-[#00ff9d] hover:bg-[#00cc7d] text-black px-4 py-2 text-sm font-bold uppercase transition-colors"
                    >
                      Repay Loan
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* REQUEST LOAN VIEW */}
          {activeTab === 'request' && (
            <motion.div 
              key="request"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div className="terminal-card p-8">
                <h2 className="text-xl font-bold text-[#00ff9d] mb-2 uppercase">Request_Capital</h2>
                <p className="text-gray-500 mb-8 text-sm font-mono">&gt; Confidential credit scoring powered by Chainlink DECO.</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Loan Amount (USDC)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00ff9d] font-mono">$</span>
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black border border-gray-700 py-4 pl-10 pr-4 text-xl text-white placeholder:text-gray-800 focus:outline-none focus:border-[#00ff9d] transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="bg-[#00ff9d]/5 border border-[#00ff9d]/20 p-4 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-[#00ff9d] mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-[#00ff9d] uppercase">Privacy Preserved</h4>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        &gt; Your off-chain credit data is verified via zero-knowledge proofs. 
                        &gt; Raw data never leaves the source.
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={handleRequestLoan}
                    disabled={!amount || isProcessing || !isConnected}
                    className="w-full bg-[#00ff9d] hover:bg-[#00cc7d] text-black font-bold py-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        [ Execute_Request ]
                        <ArrowRightLeft className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* POOL VIEW */}
          {activeTab === 'pool' && (
            <motion.div 
              key="pool"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <div className="terminal-card p-8">
                <h2 className="text-lg font-bold text-[#00ff9d] mb-6 uppercase">Provide_Liquidity</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-black border border-gray-800">
                    <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono uppercase">
                      <span>Asset</span>
                      <span>Balance: 24,500 USDC</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-900 border border-blue-500 flex items-center justify-center text-[10px] font-bold text-blue-400">
                          $
                        </div>
                        <span className="text-lg font-bold text-white">USDC</span>
                      </div>
                      <input 
                        type="text" 
                        placeholder="0.00" 
                        className="bg-transparent text-right text-xl text-white placeholder:text-gray-800 focus:outline-none w-1/2 font-mono"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black border border-gray-800 text-center">
                      <div className="text-xs text-gray-500 uppercase">APY</div>
                      <div className="text-xl font-bold text-[#00ff9d] font-mono">8.4%</div>
                    </div>
                    <div className="p-4 bg-black border border-gray-800 text-center">
                      <div className="text-xs text-gray-500 uppercase">TVL</div>
                      <div className="text-xl font-bold text-white font-mono">$1.25M</div>
                    </div>
                  </div>

                  <button className="w-full border border-[#00ff9d] text-[#00ff9d] hover:bg-[#00ff9d] hover:text-black font-bold py-3 transition-colors uppercase tracking-wider">
                    Deposit Liquidity
                  </button>
                </div>
              </div>

              <div className="terminal-card p-8">
                <h2 className="text-lg font-bold text-[#00ff9d] mb-6 uppercase">Your_Position</h2>
                {isConnected ? (
                  <div className="space-y-6">
                     <div className="flex justify-between items-center py-4 border-b border-gray-800 border-dashed">
                        <span className="text-gray-500 text-sm uppercase">Staked Balance</span>
                        <span className="text-xl font-mono text-white">5,000.00 USDC</span>
                     </div>
                     <div className="flex justify-between items-center py-4 border-b border-gray-800 border-dashed">
                        <span className="text-gray-500 text-sm uppercase">Unclaimed Yield</span>
                        <span className="text-xl font-mono text-[#00ff9d]">+124.50 USDC</span>
                     </div>
                     <button className="w-full bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold py-3 border border-gray-700 transition-colors uppercase text-sm">
                        Claim Rewards
                     </button>
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-gray-600 border border-gray-800 border-dashed">
                    <Wallet className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-mono text-sm">Connect wallet to view position</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ADMIN VIEW */}
          {activeTab === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="terminal-card overflow-hidden"
            >
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/20">
                <h2 className="text-lg font-bold text-[#00ff9d] uppercase">Loan_Requests_DB</h2>
                <div className="flex gap-2 font-mono">
                  <span className="text-[10px] px-2 py-1 bg-gray-900 text-gray-400 border border-gray-700">NODE: ONLINE</span>
                  <span className="text-[10px] px-2 py-1 bg-gray-900 text-gray-400 border border-gray-700">NET: SEPOLIA</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm font-mono">
                  <thead className="bg-black text-gray-500 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 font-bold uppercase text-xs">ID</th>
                      <th className="px-6 py-4 font-bold uppercase text-xs">Borrower</th>
                      <th className="px-6 py-4 font-bold uppercase text-xs">Amount</th>
                      <th className="px-6 py-4 font-bold uppercase text-xs">Score</th>
                      <th className="px-6 py-4 font-bold uppercase text-xs">Status</th>
                      <th className="px-6 py-4 font-bold uppercase text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {loans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-600 italic">&gt; No loan requests found in database.</td>
                      </tr>
                    ) : (
                      loans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-[#00ff9d]/5 transition-colors">
                          <td className="px-6 py-4 text-gray-400">#{loan.id}</td>
                          <td className="px-6 py-4 text-gray-500">{loan.borrower}</td>
                          <td className="px-6 py-4 text-white font-bold">${loan.amount.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            {loan.creditScore ? (
                              <span className={cn(
                                "font-bold",
                                loan.creditScore > 700 ? "text-[#00ff9d]" : "text-yellow-500"
                              )}>
                                {loan.creditScore}
                              </span>
                            ) : (
                              <span className="text-gray-600 animate-pulse">Fetching...</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={loan.status} />
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-gray-500 hover:text-[#00ff9d]">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <OracleVisualizer isProcessing={isProcessing} />
      
      <footer className="max-w-7xl mx-auto px-6 py-8 mt-12 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-gray-600 font-mono uppercase">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#00ff9d] animate-pulse"></div>
          <span>System Operational</span>
          <span className="mx-2">|</span>
          <span>Block: 18,245,912</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-[#00ff9d] cursor-pointer transition-colors">Docs</span>
          <span className="hover:text-[#00ff9d] cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-[#00ff9d] cursor-pointer transition-colors">Terms</span>
          <span className="flex items-center gap-1 ml-4 opacity-50">
            Powered by <span className="font-bold text-gray-400">Chainlink</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

