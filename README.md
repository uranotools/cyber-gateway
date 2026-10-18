# 🛡️ CyberGateway — AI Security Gateway & Reverse Proxy

<div align="center">

![CyberGateway Header](https://img.shields.io/badge/Urano_Plugin-CyberGateway-0078D4?style=for-the-badge&logo=shield&logoColor=white)
![Version](https://img.shields.io/badge/Version-1.0.0-emerald?style=for-the-badge)
![Security Layer](https://img.shields.io/badge/Layer-Inline_AI_WAF-red?style=for-the-badge)
![Zero Trust](https://img.shields.io/badge/Architecture-Zero_Trust-blueviolet?style=for-the-badge)

**Gateway de Seguridad Inteligente & Reverse Proxy Autónomo con Inspección en Tiempo Real para Canales, APIs e Infraestructura.**

[Características](#-características-principales) • [Arquitectura y Capas](#-arquitectura-y-capas-de-seguridad) • [Medidas de Seguridad](#-medidas-de-seguridad-implementadas) • [Instalación y Configuración](#-instalación-y-configuración) • [Herramientas MCP](#-herramientas-mcp-disponibles)

---

</div>

## 📌 ¿Qué es CyberGateway?

**CyberGateway** es un módulo de ciberseguridad plug-and-play para **UranoAI** diseñado para colocarse como una aduana de seguridad activa (*Inline AI Firewall & Reverse Proxy*) delante de cualquier canal de mensajería (WhatsApp, Telegram, Discord, Webhooks) o API pública.

En lugar de que el tráfico no filtrado llegue directamente a los servidores internos o a los agentes de IA, **CyberGateway inspecciona cada paquete en microsegundos**:
- Neutraliza **inyecciones de prompt (Jailbreaks)** dirigidas a manipular modelos de lenguaje.
- Detecta **phishing con IA, suplantación de identidad (BEC)** y enlaces maliciosos.
- Identifica **ataques de bots, fuzzing semántico** y anomalías de alta frecuencia.
- Reenvía únicamente el **tráfico limpio verificado** hacia la infraestructura de destino (*Forward Proxy*).

---

## 🏛️ Arquitectura y Flujo de Tráfico

```
                     TRÁFICO ENTRANTE (Usuario / Bot / Atacante)
                                        │
                                        ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                      🛡️ URANO CYBERGATEWAY                            │
    │                                                                       │
    │  ┌─────────────────────────────────────────────────────────────────┐  │
    │  │ 1. CAPA CHANNEL (Webhook Receiver & Auth Handshake)             │  │
    │  │    • Validación HMAC / Secret Token (`validateWebhook`)         │  │
    │  │    • Normalización de payload multimodal (`parseWebhook`)       │  │
    │  └─────────────────────────────────┬───────────────────────────────┘  │
    │                                    │                                  │
    │  ┌─────────────────────────────────▼───────────────────────────────┐  │
    │  │ 2. CAPA ENGINE (Inspección en Caliente - Guardrails AI)         │  │
    │  │    • Filtro Regex & Heurístico Anti-Prompt Injection            │  │
    │  │    • Escáner de URLs Maliciosas y Typosquatting                 │  │
    │  │    • Análisis de Entropía & Detección de Botnets / Fuzzing      │  │
    │  │    • Sanitización de Datos Sensibles / PII (`onLlmInput`)       │  │
    │  │    • Filtro Anti-Fuga de Secretos en Salida (`onLlmOutput`)     │  │
    │  └─────────────────────────────────┬───────────────────────────────┘  │
    │                                    │                                  │
    │            ┌───────────────────────┴───────────────────────┐          │
    │            ▼                                               ▼          │
    │   🔴 AMENAZA DETECTADA                            🟢 TRÁFICO LIMPIO   │
    │   ├── Bloqueo Activo & Mensaje Seguro             └── Reenvío Seguro  │
    │   ├── Alerta Inmediata a Webhook SOC                   con HMAC/Auth  │
    │   └── Registro en Ledger Criptográfico                 a Upstream     │
    └────────────────────────────────────────────────────────────┬──────────┘
                                                                 │
                                                                 ▼
                                                  [ Servidores Internos / API ]
```

---

## 🛡️ Capas de Seguridad del Sistema

### 1. Capa de Canal (Channel Adapter Layer)
- **Zero-Code Core Integration**: Registra automáticamente el canal bajo `mcp_cyber-gateway` en el enrutador de Urano sin modificar código interno.
- **Doble Endpoint Universal**:
  - **Cloud:** `https://api.urano.cloud/v1/webhook/mcp_cyber-gateway/:channelId`
  - **Local (Desktop):** `http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/:channelId`
- **Autenticación en Ingress**: Valida cabeceras criptográficas (`x-hub-signature-256`, `x-gateway-secret`, tokens Bearer) antes de permitir que cualquier byte llegue al motor de inferencia.

### 2. Capa de Motor de Sesión (Engine Plugin Layer)
- **Pre-Message Interception**: Intercepta el ciclo de ejecución (`preMessageProcess`) antes de que el mensaje toque el System Prompt o gaste tokens del LLM.
- **Sanitización Bireccional**:
  - `onLlmInput`: Oculta números de tarjeta de crédito, identificadores personales y API keys antes de contactar al proveedor de IA.
  - `onLlmOutput`: Redacta tokens y secretos de infraestructura para prevenir fugas accidentales por alucinación.
- **Badges Visuales en Tiempo Real**: Inyecta un indicador de estado dinámico (`🛡️ CyberGateway: Bloqueo Activo`) visible para los analistas en la interfaz de Urano.

### 3. Capa de Herramientas de Análisis (MCP Tools Layer)
- Expone funciones de control para que operadores o sub-agentes puedan consultar métricas, evaluar payloads de forma manual (`inspect_payload`), bloquear/desbloquear IPs y emitir reportes de seguridad en Markdown.

---

## 🔒 Medidas de Seguridad Implementadas

| Medida de Seguridad | Tipo | Descripción |
|---|---|---|
| **Defensa Anti-Jailbreak / Prompt Injection** | Preventiva | Detecta patrones `DAN`, `ignore previous instructions`, llamadas a `eval()`, inyecciones SQL y comandos de consola (`sudo`, `chmod`, `rm -rf`). |
| **Escáner Anti-Phishing & Typosquatting** | Preventiva | Identifica enlaces fraudulentos, dominios con TLDs de alto riesgo (`.xyz`, `.top`, `.click`), acortadores públicos (`bit.ly`) y URLs con IP directa. |
| **Detección de Fuzzing & Botnets** | Reactiva | Mide la entropía del texto, variaciones de caracteres repetitivos y ráfagas no humanas para mitigar ataques de denegación de wallet (DoW). |
| **Lista Negra Dinámica (Blacklist)** | Control de Acceso | Bloquea inmediatamente a remitentes, teléfonos o IPs registradas por el operador o marcadas por el SOC. |
| **Sanitización Criptográfica de PII** | Privacidad | Enmascara datos sensibles de ciudadanos/usuarios antes de enviarlos a modelos de inferencia. |
| **Notificación Inmediata al SOC** | Visibilidad | Despacha alertas JSON en tiempo real con severidad `CRITICAL` hacia SIEMs (Splunk, Elastic, Wazuh), Slack o Microsoft Teams. |
| **Modo Zero Trust Estricto** | Política | Permite configurar el gateway para bloquear cualquier petición con un score de anomalía mayor al 30%. |

---

## ⚙️ Modos de Operación

En los ajustes del Vault puedes configurar el parámetro `SECURITY_MODE`:

1. **`block_threats` (Predeterminado - Recomendado)**:
   - Bloquea cualquier ataque detectado.
   - Devuelve una respuesta de rechazo seguro al remitente.
   - Envía alerta inmediata al webhook del SOC.
   - No gasta tokens en el LLM principal.

2. **`monitor_only` (Auditoría Pasiva)**:
   - No bloquea el mensaje.
   - Añade una etiqueta de advertencia `[⚠️ ALERTA DE SEGURIDAD]` al contenido para que el agente o backend downstream proceda con cautela.

3. **`strict_zero_trust` (Máxima Seguridad)**:
   - Bloquea cualquier petición con patrones inusuales, alta entropía o remitentes no categorizados.

4. **`quarantine` (Aprobación Humana)**:
   - Retiene los mensajes dudosos en cola para revisión del analista.

---

## 🚀 Instalación y Configuración

### Paso 1: Instalar en Urano
1. Abre **Urano Desktop** > **MCP Manager** > **Modo Desarrollador**.
2. Haz clic en **Vincular Carpeta Local** y selecciona este directorio (`cyber-gateway`).
3. O si utilizas distribución empaquetada, instala el archivo `cyber-gateway.zip`.

### Paso 2: Configurar Parámetros en el Vault
En el panel de configuración del módulo en Urano, define:

| Parámetro | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `FORWARD_URL` | `text` | URL de tu servidor backend interno | `https://api.miempresa.com/v1/webhook` |
| `FORWARD_AUTH_TOKEN` | `password` | Token Bearer para autenticar hacia el servidor interno | `secret_upstream_key_123` |
| `SECURITY_MODE` | `select` | Modo de mitigación | `block_threats` |
| `ALERT_WEBHOOK_URL` | `text` | Endpoint para alertas del equipo SOC / SIEM | `https://soc.miempresa.com/alerts` |
| `INCOMING_WEBHOOK_SECRET`| `password` | Secreto esperado en cabeceras entrantes | `mi_secreto_hmac_seguro` |

### Paso 3: Configurar tu Canal Externo
En tu proveedor (Meta WhatsApp, Bot de Telegram, Twilio, etc.), establece como URL de Webhook:
```
https://api.urano.cloud/v1/webhook/mcp_cyber-gateway/:channelId
```
*(o en local para pruebas: `http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/:channelId`)*

¡Y todo el tráfico entrante quedará protegido por el Gateway de IA!

---

## 🛠️ Herramientas MCP Disponibles

Cuando un Agente tiene habilitado el módulo `cyber-gateway`, puede ejecutar las siguientes herramientas:

- **`urano_cyber-gateway_gateway_get_gateway_status`**: Consulta métricas en tiempo real (paquetes analizados, mitigaciones, estado del upstream).
- **`urano_cyber-gateway_gateway_inspect_payload`**: Evalúa un texto o fragmento JSON retornando score de riesgo (0 a 100) y veredicto (`CLEAN`, `SUSPICIOUS`, `CRITICAL_THREAT`).
- **`urano_cyber-gateway_gateway_block_sender`**: Agrega un remitente, teléfono o IP a la lista de mitigación activa.
- **`urano_cyber-gateway_gateway_unblock_sender`**: Remueve un identificador de la lista negra.
- **`urano_cyber-gateway_gateway_get_threat_log`**: Consulta el historial de alertas detectadas.
- **`urano_cyber-gateway_gateway_test_upstream_connection`**: Realiza un healthcheck ping con medición de latencia en milisegundos hacia el servidor de destino.
- **`urano_cyber-gateway_gateway_generate_security_report`**: Genera un informe ejecutivo consolidado en formato Markdown.

---

## 📂 Estructura del Código

```text
cyber-gateway/
├── README.md                    # Documentación completa y arquitectura
├── config.ts                    # Manifiesto MCP (channelPlugin + enginePlugin + schemas)
├── package.json                 # Dependencias y scripts de compilación
├── tsconfig.json                # Configuración de compilación TypeScript
├── urano.d.ts                   # Declaración de tipos @core para Urano
├── SKILL.md                     # Directivas de contexto y protocolo para el Agente
├── knowledge/                   # Memorias y bases de conocimiento
│   ├── threat-signatures.md     # Catálogo de firmas de Jailbreak e inyecciones
│   └── phishing-indicators.md   # Indicadores de ingeniería social y typosquatting
└── Plugins/
    ├── Channel/
    │   └── ChannelPlugin.ts     # Receiver Webhook & Forward Proxy saliente
    ├── Engine/
    │   └── CyberGatewayEnginePlugin.ts # Middleware de filtrado e inspección en caliente
    └── Gateway/
        └── GatewayPlugin.ts     # Métodos ejecutables de la API MCP
```

---

<div align="center">

**Desarrollado para el Ecosistema UranoAI — Ciberdefensa Autónoma de Próxima Generación**

</div>

## Experimento de ejecuciones recuperables (core protocolo v1)

El plugin conserva el contrato Guard schema 1.0 y ahora acepta controles `webhookAction: status|events|cancel` antes de evaluar NEED, sin convertir una consulta en inferencia. Mantiene la identidad de `request.senderId` en controles y ejecuciones; `sessionId`, idempotencia y replay son responsabilidad del core.

El manifiesto **de este plugin experimental** opta por `experimentalWebSocket: true`, dos turnos concurrentes y tres minutos máximos de ejecución. No activa WS globalmente para otros plugins. El formatter añade `execution` con `turnId`, `sessionId`, `requestId` y `protocolVersion`, conservando `verdict`, `analysis` y `report`.

Para un entorno remoto configura `INCOMING_WEBHOOK_SECRET`, activa `REQUIRE_WEBHOOK_AUTH` y usa Bearer/HMAC desde el cliente. Sin secreto y sin esa exigencia se conserva el laboratorio local abierto; esto no es autenticación de producción. La comparación de tokens es constante en tiempo y los controles se autentican igual que una invocación normal.

La consola hermana `urano-guard-demos` incorpora **Experimentos**: streaming, continuidad, doble entrega, recuperación/cancelación y tareas sintéticas de soporte, producto y datos. Las tareas `workflow-lab` siguen pasando por los inspectores y responden con el JSON habitual, usando analysis/report para el análisis; no autorizan acciones externas. Véase `urano-guard-demos/docs/PROTOCOL_LAB.md`.

## Empaquetar para Desktop y Cloud

Desde el checkout del plugin, instala las dependencias una vez con `npm install`. Después ejecuta `npm run pack`: compila las entradas `config.ts` y `Plugins/**/*.ts` a CommonJS, prepara los recursos y crea `cyber-gateway.zip`. No instala paquetes durante la compilación.

- `npm run build` o `npm run deploy`: regenera `dist` y copia documentación, LICENSE y todas las memorias de `knowledge/`.
- `npm run typecheck`: comprueba TypeScript sin emitir archivos.
- `npm run stage`: actualiza y verifica los recursos sobre los bundles ya compilados.
- `npm run urano-launch`: prepara los recursos y comprime el `dist` existente; si cambiaste TypeScript, usa `npm run pack` para recompilar primero.
- `npm run pack`: compila, prepara y crea el ZIP completo.

El ZIP contiene `config.js`, `Plugins/`, `SKILL.md`, `README.md`, `LICENSE`, un manifiesto de ejecución con `main: config.js` y `knowledge/` en la raíz (sin carpeta `dist/` contenedora). No incluye node_modules, secretos locales ni herramientas de desarrollo. Los aliases `@core`, `@models`, `@modules` y Electron quedan externos para que los resuelva Urano. El core escanea `knowledge/` automáticamente; no hace falta duplicar sus contenidos en SKILL.md.

La compilación limpia únicamente la carpeta generada `dist` del plugin. El ZIP anterior se sustituye después de comprimir correctamente. En Windows se usa PowerShell; Linux/macOS requieren la utilidad `zip` instalada. Instala el resultado desde **Integraciones > Instalar MCP (.zip)**.
