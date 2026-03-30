// Download Pikafish engine during npm install
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PIKAFISH_URL = 'https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z';
const PIKAFISH_7Z = '/tmp/pikafish.7z';
const ENGINE_DIR = path.join(__dirname, 'engine');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(dest);
    
    const request = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          request(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Download complete');
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    
    request(url);
  });
}

async function extractBinary() {
  console.log('Extracting Pikafish binary...');
  
  // Create engine directory
  if (!fs.existsSync(ENGINE_DIR)) {
    fs.mkdirSync(ENGINE_DIR, { recursive: true });
  }
  
  // Use 7zip-min for extraction
  const sevenZip = require('7zip-min');
  
  return new Promise((resolve, reject) => {
    sevenZip.unpack(PIKAFISH_7Z, '/tmp/pikafish-extract', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Move the Linux binary
      const srcBinary = '/tmp/pikafish-extract/Linux/pikafish-bmi2';
      const destBinary = path.join(ENGINE_DIR, 'pikafish');
      const srcNnue = '/tmp/pikafish-extract/pikafish.nnue';
      const destNnue = path.join(ENGINE_DIR, 'pikafish.nnue');
      
      fs.copyFileSync(srcBinary, destBinary);
      fs.copyFileSync(srcNnue, destNnue);
      fs.chmodSync(destBinary, '755');
      
      console.log('Extraction complete');
      console.log(`Binary: ${destBinary}`);
      console.log(`NNUE: ${destNnue}`);
      
      // Cleanup
      fs.unlinkSync(PIKAFISH_7Z);
      
      resolve();
    });
  });
}

async function main() {
  try {
    await downloadFile(PIKAFISH_URL, PIKAFISH_7Z);
    await extractBinary();
    console.log('✅ Pikafish engine ready');
  } catch (error) {
    console.error('❌ Failed to download/extract engine:', error.message);
    process.exit(1);
  }
}

main();
