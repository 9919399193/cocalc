// front end test of CoCalc in puppeteer
// usage:
//   npm run test -- [-s] [-c credentials-file]
// or
//   node index.js [-s] [-c credentials-file]
// -s - display the browser window (opposite of headless), default false
// -c - name of credentials file, without ".js" extension
//
// example invocations
//   npm run test -- -s  // run the test with 'creds.js', not headless
//   node index.js creds-cocalc // run test headless with 'creds-cocalc.js' credentials file
//
// example credentials file "creds.js"
//
// module.exports = {
//     url: 'https://cocalcinstance.com/app',
//     username: 'testuser@example.com',
//     password: 'asdf8qwerty',
//     project:  'my-test',
//     texfile:  'latex-fu.tex'
// }

// to do:
// ✓ command line options for test creds, non-headless operation
// ✓ run in more environments
//   ✓ client laptop as well as cc project
//   ✓ target UW and pixelbook as well as cocalc.com & test.cocalc.com
// - add test for jupyter widgets
// - wrap in jest
// - add test to get api key
// - write in typescript
// - host on gce
// - deal gracefully with test project that is stopped/archived

// what it does:
// - sign into instance with email and password
// - open test project
// - open test .tex file
// - check that word count button in upper left frame works
// - logs each step that passes to js console

// works with:
// - cocalc.com
// - test.cocalc.com
// - docker containers
//   - UW regular cocalc
//   - UW no-agpl cocalc
//   - pixelbook cocalc†
//   - pixelbook no-agpl cocalc†
// † - TO DO

const HEADLESS = true;

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const program = require('commander');
program.version('0.1.0');


const sprintf = require('sprintf-js').sprintf;

async function run() {
  try {

    program
      .option('-s, --screen', 'opposite of headless')
      .option('-c, --creds <file>', 'credentials file', "./creds")


    program.parse(process.argv);

    headless = !(program.screen);
    console.log('headless',headless);

    creds = program.creds;
    if (!creds.includes("/")) {creds = "./" + creds;}
    console.log('creds file:', creds);

    //throw new Error("early exit");

    let browser;
    if (headless) {
      browser = await puppeteer.launch({
      ignoreHTTPSErrors:true,
      })
    } else {
      browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors:true,
        sloMo:200
      })
    }

    const CREDS = require(creds);

    //const context = await browser.createIncognitoBrowserContext();
    //const page = await context.newPage();
    const page = (await browser.pages())[0];
    // await page.setViewport({ width: 1024, height: 768});
    // await page.waitFor(2 * 1000);

    // sign in
    await page.goto(CREDS.url);
    console.log('got sign-in page', CREDS.url);

    let sel = '*[cocalc-test="sign-in-email"]';
    await page.click(sel);
    await page.keyboard.type(CREDS.username);
    console.log('entered email address');

    sel = '*[cocalc-test="sign-in-password"]';
    await page.click(sel);
    await page.keyboard.type(CREDS.password);
    console.log('entered password');

    sel = '*[cocalc-test="sign-in-submit"]';
    await page.click(sel);
    console.log('clicked submit');

    sel = '*[cocalc-test="project-button"]';
    await page.waitForSelector(sel, 60000);
    await page.click(sel);
    console.log('clicked project button');

    // type into the project search blank
    sel = '*[cocalc-test="search-input"][placeholder="Search for projects..."]';
    await page.waitForSelector(sel);
    await page.type(sel, CREDS.project);
    console.log('entered test project name');

    // find the project link and click it
    // XXX if multiple projects match the test project name, choose the first one
    sel = '*[cocalc-test="project-line"]';
    await page.click(sel);
    console.log('clicked test project line');

    let xpt = '//button[text()="Check All"]';
    await page.waitForXPath(xpt);
    console.log('got check all');

    // click the Files button
    sel = '*[cocalc-test="Files"]';
    await page.click(sel);
    console.log('clicked Files');

    sel = '*[cocalc-test="search-input"][placeholder="Search or create file"]';
    await page.click(sel);
    await page.type(sel, CREDS.texfile);
    console.log('entered texfile name into file search');

    // find and click the texfile link
    sel = '*[cocalc-test="file-line"]';
    await page.click(sel);
    console.log('clicked file line');

    sel = '*[cocalc-test="latex-dropdown"]';
    await page.waitForSelector(sel);
    await page.click(sel);
    console.log('clicked latex dropdown');

    sel = '*[cocalc-test="word_count"]';
    await page.click(sel);
    console.log('clicked word count');

    xpt = '//div[contains(text(), "Encoding: ascii")]';
    await page.waitForXPath(xpt);
    console.log('got encoding ascii');

    sel = '*[cocalc-test="word-count-output"]';
    const elt = await page.waitForSelector(sel);
    console.log('got word count output');

    text = await page.$eval(sel, e => e.innerText);
    console.log('word count output:\n'+ chalk.cyan(text));

    sel = '*[cocalc-test="latex-dropdown"]';
    await page.waitForSelector(sel);
    await page.click(sel);
    console.log('clicked latex dropdown again');

    sel = '*[cocalc-test="cm"]';
    await page.click(sel);
    console.log('clicked source code');

    sel = '*[title="Build project"]';
    await page.waitForSelector(sel);
    console.log('got build button');

    const spath = 'cocalc.png';
    await page.screenshot({ path: spath});
    console.log(`screenshot saved to ${spath}`);

    console.log('all tests ok - closing browser');
    browser.close();

  } catch (e) {
    console.log(chalk.red(`ERROR: ${e.message}`));
    process.exit()
  }
}

run();

