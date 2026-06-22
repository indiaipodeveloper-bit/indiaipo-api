import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";
import pool from "../db.mjs";
import { saveNewsToDB } from "./newsCron.js";

dotenv.config();

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;


function mapArticle(article) {
    const slug = article.title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    return {
        uuid: crypto.randomUUID(),
        title: article.title,
        slug,
        description: article.description || "",
        content: article.content || "",
        category: getCategory(article.title),
        image: article.image || "",
        source: article.source?.name || "GNews",
        published_at: new Date(article.publishedAt),
        latest_news: 1,
        trending_news: 1,
        status: "published",
        created_at: new Date(),
        updated_at: new Date(),
    };
}

async function testGNews() {
    try {
        const url = `${BASE_URL}?lang=en&country=in&max=5&apikey=${API_KEY}`;
        console.log("URL:", url);

        const res = await axios.get(url, {
            timeout: 10000,
            family: 4,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        console.log("STATUS:", res.status);
        console.log("TOTAL:", res.data.totalArticles);
        console.log("ARTICLES:", res.data.articles.length);

        // 🔥 MAIN PART (mapping apply)
        const mapped = res.data.articles.map(mapArticle);
        await saveNewsToDB(mapped);
        console.log("MAPPED FIRST:", mapped[0]);

    } catch (err) {
        if (err.response) {
            console.error("AXIOS ERROR (Response):", err.response.status, err.response.data);
        } else if (err.request) {
            console.error("AXIOS ERROR (Request): No response received");
        } else {
            console.error("AXIOS ERROR (General):", err.message);
        }
    }
}



testGNews();