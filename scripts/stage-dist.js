const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function listFiles(dir, base = dir) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`No se empaquetan enlaces simbólicos: ${full}`);
        if (entry.isDirectory()) files.push(...listFiles(full, base));
        else if (entry.isFile()) files.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return files.sort();
}

function assertDist() {
    if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') throw new Error('Ruta dist inválida');
    if (fs.existsSync(dist) && (!fs.lstatSync(dist).isDirectory() || fs.lstatSync(dist).isSymbolicLink())) throw new Error('dist debe ser una carpeta local, no un enlace');
}

function entries() {
    return ['config.ts', ...listFiles(path.join(root, 'Plugins')).filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts')).map(file => `Plugins/${file}`)];
}

function requiredRel() {
    return [...entries().map(file => file.replace(/\.ts$/, '.js')), 'SKILL.md', 'README.md', 'LICENSE', 'package.json',
        ...listFiles(path.join(root, 'knowledge')).map(file => `knowledge/${file}`)].sort();
}

function stageDist() {
    assertDist();
    for (const file of entries().map(file => file.replace(/\.ts$/, '.js'))) {
        if (!fs.existsSync(path.join(dist, file))) throw new Error(`Falta dist/${file}. Ejecuta npm run deploy.`);
    }
    for (const file of ['SKILL.md', 'README.md', 'LICENSE']) {
        if (!fs.existsSync(path.join(root, file))) throw new Error(`Falta ${file}`);
        fs.copyFileSync(path.join(root, file), path.join(dist, file));
    }
    const knowledge = listFiles(path.join(root, 'knowledge'));
    if (!knowledge.length) throw new Error('knowledge/ está vacío o no existe. El ZIP debe incluir sus memorias.');
    const destination = path.join(dist, 'knowledge');
    if (fs.existsSync(destination)) {
        if (fs.lstatSync(destination).isSymbolicLink()) throw new Error('dist/knowledge no puede ser un enlace');
        fs.rmSync(destination, { recursive: true, force: true });
    }
    for (const file of knowledge) {
        const target = path.join(destination, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, 'knowledge', file), target);
    }
    // The ZIP contains dist's contents at its root, so dist/config.js is not a valid installed entry.
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const { scripts, devDependencies, ...manifest } = pkg;
    manifest.main = 'config.js';
    fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    assertStaged();
}

function assertStaged() {
    assertDist();
    const missing = requiredRel().filter(file => !fs.existsSync(path.join(dist, file)));
    if (missing.length) throw new Error('Paquete incompleto: ' + missing.join(', '));
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'package.json'), 'utf8'));
    const config = require(path.join(dist, 'config.js'));
    if (config.CyberGatewayConfig?.name !== manifest.name || manifest.main !== 'config.js') throw new Error('Nombre o entrada del manifiesto inválidos');
    if (config.CyberGatewayConfig?.knowledge?.enabled === false) throw new Error('El manifiesto deshabilita knowledge');
}

if (require.main === module) { stageDist(); console.log('[stage] dist listo: bundles, documentación, LICENSE y knowledge/'); }
module.exports = { root, dist, listFiles, entries, requiredRel, assertDist, stageDist, assertStaged };
