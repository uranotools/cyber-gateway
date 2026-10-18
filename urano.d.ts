declare module '@core/PluginBase' {
    export class PluginBase {
        protected config: any;
        constructor(config: any);
    }
}

declare module '@core/channels/ChannelAdapter' {
    export interface ParsedMessage {
        sessionId?: string;
        webhookPrincipal?: { id: string; permissions: ('invoke' | 'read' | 'cancel')[] };
        from: string;
        text: string;
        hasMedia: boolean;
        mediaUrl?: string;
        mediaType?: string;
        immediateResponse?: { status: number; body: any; headers?: Record<string, string> };
        threadId?: string;
        waitForAgent?: boolean;
        skipOutboundReply?: boolean;
        syncTimeoutMs?: number;
        responseHeaders?: Record<string, string>;
    }

    export interface WebhookRequest {
        body: any;
        headers: Record<string, string>;
        query: Record<string, string>;
        url: string;
        rawBody?: string;
    }
}

declare module '@core/EnginePluginBase' {
    export interface EnginePreProcessResult {
        status: 'continue' | 'intercepted';
        overrideResponse?: string;
        modifiedMessage?: any;
    }

    export interface ContextEngineResult {
        key: string;
        content: string;
        priority?: number;
    }

    export abstract class EnginePluginBase {
        protected readonly config: any;
        constructor(config: any);
        onSessionStart?(ctx: any): Promise<void>;
        preMessageProcess?(ctx: any, message: any): Promise<EnginePreProcessResult>;
        postMessageProcess?(ctx: any, response: any): Promise<void>;
        onToolCall?(ctx: any, toolCall: any): Promise<void>;
        onSessionEnd?(ctx: any): Promise<void>;
        onLlmInput?(ctx: any, llmPayload: any): Promise<void>;
        onLlmOutput?(ctx: any, rawOutput: any): Promise<any>;
        beforeToolCall?(ctx: any, toolCall: any): Promise<void>;
        afterToolCall?(ctx: any, toolCall: any, result: any): Promise<any>;
        getContextEngine?(ctx: any): Promise<ContextEngineResult | null>;
    }
}

declare module '@core/runtime/SessionContext' {
    export class PluginStore {
        get<T = any>(key: string): Promise<T | null>;
        set(key: string, value: any): Promise<void>;
        delete(key: string): Promise<void>;
        getSession<T = any>(key: string): Promise<T | null>;
        setSession(key: string, value: any): Promise<void>;
        deleteSession(key: string): Promise<void>;
    }

    export interface SubSessionConfig {
        systemPrompt?: string;
        input: string | any[];
        agentId?: string;
        allowedTools?: string[];
        silent?: boolean;
        maxTokens?: number;
        timeout?: number;
        priority?: 'low' | 'medium' | 'high';
        persist?: boolean;
        debug?: boolean;
        onProgress?: (progress: { step: number; currentTool?: string; totalTokens: number }) => void;
    }

    export interface SubSessionResult {
        subSessionId: string;
        status: 'completed' | 'error' | 'cancelled';
        messages: any[];
        summary: string;
        tokenStats: { promptTokens: number; completionTokens: number; totalTokens: number };
        toolExecutions: Array<{ toolName: string; args: any; output: any; success: boolean }>;
    }

    export class SessionContext {
        readonly moduleName: string;
        readonly sessionId: string;
        readonly userId: string;
        readonly agentId: string;
        readonly status: string;
        readonly provider: string | undefined;
        readonly model: string | undefined;
        readonly platform: string | undefined;
        readonly agentName: string | undefined;
        readonly customInstructions: string;
        readonly messageCount: number;
        readonly store: PluginStore;
        getMessages(): any[];
        getLastMessages(count: number): any[];
        getMessagesByRole(role: string): any[];
        injectSystemMessage(content: string): void;
        getMetadata(): Readonly<any>;
        getAllowedModules(): string[];
        setPluginData(key: string, value: any): void;
        getPluginData<T = any>(key: string): T | undefined;
        appendCustomInstructions(text: string): void;
        addBadge(badge: any): void;
        removeBadge(badgeId: string): void;
        getBadges(): any[];
        getTokenStats(): { usedTokens: number; limitTokens: number };
        getTotalTokenStats(): { promptTokens: number; completionTokens: number; totalTokens: number };
        on(eventType: string, listener: (event: any) => void): () => void;
        getSecret(key: string): string | null;
        getSecretWithOverride(key: string): string | null;
        getModuleOverrides(): Record<string, string>;
        isModuleEnabled(): boolean;
        spawnSubSession(config: SubSessionConfig): Promise<SubSessionResult>;
    }
}
