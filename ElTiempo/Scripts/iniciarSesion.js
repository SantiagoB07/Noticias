const puppeteer = require('puppeteer');
const fs = require('fs');

const LOGIN_URL = 'https://www.eltiempo.com/login';
const NEWS_URL = 'https://www.eltiempo.com/politica/proceso-de-paz';

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

    // 🔹 Cambiar a la página de noticias después de 1 minuto
    console.log("🔹 Redirigiendo a la página de noticias...");
    await page.goto(NEWS_URL, { waitUntil: 'networkidle2' });

    // ⏳ Pequeña espera antes de interactuar con la página
    await new Promise(resolve => setTimeout(resolve, 6000));

    let loadMoreButtonExists = true;
    let iteration = 0;
    const maxIterations = 20; // Límite para evitar bucles infinitos

    while (loadMoreButtonExists && iteration < maxIterations) {
      iteration++;

      loadMoreButtonExists = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("#load_more_button"));
        let clicked = false;

        buttons.forEach(button => {
          if (button.offsetParent !== null) { 
            button.click();
            clicked = true;
          }
        });

        return clicked;
      });

      console.log(`Iteración ${iteration}: Clic en "Cargar más"`);

      if (loadMoreButtonExists) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log("No hay más botones de carga. Se procederá a extraer los enlaces.");
      }
    }

    // 🟢 Extraer todos los enlaces de los artículos
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("h3.c-article__title a"))
        .map(anchor => anchor.href);
    });

    console.log(`Se han recopilado un total de ${links.length} enlaces.`);

    fs.writeFileSync('./Noticias_LinksCongreso.json', JSON.stringify(links, null, 2), 'utf8');
    console.log("Enlaces guardados en Noticias_LinksProcesoPaz.json");

    await page.close();

    // 🟢 Extraer contenido de cada noticia
    const articlesData = [];
    const articlePage = await browser.newPage();

    for (const link of links) {
      console.log(`Procesando: ${link}`);

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
    const outputFile = './Noticias_CompletasProcesoPazElTiempo.json';
    fs.writeFileSync(outputFile, JSON.stringify(articlesData, null, 2), 'utf8');
    console.log(`✅ Archivo JSON guardado exitosamente en ${outputFile}`);

    await articlePage.close();
    await browser.close();
  } catch (error) {
    console.error("🚨 Ocurrió un error:", error);
  }
})();