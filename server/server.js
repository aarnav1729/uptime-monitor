// server/server.js
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS (adjust the origin as needed in production)
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3333;
const WEBSITE_URL = 'https://logistics.premierenergiesphotovoltaic.com';
const CHECK_INTERVAL = 60000; // Check every 1 minute

// Array to store check results
let checkResults = [];

/**
 * Compute summary data based on checkResults.
 */
function computeSummary() {
  const totalChecks = checkResults.length;
  const successfulChecks = checkResults.filter(check => check.success);
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
 * Checks the website by performing an HTTP GET request.
 * Stores the result and broadcasts it to all connected clients.
 */
async function checkWebsite() {
  const start = Date.now();
  let result;
  try {
    const response = await axios.get(WEBSITE_URL, { timeout: 10000 }); // 10 seconds timeout
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

  // Save the result and emit to clients
  checkResults.push(result);
  io.emit('newCheck', result);

  // Compute and emit summary data
  const summary = computeSummary();
  io.emit('summaryUpdate', summary);
}

// When a client connects, send the current state immediately.
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('currentState', { checkResults, summary: computeSummary() });
});

// Optionally serve static files (e.g. your built frontend) from the public folder:
app.use(express.static('public'));

// Start the periodic checks and run one immediately.
setInterval(checkWebsite, CHECK_INTERVAL);
checkWebsite();

// Start the server.
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
