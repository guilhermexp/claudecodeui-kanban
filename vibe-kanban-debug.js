import { chromium } from 'playwright';

async function debugVibeKanban() {
    console.log('🔍 Depurando aplicação VibeKanban...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000 
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Capturar logs do console
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        console.log(`📝 Console [${type}]: ${text}`);
    });
    
    page.on('pageerror', error => {
        console.log(`❌ Page Error: ${error.message}`);
    });
    
    try {
        console.log('📍 Navegando para http://localhost:9000/vibe-kanban');
        await page.goto('http://localhost:9000/vibe-kanban', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Aguardar carregamento
        await page.waitForTimeout(3000);
        
        console.log('🔍 Analisando estrutura da página...');
        
        // Capturar screenshot para análise
        await page.screenshot({ path: 'debug-page.png', fullPage: true });
        console.log('📸 Screenshot capturado: debug-page.png');
        
        // Verificar o HTML do body
        const bodyHTML = await page.evaluate(() => document.body.innerHTML);
        console.log('📄 HTML do body:');
        console.log(bodyHTML.substring(0, 1000) + '...');
        
        // Verificar todos os elementos visíveis
        const allElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            const visibleElements = [];
            
            for (let el of elements) {
                if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                    visibleElements.push({
                        tag: el.tagName,
                        className: el.className,
                        id: el.id,
                        textContent: el.textContent?.substring(0, 100)
                    });
                }
            }
            
            return visibleElements.slice(0, 20); // Primeiros 20 elementos
        });
        
        console.log('\n🎯 Elementos visíveis na página:');
        allElements.forEach((el, index) => {
            console.log(`${index + 1}. ${el.tag} - class: "${el.className}" - id: "${el.id}" - text: "${el.textContent}"`);
        });
        
        // Verificar se existe algum botão ou link clicável
        const clickableElements = await page.$$('button, a, [onclick], [role="button"]');
        console.log(`\n🖱️ Elementos clicáveis encontrados: ${clickableElements.length}`);
        
        for (let i = 0; i < Math.min(clickableElements.length, 5); i++) {
            const element = clickableElements[i];
            const text = await element.textContent();
            const className = await element.getAttribute('class');
            console.log(`${i + 1}. Texto: "${text}" - Classe: "${className}"`);
        }
        
        // Aguardar mais tempo para ver se algo carrega
        console.log('\n⏳ Aguardando mais carregamento...');
        await page.waitForTimeout(5000);
        
        // Verificar novamente
        const newElements = await page.$$('button, a, [onclick], [role="button"], .card, .item, .component');
        console.log(`🔄 Elementos após aguardar: ${newElements.length}`);
        
        // Screenshot final
        await page.screenshot({ path: 'debug-final.png', fullPage: true });
        console.log('📸 Screenshot final: debug-final.png');
        
    } catch (error) {
        console.log(`❌ Erro: ${error.message}`);
        await page.screenshot({ path: 'debug-error.png', fullPage: true });
    }
    
    await browser.close();
}

debugVibeKanban().catch(console.error);