# 🌐 Acesso Remoto - Claude Code UI

## Como Usar

### 1. Iniciar o Sistema
```bash
./iniciar.sh
```

### 2. Pegar sua URL Fixa
Quando o ngrok iniciar, procure por:
```
Forwarding: https://[seu-codigo].ngrok-free.app -> http://localhost:9000
```

**Esta URL é FIXA e sempre será a mesma para sua conta!**

### 3. Acessar de Qualquer Lugar
- Celular ✅
- Outro computador ✅
- Qualquer lugar com internet ✅

## Arquivos do Sistema

### Scripts Principais
- `iniciar.sh` - Script principal para iniciar tudo
- `run.sh` - Script base que o iniciar.sh chama
- `start.sh` - Script alternativo com mesma funcionalidade

### Configurações
- `ngrok.yml` - Configuração do ngrok (se necessário)
- `vite.config.js` - Configuração do Vite com proxy correto

## Requisitos

1. Seu Mac precisa estar:
   - Ligado
   - Com o script rodando
   - Conectado à internet

2. Para deixar rodando o dia todo:
   - Deixe o Terminal aberto
   - Configure o Mac para não dormir

## Solução de Problemas

### Terminal não abre?
- Mude para outro projeto
- Crie um novo projeto

### Erro de conexão?
- Verifique se o servidor está rodando
- Reinicie com `./iniciar.sh`

---
Última atualização: $(date)
