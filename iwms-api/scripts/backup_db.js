const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error("Error: DIRECT_URL is not defined in .env file.");
  process.exit(1);
}

// Parse PostgreSQL URL: postgresql://username:password@host:port/database
const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:/]+):?(\d+)?\/([^?]+)/;
const matches = directUrl.match(regex);
if (!matches) {
  console.error("Error: DIRECT_URL is not in a valid postgresql format.");
  process.exit(1);
}

const [_, user, password, host, portStr, database] = matches;
const port = portStr || '5432';
const decodedPassword = decodeURIComponent(password);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

const outputFile = path.join(backupDir, `backup-${database}-${timestamp}.sql`);
const compressedFile = `${outputFile}.gz`;

console.log(`Starting database backup for "${database}" on host "${host}"...`);

// Set PGPASSWORD environment variable for pg_dump
const env = { ...process.env, PGPASSWORD: decodedPassword };
const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${outputFile}"`;

exec(command, { env }, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing pg_dump: ${error.message}`);
    console.error(stderr);
    process.exit(1);
  }

  console.log(`Backup file created: ${outputFile}`);

  // Compress the backup using Node's zlib to remain platform-independent
  console.log("Compressing backup file...");
  const zlib = require('zlib');
  const gzip = zlib.createGzip();
  const source = fs.createReadStream(outputFile);
  const destination = fs.createWriteStream(compressedFile);

  source.pipe(gzip).pipe(destination);

  destination.on('finish', () => {
    console.log(`Compression finished. Gzip file created: ${compressedFile}`);
    fs.unlinkSync(outputFile);
    console.log("Temporary raw backup file cleaned up.");
    console.log("Database backup completed successfully.");
  });

  destination.on('error', (err) => {
    console.error(`Compression failed: ${err.message}`);
    process.exit(1);
  });
});
