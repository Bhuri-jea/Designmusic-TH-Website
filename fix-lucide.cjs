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
    const regex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]lucide-svelte['"];?/g;
    let newContent = content.replace(regex, (match, p1) => {
      const icons = p1.split(',').map(i => i.trim());
      return icons.map(icon => {
        // Convert PascalCase to kebab-case
        const iconName = icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        return `import ${icon} from 'lucide-svelte/icons/${iconName}';`;
      }).join('\n');
    });
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log('Updated ' + filePath);
    }
  }
});
