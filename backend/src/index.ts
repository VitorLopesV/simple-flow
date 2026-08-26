import serverlessHttp from 'serverless-http';
import { createApp } from './app';

const app = createApp();
export default serverlessHttp(app);
