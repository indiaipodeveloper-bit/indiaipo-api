import fetch from 'node-fetch';

async function test() {
    const url = 'https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=5&apikey=7678340aa0c923820421b14c5ac63ec2';
    console.log("Testing with node-fetch...");
    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Data:", JSON.stringify(data).substring(0, 100) + "...");
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

test();
