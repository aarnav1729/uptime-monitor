import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, Clock, Server, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface CheckResult {
  timestamp: string;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
}

interface Summary {
  totalChecks: number;
  successful: number;
  failed: number;
  uptimePercentage: string;
  averageResponseTime: string;
}

function App() {
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalChecks: 0,
    successful: 0,
    failed: 0,
    uptimePercentage: '0',
    averageResponseTime: '0'
  });

  useEffect(() => {
    // Change the URL here to your deployed backend
    const socket = io('https://uptime-monitor-daqr.onrender.com');

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('currentState', (data: { checkResults: CheckResult[], summary: Summary }) => {
      setCheckResults(data.checkResults);
      setSummary(data.summary);
    });

    socket.on('newCheck', (result: CheckResult) => {
      setCheckResults(prev => [result, ...prev].slice(0, 100));
    });

    socket.on('summaryUpdate', (newSummary: Summary) => {
      setSummary(newSummary);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Uptime Monitor</h1>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full">
          <Activity className="w-5 h-5 text-green-400" />
          <span>Live Monitoring</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-medium">Total Checks</h3>
          </div>
          <p className="text-3xl font-bold">{summary.totalChecks}</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-medium">Success Rate</h3>
          </div>
          <p className="text-3xl font-bold">{summary.uptimePercentage}%</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-medium">Response Time</h3>
          </div>
          <p className="text-3xl font-bold">{summary.averageResponseTime} ms</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-medium">Failed Checks</h3>
          </div>
          <p className="text-3xl font-bold">{summary.failed}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold">Recent Checks</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left">Timestamp</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-left">Response Time</th>
                <th className="px-6 py-4 text-left">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {checkResults.map((check, index) => (
                <tr key={index} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    {new Date(check.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                      check.success 
                        ? 'bg-green-400/10 text-green-400' 
                        : 'bg-red-400/10 text-red-400'
                    }`}>
                      {check.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </td>
                  <td className="px-6 py-4">{check.responseTime} ms</td>
                  <td className="px-6 py-4 text-red-400">{check.error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
