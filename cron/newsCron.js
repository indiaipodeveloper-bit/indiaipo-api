import cron from "node-cron";
import axios from "axios";
import crypto from "crypto";
import pool from "../db.mjs";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;



const blockedKeywords = [
    "united states",
    "u.s.",
    "usa",
    "trump",
    "horoscope",
    "astrology",
    "zodiac",
    "cricket",
    "football",
    "movie",
    "bollywood",
    "celebrity",
    "actor",
    "actress",
    "muslims",
    "pakistani",
    "school",
    "education",
    "ugc",
    "footwear",
    "fashion",
    "weather",
    "election",
    "politics",


    "fssai",
    "food",

];


const allowedKeywords = [
    "ipo",
    "initial public offering",
    "ipo filing",
    "ipo market",
    "listing",
    "listed",
    "nse",
    "bse",
    "sensex",
    "nifty",
    "sebi",
    "drhp",
    "rhp",
    "book built issue",
    "anchor investor",
    "share market",
    "stock market",
    "gmp",
    "grey market",
    "ipo alert",
    "stock"

];


function isBlockedNews(article) {
    const text = (
        (article.title || "") +
        " " +
        (article.description || "") +
        " " +
        (article.content || "")
    ).toLowerCase();

    return blockedKeywords.some(keyword =>
        text.includes(keyword.toLowerCase())
    );
}



function isRelevantNews(article) {
    const text = (
        (article.title || "") +
        " " +
        (article.description || "") +
        " " +
        (article.content || "")
    ).toLowerCase();

    return allowedKeywords.some(keyword =>
        text.includes(keyword)
    );
}


function getCategory(article) {
    const text = (
        (article.title || "") +
        " " +
        (article.description || "") +
        " " +
        (article.content || "")
    ).toLowerCase();

    if (text.includes("ipo") || text.includes("initial public offering") || text.includes("listing")) return "IPO";
    if (text.includes("nse") || text.includes("nifty")) return "NSE";
    if (text.includes("bse") || text.includes("sensex")) return "BSE";
    if (text.includes("equity") || text.includes("stock") || text.includes("share")) return "Equity";
    if (text.includes("sebi")) return "SEBI";
    if (text.includes("bank") || text.includes("finance") || text.includes("economy") || text.includes("rbi")) return "Economy";

    return "General";
}





function mapArticle(article) {
    const slug = (article.title || "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    return {
        uuid: crypto.randomUUID(),
        title: article.title,
        slug,
        description: article.description || "",
        content: article.content || "",
        category: getCategory(article),
        image: article.image || "",
        source: article.source?.name || "GNews",
        published_at: new Date(article.publishedAt),
        latest_news: 1,
        trending_news: 1,
        // status: "published",
        created_at: new Date(),
        updated_at: new Date(),
    };
}






async function saveNewsToDB(mappedArticles) {
    for (const news of mappedArticles) {
        const [existing] = await pool.execute(
            "SELECT id FROM api_news WHERE slug = ?",
            [news.slug]
        );

        if (existing.length > 0) continue;

        await pool.execute(
            `INSERT INTO api_news 
    (uuid, title, slug, description, content, category, image, source, published_at, latest_news, trending_news, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                news.uuid,
                news.title,
                news.slug,
                news.description,
                news.content,
                news.category,
                news.image,
                news.source,
                news.published_at,
                news.latest_news,
                news.trending_news,
                news.created_at,
                news.updated_at
            ]
        );

        console.log("✅ Inserted:", news.title);
    }
}


async function fetchAndSaveNews() {
    try {
        // category=business add karne se IPO/NSE/BSE news milne ke chances badh jayenge
        const url = `${BASE_URL}?category=business&lang=en&country=in&max=20&apikey=${API_KEY}`;

        const res = await axios.get(url, {
            timeout: 10000,
            family: 4,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const mapped = res.data.articles
            .filter(article =>
                article.title &&
                isRelevantNews(article) &&
                !isBlockedNews(article)
            )
            .map(mapArticle);

        await saveNewsToDB(mapped);

        console.log("🔥 Daily News Sync Done");
    } catch (err) {
        console.error("❌ Cron Error:", err.message);
    }
}


async function deleteOldNews() {
    try {
        const [result] = await pool.execute(`
            DELETE FROM api_news 
            WHERE published_at < NOW() - INTERVAL 10 DAY
        `);

        console.log(`🗑 Deleted ${result.affectedRows} old news`);

    } catch (err) {
        console.error("❌ Delete Cron Error:", err.message);
    }
}




// cron.schedule("0 9 * * *", () => {
//     console.log("⏰ Running Daily News Cron...");
//     fetchAndSaveNews();
// }, {
//     timezone: "Asia/Kolkata"
// });




// cron.schedule("*/1 * * * *", () => {
//     console.log("⏰ Running every 1 minute  News Cron...");
//     fetchAndSaveNews();
// });




cron.schedule("0 2 * * *", () => {
    console.log("🗑 Running Old News Cleanup...");
    deleteOldNews();
});



// cron.schedule("*/1 * * * *", () => {
//     console.log("🗑 Running Old News Cleanup...");
//     deleteOldNews();
// });


export { fetchAndSaveNews, deleteOldNews };