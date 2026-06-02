import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "url";
import { createRequire } from "module";
import inCfcidr from "../src/cfcidr.js";
import cfhostpat from "../src/cfhostpat.json" with { type: "json" };
import cfhostRE from "../src/cfhostpat.js";

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
    ip && inCfcidr(ip) && domains.push(domain);
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

function toArray() {
  return Object.entries(cfhostpat).reduce((r, [k, s]) => {
    r.push(...s.split("|").map(v => v + "." + k));
    return r;
  }, []);
}
function toLines() {
  return toArray().join("\n");
}
function toObj(arr) {
  return arr
    .map(d => {
      let ps = d.split(".");
      return [ps.pop(), ps.join(".")];
    })
    .sort()
    .reduce((r, d) => {
      r[d[0]] ? (r[d[0]] += "|" + d[1]) : (r[d[0]] = d[1]);
      return r;
    }, {});
}

const isAsync = fn => fn.constructor.name === "AsyncFunction";

const argv = process.argv.slice(2);
const arg = argv.shift();
try {
  const f = eval(arg);
  let r;
  if (typeof f == "function")
    if (isAsync(f)) {
      r = await f(...argv);
      if (arg == "handleLine") r = r.join("\n");
    } else r = f(...argv);
  else if (typeof f != undefined) r = f.toString();
  r && console.log(r);
} catch (e) {
  console.error(arg, e);
}
