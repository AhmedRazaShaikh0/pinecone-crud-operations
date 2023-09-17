import express from "express";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890", 20);
import cors from "cors";
// import path from "path";
import path from "path";
const __dirname = path.resolve();
import { PineconeClient } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new PineconeClient();
await pinecone.init({
  environment: process.env.PINECONE_ENVIRONMENT,
  apiKey: process.env.PINECONE_API_KEY,
});

const app = express();
app.use(express.json());
app.use(cors());

// app.get("/", (req, res) => {
//   console.log("Testing");
//   res.send("Testing");
// });

app.get("/api/v1/posts", async (req, res) => {
  // console.log("req.body", req.body.text);
  // const queryText = ""; // emtpy string to fetch all data
  const queryText = req.query.text || ""; // emtpy string to fetch all data

  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: queryText,
  });
  const vector = response?.data[0]?.embedding;
  console.log("vector: ", vector);
  // [ 0.0023063174, -0.009358601, 0.01578391, ... , 0.01678391, ]

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
  const queryResponse = await index.query({
    queryRequest: {
      vector: vector,
      // id: "vec1",
      topK: 100,
      includeValues: true,
      includeMetadata: true,
      // namespace: process.env.PINECONE_NAME_SPACE,
    },
  });

  queryResponse.matches.map((eachMatch) => {
    console.log(
      `score ${eachMatch.score.toFixed(1)} => ${JSON.stringify(
        eachMatch.metadata
      )}\n\n`
    );
  });
  console.log(`${queryResponse.matches.length} records found `);

  res.send(queryResponse.matches);
});

app.post("/api/v1/post", async (req, res) => {
  console.log("req.body: ", req.body); // data passed in body

  // since pinecone can only store data in vector form (numeric representation of text)
  // we will have to convert text data into vector of a certain dimension (1536 in case of openai)
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: `${req.body?.text}`, // converting string data into vector format
    // input: `${req.body?.authorName} ${req.body?.text}`, // converting string data into vector format
  });
  console.log("response?.data: ", response?.data);
  const vector = response?.data[0]?.embedding;
  console.log("vector: ", vector);
  // [ 0.0023063174, -0.009358601, 0.01578391, ... , 0.01678391, ]

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
  const upsertRequest = {
    vectors: [
      {
        id: nanoid(), // unique id
        values: vector,
        metadata: {
          text: req.body?.text,
          // authorName: req.body?.authorName,
        },
      },
    ],
    // namespace: process.env.PINECONE_NAME_SPACE,
  };
  try {
    const upsertResponse = await index.upsert({ upsertRequest }); // upsert = combination of insert and update
    console.log("upsertResponse: ", upsertResponse);

    res.send({
      message: "Post Created Successfully",
    });
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send({
      message: "failed to create post, please try later",
    });
  }
});

app.put("/api/v1/post/:id", async (req, res) => {
  console.log("req.params.id: ", req.params.id);
  // console.log("req.body: ", req.body);
  // {
  //     title: "abc title",
  //     body: "abc text"
  // }

  // since pine cone can only store data in vector form (numeric representation of text)
  // we will have to convert text data into vector of a certain dimension (1536 in case of openai)
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: `${req.body?.text}`,
  });
  console.log("response?.data: ", response?.data);
  const vector = response?.data[0]?.embedding;
  console.log("vector: ", vector);
  // [ 0.0023063174, -0.009358601, 0.01578391, ... , 0.01678391, ]

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
  const upsertRequest = {
    vectors: [
      {
        id: req.params.id, // unique id, // unique id
        values: vector,
        metadata: {
          text: req.body?.text,
        },
      },
    ],
    // namespace: process.env.PINECONE_NAME_SPACE,
  };
  try {
    const upsertResponse = await index.upsert({ upsertRequest });
    console.log("upsertResponse: ", upsertResponse);

    res.send({
      message: "Post updated successfully",
    });
  } catch (e) {
    console.log("error: ", e);
    res.status(500).send({
      message: "failed to update post, please try later",
    });
  }
});

app.delete("/api/v1/post/:id", async (req, res) => {

  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    const deleteResponse = await index.delete1({
      ids: [req.params.id],
      // namespace: process.env.PINECONE_NAME_SPACE
    })
    // const ns = index.namespace(process.env.PINECONE_NAME_SPACE);
    // const deleteResponse = await ns.deleteOne(req.params.id);

    console.log("deleteResponse: ", deleteResponse);

    res.send({
      message: "post deleted successfully"
    });

  } catch (e) {
    console.log("error: ", e)
    res.status(500).send({
      message: "failed to delete story, please try later"
    });
  }

});

app.get(express.static(path.join(__dirname, "./pinecone-crud/out")));
app.use("/", express.static(path.join(__dirname, "./pinecone-crud/out")));

app.use("/static", express.static(path.join(__dirname, "static")));

app.use((req, res) => {
  res.status(404).send("not found");
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
