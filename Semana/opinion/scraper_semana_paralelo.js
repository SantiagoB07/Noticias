const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const mainPage = await browser.newPage();

    // 1. Ir a la página de noticias
    const mainUrl = 'https://www.semana.com/opinion/';
    await mainPage.goto(mainUrl, { waitUntil: 'networkidle2' });

    await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3 segundos iniciales

    let loadMoreButtonExists = true;
    let iteration = 0;
    const maxIterations = 10; // Aumenté el límite de iteraciones para cargar más noticias

    while (loadMoreButtonExists && iteration < maxIterations) {
      iteration++;

      // Verificar si el botón "Más contenido" está visible
      const isButtonVisible = await mainPage.evaluate(() => {
        const button = document.querySelector('.styles__DivVerMas-sc-1mj7fj3-9.hKYFlJ');
        return button && button.offsetParent !== null; // Verifica si el botón es visible
      });

      if (isButtonVisible) {
        try {
          await mainPage.click('.styles__DivVerMas-sc-1mj7fj3-9.hKYFlJ');
          console.log(`Iteración ${iteration}: Clic en el botón "Más contenido"`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3 segundos para cargar más noticias
        } catch (err) {
          console.log("Error al hacer clic en el botón 'Más contenido':", err);
          loadMoreButtonExists = false;
        }
      } else {
        console.log("El botón 'Más contenido' ya no está visible.");
        loadMoreButtonExists = false;
      }
    }

    console.log("No hay más botones de carga. Se procederá a extraer los enlaces.");

    // 2. Extraer todos los enlaces de los artículos una vez cargadas todas las noticias
    const links = await mainPage.evaluate(() => {
      return Array.from(document.querySelectorAll(".styles__DivInformacion-sc-1mj7fj3-3.dzTong a"))
        .map(anchor => anchor.href);
    });

    console.log(`Se han recopilado un total de ${links.length} enlaces.`);

    // Guardar los enlaces en un archivo JSON
    fs.writeFileSync('./Noticias_Links.json', JSON.stringify(links, null, 2), 'utf8');
    console.log("Enlaces guardados en Noticias_Links.json");

    // 3. Extraer contenido de cada enlace en paralelo (con un límite de concurrencia)
    const articlesData = [];
    const maxConcurrentPages = 5; // Reduje el número de páginas abiertas en paralelo

    const processLink = async (link, index) => {
      const articlePage = await browser.newPage();
      console.log(`Procesando enlace ${index + 1} de ${links.length}`);

      try {
        await articlePage.goto(link, { waitUntil: 'networkidle2' });
        await articlePage.waitForSelector('p[data-type="text"]', { timeout: 5000 }); // Aumenté el timeout

        // Extraer todos los párrafos de la noticia
        const paragraphs = await articlePage.evaluate(() => {
          return Array.from(document.querySelectorAll('p[data-type="text"]'))
            .map(div => div.innerText.trim())
            .join(" "); // Une los párrafos con un espacio entre ellos
        });

        if (paragraphs.length === 0) {
          console.warn(`Advertencia: No se encontraron párrafos en el enlace ${index + 1}`);
        }

        articlesData.push({ link, content: paragraphs });
      } catch (err) {
        console.error(`Error al procesar el enlace ${index + 1}:`, err);
      } finally {
        await articlePage.close(); // Cerrar la pestaña después de procesar el enlace
      }
    };

    // Ejecutar las solicitudes en lotes de maxConcurrentPages
    for (let i = 0; i < links.length; i += maxConcurrentPages) {
      const batch = links.slice(i, i + maxConcurrentPages);
      await Promise.all(batch.map((link, index) => processLink(link, i + index)));
    }

    // Guardar el contenido en un archivo JSON
    fs.writeFileSync('./Noticias_Contenido.json', JSON.stringify(articlesData, null, 2), 'utf8');
    console.log("Contenido de las noticias guardado en Noticias_Contenido.json");

    await browser.close(); // Cerrar el navegador correctamente
  } catch (error) {
    console.error("Ocurrió un error general:", error);
  }
})();