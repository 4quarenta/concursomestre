const fs = require('fs');
const path = 'c:\\dev\\concursomestre\\pages\\Admin.tsx';

try {
    const data = fs.readFileSync(path, 'utf8');
    // Handle both CRLF and LF
    let lines = data.split(/\r?\n/);

    // Find the start and end indices dynamically to be safe
    const startIndex = lines.findIndex(line => line.includes('// --- CALCULATE FINANCE OVERVIEW ---'));

    // Find end index AFTER start index.
    // The end line contains: }, [allTransactions, allUsers, systemSettings.pricing, showAvailableOnly]);
    const endIndex = lines.findIndex((line, index) => index > startIndex && line.includes('}, [allTransactions, allUsers, systemSettings.pricing, showAvailableOnly]);'));

    if (startIndex === -1 || endIndex === -1) {
        console.error('Could not find start or end line');
        console.log('Start index:', startIndex);
        console.log('End index:', endIndex);
        process.exit(1);
    }

    console.log(`Removing from line ${startIndex + 1} to ${endIndex + 1}`);
    // Verification print
    console.log('START LINE CONTENT:', lines[startIndex]);
    console.log('END LINE CONTENT:', lines[endIndex]);

    // Remove the lines
    lines.splice(startIndex, endIndex - startIndex + 1);

    fs.writeFileSync(path, lines.join('\n'));
    console.log('Successfully removed lines');
} catch (e) {
    console.error(e);
    process.exit(1);
}
