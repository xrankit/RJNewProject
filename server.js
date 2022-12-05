import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import Fastify from 'fastify';
import fastify_static from '@fastify/static';

import * as analytics from "@needle-tools/needle-engine-analytics";

const fastify = Fastify({
  logger: false,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Setup our static files
fastify.register(fastify_static, {
  root: path.join(__dirname, "public"),
  prefix: "/",
  preCompressed: true, // necessary to try send gz first
});

// Index
fastify.get("/", function (request, reply) {
  analytics.ping(request); 
  return reply.sendFile("index.html");
});

// Run the server and report out to the logs
fastify.listen(process.env.PORT || 3010, "0.0.0.0", function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
  fastify.log.info(`server listening on ${address}`); 
});


// ---- 🌵 needle Unity → threejs
import networking from "@needle-tools/needle-tiny-networking-ws";
import { deploymentSetup } from "./deploy.js";

import storage from "@needle-tools/needle-tiny-storage";
storage.initFastify(fastify, { registerPlugins: true });

networking.startServerFastify(fastify, { endpoint: "/socket" });
deploymentSetup(fastify);
