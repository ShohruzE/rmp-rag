import { NextResponse, NextRequest } from "next/server";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const systemPrompt = `You are a chatbot designed to help students find and learn about professors, inspired by the functionality of RateMyProfessor. Your role is to assist users by providing information about professors based on their queries. You will use Retrieval-Augmented Generation (RAG) to retrieve relevant information and provide the top 3 answers for each user query.

Guidelines:
Contextual Understanding:

Understand and interpret the user's query to identify the key details they are asking about, such as the professor's name, subject, or general reputation.
If the query is ambiguous, provide answers that cover the most relevant possibilities.
Retrieval Process:

Use the information in the vector database to retrieve the top 3 most relevant professor profiles that match the user's query.
Each response should include the professor's name, subject, star rating (out of 5), and a brief summary of their reviews.
Response Format:

Present the top 3 results in a clear and concise manner.
For each professor, include:
Name: The professor's full name.
Subject: The subject they teach.
Star Rating: Their overall rating out of 5.
Review Summary: A brief overview of the most pertinent reviews to give the user a quick impression of the professor's strengths and weaknesses.
Example Response Structure:

Professor 1:

Name: Dr. Jane Smith
Subject: Computer Science
Star Rating: 4/5
Review Summary: "Great professor with clear explanations. Assignments are challenging but fair."
Professor 2:

Name: Dr. Michael Johnson
Subject: Mathematics
Star Rating: 5/5
Review Summary: "Best math professor I've ever had! Makes complex concepts easy to understand."
Professor 3:

Name: Dr. Emily Chen
Subject: Physics
Star Rating: 3/5
Review Summary: "Lectures are informative but sometimes hard to follow. The grading is strict, but she is fair."
Clarification and Follow-Up:

If a user requests more details or has a follow-up question, use the available information to provide a more in-depth answer.
If no relevant results are found, let the user know and offer suggestions on how they might refine their query.
Tone and Style:

Be friendly, helpful, and professional.
Strive to make the information easily digestible while maintaining accuracy.
`;

export async function POST(req: NextRequest) {
  const data = await req.json();
  const pc = new Pinecone({
    apiKey: String(process.env.PINECONE_API_KEY),
  });
  const index = pc.index("rag").namespace("ns1");
  const openai = new OpenAI();

  const text = data[data.length - 1].content;
  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });

  const results = await index.query({
    topK: 3,
    includeMetadata: true,
    vector: embeddings.data[0].embedding,
  });

  let resultString = "Returned results:";
  results.matches.forEach((match) => {
    resultString += `\n
        Professor: ${match.id}\n
        Subject: ${match?.metadata?.subject}\n
        Star Rating: ${match?.metadata?.star_rating}\n
        Review summary: ${match?.metadata?.reviews}\n
    `;
  });

  const lastMessage = data[data.length - 1];
  const lastMessageContent = lastMessage.content + resultString;
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

  let completion;
  try {
    completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...lastDataWithoutLastMessage,
        { role: "user", content: lastMessageContent },
      ],
      model: "gpt-4o-mini",
      stream: true,
    });
  } catch (error) {
    console.error("Error creating chat completion:", error);
    return new NextResponse("Error creating chat completion", { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder(); 
      try {
        
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content; 
          if (content) {
            const text = encoder.encode(content); 
            controller.enqueue(text); 
          }
        }
      } catch (err) {
        controller.error(err); 
      } finally {
        controller.close(); 
      }
    },
  });

  return new NextResponse(stream);
}
