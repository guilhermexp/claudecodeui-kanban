# Voice Transcription (Transcrição de Voz)

## Configuração

A funcionalidade de transcrição de voz usa a API Whisper da OpenAI para converter áudio em texto.

### Pré-requisitos

1. **Conta OpenAI**: Você precisa de uma conta na [OpenAI](https://platform.openai.com)
2. **API Key**: Gere uma API key no [dashboard da OpenAI](https://platform.openai.com/api-keys)
3. **Créditos**: Certifique-se de ter créditos na sua conta OpenAI

### Configuração da API Key

1. Copie sua API key da OpenAI
2. Adicione ao arquivo `.env`:

```env
OPENAI_API_KEY=sk-sua-api-key-aqui
```

3. Reinicie o servidor para aplicar as mudanças:
```bash
# Pare o servidor (Ctrl+C)
# Inicie novamente
npm run dev
```

## Como Usar

### No Mobile (Shell)

1. Abra a aba **Shell**
2. Conecte ao Claude CLI
3. Toque no botão de **microfone** 🎤 na barra inferior
4. Fale seu comando ou pergunta
5. Toque novamente para parar a gravação
6. O texto será transcrito e enviado ao terminal

### Botões Flutuantes (após transcrição)

Após a transcrição, aparecem 3 botões ao redor do microfone:
- **↵ Enter**: Envia o comando
- **⌫ Delete**: Apaga caracteres
- **⎋ Esc**: Cancela a operação

### No Desktop (Git Panel)

A mesma funcionalidade está disponível no painel Git para mensagens de commit.

## Solução de Problemas

### Erro: "OpenAI API key não configurada"

**Causa**: A variável de ambiente `OPENAI_API_KEY` não está definida.

**Solução**:
1. Verifique se adicionou a API key ao `.env`
2. Certifique-se de que o arquivo `.env` está na raiz do projeto
3. Reinicie o servidor após adicionar a API key

### Erro: "Microphone access denied"

**Causa**: O navegador não tem permissão para acessar o microfone.

**Solução**:
1. Permita o acesso ao microfone quando solicitado
2. Em iOS: Configurações > Safari > Microfone
3. Em Android: Configurações do site > Microfone
4. Use HTTPS ou localhost (requisito do navegador)

### Erro: "Microphone not supported"

**Causa**: Navegador não suporta API de microfone ou não está em HTTPS.

**Solução**:
1. Use um navegador moderno (Chrome, Safari, Firefox)
2. Acesse via HTTPS ou localhost
3. Para rede local, use o script `./start-network.sh`

## Custos

A API Whisper da OpenAI cobra por minuto de áudio:
- **Whisper**: $0.006 por minuto
- Transcrições curtas (< 30 segundos) são muito baratas
- Monitore seu uso no [dashboard da OpenAI](https://platform.openai.com/usage)

## Segurança

- A API key **nunca** é enviada ao frontend
- Todas as requisições passam pelo backend autenticado
- O áudio é processado e descartado após transcrição
- Use HTTPS em produção para proteger o áudio

## Recursos Avançados

### Modos de Transcrição

O sistema suporta diferentes modos configuráveis em Settings:
- **Default**: Transcrição simples
- **Prompt**: Otimizado para prompts de IA
- **Vibe**: Estilo conversacional
- **Instructions**: Formatado como instruções
- **Architect**: Linguagem técnica

### Idiomas Suportados

O Whisper detecta automaticamente o idioma. Suporta:
- Português, Inglês, Espanhol, Francês
- E mais de 50 outros idiomas
- Mistura de idiomas na mesma gravação