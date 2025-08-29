# Teste do Seletor de Elementos - Instruções

## Como testar:

1. **Abra o CodeUI** no navegador: http://localhost:5892

2. **Abra o Preview Panel** (clique no ícone de preview no terminal)

3. **Digite a URL de teste** no campo de URL quando pausado:
   ```
   http://localhost:5892/test-selector.html
   ```

4. **Clique em Play** para carregar a página

5. **Clique no botão de seleção de elementos** (ícone de cursor/seta)

6. **Observe no console do navegador** (F12):
   - Deve aparecer: "🎯 Element selection button clicked!"
   - Deve aparecer: "🔄 Reloading iframe to apply sandbox changes..."
   - Deve aparecer: "🎯 Injecting element selector script..."

7. **Passe o mouse sobre elementos** na página de teste:
   - Elementos devem ficar destacados em azul
   - Um tooltip deve aparecer mostrando o seletor

8. **Clique em qualquer elemento**:
   - O elemento selecionado deve aparecer em um painel na parte inferior
   - Opções para "Send to Chat" e "Copy HTML" devem estar disponíveis

## O que foi corrigido:

1. **Problema identificado**: O atributo `sandbox` no iframe estava bloqueando a injeção de scripts
2. **Solução**: Remover temporariamente o sandbox quando o modo de seleção está ativo
3. **Segurança**: O sandbox é reativado assim que o modo de seleção é desligado

## Logs esperados no console:

```
🎯 Element selection button clicked! Current state: false
🔍 Element selection mode changed to: true
🔄 Element selection useEffect triggered. Mode: true IFrame exists: true
🔄 Reloading iframe to apply sandbox changes...
🎯 Element selection activation attempt:
  - elementSelectionMode: true
  - iframeRef.current exists: true
  - iframe src: http://localhost:5892/test-selector.html
🎯 Injecting element selector script...
✅ Element selector script injected successfully! Click any element in the preview to select it.
```

## Se não funcionar:

1. Verifique se há erros no console
2. Certifique-se de que a URL está em localhost (não funciona com URLs externas)
3. Tente recarregar a página (F5) e repetir o processo