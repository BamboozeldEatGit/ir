import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createBareServer } from "@tomphttp/bare-server-node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import wisp from "wisp-server-node";
import request from '@cypress/request';
import chalk from 'chalk';
import packageJson from './package.json' assert { type: 'json' };
import fs from 'node:fs';
const __dirname = path.resolve();
const server = http.createServer();
const bareServer = createBareServer('/seal/');
const app = express(server);
const version = packageJson.version;
const discord = 'https://discord.gg/unblocking';
const routes = [
  { route: '/mastery', file: './static/loader.html' },
  { route: '/apps', file: './static/apps.html' },
  { route: '/gms', file: './static/gms.html' },
  { route: '/lessons', file: './static/agloader.html' },
  { route: '/info', file: './static/info.html' },
  { route: '/mycourses', file: './static/loading.html' }
];

// Add middleware to handle headers
app.use((req, res, next) => {
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'content-length' && res.getHeader('content-length')) {
      return;
    }
    return originalSetHeader.call(this, name, value);
  };
  next();
});

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

// Replace the webp middleware with a streaming approach
app.use((req, res, next) => {
  // Handle static files from the static directory
  const staticPath = path.join(__dirname, 'static');
  const filePath = path.join(staticPath, req.path);
  
  // If the file exists and is a webp
  if (req.path.endsWith('.webp')) {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        // File doesn't exist, move to next middleware
        return next();
      }
      
      // Set headers without Content-Length
      res.setHeader('Content-Type', 'image/webp');
      res.removeHeader('Content-Length'); // Ensure no Content-Length header
      
      // Stream the file instead of using sendFile
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      
      stream.on('error', (err) => {
        console.error('Error streaming file:', err);
        if (!res.headersSent) {
          res.status(500).send('Error serving file');
        }
      });
    });
  } else {
    next(); // Not a webp, let other middleware handle it
  }
});

// Use regular static middleware for other files
app.use(express.static(path.join(__dirname, 'static')));
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

routes.forEach(({ route, file }) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});

app.get('/student', (req, res) => {
  res.redirect('/portal');
});

app.get('/worker.js', (req, res) => {
  request('https://cdn.surfdoge.pro/worker.js', (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.setHeader('Content-Type', 'text/javascript');
      res.send(body);
    } else {
      res.status(500).send('Error fetching worker script');
    }
  });
});

app.use((req, res) => {
  res.statusCode = 404;
  res.sendFile(path.join(__dirname, './static/404.html'));
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error handling request:', req.path);
  console.error(err);
  
  // If headers already sent, just end the response
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).send('Internal Server Error');
});

server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else app(req, res);
});
server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else if (req.url.endsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
  } else socket.end();
});

server.on('listening', () => {
  console.log(chalk.bgBlue.white.bold(`  Welcome to Doge V4, user!  `) + '\n');
  console.log(chalk.cyan('-----------------------------------------------'));
  console.log(chalk.green('  🌟 Status: ') + chalk.bold('Active'));
  console.log(chalk.green('  🌍 Port: ') + chalk.bold(chalk.yellow(server.address().port)));
  console.log(chalk.green('  🕒 Time: ') + chalk.bold(new Date().toLocaleTimeString()));
  console.log(chalk.cyan('-----------------------------------------------'));
  console.log(chalk.magenta('📦 Version: ') + chalk.bold(version));
  console.log(chalk.magenta('🔗 URL: ') + chalk.underline('http://localhost:' + server.address().port));
  console.log(chalk.cyan('-----------------------------------------------'));
  console.log(chalk.blue('💬 Discord: ') + chalk.underline(discord));
  console.log(chalk.cyan('-----------------------------------------------'));
});

function shutdown(signal) {
  console.log(chalk.bgRed.white.bold(`  Shutting Down (Signal: ${signal})  `) + '\n');
  console.log(chalk.red('-----------------------------------------------'));
  console.log(chalk.yellow('  🛑 Status: ') + chalk.bold('Shutting Down'));
  console.log(chalk.yellow('  🕒 Time: ') + chalk.bold(new Date().toLocaleTimeString()));
  console.log(chalk.red('-----------------------------------------------'));
  console.log(chalk.blue('  Performing graceful exit...'));
  server.close(() => {
    console.log(chalk.blue('  Doge has been closed.'));
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen({
  port: 8000,
});