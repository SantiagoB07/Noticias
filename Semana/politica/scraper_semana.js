const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const mainPage = await browser.newPage();

    // 1. Ir a la página de noticias
    const mainUrl = 'https://www.semana.com/politica/';
    await mainPage.goto(mainUrl, { waitUntil: 'networkidle2' });

    await new Promise(resolve => setTimeout(resolve, 1000));

    let loadMoreButtonExists = true;
    let iteration = 0;
    const maxIterations = 30; // Límite de iteraciones para evitar bucles infinitos

    while (loadMoreButtonExists && iteration < maxIterations) {
      iteration++;
      
      try {
        await mainPage.click('.styles__DivVerMas-sc-o51gjq-2.EUsLC');
        console.log(`Iteración ${iteration}: Clic en el botón "Más contenido"`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar para cargar más noticias
      } catch (err) {
        console.log("No se encontró el botón 'Más contenido' o ya no está disponible.");
        loadMoreButtonExists = false;
      }
    }

    console.log("No hay más botones de carga. Se procederá a extraer los enlaces.");

    // 2. Extraer todos los enlaces de los artículos una vez cargadas todas las noticias
    const links = await mainPage.evaluate(() => {
      return Array.from(document.querySelectorAll("h2.card-title.h4 a"))
        .map(anchor => anchor.href);
    });

    console.log(`Se han recopilado un total de ${links.length} enlaces.`);

    // Guardar los enlaces en un archivo JSON
    fs.writeFileSync('./Noticias_Links.json', JSON.stringify(links, null, 2), 'utf8');
    console.log("Enlaces guardados en Noticias_Links.json");

    await mainPage.close();

    // 3. Extraer contenido de cada enlace
    const articlesData = [];
    const articlePage = await browser.newPage(); // Reutilizar la misma página para mejorar eficiencia

    for (let i = 0; i < links.length; i++) {
      console.log(`Procesando enlace ${i + 1} de ${links.length}`);
      const link = links[i];

      await articlePage.goto(link, { waitUntil: 'networkidle2' });

      try {
        await articlePage.waitForSelector('p[data-type="text"]', { timeout: 1000 });

        // Extraer todos los párrafos de la noticia
        const paragraphs = await articlePage.evaluate(() => {
          return Array.from(document.querySelectorAll('p[data-type="text"]'))
            .map(div => div.innerText.trim())
            .join(" "); // Une los párrafos con un espacio entre ellos
        });

        if (paragraphs.length === 0) {
          console.warn(`Advertencia: No se encontraron párrafos en el enlace ${i + 1}`);
        }

        articlesData.push({
          link: link,
          content: paragraphs
        });
      } catch (err) {
        console.error(`Error al procesar el enlace ${i + 1}:`, err);
      }
    }

    // Guardar el contenido en un archivo JSON
    fs.writeFileSync('./Noticias_Contenido.json', JSON.stringify(articlesData, null, 2), 'utf8');
    console.log("Contenido de las noticias guardado en Noticias_Contenido.json");

    await browser.close(); // Cerrar el navegador correctamente
  } catch (error) {
    console.error("Ocurrió un error general:", error);
  }
})();
