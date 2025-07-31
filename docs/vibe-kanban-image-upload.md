# Vibe Kanban - Upload de Imagens

## Funcionalidade Implementada

O Vibe Kanban agora suporta upload de imagens nas tarefas. As imagens são automaticamente convertidas em URLs temporárias e incluídas na descrição da tarefa.

## Como Usar

### 1. Arrastar e Soltar (Drag & Drop)
- Arraste imagens diretamente para a área de texto
- A área ficará destacada quando você estiver arrastando uma imagem

### 2. Colar (Paste)
- Use Ctrl+V (ou Cmd+V no Mac) para colar imagens da área de transferência
- Funciona com screenshots e imagens copiadas

### 3. Botão de Upload
- Clique no botão de clipe (📎) para selecionar imagens do seu computador
- Suporta seleção múltipla

## Limitações

- **Máximo de 5 imagens por tarefa**
- **Tamanho máximo: 10MB por imagem**
- **Formatos suportados**: PNG, JPG, JPEG, GIF, WebP, SVG
- **Imagens temporárias**: As URLs são válidas por 1 hora

## Como funciona com o Claude CLI

As imagens são enviadas para o Claude CLI como URLs em formato markdown. O Claude consegue processar e analisar essas imagens normalmente através das URLs fornecidas.

## Formato na Descrição

As imagens são adicionadas ao final da descrição da tarefa no formato:

```markdown
Sua descrição aqui...

Imagens anexadas:
![Imagem 1](http://localhost:8080/api/vibe-kanban/images/image-123456-abc123)
![Imagem 2](http://localhost:8080/api/vibe-kanban/images/image-123456-def456)
```

