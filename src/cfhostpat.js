import cfhostpat from "./cfhostpat.json" with { type: "json" };

const cfdomain = "cloudflare(insights|previews|stream|storage|workers|-ipfs|-dns)?.(com|tv|dev)|(workers|pages).dev|one.one.one.one";

export function remove(data, domains) {
  let pat,
    ret = data;
  domains.forEach(d => {
    const pre = d.slice(0, d.lastIndexOf("."));
    const suf = d.slice(d.lastIndexOf("."));
    pat = RegExp(`(,?\n?\\s*)((?:'|")?${suf}(?:'|")?: ?)(?:'|")(.*)(?:'|"),?`);
    ret = ret.replace(pat, (l, g1, g2, g3, g4) => {
      const v = g3
        .split("|")
        .filter(p => p != pre)
        .join("|");
      return v ? g1 + g2 + `"${v}",` : g1;
    });
  });
  return ret.replace(/\n\s\n/g, "\n");
}

export function toArray() {
  return Object.entries(cfhostpat).reduce((r, [k, s]) => {
    r.push(...s.split("|").map(v => v + "." + k));
    return r;
  }, []);
}

export function toLines() {
  return toArray().join("\n");
}

export function toObj(arr) {
  return arr
    .map(d => d.split(".").reverse())
    .sort()
    .reduce((r, d) => {
      r[d[0]] ? (r[d[0]] += "|" + d[1]) : (r[d[0]] = d[1]);
      return r;
    }, {});
}

const cfhostRE = new RegExp(
  Object.entries(cfhostpat).reduce((r, [k, s]) => {
    r += `|(${s}).${k}`;
    return r;
  }, cfdomain)
);
export default cfhostRE;

if (typeof process != "undefined") {
  (function () {
    if (!process.argv[1] || !process.argv[1].includes("cfhostpat")) return;
    const argv = process.argv.slice(2);
    const arg = argv.shift();
    if (arg) {
      try {
        let r;
        const f = eval(arg);
        if (typeof f == "function") r = f(...argv);
        else if (typeof f != undefined) r = f.toString();
        r && console.log(r);
      } catch (e) {
        console.error("no function:", arg);
      }
    }
  })();
}
