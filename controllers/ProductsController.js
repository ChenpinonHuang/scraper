const Product = require('../models/product');

const puppeteer = require('puppeteer');

const sleep = async time =>  new Promise(resolve => setTimeout(resolve, time * 1000));

exports.index = async (req, res) => {
  //get the product we find
  const products = await Product.find();
  
  res.render('products/index', {
    pageTitle: 'Canadiantire Products',
    products
  });
};

exports.update = async (req, res) => {
  const url = 'https://www.canadiantire.ca/en/kitchen/cookware.html';
  const products = await scrapeIt(url);

  console.log(products);

  
  for (let product of products) {
    if (product.productName === "" || product.title === null || product.price === "") continue;
    await Product.updateOne({productID: product.productID}, product, {upsert: true});
  }

  res.redirect('/products');
};

async function scrapeIt (url) {
  // Create a new browser instance
  const browser = await puppeteer.launch({headless: false});

  // Close the location request
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, ['geolocation']);//block the geolocation tag pop up

  // Create a new page context
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080
  });

  // Pass our sleep function
  await page.exposeFunction('sleep', sleep);

  // Close any prompts/alerts/confirms
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });

  // Expose the console
  page.on('console', msg => console.log(msg._text));

  // Navigate to the URL
  await page.goto(url);
  await sleep(2); // wait 2 second
  await page.screenshot({path: 'screenshots/example.png'});
  
  await page.evaluate(async () => {
    window.scrollBy(0, document.body.scrollHeight); // sreoll down the page to scrape the page
    await sleep(2);
  });
  await page.waitForSelector(`[class^="search-results-grid"]`, {visible: true, timeout: 120}); // timeout 120 seconds, this is optional

  // Run some JavaScript on the page
  const content = await page.evaluate(async () => {
    try{
        const productScrape = document.querySelectorAll('.temporary-grid-item');
        const products = [];

        for (let product of productScrape) {
        //deal with the lazy-load
        if (!product.querySelector('product-tile-srp__image')) {
            product.scrollIntoView();
            await sleep(2);
        }
        // Get the productID
        const productID = product.querySelector(`a[itemprop="data-anchor"]`);     
        //get product name
        const productName = product.querySelector(`[class^="product-tile-srp__middle-content"]`).textContent;
        //get the price
        const price = product.querySelector(`price__total-value price__total--on-sale`).content;
        //get the image
        const image = product.querySelector('img');
        let src = null;
        if (image) src = image.src;

        products.push({productID, productName, price, image: src});
        }
    }catch(e){
        console.log(e) 
    }
    

    return products;
  });

  //console.log("close window")
  // Close our browser
  await browser.close();
  return content;
}