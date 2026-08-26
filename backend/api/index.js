const serverlessHttp = require('serverless-http');
const path = require('path');

// Load the compiled app
const { createApp } = require(path.join(__dirname, '../dist/src/app.js'));

const app = createApp();
const handler = serverlessHttp(app);

// Export as both default and named export for compatibility
module.exports = handler;
module.exports.default = handler;
