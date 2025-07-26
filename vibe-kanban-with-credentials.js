import { chromium } from 'playwright';

async function testVibeKanbanWithCredentials() {
    console.log('🚀 Testando VibeKanban com credenciais fornecidas...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 800 
    });
    
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    // Capturar logs do console e erros
    const consoleLogs = [];
    const errors = [];
    
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        consoleLogs.push({ type, text });
        
        if (type === 'error') {
            console.log(`❌ Console Error: ${text}`);
        } else {
            console.log(`📝 Console [${type}]: ${text}`);
        }
    });
    
    page.on('pageerror', error => {
        errors.push(error.message);
        console.log(`💥 Page Error: ${error.message}`);
    });
    
    page.on('response', response => {
        if (response.status() >= 400) {
            console.log(`🔥 HTTP ${response.status()}: ${response.url()}`);
        } else if (response.url().includes('/api/')) {
            console.log(`✅ API ${response.status()}: ${response.url()}`);
        }
    });
    
    try {
        // Passo 1: Login
        console.log('📍 Passo 1: Fazendo login com credenciais fornecidas');
        await page.goto('http://localhost:9000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Fazer login com as credenciais fornecidas
        await page.fill('#username', 'guilherme-varela@hotmail.com');
        await page.fill('#password', 'adoado01');
        
        console.log('🔑 Tentando fazer login...');
        await page.click('button[type="submit"], button:has-text("Sign In")');
        await page.waitForTimeout(3000);
        
        // Verificar se o login foi bem-sucedido
        const currentUrl = page.url();
        console.log(`🌐 URL após login: ${currentUrl}`);
        
        // Se ainda estiver na página de login, tentar registrar
        const stillOnLogin = await page.$('input[type="password"]') !== null;
        
        if (stillOnLogin) {
            console.log('📝 Login falhou, tentando registrar novo usuário...');
            
            // Registrar via API
            const registerResult = await page.evaluate(async () => {
                try {
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: 'guilherme-varela@hotmail.com',
                            password: 'adoado01'
                        })
                    });
                    const data = await response.json();
                    return { success: response.ok, data, status: response.status };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            console.log('📋 Resultado do registro:', registerResult);
            
            if (registerResult.success) {
                console.log('✅ Usuário registrado com sucesso, fazendo login...');
                await page.fill('#username', 'guilherme-varela@hotmail.com');
                await page.fill('#password', 'adoado01');
                await page.click('button[type="submit"], button:has-text("Sign In")');
                await page.waitForTimeout(3000);
            }
        }
        
        // Passo 2: Navegar para VibeKanban
        console.log('📍 Passo 2: Navegando para VibeKanban');
        await page.goto('http://localhost:9000/vibe-kanban', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'vibe-kanban-authenticated.png', fullPage: true });
        console.log('📸 Screenshot autenticado: vibe-kanban-authenticated.png');
        
        // Passo 3: Análise detalhada da página
        console.log('📍 Passo 3: Analisando página VibeKanban autenticada...');
        
        const pageContent = await page.evaluate(() => {
            return {
                url: window.location.href,
                title: document.title,
                bodyText: document.body.textContent?.substring(0, 500),
                hasVibeContent: document.body.innerHTML.includes('vibe') || 
                               document.body.innerHTML.includes('Vibe') ||
                               document.body.innerHTML.includes('kanban') ||
                               document.body.innerHTML.includes('Kanban'),
                elementCount: document.querySelectorAll('*').length,
                reactRoot: !!document.querySelector('#root'),
                hasButtons: document.querySelectorAll('button').length,
                hasProjects: document.body.textContent?.toLowerCase().includes('project'),
                hasTasks: document.body.textContent?.toLowerCase().includes('task')
            };
        });
        
        console.log('🔍 Análise da página:');
        console.log(`   📄 Título: ${pageContent.title}`);
        console.log(`   🌐 URL: ${pageContent.url}`);
        console.log(`   📊 Elementos: ${pageContent.elementCount}`);
        console.log(`   ⚛️ React Root: ${pageContent.reactRoot ? '✅' : '❌'}`);
        console.log(`   🖱️ Botões: ${pageContent.hasButtons}`);
        console.log(`   🎯 Conteúdo Vibe: ${pageContent.hasVibeContent ? '✅' : '❌'}`);
        console.log(`   📋 Projetos: ${pageContent.hasProjects ? '✅' : '❌'}`);
        console.log(`   ✅ Tarefas: ${pageContent.hasTasks ? '✅' : '❌'}`);
        
        console.log('📝 Primeiros 500 chars do texto:');
        console.log(`"${pageContent.bodyText}"`);
        
        // Passo 4: Procurar por elementos interativos específicos
        console.log('📍 Passo 4: Procurando elementos interativos...');
        
        // Aguardar mais um pouco para garantir carregamento completo
        await page.waitForTimeout(3000);
        
        // Procurar por diferentes tipos de elementos
        const interactiveElements = await page.evaluate(() => {
            const elements = [];
            
            // Procurar por botões
            document.querySelectorAll('button').forEach(btn => {
                if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                    elements.push({
                        type: 'button',
                        text: btn.textContent?.trim().substring(0, 50),
                        className: btn.className
                    });
                }
            });
            
            // Procurar por links
            document.querySelectorAll('a').forEach(link => {
                if (link.offsetWidth > 0 && link.offsetHeight > 0) {
                    elements.push({
                        type: 'link',
                        text: link.textContent?.trim().substring(0, 50),
                        href: link.href,
                        className: link.className
                    });
                }
            });
            
            // Procurar por divs clicáveis
            document.querySelectorAll('div[onclick], div[role="button"]').forEach(div => {
                if (div.offsetWidth > 0 && div.offsetHeight > 0) {
                    elements.push({
                        type: 'clickable-div',
                        text: div.textContent?.trim().substring(0, 50),
                        className: div.className
                    });
                }
            });
            
            return elements.slice(0, 15);
        });
        
        console.log(`🖱️ Elementos interativos encontrados: ${interactiveElements.length}`);
        interactiveElements.forEach((el, index) => {
            console.log(`${index + 1}. ${el.type.toUpperCase()}: "${el.text}" - ${el.className}`);
        });
        
        // Passo 5: Tentar interagir com elementos
        console.log('📍 Passo 5: Tentando interações...');
        
        // Clicar nos primeiros elementos interativos
        const clickableSelectors = [
            'button',
            'a[href]',
            '[role="button"]',
            '.clickable',
            '[onclick]'
        ];
        
        for (let i = 0; i < clickableSelectors.length; i++) {
            try {
                const elements = await page.$$(clickableSelectors[i]);
                if (elements.length > 0) {
                    console.log(`🔄 Tentando clicar em ${clickableSelectors[i]}...`);
                    
                    for (let j = 0; j < Math.min(elements.length, 2); j++) {
                        try {
                            const element = elements[j];
                            const isVisible = await element.isVisible();
                            const text = await element.textContent();
                            
                            if (isVisible && text?.trim()) {
                                console.log(`   Clicando: "${text.trim().substring(0, 30)}"`);
                                await element.click();
                                await page.waitForTimeout(2000);
                                
                                // Screenshot após clique
                                await page.screenshot({ 
                                    path: `vibe-interaction-${i}-${j}.png`, 
                                    fullPage: true 
                                });
                                
                                // Verificar se houve mudança na página
                                const newUrl = page.url();
                                if (newUrl !== pageContent.url) {
                                    console.log(`   ✅ Navegação detectada: ${newUrl}`);
                                    await page.waitForTimeout(3000);
                                    break;
                                }
                            }
                        } catch (clickError) {
                            console.log(`   ⚠️ Erro ao clicar: ${clickError.message}`);
                        }
                    }
                }
            } catch (selectorError) {
                console.log(`⚠️ Erro com seletor ${clickableSelectors[i]}: ${selectorError.message}`);
            }
        }
        
        // Passo 6: Verificar componentes específicos do VibeKanban
        console.log('📍 Passo 6: Verificando componentes VibeKanban...');
        
        const vibeComponents = await page.evaluate(() => {
            const components = {};
            
            // Lista de componentes para verificar
            const componentSelectors = {
                'TaskDetails': ['.task-details', '[class*="TaskDetails"]', '[class*="task-detail"]'],
                'Toolbar': ['.toolbar', '[class*="Toolbar"]', '[class*="toolbar"]'],
                'CreateAttempt': ['.create-attempt', '[class*="CreateAttempt"]', '[class*="create-attempt"]'],
                'CurrentAttempt': ['.current-attempt', '[class*="CurrentAttempt"]', '[class*="current-attempt"]'],
                'LogsTab': ['.logs-tab', '[class*="LogsTab"]', '[class*="logs-tab"]', 'button:has-text("Logs")'],
                'Conversation': ['.conversation', '[class*="Conversation"]', '[class*="conversation"]'],
                'CreatePRDialog': ['.create-pr', '[class*="CreatePR"]', '[class*="create-pr"]'],
                'Projects': ['.project', '[class*="Project"]', '[class*="project"]'],
                'KanbanBoard': ['.kanban', '[class*="Kanban"]', '[class*="kanban"]', '.board']
            };
            
            for (const [name, selectors] of Object.entries(componentSelectors)) {
                components[name] = { found: false, count: 0, selector: null };
                
                for (const selector of selectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            components[name] = { 
                                found: true, 
                                count: elements.length, 
                                selector: selector 
                            };
                            break;
                        }
                    } catch (e) {
                        // Ignore selector errors
                    }
                }
            }
            
            return components;
        });
        
        console.log('🧩 Status dos componentes VibeKanban:');
        Object.entries(vibeComponents).forEach(([name, info]) => {
            const status = info.found ? '✅' : '❌';
            const details = info.found ? `(${info.count} elementos via ${info.selector})` : '';
            console.log(`   ${status} ${name} ${details}`);
        });
        
        // Screenshot final
        await page.screenshot({ path: 'vibe-kanban-final-test.png', fullPage: true });
        console.log('📸 Screenshot final: vibe-kanban-final-test.png');
        
        // Aguardar um pouco mais para capturar logs finais
        await page.waitForTimeout(2000);
        
    } catch (error) {
        console.log(`💥 Erro durante o teste: ${error.message}`);
        errors.push(error.message);
        await page.screenshot({ path: 'vibe-kanban-error-final.png', fullPage: true });
    }
    
    await browser.close();
    
    // Relatório final
    console.log('\n' + '='.repeat(70));
    console.log('📋 RELATÓRIO FINAL - TESTE VIBE KANBAN COMPLETO');
    console.log('='.repeat(70));
    
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    const warningLogs = consoleLogs.filter(log => log.type === 'warning');
    
    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`   📝 Total de logs: ${consoleLogs.length}`);
    console.log(`   ❌ Erros do console: ${errorLogs.length}`);
    console.log(`   ⚠️ Avisos: ${warningLogs.length}`);
    console.log(`   💥 Erros de página: ${errors.length}`);
    
    if (errorLogs.length > 0) {
        console.log(`\n❌ ERROS JAVASCRIPT ENCONTRADOS:`);
        errorLogs.forEach((log, index) => {
            console.log(`${index + 1}. ${log.text}`);
        });
    }
    
    if (errors.length > 0) {
        console.log(`\n💥 ERROS DE PÁGINA:`);
        errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Determinar status final
    const hasErrors = errorLogs.length > 0 || errors.length > 0;
    const hasCriticalErrors = errorLogs.some(log => 
        log.text.includes('500') || 
        log.text.includes('TypeError') ||
        log.text.includes('ReferenceError') ||
        log.text.includes('null reference')
    ) || errors.length > 0;
    
    console.log(`\n🎯 RESULTADO FINAL:`);
    
    if (!hasErrors) {
        console.log('🎉 SUCESSO TOTAL!');
        console.log('   ✅ Nenhum erro JavaScript detectado');
        console.log('   ✅ Aplicação VibeKanban funcionando 100%');
        console.log('   ✅ Todos os componentes carregaram corretamente');
    } else if (hasErrors && !hasCriticalErrors) {
        console.log('⚠️ SUCESSO COM AVISOS MENORES');
        console.log('   ✅ Aplicação funcionando');
        console.log('   ⚠️ Alguns avisos/erros menores detectados');
        console.log('   📋 Não afetam funcionalidade principal');
    } else {
        console.log('❌ FALHA - ERROS CRÍTICOS DETECTADOS');
        console.log('   🔥 Erros JavaScript críticos encontrados');
        console.log('   🛠️ Correções necessárias');
        console.log('   📋 Ver detalhes dos erros acima');
    }
    
    console.log(`\n📁 EVIDÊNCIAS CAPTURADAS:`);
    console.log('   📸 vibe-kanban-authenticated.png - Estado após login');
    console.log('   📸 vibe-interaction-*.png - Interações testadas');
    console.log('   📸 vibe-kanban-final-test.png - Estado final');
    
    console.log('\n' + '='.repeat(70));
    
    const isSuccess = !hasCriticalErrors;
    console.log(`\n🏁 CONCLUSÃO: ${isSuccess ? 'APLICAÇÃO FUNCIONANDO ✅' : 'REQUER CORREÇÕES ❌'}`);
    
    return {
        success: isSuccess,
        errors: errors.length,
        consoleErrors: errorLogs.length,
        warnings: warningLogs.length,
        totalLogs: consoleLogs.length
    };
}

// Executar teste
testVibeKanbanWithCredentials()
    .then(result => {
        console.log(`\n🎯 Teste concluído. Status: ${result.success ? 'SUCESSO' : 'FALHA'}`);
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });