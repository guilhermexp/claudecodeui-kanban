import express from 'express';
import { spawn } from 'child_process';
import { authenticateToken } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = createLogger('CLAUDE-STREAM');
const router = express.Router();

// Store active Claude sessions
const activeSessions = new Map();

// Detect Claude CLI installation path
async function detectClaudePath() {
    try {
        // First, get absolute path to node
        let nodePath = 'node';
        try {
            const { stdout: nodeWhich } = await execAsync('which node');
            if (nodeWhich.trim()) {
                nodePath = nodeWhich.trim();
            }
        } catch {
            // Try common paths if which fails
            if (fs.existsSync('/opt/homebrew/bin/node')) {
                nodePath = '/opt/homebrew/bin/node';
            } else if (fs.existsSync('/usr/local/bin/node')) {
                nodePath = '/usr/local/bin/node';
            } else if (fs.existsSync('/usr/bin/node')) {
                nodePath = '/usr/bin/node';
            }
        }

        // Try common installation methods
        const { stdout: npmPath } = await execAsync('npm root -g');
        const npmClaudePath = path.join(npmPath.trim(), '@anthropic-ai/claude-code/cli.js');
        if (fs.existsSync(npmClaudePath)) {
            return { command: nodePath, script: npmClaudePath };
        }

        // Try which command
        const { stdout: whichPath } = await execAsync('which claude');
        if (whichPath.trim()) {
            return { command: whichPath.trim(), script: null };
        }

        // Try npx
        return { command: 'npx', script: '-y @anthropic-ai/claude-code@latest' };
    } catch (error) {
        log.error(`Failed to detect Claude CLI path: ${error.message}`);
        // Fallback to npx
        return { command: 'npx', script: '-y @anthropic-ai/claude-code@latest' };
    }
}

// SSE endpoint for streaming Claude responses
router.get('/stream/:sessionId', authenticateToken, async (req, res) => {
    const { sessionId } = req.params;
    const { workingDir = process.cwd() } = req.query;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // Send initial connection event
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ sessionId, status: 'connected' })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
        const session = activeSessions.get(sessionId);
        if (session) {
            session.abortController.abort();
            if (session.process) {
                session.process.kill('SIGTERM');
            }
            activeSessions.delete(sessionId);
        }
    });

    activeSessions.set(sessionId, {
        res,
        abortController: new AbortController(),
        batchId: 0,
        cursor: 0,
        conversation: { entries: [] }
    });

    res.write('event: ready\n');
    res.write(`data: ${JSON.stringify({ sessionId, status: 'ready' })}\n\n`);
});

// Endpoint to send messages to Claude
router.post('/message/:sessionId', authenticateToken, async (req, res) => {
    const { sessionId } = req.params;
    const { message, workingDir = process.cwd(), images = [], model = null } = req.body;

    let session = activeSessions.get(sessionId);
    
    // If no session exists, check if it's a temporary ID and there's an SSE connection waiting
    if (!session) {
        // Try to find a session that's waiting for messages
        for (const [key, value] of activeSessions.entries()) {
            if (value.res && !value.process) {
                session = value;
                // Update the session key to the new sessionId
                activeSessions.delete(key);
                activeSessions.set(sessionId, session);
                break;
            }
        }
    }
    
    if (!session || !session.res) {
        return res.status(404).json({ error: 'Session not found. Please establish SSE connection first.' });
    }

    try {
        // Detect Claude CLI path
        const { command, script } = await detectClaudePath();

        // Build Claude command arguments
        const args = [];
        if (script) {
            args.push(...script.split(' '));
        }
        args.push(
            '-p',
            '--dangerously-skip-permissions',
            '--verbose',
            '--output-format=stream-json'
        );

        // Add model if specified
        if (model) {
            args.push('--model', model);
        }

        // Add images if provided
        images.forEach(img => {
            args.push('-i', img);
        });

        // Spawn Claude process using the direct CLI with proper execution
        
        // Use full path to npx to avoid PATH issues
        let spawnCommand = '/opt/homebrew/bin/npx';
        let spawnArgs = [
            '-y',
            '@anthropic-ai/claude-code@latest',
            '-p',
            '--dangerously-skip-permissions', 
            '--verbose',
            '--output-format=stream-json'
        ];
        
        // Add model if specified
        if (model) {
            spawnArgs.push('--model', model);
        }
        
        // Add images if provided
        images.forEach(img => {
            spawnArgs.push('-i', img);
        });
        
        
        // Use spawn with proper configuration
        const claudeProcess = spawn(spawnCommand, spawnArgs, {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_NO_WARNINGS: '1',
                PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`,
                // Add npm/node paths explicitly
                NODE_PATH: '/usr/local/lib/node_modules:/opt/homebrew/lib/node_modules'
            },
            shell: false  // Don't use shell
        });

        session.process = claudeProcess;
        let buffer = '';
        let conversationStarted = false;
        let capturedSessionId = null;

        // Handle stdout (streaming JSON responses)
        claudeProcess.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                try {
                    const json = JSON.parse(trimmed);
                    
                    // Track session ID from Claude (REAL session ID)
                    if (json.session_id && !capturedSessionId) {
                        capturedSessionId = json.session_id;
                        session.claudeSessionId = json.session_id;
                        
                        // Update the session mapping with the REAL session ID
                        if (sessionId !== capturedSessionId) {
                            // Move the session to the real ID
                            activeSessions.delete(sessionId);
                            activeSessions.set(capturedSessionId, session);
                        }
                        
                        // Send the real session ID to frontend
                        session.res.write('event: session\n');
                        session.res.write(`data: ${JSON.stringify({ 
                            tempSessionId: sessionId,
                            realSessionId: json.session_id 
                        })}\n\n`);
                    }

                    // Convert Claude events to normalized format
                    const entry = normalizeClaudeEvent(json);
                    if (entry) {
                        // Send as patch for incremental updates
                        const patches = createPatchForEntry(session.conversation, entry);
                        if (patches.length > 0) {
                            session.batchId++;
                            session.res.write('event: patch\n');
                            session.res.write(`data: ${JSON.stringify({
                                batch_id: session.batchId,
                                patches,
                                cursor: session.cursor++
                            })}\n\n`);
                            
                            // Apply patch to local conversation state
                            session.conversation.entries.push(entry);
                        }
                    }

                    // Send raw event for debugging
                    session.res.write('event: raw\n');
                    session.res.write(`data: ${JSON.stringify(json)}\n\n`);

                } catch (err) {
                    // Not JSON, might be raw output
                    if (trimmed) {
                        session.res.write('event: output\n');
                        session.res.write(`data: ${JSON.stringify({ text: trimmed })}\n\n`);
                    }
                }
            });
        });

        // Handle stderr
        claudeProcess.stderr.on('data', (data) => {
            const error = data.toString();
            log.warn(`stderr: ${error}`);
            session.res.write('event: error\n');
            session.res.write(`data: ${JSON.stringify({ error })}\n\n`);
        });

        // Handle process exit
        claudeProcess.on('exit', (code, signal) => {
            log.info(`process exited code=${code} signal=${signal}`);
            session.res.write('event: complete\n');
            session.res.write(`data: ${JSON.stringify({ 
                sessionId, 
                exitCode: code,
                signal 
            })}\n\n`);
            
            // Clean up session
            activeSessions.delete(sessionId);
        });

        // Send the message to Claude
        claudeProcess.stdin.write(message + '\n');
        claudeProcess.stdin.end();

        res.json({ success: true, sessionId });

    } catch (error) {
        log.error(`Error: ${error.message}`);
        session.res.write('event: error\n');
        session.res.write(`data: ${JSON.stringify({ 
            error: error.message 
        })}\n\n`);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to normalize Claude events
function normalizeClaudeEvent(event) {
    // Claude CLI sends events with 'type' field, not 'event_type'
    const { type, subtype, message, text, tool_name, tool_use_id, error } = event;

    // Handle different Claude event types
    switch (type) {
        case 'system':
            if (subtype === 'init') {
                return {
                    type: 'session_start',
                    content: 'Claude session started',
                    timestamp: new Date().toISOString()
                };
            }
            break;

        case 'assistant':
            // Claude sends assistant messages with a message object
            if (message && message.text) {
                return {
                    type: 'assistant_message',
                    content: message.text,
                    timestamp: new Date().toISOString()
                };
            } else if (message && message.content) {
                // Sometimes content is in message.content
                return {
                    type: 'assistant_message',
                    content: message.content,
                    timestamp: new Date().toISOString()
                };
            }
            break;

        case 'tool_use':
            return {
                type: 'tool_use',
                content: `Using tool: ${tool_name}`,
                tool_name,
                tool_use_id,
                timestamp: new Date().toISOString()
            };

        case 'tool_result':
            return {
                type: 'tool_result',
                content: text || 'Tool executed',
                timestamp: new Date().toISOString()
            };

        case 'error':
            return {
                type: 'error',
                content: error || 'An error occurred',
                timestamp: new Date().toISOString()
            };

        case 'result':
            if (subtype === 'success') {
                return {
                    type: 'session_end',
                    content: 'Response complete',
                    timestamp: new Date().toISOString()
                };
            }
            break;

        // Handle streaming text
        case 'text':
            if (text) {
                return {
                    type: 'assistant_message',
                    content: text,
                    timestamp: new Date().toISOString()
                };
            }
            break;
    }

    return null;
}

// Helper function to create JSON patches for conversation updates
function createPatchForEntry(conversation, entry) {
    const patches = [];
    const newIndex = conversation.entries.length;

    patches.push({
        op: 'add',
        path: `/entries/${newIndex}`,
        value: entry
    });

    return patches;
}

// Endpoint to abort a session
router.delete('/session/:sessionId', authenticateToken, (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (session) {
        if (session.process) {
            session.process.kill('SIGTERM');
        }
        session.abortController.abort();
        activeSessions.delete(sessionId);
        res.json({ success: true, message: 'Session aborted' });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

export default router;
