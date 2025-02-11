// server/server.js
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // In production, restrict this to your frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3333;
const WEBSITE_URL = 'https://logistics.premierenergiesphotovoltaic.com';
const CHECK_INTERVAL = 60000; // 1 minute

// For daily grouping:
let currentDayKey = new Date().toDateString();
let currentDayData = {
  date: new Date().toISOString(), // start time of current day
  logs: [],                        // array of CheckResult objects for current day
  summary: {
    totalChecks: 0,
    successful: 0,
    failed: 0,
    uptimePercentage: 'N/A',
    averageResponseTime: 'N/A'
  }
};
let pastDays = []; // Array of finished day objects; most recent first

/**
 * Compute a summary for a given array of check results.
 */
function computeSummaryForResults(results) {
  const totalChecks = results.length;
  const successfulChecks = results.filter(check => check.success);
  const failedChecks = totalChecks - successfulChecks.length;
  const uptimePercentage = totalChecks
    ? ((successfulChecks.length / totalChecks) * 100).toFixed(2)
    : 'N/A';
  const averageResponseTime = successfulChecks.length > 0
    ? (successfulChecks.reduce((sum, check) => sum + check.responseTime, 0) / successfulChecks.length).toFixed(2)
    : 'N/A';
  return { totalChecks, successful: successfulChecks.length, failed: failedChecks, uptimePercentage, averageResponseTime };
}

/**
 * Check the website, record the result, and broadcast updates.
 * Also, if the day has changed (by comparing toDateString()), archive the previous day.
 */
async function checkWebsite() {
  const start = Date.now();
  let result;
  try {
    const response = await axios.get(WEBSITE_URL, { timeout: 10000 });
    const duration = Date.now() - start;
    result = {
      timestamp: new Date(),
      status: response.status,
      responseTime: duration,
      success: true
    };
    console.log(`[${result.timestamp.toISOString()}] SUCCESS: ${response.status} in ${duration} ms`);
  } catch (error) {
    const duration = Date.now() - start;
    result = {
      timestamp: new Date(),
      status: error.response ? error.response.status : null,
      responseTime: duration,
      success: false,
      error: error.message
    };
    console.error(`[${result.timestamp.toISOString()}] ERROR: ${error.message} in ${duration} ms`);
  }
  
  // Check if the day has changed:
  const now = new Date();
  if (now.toDateString() !== currentDayKey) {
    // Archive the finished day
    pastDays.unshift(currentDayData);
    // Reset for new day:
    currentDayKey = now.toDateString();
    currentDayData = {
      date: now.toISOString(),
      logs: [],
      summary: {
        totalChecks: 0,
        successful: 0,
        failed: 0,
        uptimePercentage: 'N/A',
        averageResponseTime: 'N/A'
      }
    };
    io.emit('dailySummaryUpdate', [currentDayData, ...pastDays]);
  }
  
  // Save the result in the current day's logs and update its summary:
  currentDayData.logs.push(result);
  currentDayData.summary = computeSummaryForResults(currentDayData.logs);
  
  // Emit events for live updates:
  io.emit('newCheck', result);
  io.emit('summaryUpdate', currentDayData.summary);
  io.emit('dailySummaryUpdate', [currentDayData, ...pastDays]);
}

// When a new client connects, send the current state.
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('currentState', {
    checkResults: currentDayData.logs,
    summary: currentDayData.summary,
    daySummaries: [currentDayData, ...pastDays]
  });
});

// Optionally serve static files from the "public" folder (if serving your built frontend)
app.use(express.static('public'));

// Start periodic website checks:
setInterval(checkWebsite, CHECK_INTERVAL);
checkWebsite();

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
