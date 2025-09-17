export { default as inCfcidr } from "./cfcidr";
export { default as cfhostRE } from "./cfhostpat";
import kvWrap from "./kvWrap";

if (!Set.prototype.toArray)
  Set.prototype.toArray = function () {
    return Set.prototype.keys.call(this).toArray();
  };
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
// args a,b Set|Array
// return Array
const union = (a, b) => [...new Set([...a, ...b])];
const difference = (a, b) => {
  const s = new Set(a);
  for (const e of b) s.delete(e);
  return [...s];
};
function symmetricDifference(a, b, separate = false) {
  const _a = new Set(a);
  let _b;
  if (separate) _b = new Set();
  else _b = _a;
  for (const e of b) _a.has(e) ? _a.delete(e) : _b.add(e);
  return separate ? [[..._a], [..._b]] : [..._a];
}

export const randFrom = arr => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined);

const delay = t =>
  new Promise(resolve => {
    setTimeout(resolve, t);
  });

export default class CF {
  KV;
  KEY_PROXYS = "proxys";
  KEY_CFHOST = "cfhost";

  proxys = { 443: [], 80: [], openai: [], x: [] };
  proxy = { 443: "", 80: "", openai: "", x: "", timestamp: 0 };
  proxysLoaded = false;

  _cfhost = new Set(); //entry
  cfhost = new Set(); //entry + cache
  cfhostRaw = false; //kv source
  cfhostLoaded = false;

  // internal helpers for concurrency
  _loadings = new Map(); // key -> Promise for loadKey
  _locks = new Map(); // key -> Promise chain for serialization
  constructor({ KV, proxys, cfhost = [] }) {
    if (KV) this.setKV(KV);
    if (proxys instanceof Array) this.proxys[443] = proxys;
    else this.proxys = proxys;
    cfhost.forEach(e => {
      this._cfhost.add(e);
      this.cfhost.add(e);
    });
    this.initProxy();
  }
  setKV(KV) {
    kvWrap.KV = KV;
    this.KV = kvWrap;
  }
  initProxy(key) {
    if (key) {
      const arr = this.proxys[key];
      if (!arr.length) this.proxy[key] = randFrom(this.proxys[443]) || ""; // fallback to 443
      else this.proxy[key] = randFrom(arr);
    } else {
      for (let k in this.proxys) {
        const arr = this.proxys[k];
        if (arr.length && (!this.proxy[k] || !arr.includes(this.proxy[k]))) this.proxy[k] = randFrom(arr);
      }
    }
    this.proxy.timestamp = Date.now();
  }
  async getProxy(host, port) {
    let key = 443;
    if (/^(\w+\.)*(openai|chatgpt)\.com$/.test(host)) {
      key = this.proxys.openai && this.proxys.openai.length ? "openai" : 443;
    } else if (/^((\w+\.)*(twitter|x)\.com|t\.co)$/.test(host)) {
      key = this.proxys.x && this.proxys.x.length ? "x" : 443;
      if (Date.now() - this.proxy.timestamp >= 3600000) this.initProxy("x");
    } else if (port == 80) {
      key = port;
    }
    if (!this.proxy[key] && !this.proxysLoaded) await this.loadProxys();
    return { host: this.proxy[key], key };
  }
  loadCfhost() {
    const key = this.KEY_CFHOST;
    return this.loadKey(key, r => {
      if (r && r instanceof Array) {
        this[key + "Raw"] = true;
        for (let e of r) this[key].add(e);
      }
      console.log(`KV ${key} loaded ${this[key].size}`);
    });
  }
  loadProxys() {
    return this.loadKey(this.KEY_PROXYS, r => {
      if (r && typeof r == "object") {
        if (r instanceof Array) this.proxys[443] = r;
        else if ("443" in r) this.proxys = { ...this.proxys, ...r };
        this.initProxy();
      }
      console.log(
        `KV ${this.KEY_PROXYS} loaded ${this.proxys[443].length}(443) ${this.proxys[80]?.length}(80) ${this.proxys["openai"]?.length}(openai) ${this.proxys["x"]?.length}(x)`
      );
    });
  }
  loadKey(key, callback) {
    if (this[key + "Loaded"]) return Promise.resolve(this[key]);
    if (this._loadings.has(key)) return this._loadings.get(key);
    const p = this.KV.get(key)
      .then(r => {
        if (callback) callback(r);
        else {
          this[key] = r;
          console.log(`KV ${key} loaded ${this[key].length}`);
        }
        this[key + "Loaded"] = true;
        return this[key];
      })
      .finally(() => this._loadings.delete(key));
    this._loadings.set(key, p);
    return p;
  }
  async deleteProxy({ host, key }) {
    if (!host || !key) return;
    await this.loadProxys();
    // if (!this.proxys[key]) return;
    const i = this.proxys[key].indexOf(host);
    if (i > -1) {
      this.proxys[key].splice(i, 1);
      this.KV.put(this.KEY_PROXYS, this.proxys)
        .then(r => console.log(`proxy ${host}(${key}) deleted from KV`))
        .catch(console.error);
      this.initProxy(key);
    }
  }
  async tagCfhost(host) {
    const key = this.KEY_CFHOST;
    await this.loadCfhost();
    if (this[key].has(host)) return; // already cached locally
    this[key].add(host);
    console.log(`cached ${host} ${this[key].size}`);

    return this.withLock(key + ":put", async () => {
      if (this[key + "Raw"]) {
        let r = (await this.KV.get(key)) || [];
        let ldiff = this[key].difference(this["_" + key]);
        for (const e of r) {
          if (this[key].has(e)) ldiff.delete(e);
          else this[key].add(e);
        }
        if (ldiff.size)
          await this.KV.put(key, difference(this[key], this["_" + key])).then(() => {
            console.log(`tagged ${ldiff.toArray()} to KV`);
          });
      } else {
        await this.KV.put(key, difference(this[key], this["_" + key])).then(() => {
          this[key + "Raw"] = true;
          console.log(`tagged ${host} to KV`);
        });
      }
    });
  }
  withLock(key, fn) {
    const cur = this._locks.get(key) || Promise.resolve();
    const next = cur.then(() => fn());
    // store and cleanup when done (only remove if identical)
    this._locks.set(key, next.catch(console.error)); // swallow here to let chain continue
    next.finally(() => {
      if (this._locks.get(key) === next) this._locks.delete(key);
    });
    return next;
  }
  // async test() {
  //   this.loadKey(this.KEY_CFHOST);
  //   this.loadProxys();
  //   this.deleteProxy({ host: this.proxy[443], key: 443 });
  //   let r = 0;
  //   let hosts = ["cloudflare.com", "ip.sb", "a.a", "a.com", "1.1.1.1", "2.2.2.2"];
  //   hosts.forEach(h => {
  //     if (!cfhostRE.test(h) && !this.cfhost.has(h) && !(r = inCfcidr(h))) {
  //       console.log(h, r);
  //       // r === false && this.tagCfhost(h);
  //     } else console.log("Hit proxy for", h);
  //   });
  // }
}
