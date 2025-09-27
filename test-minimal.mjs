// Test if ES modules work
console.log('Starting test...');

try {
    console.log('About to import Claude Code SDK...');
    const { query } = await import('@anthropic-ai/claude-code');
    console.log('Import successful!');
    
    console.log('Testing query...');
    for await (const message of query({ 
        prompt: 'what is 2+2?', 
        options: { maxTurns: 1, cwd: '/Users/olivier/Projects/claudio' } 
    })) {
        console.log('Message:', message);
    }
    console.log('Test complete!');
} catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
}