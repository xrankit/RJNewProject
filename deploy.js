import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

//import fastify_multipart from "@fastify/multipart";
import fastify_compress from "@fastify/compress";
import * as unzip from "unzipper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// get disc space
import child_process from "child_process";

import * as analytics from "@needle-tools/needle-engine-analytics";

// ------------------------------------------------------------
// DEPLOYMENT

export function deploymentSetup(fastify) {
  // for uploading zip
  // registered from storage package already
  //fastify.register(fastify_multipart, { attachFieldsToBody: true });
  fastify.register(fastify_compress);

  fastify.post("/v1/deploy", async function (request, reply) {
    const key = process.env.DEPLOY_KEY;
    if (typeof key !== "string" || key.length <= 0) {
      reply
        .status(500)
        .send(
          "No Deploy Key set! Please open your remix in a web browser, select the .env file and add a Deploy Key 🗝️"
        );
      return;
    }

    const deploymentKey = request.headers.deployment_key;
    if (deploymentKey !== key) {
      reply.status(401).send("Invalid or missing Deploy Key");
      return;
    }

    let expected_size = request.headers.zip_length;
    if (expected_size !== undefined) {
      expected_size = Number.parseInt(expected_size);
      const res = await hasEnoughRemainingDiscSpace(expected_size);
      if (res === false) {
        reply
          .status(507)
          .send(
            "Your glitch instance does not have enough free disc space left"
          );
        return;
      }
    }

    const outputDir = path.join(__dirname, "public");

    try {
      console.log("📦 Starting new deployment");
      if (expected_size !== undefined)
        console.log("Expected filesize=" + expected_size);
      let failed = false;
      await fs.rmSync(outputDir, { recursive: true, force: true });
      copyDeploymentHtmlToOutut(outputDir);
      const file = await request.file();
      try {
        const buf = await file.toBuffer();
        unzip.Open.buffer(buf)
          .then((d) => {
            return d.extract({ path: outputDir, concurrency: 1 });
          })
          .catch((err) => {
            failed = true;
            console.log("Error extracting file...", err);
            reply.status(500).send(err);
          });
      } catch (err) {
        failed = true;
        console.error("Error extracting...", err);
        reply.status(500).send(err);
      }
      if (!failed) {
        console.log("✔️ Deployment finished");
        reply.send("Successfully deployed new version");
        setTimeout(() => analytics.onDeploy(request), 5000);
      } else {
        console.log("❌ Deployment failed");
      }
    } catch (err) {
      console.error(err);
      reply.status(500).send(err);
    }
  });

  // automatically generate environment variable key
  // TODO: currently the glitch UI doesnt automatically refresh, would be nice to get an API to call refresh for the editor (or to let the editor know that we modified a file)
  let isCurrentlyGenerating = false;
  fastify.post("/v1/deploy/generate-key", (request, reply) => {
    if (isCurrentlyGenerating) {
      return reply.status(401).send("Invalid request.");
    }
    isCurrentlyGenerating = true;
    try {
      // check if a secret already exists
      const key = process.env.DEPLOY_KEY;
      if (typeof key === "string" && key.length > 0) {
        // if we have a secret do nothing
        return reply.status(401).send("Invalid request. Key already exists.");
      }
      const envFilePath = path.join(__dirname, ".env");
      if (fs.existsSync(envFilePath) === false)
        return reply.status(500).send(".env file does not exist");
      const content = fs.readFileSync(envFilePath);
      // check if the .env file has a secret but the process not yet
      const contentStr = content.toString();
      const hasDeployKey =
        (new RegExp("DEPLOY_KEY=.+", "gm").exec(contentStr)?.length ?? 0) > 0;
      if (hasDeployKey) {
        return reply.status(401).send("Invalid request. Key already exists.");
      }
      // no secret is yet assigned
      // generate a new secret
      const secretKey = makeIdFromRandomWords();
      console.log("Generated new secret", secretKey);
      const newEnvContent = content
        .toString()
        .replace(
          new RegExp("(DEPLOY_KEY=)(?<existing>.*)(\n?)", "gm"),
          "$1" + secretKey + "\n"
        );
      // write the new secret to our env file
      fs.writeFileSync(envFilePath, newEnvContent.toString());
      // return the secret once
      reply.status(200).send(secretKey);
      // force a restart
      process.exit();
    } finally {
      isCurrentlyGenerating = false;
    }
  });

  function copyDeploymentHtmlToOutut(targetDir) {
    try {
      const templatePath = path.join(__dirname, "needle/needle_deploying.html");
      if (fs.existsSync(templatePath)) {
        if(!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
        const targetPath = targetDir + "/index.html";
        console.log(templatePath, targetPath);
        fs.copyFileSync(templatePath, targetPath);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function hasEnoughRemainingDiscSpace(expectedSpace) {
    // get info about current disc
    const rows = child_process
      .execSync("df -h " + __dirname)
      .toString()
      ?.split("\n");
    if (rows.length > 1) {
      // get the second row (first row is header)
      const sizesRow = rows[1];
      const entries = sizesRow.match(/[^ ]+/g);
      if (entries?.length > 3) {
        // the third entry (column) contains the available space
        const available = entries[3];
        // e.g. 100M for 100 megabytes left
        if (available.endsWith("M")) {
          console.log("Your glitch instance has " + available + " left");
          const availableNumber = Number.parseInt(
            available.substring(0, available.length - 1)
          );
          if (availableNumber !== undefined) {
            const availableBytes = availableNumber * 1024 * 1024;
            return availableBytes > expectedSpace;
          }
        }
      }
    }
    //const res = child_process.execSync("du -s").toString('utf8')?.split('\t');
    //console.log("space", res[0]);
    /*const cmd = "df -h --output=pcent " + __dirname;
    console.log("EXPECTED", expectedSpace);
    const res = await child_process.exec(cmd);
    console.log(res);*/
    return true;
  }

  const colors = [
    "red",
    "green",
    "blue",
    "yellow",
    "orange",
    "purple",
    "pink",
    "brown",
    "black",
    "white",
  ];
  const adjectives = [
    "smol",
    "tiny",
    "giant",
    "interesting",
    "smart",
    "bright",
    "dull",
    "extreme",
    "beautiful",
    "pretty",
    "dark",
    "epic",
    "salty",
    "silly",
    "funny",
    "lame",
    "lazy",
    "loud",
    "lucky",
    "mad",
    "mean",
    "mighty",
    "mysterious",
    "nasty",
    "odd",
    "old",
    "powerful",
    "quiet",
    "rapid",
    "scary",
    "shiny",
    "shy",
    "silly",
    "smooth",
    "sour",
    "spicy",
    "stupid",
    "sweet",
    "tasty",
    "terrible",
    "ugly",
    "unusual",
    "vast",
    "wet",
    "wild",
    "witty",
    "wrong",
    "zany",
    "zealous",
    "zippy",
    "zombie",
    "zorro",
  ];
  const nouns = [
    "cat",
    "dog",
    "mouse",
    "pig",
    "cow",
    "horse",
    "sheep",
    "chicken",
    "duck",
    "goat",
    "panda",
    "tiger",
    "lion",
    "elephant",
    "monkey",
    "bird",
    "fish",
    "snake",
    "frog",
    "turtle",
    "hamster",
    "penguin",
    "kangaroo",
    "whale",
    "dolphin",
    "crocodile",
    "snail",
    "ant",
    "bee",
    "beetle",
    "butterfly",
    "dragon",
    "eagle",
    "fish",
    "giraffe",
    "lizard",
    "panda",
    "penguin",
    "rabbit",
    "snake",
    "spider",
    "tiger",
    "zebra",
  ];

  function makeIdFromRandomWords() {
    const randomAdjective =
      adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return randomAdjective + "-" + randomColor + "-" + randomNoun;
  }
}
