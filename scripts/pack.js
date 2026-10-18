const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { root, dist, listFiles, requiredRel, stageDist, assertStaged } = require('./stage-dist');

function pack() {
    stageDist();
    assertStaged();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!/^[a-z0-9_-]+$/i.test(pkg.name)) throw new Error('Nombre de paquete inválido para el ZIP');
    const zip = path.join(root, `${pkg.name}.zip`);
    const temporary = path.join(root, `${pkg.name}.${crypto.randomUUID()}.tmp.zip`);
    try {
        if (process.platform === 'win32') {
            // Paths are environment data, never interpolated into PowerShell code.
            execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
                "$ErrorActionPreference = 'Stop'; Compress-Archive -Path (Join-Path $env:URANO_PACK_DIST '*') -DestinationPath $env:URANO_PACK_ZIP -Force"],
            { stdio: 'inherit', windowsHide: true, env: { ...process.env, URANO_PACK_DIST: dist, URANO_PACK_ZIP: temporary } });
        } else {
            execFileSync('zip', ['-q', '-r', temporary, ...listFiles(dist)], { cwd: dist, stdio: 'inherit' });
        }
        if (!fs.statSync(temporary).size) throw new Error('ZIP vacío');
        fs.renameSync(temporary, zip);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    console.log(`[pack] ${zip} (${Math.round(fs.statSync(zip).size / 1024)} KB)`);
    for (const file of requiredRel()) console.log(`  ✓ ${file}`);
    console.log('Instala el ZIP desde Integraciones > Instalar MCP (.zip).');
}
try { pack(); } catch (error) { console.error('[pack] ' + error.message); process.exitCode = 1; }
