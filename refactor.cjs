const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'script.js');
let content = fs.readFileSync(scriptPath, 'utf8');

// Replace everything between const INITIAL_CLIENTS and the end of INITIAL_OPERATIONS
// We can just use a regex since we know the strings
content = content.replace(/const INITIAL_OPERATIONS = \[\s*\{[\s\S]*\}\s*\];/, 'const INITIAL_OPERATIONS = [];');

fs.writeFileSync(scriptPath, content);
