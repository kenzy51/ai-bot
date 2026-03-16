const { spawn } = require('child_process');

// Run 'npm run build'
const child = spawn('npm', ['run', 'build'], { shell: true });

// Check the child process memory periodically
const interval = setInterval(() => {
  // We use a small shell command to get the RSS of the PID
  const pid = child.pid;
  if (pid) {
    const { exec } = require('child_process');
    exec(`ps -o rss= -p ${pid}`, (err, stdout) => {
      if (!err && stdout) {
        const rss = parseInt(stdout.trim()) / 1024; // Convert KB to MB
        console.log(`Build Process (PID ${pid}) RSS: ${rss.toFixed(2)} MB`);
      }
    });
  }
}, 1000);

child.on('close', () => {
  clearInterval(interval);
  console.log('Build finished.');
  process.exit();
});