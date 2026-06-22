import fetch from 'node-fetch';

async function test() {
    const url = 'https://www.google.com';
    console.log("Testing connection to Google...");
    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

test();
