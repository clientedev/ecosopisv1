const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.ecosopis.com.br';
const OUTPUT_DIR = path.join(__dirname, 'screenshots_ecosopis');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const routes = [
  { name: '01_home', path: '/' },
  { name: '02_catalogo_produtos', path: '/produtos' },
  { name: '03_carrinho', path: '/carrinho' },
  { name: '04_atacado', path: '/atacado' },
  { name: '05_composicao_acafrao', path: '/composicao-acafrao' },
  { name: '06_sobre_nos', path: '/sobre' },
  { name: '07_sobre_materia_prima', path: '/sobre/materia-prima' },
  { name: '08_contato', path: '/contato' },
  { name: '09_faq', path: '/faq' },
  { name: '10_politica_envio', path: '/envio' },
  { name: '11_assistente_lia', path: '/lia' },
  { name: '12_novidades_blog', path: '/novidades' },
  { name: '13_quizz_interativo', path: '/quizz' },
  { name: '14_conta_login', path: '/conta' },
  { name: '15_recuperar_senha', path: '/recuperar-senha' },
  { name: '16_perfil_usuario', path: '/perfil' },
  { name: '17_checkout_pagamento', path: '/pagamento' },
  { name: '18_admin_login', path: '/admin' },
  { name: '19_admin_dashboard', path: '/admin/dashboard' },
  { name: '20_admin_pedidos', path: '/admin/pedidos' },
  { name: '21_admin_compras', path: '/admin/compras' },
  { name: '22_admin_whatsapp', path: '/admin/dashboard/whatsapp' },
  { name: '23_admin_temas', path: '/admin/temas' },
  { name: '24_admin_settings', path: '/admin/settings' },
  { name: '25_admin_bolao', path: '/admin/bolao' },
  { name: '26_admin_crm', path: '/admin/dashboard/crm' },
  { name: '27_admin_cupons', path: '/admin/dashboard/cupons' },
  { name: '28_admin_metricas', path: '/admin/dashboard/metrics' },
  { name: '29_admin_raspadinha', path: '/admin/dashboard/raspadinha' },
  { name: '30_admin_reviews', path: '/admin/dashboard/reviews' },
];

async function run() {
  console.log('Iniciando captura de screenshots com browser:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Tentar encontrar um produto real na página /produtos
  let sampleProductUrl = null;
  try {
    console.log('Descobrindo primeiro produto em /produtos...');
    await page.goto(`${BASE_URL}/produtos`, { waitUntil: 'networkidle2', timeout: 30000 });
    const productHref = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/produtos/"], a[href*="/produto/"]');
      return a ? a.getAttribute('href') : null;
    });
    if (productHref) {
      sampleProductUrl = productHref.startsWith('http') ? productHref : `${BASE_URL}${productHref}`;
      routes.push({ name: '31_detalhe_produto_exemplo', path: sampleProductUrl.replace(BASE_URL, '') });
    }
  } catch (err) {
    console.warn('Não foi possível capturar link dinâmico de produto:', err.message);
  }

  // Tentar encontrar uma notícia em /novidades
  try {
    console.log('Descobrindo notícia em /novidades...');
    await page.goto(`${BASE_URL}/novidades`, { waitUntil: 'networkidle2', timeout: 30000 });
    const newsHref = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/novidades/"]');
      return a ? a.getAttribute('href') : null;
    });
    if (newsHref) {
      const fullUrl = newsHref.startsWith('http') ? newsHref : `${BASE_URL}${newsHref}`;
      routes.push({ name: '32_detalhe_novidade_exemplo', path: fullUrl.replace(BASE_URL, '') });
    }
  } catch (err) {
    console.warn('Não foi possível capturar link dinâmico de novidade:', err.message);
  }

  for (const item of routes) {
    const targetUrl = item.path.startsWith('http') ? item.path : `${BASE_URL}${item.path}`;
    const screenshotPath = path.join(OUTPUT_DIR, `${item.name}.png`);
    console.log(`[${item.name}] Acessando: ${targetUrl}`);

    try {
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 25000
      });

      // Aguarda 1s para animações e imagens carregarem
      await new Promise(r => setTimeout(r, 1200));

      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      console.log(`  -> Salvo: ${item.name}.png`);
    } catch (error) {
      console.error(`  -> Erro ao acessar ${targetUrl}: ${error.message}`);
      try {
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`  -> Salvo fallback parcial: ${item.name}.png`);
      } catch (e2) {}
    }
  }

  await browser.close();
  console.log('Captura finalizada com sucesso!');
}

run().catch(console.error);
