const puppeteer = require('puppeteer');
const fs = require('fs');

const LOGIN_URL = 'https://www.eltiempo.com/login';
const LINKS_FILE = './Noticias_LinksCongreso.json'; // Archivo JSON con los enlaces
const OUTPUT_FILE = './Noticias_ScrapeadasCongresoElTiempo.json';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: false }); // Mantener visible para iniciar sesión manualmente
    const page = await browser.newPage();

    // 🟢 Ir a la página de login
    console.log("🔹 Abriendo página de inicio de sesión...");
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

    // ⏳ Esperar 1 minuto para que el usuario inicie sesión manualmente
    console.log("⏳ Esperando 1 minuto para que inicies sesión manualmente...");
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 📂 Cargar enlaces desde el archivo JSON
    if (!fs.existsSync(LINKS_FILE)) {
      console.error("🚨 No se encontró el archivo de enlaces.");
      await browser.close();
      return;
    }

    const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));

    console.log(`📌 Se encontraron ${links.length} enlaces. Iniciando scraping...`);

    // 🟢 Extraer contenido de cada noticia
    const articlesData = [];
    const articlePage = await browser.newPage();

    for (const link of links) {
      console.log(`🔹 Procesando: ${link}`);

      await articlePage.goto(link, { waitUntil: 'networkidle2' });

      // 🔄 Hacer scroll para cargar contenido si hay carga diferida (lazy loading)
      for (let i = 0; i < 3; i++) {
        await articlePage.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      try {
        await articlePage.waitForSelector('div.paragraph', { timeout: 10000 });

        // 🔍 Extraer todos los párrafos de la noticia
        const paragraphs = await articlePage.evaluate(() => {
          return Array.from(document.querySelectorAll('div.paragraph'))
            .filter(div => !div.querySelector('a'))
            .map(div => div.innerText.trim());
        });

        if (paragraphs.length === 0) {
          console.warn(`⚠️ Advertencia: No se encontraron párrafos en ${link}`);
        }

        articlesData.push({
          link: link,
          content: paragraphs
        });
      } catch (err) {
        console.error(`❌ Error al procesar ${link}:`, err);
      }
    }

    // 🟢 Guardar los datos en un archivo JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articlesData, null, 2), 'utf8');
    console.log(`✅ Archivo JSON guardado exitosamente en ${OUTPUT_FILE}`);

    await articlePage.close();
    await browser.close();
  } catch (error) {
    console.error("🚨 Ocurrió un error:", error);
  }
})();
