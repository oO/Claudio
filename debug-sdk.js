import { query } from '@anthropic-ai/claude-code';

console.log('Testing Claude Code SDK...');

try {
    for await (const message of query({ 
        prompt: 'what is 2+2?',
        options: {
            maxTurns: 1,
            cwd: '/Users/olivier/Projects/claudio'
        }
    })) {
        console.log('Message type:', message.type);
        console.log('Message:', JSON.stringify(message, null, 2));
        console.log('---');
    }
    console.log('SDK test completed successfully!');
} catch (error) {
    console.error('SDK test failed:', error);
}