#!/usr/bin/env node

import fetch from 'node-fetch';

async function testClaudeIntegration() {
    console.log('🔍 Testing Claude Code CLI integration...\n');

    try {
        // 1. Test if backend is healthy
        console.log('1. Testing backend health...');
        const healthRes = await fetch('http://localhost:7347/api/health');
        const health = await healthRes.json();
        console.log('✅ Backend health:', health.status);

        // 2. Login to get authentication token
        console.log('2. Getting authentication token...');
        const loginRes = await fetch('http://localhost:7347/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'test',
                password: 'password'
            })
        });

        let authToken = null;
        if (loginRes.ok) {
            const loginData = await loginRes.json();
            authToken = loginData.token;
            console.log('✅ Login successful');
        } else {
            // Try to create account first
            console.log('   Login failed, trying to create account...');
            const signupRes = await fetch('http://localhost:7347/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'test',
                    password: 'password'
                })
            });

            if (signupRes.ok) {
                const signupData = await signupRes.json();
                authToken = signupData.token;
                console.log('✅ Account created and logged in');
            } else {
                const error = await signupRes.text();
                console.log('❌ Authentication failed:', error);
                return false;
            }
        }

        // 3. Test Claude streaming endpoint (establish SSE connection)
        console.log('3. Testing Claude streaming endpoint...');
        const sessionId = `test-${Date.now()}`;
        
        const streamRes = await fetch(`http://localhost:7347/api/claude-stream/stream/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'text/event-stream'
            }
        });

        if (!streamRes.ok) {
            const error = await streamRes.text();
            console.log('❌ Claude streaming endpoint failed:', error);
            return false;
        }

        console.log('✅ Claude streaming endpoint accessible');

        // 4. Test sending a message (this will spawn Claude CLI)
        console.log('4. Testing message sending to Claude...');
        const messageRes = await fetch(`http://localhost:7347/api/claude-stream/message/${sessionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Hello Claude, this is a test message from the validation script.',
                workingDir: process.cwd()
            })
        });

        if (!messageRes.ok) {
            const error = await messageRes.text();
            console.log('❌ Message sending failed:', error);
            return false;
        }

        const messageResult = await messageRes.json();
        console.log('✅ Message sent successfully:', messageResult);

        // 5. Check if Claude CLI is available
        console.log('5. Checking Claude CLI availability...');
        const { spawn } = await import('child_process');
        
        return new Promise((resolve) => {
            const testProcess = spawn('claude', ['--version'], { stdio: 'pipe' });
            
            let output = '';
            testProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });

            testProcess.stderr?.on('data', (data) => {
                output += data.toString();
            });

            testProcess.on('close', (code) => {
                if (code === 0 && output.includes('Claude Code')) {
                    console.log('✅ Claude CLI is working:', output.trim());
                    resolve(true);
                } else {
                    console.log('❌ Claude CLI test failed. Output:', output);
                    resolve(false);
                }
            });

            testProcess.on('error', (error) => {
                console.log('❌ Claude CLI not found:', error.message);
                resolve(false);
            });
        });

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Run the test
testClaudeIntegration()
    .then(success => {
        if (success) {
            console.log('\n🎉 Claude Code CLI integration validation PASSED!');
            console.log('✅ All components are working correctly:');
            console.log('   - Backend API is healthy');
            console.log('   - Authentication is working');
            console.log('   - Claude streaming endpoints are accessible');
            console.log('   - Claude CLI is properly installed');
            process.exit(0);
        } else {
            console.log('\n💥 Claude Code CLI integration validation FAILED!');
            console.log('❌ One or more components are not working correctly.');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n💥 Test script crashed:', error);
        process.exit(1);
    });