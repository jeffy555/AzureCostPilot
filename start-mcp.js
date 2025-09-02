// Simple Azure MCP Server starter
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = {
  ...process.env,
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
  AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID
};

console.log('Starting Azure MCP Server...');

const mcpServer = spawn('node', [join(__dirname, 'mcp-server', 'server.js')], {
  env,
  stdio: 'inherit',
  detached: false
});

mcpServer.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
});

mcpServer.on('exit', (code, signal) => {
  console.log(`MCP server exited with code ${code} and signal ${signal}`);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Stopping MCP server...');
  mcpServer.kill();
  process.exit(0);
});