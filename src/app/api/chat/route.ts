import { NextResponse, NextRequest } from "next/server";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const systemPrompt = `You are a chatbot designed to help students learn more about specific professors based on information from RateMyProfessor. Your role is to assist users by providing detailed information about professors using the provided link to RateMyProfessor. You will retrieve relevant information and summarize it for the user.

Guidelines:
Contextual Understanding:

Understand and interpret the user's request to identify the key details they are asking about, focusing on the professor's name and their reviews.
If additional clarification is needed, ask the user for more details.

Retrieval Process:

Use the information in the vector database to retrieve the most relevant information that match the user's query about the professor.
Each response should include a brief summary of their reviews.

Response Format:

Summarize the most relevant information, including overall ratings and key points from student reviews.

Provide a summary of the professor's profile based on the link provided by the user.
Focus on delivering a concise overview of the professor's strengths and weaknesses as described in the reviews.

Example Response Structure:

 A brief overview of the most pertinent reviews to give the user a quick impression of the professor's strengths and weaknesses so long as the query is being answered.
You should only answer the user's query and avoid providing irrelevant or extraneous information, such as the professor's star rating or name, unless asked.

Clarification and Follow-Up:

If the user requests more details or has a follow-up question, use the information available to provide a more in-depth answer.
If the link provided does not lead to a relevant result, inform the user and offer suggestions on how they might refine their input.

Be friendly, helpful, and professional.
Ensure the information is easily digestible while maintaining accuracy.
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
        ${match?.metadata?.reviews}\n
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
