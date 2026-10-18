---
name: Firmas de Amenazas e Inyecciones de Prompt
description: Catálogo de patrones de jailbreak, manipulación de instrucciones y técnicas adversarias de IA.
type: mcp
---

# Catálogo de Firmas de Amenaza para IA

## 1. Técnicas de Prompt Injection Directo
- **Directiva de Olvido**: Intentos de invalidar directivas de seguridad ("Ignore previous instructions", "Desatiende las reglas anteriores").
- **Suplantación de Rol (Jailbreaks DAN/Unfiltered)**: Forzar al modelo a adoptar personalidades sin restricciones morales o de seguridad.
- **Inyección por Traducción/Cifrado**: Ocultar comandos maliciosos usando Base64, ROT13, hexadecimal o lenguajes poco comunes.

## 2. Inyección de Código y Exploits
- **SQL Injection**: `UNION SELECT`, `' OR '1'='1`, `DROP TABLE`.
- **Command Injection**: `sudo`, `rm -rf`, `chmod 777`, `/etc/shadow`, `/etc/passwd`.
- **Cross-Site Scripting (XSS)**: `<script>`, `onerror=`, `javascript:`.

## 3. Fuzzing y Botnets de IA
- Ataques masivos de peticiones con ligeras variaciones semánticas para descubrir fallos en la lógica de negocio.
- Generación de mensajes sintéticos de alta velocidad diseñados para saturar la cuota de inferencia (Denial of Wallet / DoW).
