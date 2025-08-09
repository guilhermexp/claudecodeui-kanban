# Setup HTTPS e Acesso Mobile - Claude Code UI

## ✅ Fluxo Oficial (Produção + Auto-start no macOS)

Este app agora inicia automaticamente em background quando você faz login no macOS e fica disponível via HTTPS para uso no mobile (microfone habilitado).

### Acesso
- URL pública: https://claudecode.ngrok.app (sem "www")
- Dashboard do túnel: http://localhost:4040

### O que sobe automaticamente
- Frontend (build estático servido pelo Express)
- Backend Node/Express (porta 8080)
- Vibe Kanban (porta 8081)
- Túnel ngrok (encaminha 8080)

### Controles rápidos
- Iniciar: `./claudecode-service.sh start`
- Parar: `./claudecode-service.sh stop`
- Reiniciar: `./claudecode-service.sh restart`
- Status: `./claudecode-service.sh status`

### Logs
- Server (Express): `tail -f prod-server.log`
- Vibe Kanban: `tail -f prod-vibe.log`
- Ngrok: `tail -f prod-ngrok.log`

### Rodar manualmente (opcional)
- `./start-background-prod.sh`

## ⚠️ Dicas e Troubleshooting
- Se a página não atualizar, faça hard refresh (Cmd+Shift+R) ou abra em aba anônima no celular
- Verifique no dashboard do ngrok se está encaminhando para `http://localhost:8080`
- Certifique-se de usar a URL sem "www"

## 🛠️ Requisitos
- Node.js instalado
- Ngrok instalado (`brew install ngrok`) e domínio `claudecode.ngrok.app` configurado
- macOS (testado no macOS 25.0.0)

## 📁 Arquivos relevantes
- `start-background-prod.sh` — inicia produção em background
- `com.claudecode.app.plist` — auto-start no login pelo LaunchAgent
- `claudecode-service.sh` — gerencia o LaunchAgent
- `prod-*.log` — logs do ambiente de produção

---

Última atualização: 09/08/2025
Versão: 2.0.0
Autor: Claude Code Assistant