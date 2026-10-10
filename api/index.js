import 'dotenv/config';
import app from '../src/app.js';

export const maxDuration = 10;
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
