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
function symmetricDifference(a, b, seperate = false) {
  const _a = new Set(a);
  let _b;
  if (seperate) _b = new Set();
  else _b = _a;
  for (const e of b) _a.has(e) ? _a.delete(e) : _b.add(e);
  return seperate ? [[..._a], [..._b]] : [..._a];
}

export const randFrom = arr => arr[Math.floor(Math.random() * arr.length)];

const delay = t =>
  new Promise(resolve => {
    setTimeout(resolve, t);
  });

export default class CF {
  KV;
  KEY_PROXYS = "proxys";
  KEY_CFHOST = "cfhost";

  //_proxys; //entry
  proxys = { 443: [], 80: [], openai: [], x: [] };
  proxy = { 443: "", 80: "", openai: "", x: "", timestamp: 0 };
  proxysLoaded = false;

  _cfhost = new Set(); //entry
  cfhost = new Set(); //entry + cache
  cfhostRaw = false; //kv source
  cfhostLoaded = false;
  cfhostPutting;
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
      if (key != 443 && !this.proxys[key].length) this.proxy[key] = randFrom(this.proxys[443]);
      else this.proxy[key] = randFrom(this.proxys[key]);
    } else {
      for (let k in this.proxys) {
        if (this.proxys[k].length && (!this.proxy[k] || !this.proxys[k].includes(this.proxy[k]))) this.proxy[k] = randFrom(this.proxys[k]);
      }
    }
    this.proxy.timestamp = Date.now();
  }
  getProxy(host, port) {
    let key = "";
    if (/^(\w+\.)*(openai|chatgpt)\.com$/.test(host)) {
      if (this.proxys["openai"].length) key = "openai";
      else key = 443;
    } else if (/^(\w+\.)*(twitter|x)\.com|t.co$/.test(host)) {
      if (this.proxys["x"].length) key = "x";
      else key = 443;
      if (Date.now() - this.proxy.timestamp >= 3600000) this.initProxy("x");
    } else if (/443|80/.test(port)) {
      key = port;
    }
    return { host: this.proxy[key], key };
  }
  loadCfhost() {
    return this.loadKey(this.KEY_CFHOST);
  }
  loadKey(key) {
    if (this[key + "Loaded"]) return Promise.resolve();
    return this.KV.get(key).then(r => {
      if (r && r instanceof Array) {
        this[key + "Raw"] = true;
        for (let e of r) this[key].add(e);
      }
      this[key + "Loaded"] = true;
      console.log(`KV ${key} loaded ${this[key].size}`);
      return this[key];
    });
  }
  loadProxys() {
    if (this.proxysLoaded) return Promise.resolve();
    return this.KV.get(this.KEY_PROXYS).then(r => {
      if (r && typeof r == "object") {
        if (r instanceof Array) this.proxys[443] = r;
        else if ("443" in r) this.proxys = { ...this.proxys, ...r };
        this.initProxy();
      }
      this.proxysLoaded = true;
      console.log(
        `KV ${this.KEY_PROXYS} loaded ${this.proxys[443].length}(443) ${this.proxys[80]?.length}(80) ${this.proxys["openai"]?.length}(openai) ${this.proxys["x"]?.length}(x)`
      );
      return this.proxys;
    });
  }
  async deleteProxy({ host, key }) {
    if (!host || !key) return;
    while (!this.proxysLoaded) {
      console.log(`${this.KEY_PROXYS} not loaded! try wait 20ms`);
      await delay(20);
    }
    const i = this.proxys[key].indexOf(host);
    if (i > -1) {
      this.proxys[key].splice(i, 1);
      this.KV.put(this.KEY_PROXYS, this.proxys).then(r => {
        console.log(`proxy ${host + "(" + key}) deleted from KV`);
      });
      this.initProxy(key);
    }
  }
  tagCfhost(host) {
    return this.tag(this.KEY_CFHOST, host);
  }
  async tag(key, host) {
    while (!this[key + "Loaded"]) {
      console.log(`${key} not loaded! try wait 20ms`);
      await delay(20);
    }
    if (!this[key].has(host)) this[key].add(host);
    else return Promise.resolve();
    console.log(`cached ${host} ${this[key].size}`);
    let keyPutting = key + "Putting";
    while (this[keyPutting]) {
      console.log(`${key} is been putting! try wait 50ms`);
      await delay(50);
    }
    if (!this[keyPutting]) {
      this[keyPutting] = true;
      if (this[key + "Raw"]) {
        let r = await this.KV.get(key);
        let ldiff = this[key].difference(this["_" + key]);
        for (const e of r) {
          if (this[key].has(e)) ldiff.delete(e);
          else this[key].add(e);
        }
        if (ldiff.size)
          await this.KV.put(key, difference(this[key], this["_" + key])).then(r => {
            console.log(`tagged ${ldiff.toArray()} to KV`);
          });
      } else {
        await this.KV.put(key, difference(this[key], this["_" + key])).then(r => {
          this[key + "Raw"] = true;
          console.log(`tagged ${host} to KV`);
        });
      }
      this[keyPutting] = false;
    }
    return Promise.resolve();
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
