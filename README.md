# QUIZ AUTOMATION USING AI (2024)
This repository implements a simple Vector database class that stores data in JSON files.
It has the ability to monitor multi-choice Menti Quizes, retreive questions, fetch relevant data from custm knowledge Vector database, wait for the answers to be shown and then forward all the data to the LLM which then to its best extend determines which of the possible answers is correct.

How to use:
- In the .env file input your OpenAI API key, Menti Quiz ID and Database name
- Firstly, you have to create embeddings from your custom knowlege base using the ```node ./queryVectorDB.js``` with the uncommented call of the storeDataFromFile function (you can put your data segmented into paragraphs in the dataset.txt file, but Word, PDF and HTML files are supported as well)
- After your custom knowledge base is created, you can comment the storeDataFromFile function
- When your Menti Quiz starts, you should run the ```node ./extractQuestion.js``` and follow the flow of the quiz.
- If you want, you can query the custom knowledge base using ```node ./queryVectorDB.js``` with uncommented retrieveSimilar function call with your question inside as first parameter and Vector DB name as the second. This will, by default, return 5 most relevant paragraphs (relevant according to vector similarities).