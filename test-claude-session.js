import { query } from '@anthropic-ai/claude-code';

const testOptions = {
    maxTurns: 2,
    cwd: '/Users/olivier/Projects/claudio'
};

console.log('Starting Claude Code SDK test...');

try {
    for await (const message of query({ 
        prompt: 'Hello, what is your name? This is a test of session creation.',
        options: testOptions
    })) {
        console.log('Message type:', message.type);
        if (message.type === 'system') {
            console.log('Session ID:', message.session_id);
            console.log('Working directory:', message.cwd);
        } else if (message.type === 'result') {
            console.log('Session ID:', message.session_id);
            console.log('Result:', message.result);
        }
    }
} catch (error) {
    console.error('Error:', error.message);
}

console.log('Test completed');