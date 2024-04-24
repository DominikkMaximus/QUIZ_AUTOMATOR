const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { VectorDB } = require("./vectorDB");
const pdfParse = require("pdf-parse");
const cheerio = require("cheerio");
const mammoth = require("mammoth");

require("dotenv").config();

/**
 * @type {Object.<string, VectorDB>}
 */
let vectorDBs = {};

/**
 * Load databases from disk into memory
 */
function loadDatabases() {
  const files = fs.readdirSync(path.join(__dirname, "databases"));
  for (let file of files) {
    if (path.extname(file) === ".json") {
      let data = fs.readFileSync(path.join(__dirname, "databases", file), "utf-8");
      if (data.trim() === "") continue; // Skip empty files
      let vectors = JSON.parse(`[${data.slice(0, -2)}]`);
      let category = path.basename(file, ".json");
      vectorDBs[category] = new VectorDB();
      for (let { vector, data } of vectors) {
        vectorDBs[category].store(vector, data);
      }
    }
  }
}

/**
 * Sanitize data by converting to lower case, replacing newlines with spaces, and trimming
 * @param {string} data - The data to sanitize
 * @returns {string} The sanitized data
 */
function sanitizeData(data) {
  return data.toLowerCase().replace(/\n/g, " ").trim();
}

/**
 * Store data in a category, sending it to the OpenAI API for embedding first
 * @param {string} data - The data to store
 * @param {string} category - The category to store the data in
 */
async function storeData(data, category) {
  data = sanitizeData(data);
  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { input: data, model: "text-embedding-3-small" },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  console.log(JSON.stringify(response.data, null, 2));

  const vector = response.data.data[0].embedding;
  if (!vectorDBs[category]) {
    vectorDBs[category] = new VectorDB();
    fs.writeFileSync(path.join(__dirname, "databases", `${category}.json`), "");
  }
  vectorDBs[category].store(vector, data);
  fs.appendFileSync(path.join(__dirname, "databases", `${category}.json`), JSON.stringify({ vector, data }) + ",\n");
}

/**
 * Store data from a file in a category, based on the file type
 * @param {string} filePath - The path to the file
 * @param {string} category - The category to store the data in
 * @param {boolean} isText - Whether the filePath is actually text to store
 */
async function storeDataFromFile(filePath, category, isText = false) {
  if (isText) {
    await storeParagraphs(filePath, category);
    return;
  }

  const extension = path.extname(filePath);
  switch (extension) {
    case ".pdf":
      await storePdfData(filePath, category);
      break;
    case ".doc":
    case ".docx":
      await storeWordData(filePath, category);
      break;
    case ".html":
      await storeHtmlData(filePath, category);
      break;
    case ".txt":
      await storeTxtData(filePath, category);
      break;
    default:
      console.error(`Unsupported file type: ${extension}`);
  }
}

/**
 * Store data from a PDF file in a category
 * @param {string} pdfPath - The path to the PDF file
 * @param {string} category - The category to store the data in
 */
async function storePdfData(pdfPath, category) {
  let dataBuffer = fs.readFileSync(pdfPath);
  let d = await pdfParse(dataBuffer);
  let paragraphs = d.text.split(/(?:\r?\n){2,}/); // Split the text into paragraphs
  await storeParagraphs(paragraphs, category);
}

/**
 * Store data from a TXT file in a category
 * @param {string} txtPath - The path to the TXT file
 * @param {string} category - The category to store the data in
 */
async function storeTxtData(txtPath, category) {
  let data = fs.readFileSync(txtPath, "utf8");
  let paragraphs = data.split(/(?:\r?\n){2,}/); // Split the text into paragraphs
  await storeParagraphs(paragraphs, category);
}

/**
 * Store data from a Word file in a category
 * @param {string} wordPath - The path to the Word file
 * @param {string} category - The category to store the data in
 */
async function storeWordData(wordPath, category) {
  let data = await mammoth.extractRawText({ path: wordPath });
  let paragraphs = data.value.split("\n\n"); // Split the text into paragraphs
  await storeParagraphs(paragraphs, category);
}

/**
 * Store data from an HTML file in a category
 * @param {string} htmlPath - The path to the HTML file
 * @param {string} category - The category to store the data in
 */
async function storeHtmlData(htmlPath, category) {
  let data = fs.readFileSync(htmlPath, "utf8");
  let $ = cheerio.load(data);
  let text = $.root().text(); // Get all visible text
  let paragraphs = text.split(/(?:\r?\n){2,}/); // Split the text into paragraphs
  await storeParagraphs(paragraphs, category);
}

/**
 * Store paragraphs in a category, sending each paragraph to the OpenAI API for embedding first
 * @param {Array.<string>} paragraphs - The paragraphs to store
 * @param {string} category - The category to store the paragraphs in
 */
async function storeParagraphs(paragraphs, category) {
  for (let paragraph of paragraphs) {
    paragraph = sanitizeData(paragraph);
    if (paragraph.length < 10) continue; // Skip paragraphs that are too short
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { input: paragraph, model: "text-embedding-3-small" },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const data = paragraph;
    const vector = response.data.data[0].embedding;
    if (!vectorDBs[category]) {
      vectorDBs[category] = new VectorDB();
      fs.writeFileSync(path.join(__dirname, "databases", `${category}.json`), "");
    }
    vectorDBs[category].store(vector, data);
    fs.appendFileSync(path.join(__dirname, "databases", `${category}.json`), JSON.stringify({ vector, data }) + ",\n");
  }
}

/**
 * Retrieve similar data from a category based on a query, sending the query to the OpenAI API for embedding first
 * @param {string} query - The query
 * @param {string} category - The category to retrieve similar data from
 * @returns {Array.<Object>} The similar data
 */
async function retrieveSimilar(query, category) {
  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { input: query, model: "text-embedding-3-small" },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  const queryVector = response.data.data[0].embedding;
  return vectorDBs[category].retrieve(queryVector, 5); //how many results to get
}

loadDatabases();

/*storeData("This is some example data.", "example").then(() => {
  retrieveSimilar("This is a query.", "example").then(console.log);
});
retrieveSimilar("how to sign web3 transaction object?", "web3js").then(console.log);
*/
//storeDataFromFile("dataset.txt", "DB1");

module.exports = { storeData, storeDataFromFile, retrieveSimilar };
