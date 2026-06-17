const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function loadEnv(envPath) {
  const txt = fs.readFileSync(envPath, 'utf8');
  const lines = txt.split(/\r?\n/);
  const env = {};
  for (const l of lines) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  }
  return env;
}

async function main() {
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
      console.error('.env not found in server folder');
      process.exit(2);
    }
    const env = loadEnv(envPath);
    const uri = env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not set in .env');
      process.exit(3);
    }

    console.log('Attempting mongoose.connect to:', uri.replace(/(:)[^:@\/]+@/, '$1****@'));
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB successfully');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Connection error:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();
