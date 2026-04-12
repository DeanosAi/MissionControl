#!/usr/bin/env node

/**
 * Mission Control Chat OAuth Proxy
 * 
 * This server runs on your local Windows machine and provides chat completions
 * using OpenClaw's OAuth (no API credits used).
 * 
 * The VPS calls this endpoint when generating chat responses.
 * 
 * Usage:
 *   node chat-oauth-proxy.js [port]
 * 
 * Default port: 3001
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const PORT = process.argv[2] || 3001;

async function generateViaOAuth(messages, model = 'gpt-4o') {
  // Extract the user's message
  const userMessages = messages.filter(m => m.role === 'user');
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || '';

  if (!lastUserMsg) {
    throw new Error('No user message found');
  }

  // Build a prompt that includes context
  let prompt = lastUserMsg;
  
  // If there's a system message, prepend it
  if (systemMessage) {
    prompt = `${systemMessage}\n\n${prompt}`;
  }

  // Escape for shell
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  
  console.log(`[${new Date().toISOString()}] Generating with model: ${model}`);
  console.log(`[${new Date().toISOString()}] Prompt length: ${prompt.length} chars`);

  try {
    const { stdout, stderr } = await execAsync(
      `acpx --format text --timeout 120 codex exec "${escapedPrompt}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB
        env: {
          ...process.env,
        }
      }
    );

    if (stderr && !stderr.includes('Executing')) {
      console.error('[OAuth Proxy] stderr:', stderr);
    }

    const response = stdout.trim();
    
    if (!response) {
      throw new Error('Empty response from acpx');
    }

    console.log(`[${new Date().toISOString()}] Response generated: ${response.length} chars`);
    
    return response;
  } catch (error) {
    console.error('[OAuth Proxy] Error:', error.message);
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      provider: 'openclaw-oauth',
      timestamp: new Date().toISOString() 
    }));
    return;
  }

  // Chat completion endpoint
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { messages, model } = JSON.parse(body);
        
        if (!messages || !Array.isArray(messages)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'messages array required' }));
          return;
        }

        const content = await generateViaOAuth(messages, model);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content }));
        
      } catch (error) {
        console.error('[OAuth Proxy] Request error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: error.message || 'Failed to generate response'
        }));
      }
    });
    
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✓ Mission Control Chat OAuth Proxy`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  Chat endpoint: http://localhost:${PORT}/chat`);
  console.log(`\n  Configure your VPS .env with:`);
  console.log(`  OPENAI_OAUTH_ENDPOINT=http://YOUR_LOCAL_IP:${PORT}/chat\n`);
});
