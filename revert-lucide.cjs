const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.svelte') || filePath.endsWith('.astro')) {
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]lucide-svelte\/icons\/[^'"]+['"];?/g;
    
    let icons = [];
    let newContent = content.replace(regex, (match, p1) => {
      icons.push(p1);
      return ''; // remove it
    });

    if (icons.length > 0) {
      let importStmt = `import { ${[...new Set(icons)].join(', ')} } from 'lucide-svelte';\n`;
      
      // Clean up multiple empty lines that might have been left
      newContent = newContent.replace(/\n\n+/g, '\n\n');
      
      if (newContent.includes('---')) {
        newContent = newContent.replace('---\n', '---\n' + importStmt);
      } else if (newContent.includes('<script')) {
        newContent = newContent.replace(/(<script[^>]*>)\n/, '$1\n  ' + importStmt);
      } else {
         newContent = importStmt + newContent;
      }
      fs.writeFileSync(filePath, newContent);
      console.log('Reverted ' + filePath);
    }
  }
});
