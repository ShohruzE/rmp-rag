import { NextResponse, NextRequest } from "next/server";
import scrape from '../../../utils/scraper'; // Adjust path as necessary

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const scrapedInfo = await scrape(url);
    return NextResponse.json(scrapedInfo);
  } catch (error) {
    console.error("Error in scraping:", error);
    return NextResponse.json({ error: 'Failed to scrape data' }, { status: 500 });
  }
}
