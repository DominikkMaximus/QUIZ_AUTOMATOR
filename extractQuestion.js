//TRUE FALSE questions do not work due to different structure of the page
const puppeteer = require("puppeteer-core");
const readline = require("readline");

require("dotenv").config();

const { answerWithGPT, getDataset } = require("./getAnswersGPT");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60 * 60 * 1000); // Set timeout to 60 minutes
  await page.goto(`https://www.menti.com/${process.env.MENTI_ID}`);
  try {
    while (true) {
      const userInput = await askQuestion("Press ENTER to start checking for questions or type 'exit' to quit...");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      await page.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").innerText.includes("?"), {
        polling: "mutation",
        timeout: 60 * 60 * 1000,
      });
      const question = await page.evaluate(() => {
        const questionElement = document.querySelector("h1 span");
        return questionElement ? questionElement.innerText : null;
      });

      console.log("QUESTION:", question);

      const dataset = await getDataset(question);
      console.log("DATASET:", dataset);

      await Promise.race([
        page.waitForSelector('button[type="submit"] span span', { timeout: 60 * 60 * 1000 }), // Current answer buttons
        page.waitForSelector('button[aria-label="TRUE"]', { timeout: 60 * 60 * 1000 }), // True/False buttons
      ]);

      const data = await page.evaluate(() => {
        const questionElement = document.querySelector("h1 span");
        const question = questionElement ? questionElement.innerText : null;

        const answerElements = Array.from(document.querySelectorAll('button[type="submit"] span span'));
        const answers = answerElements.map((element) => element.innerText);

        const trueFalseButtonsExist = !!document.querySelector('button[aria-label="TRUE"]');

        return { question, answers, trueFalseButtonsExist };
      });

      console.log("DATA.QUESTION:", data.question);//wrong, only gets 1st word
      console.log("DATA.ANSWERS:", data.answers);

      if (data.answers.length > 0 || data.trueFalseButtonsExist) {
        const options = data.trueFalseButtonsExist ? ["True", "False"] : data.answers;
        const GPTResponse = await answerWithGPT(data.question, options, dataset);
        console.log("GPT RESPONSE:", GPTResponse);

        let answerIndex = -1;
        for (let i = 0; i < data.answers.length; i++) {
          if (GPTResponse.includes(data.answers[i])) {
            answerIndex = i;
            break;
          }
        }

        // If no exact match was found, check for a partial match
        if (answerIndex === -1) {
          const middle80Percent = GPTResponse.slice(GPTResponse.length * 0.1, GPTResponse.length * 0.9).toLowerCase();
          for (let i = 0; i < data.answers.length; i++) {
            if (middle80Percent.includes(data.answers[i].toLowerCase())) {
              answerIndex = i;
              break;
            }
          }
        }

        if (answerIndex !== -1) {
          if (data.trueFalseButtonsExist) {
            // If True/False buttons exist, click the appropriate button
            const selector = answerIndex === 0 ? 'button[aria-label="TRUE"]' : 'button[aria-label="FALSE"]';
            await page.click(selector);
          } else {
            // If True/False buttons don't exist, click the button corresponding to the selected answer
            await page.click(`button[type="submit"]:nth-child(${answerIndex + 1})`);
          }
        } else {
          continue; // If no matches were found, go back to waiting for the ENTER key press
        }
      }
    }
  } catch (e) {
    console.log("Error occured. Switching to manual mode.");
  }

  //await browser.close();
  rl.close();
})();
