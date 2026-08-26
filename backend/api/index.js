const serverlessHttp = require('serverless-http');
const { createApp } = require('../dist/src/app');

const app = createApp();

module.exports.default = serverlessHttp(app);
