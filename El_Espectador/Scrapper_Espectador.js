const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const mainPage = await browser.newPage();

    const baseUrl = 'https://www.elespectador.com/archivo/politica/';
    let currentPage = 1;
    const maxPages = 10; // Número máximo de páginas a recorrer
    const links = [];

    while (currentPage <= maxPages) {
      const pageUrl = `${baseUrl}${currentPage}`;
      console.log(`Navegando a: ${pageUrl}`);
      await mainPage.goto(pageUrl, { waitUntil: 'networkidle2' });

      // Extraer enlaces de los artículos en la página actual
      const newLinks = await mainPage.evaluate(() => {
        return Array.from(document.querySelectorAll('h2 a'))
          .map(anchor => anchor.href);
      });

      console.log(`Se han recopilado ${newLinks.length} enlaces en la página ${currentPage}.`);
      links.push(...newLinks);

      currentPage++;
    }

    // Guardar los enlaces en un archivo JSON
    fs.writeFileSync('./Espectador_Politica_Links.json', JSON.stringify(links, null, 2), 'utf8');
    console.log("Enlaces guardados en Espectador_Politica_Links.json");

    await mainPage.close();

    // Extraer contenido de cada enlace
    const articlesData = [];
    const articlePage = await browser.newPage();

    for (const link of links) {
      console.log(`Procesando: ${link}`);

      await articlePage.goto(link, { waitUntil: 'networkidle2' });

      try {
        // Esperar a que los párrafos con la clase 'font--secondary' estén presentes
        await articlePage.waitForSelector('p.font--secondary', { timeout: 10000 });

        // Extraer todos los párrafos de la noticia
        const paragraphs = await articlePage.evaluate(() => {
          return Array.from(document.querySelectorAll('p.font--secondary'))
            .map(p => p.innerText.trim());
        });

        if (paragraphs.length === 0) {
          console.warn(`Advertencia: No se encontraron párrafos en ${link}`);
        }

        articlesData.push({
          link: link,
          content: paragraphs
        });
      } catch (err) {
        console.error(`Error al procesar ${link}:`, err);
      }
    }

    // Guardar el contenido de los artículos en un archivo JSON
    fs.writeFileSync('./Espectador_Politica_Articulos.json', JSON.stringify(articlesData, null, 2), 'utf8');
    console.log("Contenido de los artículos guardado en Espectador_Politica_Articulos.json");

    await articlePage.close();
    await browser.close();
  } catch (err) {
    console.error('Error en el proceso:', err);
  }
})();