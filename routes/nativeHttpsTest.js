import https from 'https';

const url = 'https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=5&apikey=7678340aa0c923820421b14c5ac63ec2';

console.log("Testing with native https module...");

https.get(url, (res) => {
    console.log("Status Code:", res.statusCode);
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log("Data length:", data.length);
        console.log("Data snippet:", data.substring(0, 100));
    });
}).on('error', (err) => {
    console.error("HTTPS ERROR:", err);
});
