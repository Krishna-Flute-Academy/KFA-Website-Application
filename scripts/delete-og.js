const fs = require('fs');
const path = require('path');

try {
    const layoutFile = path.join(__dirname, 'app', 'blog', '[slug]', 'layout.tsx');
    const ogFile = path.join(__dirname, 'app', 'blog', '[slug]', 'opengraph-image.tsx');

    if (fs.existsSync(layoutFile)) {
        fs.unlinkSync(layoutFile);
        console.log('Deleted layout.tsx');
    }

    if (fs.existsSync(ogFile)) {
        fs.unlinkSync(ogFile);
        console.log('Deleted opengraph-image.tsx');
    }
} catch (e) {
    console.error(e);
}
