import { NextResponse, NextRequest } from "next/server";
import scrape from '../../../utils/scraper'; 
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // scrape the professor information
    const scrapedInfo = await scrape(url);

    // initialize Pinecone and OpenAI clients
    const pc = new Pinecone({
      apiKey: String(process.env.PINECONE_API_KEY),
    });
    const index = pc.index("rag").namespace("ns1");
    const openai = new OpenAI();

    // generate embeddings based on the reviews
    const embeddings = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: scrapedInfo.reviews.join(" "), // join the reviews into a single string
      encoding_format: "float",
    });

    // prepare the data to upsert into Pinecone
    const vector = {
      id: `professor-${scrapedInfo.professor.replace(/\s+/g, '-').toLowerCase()}`,
      values: embeddings.data[0].embedding,
      metadata: {
        professor: scrapedInfo.professor,
        star_rating: scrapedInfo.star_rating,
        department: scrapedInfo.subject,
        reviews: scrapedInfo.reviews
      }
    };

    // insert the data into Pinecone
    await index.upsert([vector]);

    return NextResponse.json({ message: 'Data successfully scraped and upserted into Pinecone', data: scrapedInfo });
  } catch (error) {
    console.error("Error in scraping or upserting:", error);
    return NextResponse.json({ error: 'Failed to scrape or upsert data' }, { status: 500 });
  }
}
