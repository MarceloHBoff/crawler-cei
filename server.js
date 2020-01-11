const puppeteer = require("puppeteer");
const C = require("./constants");
const cheerio = require("cheerio");

const USERNAME_SELECTOR = "#ctl00_ContentPlaceHolder1_txtLogin";
const PASSWORD_SELECTOR = "#ctl00_ContentPlaceHolder1_txtSenha";
const BROKER_SELECTOR = "#ctl00_ContentPlaceHolder1_ddlAgentes";
const COUNT_SELECTOR = "#ctl00_ContentPlaceHolder1_ddlContas";
const TITLE_TABLE_SELECTOR = "#ctl00_ContentPlaceHolder1_lblTituloTabela";
const TABLE_SELECTOR =
  "#ctl00_ContentPlaceHolder1_rptAgenteBolsa_ctl00_rptContaBolsa_ctl00_lblAgente";
const CTA_SELECTOR = "input[type=submit]";

const URL_Login = "https://cei.b3.com.br/CEI_Responsivo/login.aspx";
const URL_Negociation =
  "https://cei.b3.com.br/CEI_Responsivo/negociacao-de-ativos.aspx";
const URL_Bond =
  "https://cei.b3.com.br/CEI_Responsivo/extrato-tesouro-direto.aspx";

const stocks = [];
const bonds = [];

async function playTest() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.setViewport({ width: 1366, height: 768 });
  page.setDefaultNavigationTimeout(80000);

  await page.goto(URL_Login);
  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(C.username);
  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(C.password);
  await page.click(CTA_SELECTOR);
  await page.waitForNavigation();

  await page.goto(URL_Negociation);

  const options = [];

  const $ = cheerio.load(await page.content());
  $(BROKER_SELECTOR).each((_, table) => {
    $(table)
      .find("option")
      .each((_, op) => {
        let option = $(op)
          .text()
          .trim();
        if (option !== "Selecione") {
          option = option.substring(0, 4);
          options.push(option);
        }
      });
  });

  await page.setDefaultTimeout(2000);

  for (let i = 0; i < options.length; i++) {
    await page.click(BROKER_SELECTOR);
    await page.keyboard.type(options[i]);
    await page.focus(CTA_SELECTOR);
    await page.click(CTA_SELECTOR);

    try {
      await page.waitForSelector(TABLE_SELECTOR);
      getDataByHTML(await page.content());
      await page.focus(CTA_SELECTOR);
      await page.click(CTA_SELECTOR);
      await page.waitFor(500);
    } catch (err) {}
  }

  await page.goto(URL_Bond);

  for (let i = 0; i < options.length; i++) {
    await page.click(BROKER_SELECTOR);
    await page.keyboard.type(options[i]);
    await page.keyboard.press("Tab");

    await page.waitFor(1000);

    await page.click(COUNT_SELECTOR);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.focus(CTA_SELECTOR);
    await page.click(CTA_SELECTOR);

    try {
      await page.waitForSelector(TITLE_TABLE_SELECTOR);
      getDataByHTMLBonds(await page.content());
      await page.focus(CTA_SELECTOR);
      await page.click(CTA_SELECTOR);
      await page.waitFor(500);
    } catch (err) {}
  }

  await browser.close();
}

function getDataByHTML(html) {
  const $ = cheerio.load(html);
  let charge = false;

  $(".responsive").each((_, table) => {
    $(table)
      .find("tr")
      .each((_, row) => {
        const headLine = $(row)
          .find("th:nth-child(1)")
          .text()
          .trim();

        if (headLine === "Cód.") charge = true;

        if (charge) {
          const data = {};
          $(row)
            .find("td")
            .each((i, cell) => {
              const value = $(cell)
                .text()
                .trim();

              switch (i) {
                case 0:
                  if (value[value.length - 1] === "F") {
                    data.code = value.substring(0, value.length - 1);
                  } else {
                    data.code = value;
                  }
                  break;
                case 4:
                  value.replace(".", "");
                  data.price = Number(value.replace(",", ".")).toFixed(2);
                  break;
                case 6:
                  data.amount = Number(value);
                  break;
                default:
                  break;
              }
            });

          if (Object.keys(data).length !== 0) stocks.push(data);
        }
      });
  });
}

function getDataByHTMLBonds(html) {
  const $ = cheerio.load(html);

  $(".responsive tbody").each((_, table) => {
    $(table)
      .find("tr")
      .each((_, row) => {
        const data = {};

        $(row)
          .find("td")
          .each((i, cell) => {
            let value = $(cell)
              .text()
              .trim();

            switch (i) {
              case 0:
                data.title = value;
                break;
              case 1:
                data.dueDate = value;
                break;
              case 2:
                value = value.replace(".", "");
                data.value = Number(value.replace(",", ".")).toFixed(2);
                break;
              case 4:
                value = value.replace(".", "");
                data.nowPrice = Number(value.replace(",", ".")).toFixed(2);
                data.nowRentability =
                  (Number(data.nowPrice) / Number(data.value) - 1) * 100;
                break;
              default:
                break;
            }
          });

        if (Object.keys(data).length !== 0) bonds.push(data);
      });
  });
}

(async () => {
  await playTest();
})();
