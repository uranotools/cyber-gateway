const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { root, dist, entries, assertDist, stageDist } = require('./stage-dist');

async function build() {
    const sources = entries();
    if (!sources.includes('Plugins/Channel/ChannelPlugin.ts') || !sources.includes('Plugins/Engine/CyberGatewayEnginePlugin.ts')) throw new Error('Faltan las entradas Channel/Engine');
    assertDist(); // Only remove the verified, generated dist folder belonging to this plugin.
    fs.rmSync(dist, { recursive: true, force: true });
    await esbuild.build({
        absWorkingDir: root, entryPoints: sources, outbase: root, outdir: dist,
        bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'info',
        external: ['@core', '@core/*', '@models', '@models/*', '@modules', '@modules/*', 'electron'],
    });
    stageDist();
    console.log(`[deploy] ${path.basename(root)}: bundles CommonJS y memorias preparados`);
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
