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
  console.log(`[${new Date().toISOString()}] Generating with model: ${model}`);
  console.log(`[${new Date().toISOString()}] Message count: ${messages.length}`);

  // Simply pass through to OpenAI using subprocess that handles OAuth
  // Format: echo prompt | openclaw chat --model openai-codex
  
  // Build conversation context
  let conversationText = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      conversationText += `System: ${msg.content}\n\n`;
    } else if (msg.role === 'user') {
      conversationText += `User: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      conversationText += `Assistant: ${msg.content}\n\n`;
    }
  }
  
  conversationText += 'Assistant:';

  // Create temp file with conversation
  const fs = require('fs');
  const path = require('path');
  const tmpFile = path.join(require('os').tmpdir(), `chat-${Date.now()}.txt`);
  
  fs.writeFileSync(tmpFile, conversationText, 'utf8');
  
  try {
    // Use simple one-shot prompt via stdin
    const { stdout, stderr } = await execAsync(
      `type "${tmpFile}" | openclaw chat --model openai-codex`,
      {
        maxBuffer: 1024 * 1024 * 10,
        timeout: 120000,
        shell: 'cmd.exe',
        env: {
          ...process.env,
        }
      }
    );

    // Clean up temp file
    fs.unlinkSync(tmpFile);

    if (stderr && !stderr.includes('Executing')) {
      console.error('[OAuth Proxy] stderr:', stderr);
    }

    let response = stdout.trim();
    
    if (!response) {
      throw new Error('Empty response from OpenClaw');
    }

    console.log(`[${new Date().toISOString()}] Raw response: ${response.substring(0, 200)}...`);
    
    // If response contains ACP protocol markers, it means we're getting session output
    // Just return an error message for now
    if (response.includes('[client]') || response.includes('[done]')) {
      throw new Error('OpenClaw returned ACP session output instead of chat completion. This OAuth method may not be compatible with Codex model. Try using Kimi K2.5 or Claude models instead.');
    }

    console.log(`[${new Date().toISOString()}] Response generated: ${response.length} chars`);
    
    return response;
  } catch (error) {
    console.error('[OAuth Proxy] Error:', error.message);
    // Clean up temp file on error
    try { fs.unlinkSync(tmpFile); } catch {}
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
