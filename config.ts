export const CyberGatewayConfig = {
    name: 'cyber-gateway',
    description: 'AI Security Gateway & Reverse Proxy para Canales y Servicios. Inspecciona en tiempo real phishing, inyecciones de prompt, ataques coordinados por IA y reenvía tráfico limpio a la infraestructura interna.',
    icon: 'ShieldAlert',
    category: 'Ciberseguridad',

    inDesktop: true,
    inCloud: true,
    cloudOnly: false,

    // ──────────────────────────────────────────
    // CAPA CHANNEL PLUGIN (Webhooks dinámicos)
    // ──────────────────────────────────────────
    channelPlugin: true,
    waitForAgent: true,
    skipOutboundReply: true,
    syncTimeoutMs: 30000,
    experimentalWebSocket: true, // Explicit opt-in for this experimental plugin only.
    webhookMaxConcurrent: 2,
    webhookQueueTimeoutMs: 60000,
    webhookExecutionTimeoutMs: 180000,

    // ──────────────────────────────────────────
    // CAPA ENGINE PLUGIN (Middleware de Sesión e Inspección en caliente)
    // ──────────────────────────────────────────
    enginePlugin: true,
    engineHooks: [
        'onSessionStart',
        'preMessageProcess',
        'postMessageProcess',
        'onLlmInput',
        'onLlmOutput',
        'onSessionEnd'
    ],
    enginePluginPath: 'Plugins/Engine/CyberGatewayEnginePlugin',

    enabledPlugins: ['Gateway'],

    // ──────────────────────────────────────────
    // AJUSTES EN EL VAULT (Configuración de Seguridad)
    // ──────────────────────────────────────────
    settings: [
        { name: 'REQUIRE_WEBHOOK_AUTH', type: 'checkbox', title: 'Exigir secreto para recibir webhooks', description: 'Actívalo fuera del laboratorio local. Sin secreto configurado, rechaza peticiones.', default: false },
        {
            name: 'SECURITY_MODE',
            type: 'select',
            title: 'Modo de Seguridad del Gateway',
            description: 'Define cómo reacciona el Gateway al detectar una anomalía o ataque.',
            options: [
                { label: '🛡️ Bloqueo Activo (Recomendado) — Neutraliza amenazas y notifica al SOC', value: 'block_threats' },
                { label: '👁️ Solo Monitoreo — Registra amenazas y reenvía con etiqueta [SUSPICIOUS]', value: 'monitor_only' },
                { label: '🔒 Zero Trust Estricto — Bloquea todo contenido con score de riesgo > 30%', value: 'strict_zero_trust' },
                { label: '📦 Cuarentena — Retiene el mensaje para revisión humana previa', value: 'quarantine' }
            ],
            default: 'block_threats',
            perAgent: true
        },
        {
            name: 'FORWARD_URL',
            type: 'text',
            title: 'URL de Reenvío Interno (Upstream Backend)',
            description: 'URL de los servidores internos donde se reenvía el tráfico limpio validado.',
            placeholder: 'https://servicios.empresa.local/api/v1/webhook',
            perAgent: true
        },
        {
            name: 'FORWARD_AUTH_TOKEN',
            type: 'password',
            title: 'Token de Autenticación para Upstream',
            description: 'Token Bearer o clave compartida enviada en Authorization header al servidor interno.'
        },
        {
            name: 'INCOMING_WEBHOOK_SECRET',
            type: 'password',
            title: 'Secreto de Verificación Webhook Entrante',
            description: 'Firma HMAC / Token secreto esperado en cabeceras x-hub-signature o x-gateway-secret.'
        },
        {
            name: 'DETECT_PROMPT_INJECTION',
            type: 'checkbox',
            title: 'Detectar Inyecciones de Prompt y Jailbreaks de IA',
            description: 'Analiza patrones de manipulación contra agentes y modelos de lenguaje.',
            default: true,
            perAgent: true
        },
        {
            name: 'DETECT_MALICIOUS_URLS',
            type: 'checkbox',
            title: 'Escanear Enlaces Sospechosos / Phishing',
            description: 'Extrae y evalúa la reputación de URLs y dominios en los mensajes recibidos.',
            default: true,
            perAgent: true
        },
        {
            name: 'DETECT_AI_BOT_PATTERNS',
            type: 'checkbox',
            title: 'Detección de Ataques Automatizados por IA / Botnets',
            description: 'Reconoce patrones de alta frecuencia, ausencia de errores humanos y fuzzing semántico.',
            default: true,
            perAgent: true
        },
        {
            name: 'ALERT_WEBHOOK_URL',
            type: 'text',
            title: 'Webhook de Notificación de Alertas SOC',
            description: 'Endpoint donde se envían alertas de intrusión en tiempo real (Slack, Teams, SIEM, Discord, Telegram SOC).',
            placeholder: 'https://soc.empresa.com/api/alerts'
        },
        {
            name: 'BLOCKED_IDENTIFIERS',
            type: 'textarea',
            title: 'Lista Negra de Remitentes / IPs Bloqueados',
            description: 'Números de teléfono, UserIDs o IPs bloqueados permanentemente (uno por línea).',
            placeholder: '+1234567890\nuser_bad_actor\n198.51.100.4',
            perAgent: true
        },
        {
            name: 'TARGET_AGENT',
            type: 'channel_agent_select',
            title: 'Agente Vinculado / Enrutador',
            description: 'Vacío o Enrutador: Hybrid Router (triggers, sesión, default). Un agente concreto: todo el webhook va a ese agente.',
        },
        {
            name: 'allowedAgents',
            type: 'dynamic',
            title: 'Agentes Disponibles para Redirección',
            label: 'Mapeo de Agentes Autorizados',
            description: 'Agentes a los que el router puede hacer handoff. Vacío = sin restricción.',
            fields: [
                {
                    name: 'agentId',
                    key: 'agentId',
                    label: 'Agente',
                    type: 'channel_agent_select',
                    includeRouter: false,
                    required: true,
                },
            ],
        }
    ],

    // ──────────────────────────────────────────
    // ESQUEMAS DE HERRAMIENTAS MCP EXPUESTAS
    // ──────────────────────────────────────────
    pluginSchemas: {
        Gateway: {
            actions: {
                get_gateway_status: {
                    label: 'Obtener estado y métricas del Gateway de Seguridad',
                    description: 'Muestra total de mensajes analizados, amenazas bloqueadas, tasa de mitigación y estado de upstream.',
                    fields: []
                },
                inspect_payload: {
                    label: 'Inspeccionar manualmente un mensaje o payload',
                    description: 'Ejecuta el motor de análisis profundo heurístico + semántico sobre un texto o paquete de datos.',
                    fields: [
                        { name: 'content', type: 'required', label: 'Texto o JSON a inspeccionar' },
                        { name: 'sender', type: 'text', label: 'Identificador del remitente (opcional)' }
                    ]
                },
                block_sender: {
                    label: 'Bloquear remitente o IP maliciosa',
                    description: 'Añade un ID de usuario, teléfono o dirección IP a la lista de mitigación activa del Gateway.',
                    fields: [
                        { name: 'identifier', type: 'required', label: 'ID de usuario, IP o número de teléfono' },
                        { name: 'reason', type: 'required', label: 'Motivo del bloqueo / Tipo de ataque' }
                    ]
                },
                unblock_sender: {
                    label: 'Desbloquear remitente o IP',
                    description: 'Remueve un identificador de la lista de bloqueo del Gateway.',
                    fields: [
                        { name: 'identifier', type: 'required', label: 'ID o IP a desbloquear' }
                    ]
                },
                get_threat_log: {
                    label: 'Consultar registro de amenazas detectadas',
                    description: 'Devuelve las últimas alertas e intentos de ataque neutralizados por el Gateway.',
                    fields: [
                        { name: 'limit', type: 'text', label: 'Límite de registros (default 20)' }
                    ]
                },
                test_upstream_connection: {
                    label: 'Probar conectividad con el servidor interno de destino',
                    description: 'Envía un ping autenticado a la URL de reenvío para validar que el upstream esté operativo.',
                    fields: []
                },
                generate_security_report: {
                    label: 'Generar reporte ejecutivo de seguridad del Gateway',
                    description: 'Construye un resumen estructurado para el equipo directivo y el SOC.',
                    fields: []
                }
            }
        }
    }
};
