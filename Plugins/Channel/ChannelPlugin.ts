import type { ParsedMessage, WebhookRequest } from '@core/channels/ChannelAdapter';
import {
    buildSocPrompt,
    extractJsonObject,
    interceptToGuardJson,
    isGuardEnvelope,
    toGuardVerdict,
    verifyHmacHex,
    safeSecretEqual
} from './guardEnvelope';

export class ChannelPlugin {
    private config: any;

    constructor(moduleConfig: any) {
        this.config = moduleConfig || {};
    }

    async executeAction(action: string, payload: any) {
        switch (action) {
            case 'validateWebhook':
                return this.validateWebhook(payload.req, payload.config);
            case 'parseWebhook':
                return this.parseWebhook(payload.req, payload.config);
            case 'sendReply':
                return this.sendReply(payload.to, payload.text, payload.config, payload.threadId);
            case 'handleHandshake':
                return this.handleHandshake(payload.req, payload.config);
            case 'resolveChannelIdentifier':
                return this.resolveChannelIdentifier(payload.req);
            case 'formatWebhookResponse':
                return this.formatWebhookResponse(payload);
            default:
                throw new Error(`Acción '${action}' no soportada en CyberGateway ChannelPlugin`);
        }
    }

    private async validateWebhook(req: WebhookRequest, config?: any): Promise<boolean> {
        const expectedSecret = config?.INCOMING_WEBHOOK_SECRET || this.config?.INCOMING_WEBHOOK_SECRET;
        if (!expectedSecret) {
            return ![true, 'true'].includes(config?.REQUIRE_WEBHOOK_AUTH ?? this.config?.REQUIRE_WEBHOOK_AUTH);
        }

        const headers = req?.headers || {};
        const hmacHeader = headers['x-urano-signature'] || headers['x-hub-signature-256'];
        const rawBody = (req as any).rawBody || (typeof req?.body === 'string' ? req.body : JSON.stringify(req?.body || {}));

        if (hmacHeader) {
            const ok = verifyHmacHex(String(rawBody || ''), hmacHeader, String(expectedSecret));
            if (!ok) {
                console.warn('[CyberGateway] HMAC de webhook rechazado');
            }
            return ok;
        }

        const incomingToken = headers['x-gateway-secret']
            || headers['authorization']?.replace(/^Bearer\s+/i, '')
            || req?.query?.secret;

        if (!incomingToken) {
            console.warn('[CyberGateway] Petición rechazada: Falta token de verificación en cabeceras');
            return false;
        }

        return safeSecretEqual(String(incomingToken), String(expectedSecret));
    }

    private async parseWebhook(req: WebhookRequest, config?: any): Promise<ParsedMessage> {
        const body = req?.body || {};

        if (body.webhookAction !== undefined || req?.query?.webhookAction !== undefined) {
            const from = String(body.request?.senderId || body.request?.ip || body.sender || body.from || 'guard_anonymous');
            return { from, text: '', hasMedia: false, skipOutboundReply: true, waitForAgent: false };
        }

        if (isGuardEnvelope(body)) {
            return this.parseGuardEnvelope(body);
        }

        const sender = body.sender
            || body.from
            || body.author_id
            || body.user_id
            || body.phone
            || req?.headers?.['x-forwarded-for']
            || 'anonymous_user';

        let textContent = '';
        if (typeof body === 'string') {
            textContent = body;
        } else if (body.text) {
            textContent = body.text;
        } else if (body.message?.text) {
            textContent = body.message.text;
        } else if (body.content) {
            textContent = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
        } else if (body.message) {
            textContent = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
        } else {
            textContent = JSON.stringify(body);
        }

        const hasMedia = !!(body.mediaUrl || body.attachment || body.file || body.photo);
        const mediaUrl = body.mediaUrl || body.attachment?.url || body.file?.url;
        const mediaType = body.mediaType || body.attachment?.type;

        return {
            from: String(sender),
            text: textContent,
            hasMedia,
            mediaUrl,
            mediaType,
            threadId: body.threadId || body.conversationId,
            waitForAgent: false
        };
    }

    private parseGuardEnvelope(body: any): ParsedMessage {
        const req = body.request || {};
        const from = String(req.senderId || req.ip || 'guard_anonymous');
        const followUp = body.followUp === true;
        const canDisclose: string[] = body.capabilities?.canDisclose || [];
        const hasBody = req.body !== undefined && req.body !== null && req.body !== '';

        if (!followUp && !hasBody && canDisclose.includes('body')) {
            return {
                from,
                text: '',
                hasMedia: false,
                threadId: body.requestId,
                waitForAgent: false,
                skipOutboundReply: true,
                immediateResponse: {
                    status: 200,
                    body: {
                        verdict: 'NEED',
                        need: ['body'],
                        skills: ['logs.recent', 'tenant.risk']
                    }
                }
            };
        }

        return {
            from,
            text: buildSocPrompt(body),
            hasMedia: false,
            threadId: body.requestId,
            skipOutboundReply: true,
            waitForAgent: true
        };
    }

    private formatWebhookResponse(payload: {
        req?: WebhookRequest;
        config?: any;
        agentResponse?: string;
        agentId?: string;
        toolsUsed?: string[];
        error?: string;
        sessionId?: string;
        turnId?: string;
        requestId?: string;
    }) {
        const securityMode = payload.config?.SECURITY_MODE || this.config?.SECURITY_MODE;
        const execution = { sessionId: payload.sessionId, turnId: payload.turnId, requestId: payload.requestId, protocolVersion: 1 };
        if (payload.error) {
            return {
                status: payload.error === 'agent_timeout' ? 504 : ['webhook_session_unavailable', 'webhook_turn_unavailable'].includes(payload.error) ? 404 : ['idempotency_conflict', 'webhook_session_busy', 'execution_cancelled'].includes(payload.error) ? 409 : 503,
                body: { error: payload.error, ...execution }
            };
        }

        const text = String(payload.agentResponse || '');
        const parsed = extractJsonObject(text);
        if (parsed) {
            return { status: 200, body: { ...toGuardVerdict(parsed, securityMode), execution } };
        }

        const intercepted = interceptToGuardJson(text, securityMode);
        if (intercepted) {
            return { status: 200, body: { ...intercepted, execution } };
        }

        return {
            status: 200,
            body: {
                verdict: securityMode === 'monitor_only' ? 'MONITOR' : 'ALLOW',
                riskScore: 12,
                reason: 'agent-prose-fallback',
                analysis: text.slice(0, 4000),
                execution
            }
        };
    }

    private async sendReply(to: string, text: string, config?: any, threadId?: string): Promise<{ sid: string }> {
        const forwardUrl = config?.FORWARD_URL || this.config?.FORWARD_URL;
        const authToken = config?.FORWARD_AUTH_TOKEN || this.config?.FORWARD_AUTH_TOKEN;

        if (forwardUrl && forwardUrl.startsWith('http')) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'X-Urano-Security-Gateway': 'v1.0-verified'
                };
                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }

                const res = await fetch(forwardUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        recipient: to,
                        reply: text,
                        threadId,
                        timestamp: new Date().toISOString(),
                        status: 'CLEAN_VERIFIED'
                    })
                });

                if (!res.ok) {
                    console.error(`[CyberGateway] Error retransmitiendo al upstream (${res.status}): ${await res.text()}`);
                }
            } catch (err: any) {
                console.error(`[CyberGateway] Fallo de conexión con upstream: ${err.message}`);
            }
        }

        return {
            sid: `gw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        };
    }

    private async handleHandshake(req: WebhookRequest, config?: any): Promise<string | null> {
        if (req?.query?.['hub.challenge']) {
            return String(req.query['hub.challenge']);
        }
        if (req?.query?.['challenge']) {
            return String(req.query['challenge']);
        }
        if (req?.body?.challenge) {
            return String(req.body.challenge);
        }
        return null;
    }

    private resolveChannelIdentifier(req: WebhookRequest): string | null {
        return req?.headers?.['x-channel-id'] || req?.query?.channelId || null;
    }
}
