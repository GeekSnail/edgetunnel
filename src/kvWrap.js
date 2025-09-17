const kvWrap = {
  KV: null,
  async get(key, option = { type: "json" }) {
    return this.api("get", key, option);
  },
  async list(...args) {
    return this.api("list", ...args);
  },
  async delete(key) {
    return this.api("delete", key);
  },
  async put(key, ...args) {
    return this.api("put", key, ...args);
  },
  async push(key, ...args) {
    return this.pushOrSet(key, ...args);
  },
  async set(key, ...args) {
    return this.pushOrSet(key, ...args);
  },
  // key, push, arg0, arg1, ...
  // key, set, subKey, subValue
  async pushOrSet(key, ...args) {
    if (!this.KV) return console.error("no KV instance!");
    val = await this.api("get", key);
    if (val) {
      if (val instanceof Array) {
        val.push(...args);
      } else if (val.toString() == "[object Object]") {
        val[args[0]] = args[1];
      }
      args = val;
    }
    return await this.api("put", key, args);
  },
  /**
   * op: get,put,list,delete
   * args: key, value(string,object,array)
   */
  async api(op, ...args) {
    if (!this.KV) return console.error("no KV instance!");
    let val;
    try {
      if (op == "put" && typeof args[1] == "object") {
        args[1] = JSON.stringify(args[1]);
      }
      val = await this.KV[op](...args);
      // if (op == "get" && val && /^[{\[].*[\]}]$/.test(val)) {
      //   val = JSON.parse(val);
      // }
    } catch (err) {
      if (op == "put") throw err;
      else console.error("KV error", err);
    }
    return val;
  },
};
export default kvWrap;
