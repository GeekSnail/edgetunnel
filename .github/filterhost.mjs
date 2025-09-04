import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "url";
import { createRequire } from "module";

import inCfcidr from "../src/cfcidr.js";
import { toArray, toObj } from "../src/cfhostpat.js";

//https://forum.linuxfoundation.org/discussion/861047/lab-7-1-err-unsupported-esm-url-scheme
const { resolve } = createRequire(import.meta.url);
async function dynamicImport(file) {
  const filepath = path.resolve(process.cwd(), file);
  return await import(pathToFileURL(resolve(filepath)).toString());
}

async function handleLine(filename) {
  const domains = [];
  const fileStream = fs.createReadStream(filename);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    const [ip, domain] = line.split(/, *| +/);
    if (ip && inCfcidr(ip)) {
      console.error(domain, ip)
      domains.push(domain);
    }
  }
  return domains;
}

async function handlePat(filename) {
  const domains = await handleLine(filename);

  // const { toArray, toObj } = await dynamicImport(jsfile);
  if (domains.length == toArray().length) return;
  const result = JSON.stringify(toObj(domains), null, 2);
  // console.log(result);
  fs.writeFile("src/cfhostpat.json", result, "utf8", err => {
    if (err) return console.error(err);
  });
}

const argv = process.argv.slice(2);
if (argv.length == 1) handleLine(argv[0]).then(r => console.log(r.join("\n")));
else if (argv.length >= 2) {
  const arg = argv.shift();
  try {
    const f = eval(arg);
    if (typeof f == "function") f(...argv).then(r => r && console.log(r));
    else if (typeof f != undefined) console.log(f.toString());
  } catch (e) {
    console.error("no function:", arg);
  }
}
