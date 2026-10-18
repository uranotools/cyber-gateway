import { EnginePluginBase, EnginePreProcessResult } from '@core/EnginePluginBase';
import type { SessionContext } from '@core/runtime/SessionContext';

// ── Patrones de Ataque y Jailbreak Comunes ───────────────────────────
const PROMPT_INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /desatiende\s+(todas\s+las\s+)?instrucciones\s+(previas|anteriores)/i,
    /you\s+are\s+now\s+(DAN|unfiltered|jailbroken|root|developer\s+mode)/i,
    /ahora\s+eres\s+(un\s+modelo\s+sin\s+restricciones|modo\s+desarrollador|root)/i,
    /system\s*prompt\s*override/i,
    /reveal\s+(your\s+)?(system\s+instructions|internal\s+prompt|credentials)/i,
    /revela\s+(tus\s+)?(instrucciones\s+del\s+sistema|prompt\s+interno|contraseñas)/i,
    /\b(base64|rot13|hex)\s+decode\s+this\s+command\b/i,
    /exec\s*\(\s*["'`].*["'`]\s*\)/i,
    /<script[\s\S]*?>[\s\S]*?<\/script>/i,
    /union\s+select\s+.*\s+from/i,
    /;\s*(DROP|DELETE|ALTER)\s+TABLE/i,
    /\b(sudo|chmod\s+777|rm\s+-rf|\/etc\/shadow|\/etc\/passwd)\b/i
];

const MALICIOUS_URL_PATTERNS = [
    /https?:\/\/[^\s/$.?#].[^\s]*\.(xyz|top|work|click|loan|gq|cf|tk|buzz|rest|fit|link)\b/i,
    /https?:\/\/(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?/i, // Raw IPs in URLs
    /(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|ow\.ly|buff\.ly)\/[a-zA-Z0-9_-]+/i,
    /https?:\/\/.*(login|verify|secure|update|banco|portal|auth).*\.(?!com|org|net|edu|io)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i // Typosquatting
];

export class CyberGatewayEnginePlugin extends EnginePluginBase {

    // ── Hook: onSessionStart ──────────────────────────────────────────
    async onSessionStart(ctx: SessionContext): Promise<void> {
        const securityMode = ctx.getSecretWithOverride('SECURITY_MODE') || 'block_threats';
        
        // Registrar badge visual de estado en el chat de Urano
        ctx.addBadge({
            id: 'cyber-gateway-badge',
            label: `🛡️ CyberGateway: ${this.formatModeLabel(securityMode)}`,
            color: securityMode === 'block_threats' || securityMode === 'strict_zero_trust' ? 'success' : 'warning',
            icon: 'ShieldCheck'
        });

        // Inicializar contadores de sesión en memoria persistente
        const currentStats = await ctx.store.getSession('stats') || {
            analyzed: 0,
            threatsBlocked: 0,
            threatsDetected: 0,
            startTime: Date.now()
        };
        await ctx.store.setSession('stats', currentStats);
    }

    // ── Hook: preMessageProcess (Inspección en Caliente) ──────────────
    async preMessageProcess(ctx: SessionContext, message: any): Promise<EnginePreProcessResult> {
        const content = typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content || '');
        const sender = message?.from || message?.author || ctx.userId || 'unknown_sender';

        // 1. Obtener configuraciones de seguridad
        const securityMode = ctx.getSecretWithOverride('SECURITY_MODE') || 'block_threats';
        const detectInjection = ctx.getSecretWithOverride('DETECT_PROMPT_INJECTION') !== 'false';
        const detectUrls = ctx.getSecretWithOverride('DETECT_MALICIOUS_URLS') !== 'false';
        const detectBots = ctx.getSecretWithOverride('DETECT_AI_BOT_PATTERNS') !== 'false';
        const blockedListRaw = ctx.getSecretWithOverride('BLOCKED_IDENTIFIERS') || '';
        const alertWebhook = ctx.getSecretWithOverride('ALERT_WEBHOOK_URL');

        // Actualizar métrica de mensajes analizados
        await this.incrementStat(ctx, 'analyzed');

        // 2. Verificar Lista Negra (Blacklist)
        const blockedList = blockedListRaw.split('\n').map(s => s.trim()).filter(Boolean);
        if (blockedList.some(id => sender.includes(id) || content.includes(id))) {
            await this.logThreat(ctx, {
                type: 'BLACKLISTED_SENDER',
                severity: 'HIGH',
                sender,
                summary: `Remitente ${sender} coincide con identificador en lista negra.`,
                contentSnippet: content.slice(0, 120)
            });
            await this.notifySoc(alertWebhook, 'BLACKLISTED_SENDER', sender, 'Remitente bloqueado en lista negra');
            await this.incrementStat(ctx, 'threatsBlocked');

            return {
                status: 'intercepted',
                overrideResponse: '🚫 [ACCESO DENEGADO]: Tu identificador ha sido bloqueado por las directivas de seguridad activas.'
            };
        }

        // 3. Inspección de Inyección de Prompt / Jailbreak
        if (detectInjection) {
            for (const pattern of PROMPT_INJECTION_PATTERNS) {
                if (pattern.test(content)) {
                    await this.logThreat(ctx, {
                        type: 'PROMPT_INJECTION_ATTACK',
                        severity: 'CRITICAL',
                        sender,
                        matchedPattern: pattern.toString(),
                        summary: 'Intento de manipulación de instrucciones (Prompt Injection / Jailbreak) detectado.',
                        contentSnippet: content.slice(0, 160)
                    });
                    await this.notifySoc(alertWebhook, 'PROMPT_INJECTION_ATTACK', sender, `Patrón detectado: ${pattern}`);
                    
                    if (securityMode === 'block_threats' || securityMode === 'strict_zero_trust') {
                        await this.incrementStat(ctx, 'threatsBlocked');
                        return {
                            status: 'intercepted',
                            overrideResponse: '🛡️ [ALERTA DE SEGURIDAD]: Se detectó un intento de inyección de código o manipulación de prompt. La petición fue neutralizada.'
                        };
                    } else if (securityMode === 'monitor_only') {
                        await this.incrementStat(ctx, 'threatsDetected');
                        return {
                            status: 'continue',
                            modifiedMessage: {
                                ...message,
                                content: `[⚠️ ALERTA DE SEGURIDAD: INTENTO DE INYECCIÓN DE PROMPT DETECTADO - PROCEDER CON CAUTELA]\n\n${content}`
                            }
                        };
                    }
                }
            }
        }

        // 4. Inspección de Enlaces Maliciosos / Phishing
        if (detectUrls) {
            for (const urlPattern of MALICIOUS_URL_PATTERNS) {
                if (urlPattern.test(content)) {
                    await this.logThreat(ctx, {
                        type: 'PHISHING_OR_MALICIOUS_LINK',
                        severity: 'HIGH',
                        sender,
                        matchedPattern: urlPattern.toString(),
                        summary: 'Enlace sospechoso, acortador o dominio de alto riesgo detectado en el mensaje.',
                        contentSnippet: content.slice(0, 160)
                    });
                    await this.notifySoc(alertWebhook, 'PHISHING_OR_MALICIOUS_LINK', sender, 'Enlace malicioso detectado');

                    if (securityMode === 'block_threats' || securityMode === 'strict_zero_trust') {
                        await this.incrementStat(ctx, 'threatsBlocked');
                        return {
                            status: 'intercepted',
                            overrideResponse: '🚫 [ENLACE BLOQUEADO]: El mensaje contiene URLs o enlaces no autorizados que infringen las políticas de seguridad.'
                        };
                    }
                }
            }
        }

        // 5. Detección de Bots / Fuzzing de Alta Velocidad (Heurística)
        if (detectBots) {
            const isHighEntropy = content.length > 500 && !content.includes(' ');
            const hasRepetitivePatterns = /(.)\1{30,}/.test(content);

            if (isHighEntropy || hasRepetitivePatterns) {
                await this.logThreat(ctx, {
                    type: 'AUTOMATED_BOT_FUZZING',
                    severity: 'MEDIUM',
                    sender,
                    summary: 'Carga de datos anómala con patrones de bot / fuzzing automatizado.',
                    contentSnippet: content.slice(0, 100)
                });

                if (securityMode === 'strict_zero_trust') {
                    await this.incrementStat(ctx, 'threatsBlocked');
                    return {
                        status: 'intercepted',
                        overrideResponse: '⚠️ [PETICIÓN ANÓMALA]: Estructura de paquete no permitida por los filtros Zero Trust.'
                    };
                }
            }
        }

        return { status: 'continue' };
    }

    // ── Hook: onLlmInput (Sanitización antes del Modelo) ──────────────
    async onLlmInput(ctx: SessionContext, llmPayload: any): Promise<void> {
        if (Array.isArray(llmPayload?.messages)) {
            llmPayload.messages = llmPayload.messages.map((m: any) => {
                if (typeof m.content === 'string') {
                    let sanitized = m.content.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[TARJETA_PROTEGIDA]');
                    sanitized = sanitized.replace(/(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36})/g, '[API_KEY_REDACTED]');
                    return { ...m, content: sanitized };
                }
                return m;
            });
        }
    }

    // ── Hook: onLlmOutput (Filtro de Salida / Prevención de Fugas) ────
    async onLlmOutput(ctx: SessionContext, rawOutput: any): Promise<any> {
        if (rawOutput?.choices?.[0]?.message?.content) {
            let content = rawOutput.choices[0].message.content;
            
            if (content.includes('FORWARD_AUTH_TOKEN') || content.includes('INCOMING_WEBHOOK_SECRET')) {
                content = content.replace(/FORWARD_AUTH_TOKEN[:=]\s*\S+/gi, 'FORWARD_AUTH_TOKEN: [PROTECTED]');
                content = content.replace(/INCOMING_WEBHOOK_SECRET[:=]\s*\S+/gi, 'INCOMING_WEBHOOK_SECRET: [PROTECTED]');
                rawOutput.choices[0].message.content = content;
                ctx.injectSystemMessage('[🛡️ AUDITORÍA CYBERGATEWAY: Se bloqueó una fuga accidental de secretos en la respuesta del modelo]');
            }
        }
        return rawOutput;
    }

    // ── Hook: onSessionEnd (Resumen de Métricas) ──────────────────────
    async onSessionEnd(ctx: SessionContext): Promise<void> {
        const stats = await ctx.store.getSession('stats');
        if (stats) {
            console.log(`[CyberGateway] Sesión finalizada ${ctx.sessionId}:`);
            console.log(`  - Mensajes analizados: ${stats.analyzed}`);
            console.log(`  - Amenazas bloqueadas: ${stats.threatsBlocked}`);
        }
        ctx.removeBadge('cyber-gateway-badge');
    }

    // ── Métodos Auxiliares ────────────────────────────────────────────
    private formatModeLabel(mode: string): string {
        switch (mode) {
            case 'block_threats': return 'Bloqueo Activo';
            case 'monitor_only': return 'Modo Monitoreo';
            case 'strict_zero_trust': return 'Zero Trust';
            case 'quarantine': return 'Cuarentena';
            default: return mode;
        }
    }

    private async incrementStat(ctx: SessionContext, key: string) {
        const stats = await ctx.store.getSession<any>('stats') || { analyzed: 0, threatsBlocked: 0, threatsDetected: 0 };
        stats[key] = (stats[key] || 0) + 1;
        await ctx.store.setSession('stats', stats);

        const globalStats = await ctx.store.get<any>('global_metrics') || { analyzed: 0, threatsBlocked: 0, threatsDetected: 0 };
        globalStats[key] = (globalStats[key] || 0) + 1;
        await ctx.store.set('global_metrics', globalStats);
    }

    private async logThreat(ctx: SessionContext, threat: any) {
        const logEntry = {
            id: `thr_${Date.now()}`,
            timestamp: new Date().toISOString(),
            sessionId: ctx.sessionId,
            ...threat
        };

        const history = await ctx.store.get<any[]>('threat_history') || [];
        history.unshift(logEntry);
        if (history.length > 100) history.pop();
        await ctx.store.set('threat_history', history);
    }

    private async notifySoc(webhookUrl: string | null | undefined, attackType: string, sender: string, details: string) {
        if (!webhookUrl || !webhookUrl.startsWith('http')) return;

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'Urano-CyberGateway',
                    alertType: attackType,
                    sender,
                    details,
                    timestamp: new Date().toISOString(),
                    priority: 'CRITICAL'
                })
            });
        } catch (err: any) {
            console.error(`[CyberGateway] Error enviando alerta al SOC: ${err.message}`);
        }
    }
}
