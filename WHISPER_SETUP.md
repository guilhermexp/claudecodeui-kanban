# Configuração do Whisper (Voice to Text)

## Visão Geral
O botão de voz no terminal permite transcrever comandos falados diretamente para texto usando a API Whisper da OpenAI.

## Requisitos

### 1. Chave da API OpenAI
Você precisa configurar a variável de ambiente `OPENAI_API_KEY` no servidor:

```bash
export OPENAI_API_KEY="sua-chave-api-aqui"
```

### 2. HTTPS ou Localhost
Por questões de segurança do navegador, o acesso ao microfone só funciona em:
- Conexões HTTPS
- Localhost (desenvolvimento local)

## Como Usar

### No Terminal
1. Conecte-se ao terminal (botão "Continue in Shell")
2. Clique no botão flutuante azul/roxo no canto inferior direito
3. Permita o acesso ao microfone quando solicitado
4. Fale seu comando
5. O texto será transcrito e enviado ao terminal

### Estados do Botão
- **Azul com pulso**: Pronto para gravar
- **Vermelho**: Gravando áudio
- **Animação de loading**: Transcrevendo
- **Verde**: Processando com GPT (se modo avançado ativado)

## Modos de Transcrição

O sistema suporta diferentes modos configuráveis em Settings:

### 1. Default (Padrão)
- Transcrição direta sem processamento adicional
- Mais rápido e econômico

### 2. Prompt Mode
- Melhora o texto para comandos mais claros
- Útil para instruções complexas

### 3. Vibe/Instructions/Architect Mode
- Formata ideias em instruções estruturadas
- Ideal para comandos de desenvolvimento

## Solução de Problemas

### "Microphone not supported"
- Verifique se está usando HTTPS ou localhost
- Use um navegador moderno (Chrome, Firefox, Safari, Edge)

### "OpenAI API key not configured"
- Configure a variável `OPENAI_API_KEY` no servidor
- Reinicie o servidor após configurar

### Sem resposta após falar
- Verifique se o microfone está funcionando
- Confirme que falou alto e claro
- Verifique os logs do servidor para erros

## Endpoint da API

O endpoint está em: `POST /api/transcribe`

Aceita:
- `audio`: Arquivo de áudio (webm, mp3, wav, etc)
- `mode`: Modo de processamento (default, prompt, vibe, instructions, architect)

Retorna:
```json
{
  "text": "texto transcrito"
}
```