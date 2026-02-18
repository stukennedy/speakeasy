
import { Hono, Env } from 'hono';

import * as api_logs from './routes/api/logs';
import * as api_suggest from './routes/api/suggest';
import * as api_ai from './routes/api/ai';
import * as ws from './routes/ws';
import * as index from './routes';

export const loadRoutes = <T extends Env>(app: Hono<T>) => {
	app.get('/api/logs', api_logs.onRequestGet);
	app.get('/api/suggest', api_suggest.onRequestGet);
	app.post('/api/ai', api_ai.onRequestPost);
	app.get('/ws', ws.onRequestGet);
	app.get('/', index.onRequestGet);
};
