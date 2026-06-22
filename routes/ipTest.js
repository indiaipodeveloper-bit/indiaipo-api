import https from 'https';

const options = {
    hostname: '157.230.179.93',
    port: 443,
    path: '/api/v4/top-headlines?lang=en&country=in&max=5&apikey=7678340aa0c923820421b14c5ac63ec2',
    method: 'GET',
    headers: {
        'Host': 'gnews.io'
    },
    rejectUnauthorized: false // Just in case
};

console.log("Testing with direct IP and Host header...");

const req = https.request(options, (res) => {
    console.log("Status Code:", res.statusCode);
    res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => {
    console.error("ERROR:", e);
});

req.end();
