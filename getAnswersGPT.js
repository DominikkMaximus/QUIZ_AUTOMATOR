//when a question is detected this function is called to prompt gpt with question and potential answers to choose one based on the predefined dataset
const { OpenAI } = require("openai");
const { retrieveSimilar } = require("./queryVectorDB");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getDataset = async (question) => {
  let dataset = await retrieveSimilar(question, process.env.CATEGORY);
  return dataset;
};
const answerWithGPT = async (question, answers, dataset) => {
  const systemMessage = {
    role: "system",
    content: `Message context:
      The user is asking a question and providing potential answers. One of the options is correct.
      The user is asking you to respond based on the predefined dataset. 
      You should choose one of the answers based on the dataset. You should repond in a strict form:
  
  EXACT_ANSWER_FORM_OPTIONS
  
      For example:
  question: Which is number the capital of Slovenia?
  answers: ["Dunaj","Ljubljana","Maribor","Trst"]
  your response:
      Ljubljana
  
      Optional dataset (if provided, you must use it to answer the question, otherwise use your own knowledge to answer the question). Data is provided in json format with each data segment including a percent of how similar the data segment is to the question, but this does not correlate to the accuracy of the answer:
  
      ${dataset}
  `,
  };
  const prompt = `${question}\n\nOptions:\n${answers.join("\n")}\n\nChoose one answer from the array of options`;
  const result = await openai.chat.completions
    .create({
      model: "gpt-3.5-turbo-0125",
      messages: [
        systemMessage,
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 50, // Make this higher if you want longer responses
    })
    .catch((error) => {
      console.log(`OPENAI ERR: ${error}`);
    });
  console.log("GPT REPLY:\n" + result.choices[0].message.content);

  return result.choices[0].message.content;
};

module.exports = { answerWithGPT, getDataset };
