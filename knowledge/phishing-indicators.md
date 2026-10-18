---
name: Indicadores de Phishing y Suplantación
description: Criterios de evaluación para detectar ingeniería social y enlaces maliciosos en canales de comunicación.
type: mcp
---

# Indicadores de Phishing y Amenazas en Canales

## 1. Detección de Dominios Fraudulentos (Typosquatting)
- Dominios que simulan entidades legítimas pero usan TLDs comerciales o sospechosos (ej. `portal-oficial.xyz`, `login-auth.tk`).
- URLs con IP directa en lugar de nombre de dominio (ej. `http://198.51.100.4/login`).
- Uso de acortadores de enlaces públicos para ofuscar destinos maliciosos (`bit.ly`, `tinyurl.com`).

## 2. Patrones de Ingeniería Social Generada por IA
- **Urgencia Artificial**: Mensajes que exigen pagos o actualizaciones de datos bajo amenaza de sanciones o bloqueo de cuentas.
- **Suplantación de Directivos (BEC)**: Correos o mensajes que afirman ser directores ejecutivos o administradores solicitando transferencias o accesos confidenciales.
- **Deepfake Textual**: Textos con redacción hiper-formal que buscan eludir filtros de spam tradicionales pero solicitan credenciales o tokens OTP.
