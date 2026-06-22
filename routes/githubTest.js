import fetch from 'node-fetch';

async function test() {
    const url = 'https://api.github.com/zen';
    console.log("Testing connection to GitHub...");
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'NodeJS' } });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Zen:", text);
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

test();
