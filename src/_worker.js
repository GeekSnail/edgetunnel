// @ts-ignore
import { connect } from "cloudflare:sockets";
import CF, { cfhostRE, inCfcidr, isIpv4, random } from "./cfutil";
import proxys from "./proxys.json";
import cfhost from "./cfhost.json";
import ui from "./user.html";

const domains = [
  "acm.org",
  "activehosted.com",
  "ahrefs.com",
  "auth0.com",
  "brainly.com",
  "cambridge.org",
  "cf.090227.xyz",
  "cf.877774.xyz",
  "codecanyon.net",
  "crazygames.com",
  "deepl.com",
  "digitalocean.com",
  "doordash.com",
  "emojipedia.org",
  "fbi.gov",
  "freecodecamp.org",
  "getbootstrap.com",
  "gitbook.io",
  "congress.gov",
  "gur.gov.ua",
  "hostinger.in",
  "hubspot.com",
  "icook.tw",
  "ikea.com",
  "iloveimg.com",
  "indeed.com",
  "ip.sb",
  "iplocation.io",
  "leetcode.com",
  "noodlemagazine.com",
  "okcupid.com",
  "pcmag.com",
  "philosophy.hku.hk",
  "futbin.com",
  "quillbot.com",
  "shopify.com",
  "slickdeals.net",
  "smallseotools.com",
  "thingiverse.com",
  "time.is",
  "try.tp-link.com",
  "udemy.com",
  "upwork.com",
  "uspto.gov",
  "visa.com",
  "visa.com.hk",
  "visa.com.sg",
  "vecteezy.com",
  "whatismyip.com",
  "worldbank.org",
  "wto.org",
  "www.gov.se",
];
// const PREFIXES = { NL: ["2a02:898:146:64::"], US: ["2602:fc59:11:64::", "2602:fc59:b0:64::"] };
const PREFIXES = { US: ["2602:fc59:b0:64::"] };
const at = "QA==";
const vl = "dmxlc3M=";
const vr = "djJyYXk=";
const ed = "RWRnZVR1bm5lbA==";

// How to generate your own UUID:
// [Windows] Press "Win + R", input cmd and run:  Powershell -NoExit -Command "[guid]::NewGuid()"
let userID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
let cfipApi = ["https://ip.164746.xyz/ipTop10.html", "https://raw.githubusercontent.com/ymyuuu/IPDB/refs/heads/main/BestCF/bestcfv4.txt"];
let dohURL = "https://cloudflare-dns.com/dns-query"; // or https://dns.google/dns-query
let proxyMode = "nat64"; // or "ip"
let proxyCountry = "US"; // or "NL"

const cf = new CF({ proxys, cfhost });

export default {
  /**
   * @param {import("@cloudflare/workers-types").Request} request
   * @param {{UUID: string}} env
   * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    // uuid_validator(request);
    try {
      userID = env.UUID || userID;
      if (!isValidUUID(userID)) throw new Error("uuid is invalid");
      //proxy = env.PROXY || proxy;
      dohURL = env.DOH_URL || dohURL;
      const url = new URL(request.url);
      const upgradeHeader = request.headers.get("Upgrade");
      proxyMode = url.searchParams.get("pm") || proxyMode;
      proxyCountry = url.searchParams.get("pc")?.toUpperCase() || proxyCountry;
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        switch (url.pathname) {
          case `/cf`: {
            return new Response(JSON.stringify(request.cf, null, 4), {
              status: 200,
              headers: {
                "Content-Type": "application/json;charset=utf-8",
              },
            });
          }
          case `/${userID}`: {
            const host = request.headers.get("Host");
            if (/curl|wget/.test(request.headers.get("User-Agent"))) {
              return new Response(vSampleConfig(userID, host), {
                status: 200,
                headers: { "Content-Type": "text/plain;charset=utf-8" },
              });
            }
            return new Response(getUI(userID, host), {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
          case `/sub/${userID}`: {
            // const url = new URL(request.url); const searchParams = url.searchParams;
            // if (env.CFIP_API) cfipApi = env.CFIP_API.split(/[\s|,]+/);
            return new Response(await createSub(userID, request.headers, proxyMode), {
              status: 200,
              headers: { "Content-Type": "text/plain;charset=utf-8" },
            });
          }
          case `/bestip/${userID}`: {
            return fetch(`https://sub.cmliussss.net/sub?host=${request.headers.get("Host")}&uuid=${userID}&path=/`, {
              headers: request.headers,
            });
            // return Response.redirect(`https://bestip.06151953.xyz/auto?host=${request.headers.get("Host")}&uuid=${userID}&path=/`, 301);
          }
          case `/${userID}/sub`: {
            return Response.redirect(`https://${request.headers.get("Host")}/sub/${userID}`);
          }
          case "/":
            const { cf: c, headers: h } = request;
            const city = c.city || c.timezone.split("/")[1];
            const wh = "https://m.weathercn.com";
            const wu = wh + "/current-weather.do?partner=1000001071_hfaw";
            const page = `<!DOCTYPE html><html><head><meta charset="UTF-8">
		          <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>来自-${city}</title></head>
              <body><p>${c.country} - ${c.region || c.country} - ${c.city} | Timezone:${c.timezone} | IP: ${h.get("cf-connecting-ip")}</p>
              <p><a href="/cf">查看连接信息</a> | <a href="https://speedtest.net" target="_blank">测网速</a></p>
              <p><a id="link" href="${wu}" target="_blank">查看[<span id="cityName">${city}</span>]逐小时天气预报</a></p>
              <script>
                fetch('${wh}/citysearchajax.do?partner=1000001071_hfaw&q=${city.replace(/_| /g, "")}').then(r => r.json()).then(r => {
                    let cityName = '${city}', id = '';
                    if (r.listAccuCity) {
                      cityName = r.listAccuCity[0].localizedName;
                      id = r.listAccuCity[0].key;
                      document.title = cityName + '-天气'
                      document.querySelector('#cityName').innerText = cityName
                      document.querySelector('#link').href = '${wu}&id=' + id
                    }  
                  })
                  .catch(console.error);  
              </script></body></html>`;
            return new Response(page, { headers: { "content-type": "text/html;charset=UTF-8" } });
          default:
            return new Response("Not found", { status: 404 });
        }
      } else {
        if (!cf.KV && env.KV) {
          cf.setKV(env.KV);
          cf.loadCfhost();
          cf.loadProxys();
        }
        console.log(
          `fetch() ${cf.proxys[443].length}(443) ${cf.proxys[80]?.length}(80) ${cf.proxys["openai"]?.length}(openai) ${cf.proxys["x"]?.length}(x), ${cf.cfhost.size}, kv loaded: proxys ${cf.proxysLoaded}, cfhost ${cf.cfhostLoaded}, raw ${cf.cfhostRaw}`,
        );
        return await vOverWSHandler(request);
      }
    } catch (err) {
      /** @type {Error} */ let e = err;
      console.error(err);
      return new Response(e.toString());
    }
  },
};

export async function uuid_validator(request) {
  const hostname = request.headers.get("Host");
  const currentDate = new Date();

  const subdomain = hostname.split(".")[0];
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;

  // const daliy_sub = formattedDate + subdomain
  const hashHex = await hashHex_f(subdomain);
  // subdomain string contains timestamps utc and uuid string TODO.
  console.log(hashHex, subdomain, formattedDate);
}

export async function hashHex_f(string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Handles V over WebSocket requests by creating a WebSocket pair, accepting the WebSocket connection, and processing the V header.
 * @param {import("@cloudflare/workers-types").Request} request The incoming request object.
 * @returns {Promise<Response>} A Promise that resolves to a WebSocket response object.
 */
async function vOverWSHandler(request) {
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);
  webSocket.accept();

  let address = "";
  let portWithRandomLog = "";
  let currentDate = new Date().toUTCString();
  const log = (/** @type {string} */ info, /** @type {string | undefined} */ event) => {
    console.log(`[${currentDate} ${address}:${portWithRandomLog}] ${info}`, event || "");
  };
  const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";

  const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

  /** @type {{ value: import("@cloudflare/workers-types").Socket | null}}*/
  let remoteSocketWapper = {
    value: null,
  };
  let udpStreamWrite = null;
  let isDns = false;

  // ws --> remote
  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (isDns && udpStreamWrite) {
            return udpStreamWrite(chunk);
          }
          if (remoteSocketWapper.value) {
            const writer = remoteSocketWapper.value.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }

          const { hasError, message, portRemote = 443, addressRemote = "", rawDataIndex, vVersion = new Uint8Array([0, 0]), isUDP } = processVHeader(chunk, userID);
          address = addressRemote;
          portWithRandomLog = `${portRemote} ${isUDP ? "udp" : "tcp"} `;
          if (hasError) {
            // controller.error(message);
            // throw new Error(message); // cf seems has bug, controller.error will not end stream
            return safeCloseWebSocket(webSocket, 1008, message);
          }
          // Handle UDP connections for DNS (port 53) only
          if (isUDP) {
            if (portRemote === 53) {
              isDns = true;
            } else {
              return safeCloseWebSocket(webSocket, 1003, "UDP proxy only enabled for DNS which is port 53");
            }
          }
          // ["version", "附加信息长度 N"]
          const vResponseHeader = new Uint8Array([vVersion[0], 0]);
          const rawClientData = chunk.slice(rawDataIndex);

          // TODO: support udp here when cf runtime has udp support
          if (isDns) {
            const { write } = await handleUDPOutBound(webSocket, vResponseHeader, log);
            udpStreamWrite = write;
            udpStreamWrite(rawClientData);
            return;
          }
          handleTCPOutBound(remoteSocketWapper, addressRemote, portRemote, rawClientData, webSocket, vResponseHeader, log);
        },
        close() {
          log(`readableWebSocketStream is close`);
        },
        abort(reason) {
          log(`readableWebSocketStream is abort`, JSON.stringify(reason));
        },
      }),
    )
    .catch(err => {
      log("readableWebSocketStream pipeTo error", err);
      safeCloseWebSocket(remoteSocketWapper.value);
    });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

/**
 * Handles outbound TCP connections.
 *
 * @param {any} remoteSocket
 * @param {string} addressRemote The remote address to connect to.
 * @param {number} portRemote The remote port to connect to.
 * @param {Uint8Array} rawClientData The raw client data to write.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket to pass the remote socket to.
 * @param {Uint8Array} vResponseHeader The V response header.
 * @param {function} log The logging function.
 * @returns {Promise<void>} The remote socket.
 */
async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, vResponseHeader, log) {
  /**
   * Connects to a given address and port and writes data to the socket.
   * @param {string} address The address to connect to.
   * @param {number} port The port to connect to.
   * @returns {Promise<import("@cloudflare/workers-types").Socket>} A Promise that resolves to the connected socket.
   */
  async function connectAndWrite(address, port) {
    try {
      /** @type {import("@cloudflare/workers-types").Socket} */
      const tcpSocket = connect({ hostname: address, port });
      remoteSocket.value = tcpSocket;
      log(`connected to ${address}:${port}`);
      const writer = tcpSocket.writable.getWriter();
      await writer.write(rawClientData); // first write, nomal is tls client hello
      writer.releaseLock();
      return tcpSocket;
    } catch (e) {
      log("connectAndWrite error", e);
      try {
        if (remoteSocket.value && remoteSocket.value.close) remoteSocket.value.close();
      } catch (e) {
        log("Error closing remote socket", e);
      }
      return null;
    }
  }

  /**
   * Retries connecting to the remote address and port if the Cloudflare socket has no incoming data.
   * @returns {Promise<void>} A Promise that resolves when the retry is complete.
   */
  async function retry() {
    let proxy;
    if (proxyMode == "nat64") {
      try {
        if (!(typeof r == "number")) {
          proxy = await getIPv6Proxy(addressRemote);
        } else if (!addressRemote.includes(":")) {
          proxy = convertToNAT64IPv6(addressRemote);
        }
      } catch (e) {
        console.error("NAT64 resolution failed, fallback to Proxy IP", e);
      }
    }
    if (!proxy) {
      proxy = await cf.getProxy(addressRemote, portRemote);
    }
    const tcpSocket = await connectAndWrite(proxy || addressRemote, portRemote);
    if (!tcpSocket) {
      return safeCloseWebSocket(webSocket, 1011, "Failed to reconnect to remote");
    }
    tcpSocket.closed
      .catch(error => {
        console.error("retry tcpSocket closed error", error);
        if (proxyMode != "nat64" && /HTTP|fetch/i.test(error) && proxy) cf.deleteProxy(proxy);
      })
      .finally(() => safeCloseWebSocket(webSocket));
    remoteSocketToWS(tcpSocket, webSocket, vResponseHeader, log);
  }
  let r = undefined;
  if (addressRemote.includes(":") || isIpv4.test(addressRemote)) r = inCfcidr(addressRemote);
  else r = cf.cfhost.has(addressRemote) || cfhostRE.test(addressRemote);
  if (r) {
    log(`Hit proxy`);
    retry(); // r: true|4|6
  } else {
    const tcpSocket = await connectAndWrite(addressRemote, portRemote);
    if (!tcpSocket) {
      return safeCloseWebSocket(webSocket, 1011, "Failed to connect to remote");
    }
    // when remoteSocket is ready, pass to websocket. remote--> ws
    if (!(await remoteSocketToWS(tcpSocket, webSocket, vResponseHeader, log))) {
      retry(); // r: false|undefined|0
      r === false && cf.KV && cf.tagCfhost(addressRemote);
    }
  }
}

/**
 * Creates a readable stream from a WebSocket server, allowing for data to be read from the WebSocket.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocketServer The WebSocket server to create the readable stream from.
 * @param {string} earlyDataHeader The header containing early data for WebSocket 0-RTT.
 * @param {(info: string)=> void} log The logging function.
 * @returns {ReadableStream} A readable stream that can be used to read data from the WebSocket.
 */
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  let readableStreamCancel = false;
  const stream = new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener("message", event => {
        // 如果流已被取消，不再处理新消息
        if (readableStreamCancel) {
          return;
        }
        const message = event.data;
        controller.enqueue(message);
      });
      // The event means that the client closed the client -> server stream.
      // However, the server -> client stream is still open until you call close() on the server side.
      // The WebSocket protocol says that a separate close message must be sent in each direction to fully close the socket.
      webSocketServer.addEventListener("close", () => {
        // client send close, need close server
        // if stream is cancel, skip controller.close
        safeCloseWebSocket(webSocketServer);
        if (readableStreamCancel) {
          return;
        }
        controller.close();
      });

      webSocketServer.addEventListener("error", err => {
        log("webSocketServer has error");
        controller.error(err);
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) {
        controller.error(error);
      } else if (earlyData) {
        controller.enqueue(earlyData);
      }
    },

    pull(controller) {
      // if ws can stop read if stream is full, we can implement backpressure
      // https://streams.spec.whatwg.org/#example-rs-push-backpressure
    },

    cancel(reason) {
      // 流被取消的几种情况：
      // 1. 当管道的 WritableStream 有错误时，这个取消函数会被调用，所以在这里处理 WebSocket 服务器的关闭
      // 2. 如果 ReadableStream 被取消，所有 controller.close/enqueue 都需要跳过
      // 3. 但是经过测试，即使 ReadableStream 被取消，controller.error 仍然有效
      if (readableStreamCancel) {
        return;
      }
      log(`ReadableStream was canceled, due to ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });

  return stream;
}

// https://xtls.github.io/development/protocols/vless.html
// https://github.com/zizifn/excalidraw-backup/blob/main/v2ray-protocol.excalidraw

/**
 * Processes the V header buffer and returns an object with the relevant information.
 * @param {ArrayBuffer} vBuffer The V header buffer to process.
 * @param {string} userID The user ID to validate against the UUID in the V header.
 * @returns {{
 *  hasError: boolean,
 *  message?: string,
 *  addressRemote?: string,
 *  addressType?: number,
 *  portRemote?: number,
 *  rawDataIndex?: number,
 *  vVersion?: Uint8Array,
 *  isUDP?: boolean
 * }} An object with the relevant information extracted from the V header buffer.
 */
function processVHeader(vBuffer, userID) {
  if (vBuffer.byteLength < 24) {
    return {
      hasError: true,
      message: "invalid data",
    };
  }

  const version = new Uint8Array(vBuffer.slice(0, 1));
  let isUDP = false;
  const slicedBuffer = new Uint8Array(vBuffer.slice(1, 17));
  let slicedBufferString;
  slicedBufferString = stringify(slicedBuffer);
  const isValidUser = slicedBufferString && slicedBufferString === userID.trim();
  console.log(`userID: ${slicedBufferString}`);

  if (!isValidUser) {
    return {
      hasError: true,
      message: "invalid user",
    };
  }

  const optLength = new Uint8Array(vBuffer.slice(17, 18))[0];
  //skip opt for now

  const command = new Uint8Array(vBuffer.slice(18 + optLength, 18 + optLength + 1))[0];

  // 0x01 TCP
  // 0x02 UDP
  // 0x03 MUX
  if (command === 1) {
    isUDP = false;
  } else if (command === 2) {
    isUDP = true;
  } else {
    return {
      hasError: true,
      message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
    };
  }
  const portIndex = 18 + optLength + 1;
  const portBuffer = vBuffer.slice(portIndex, portIndex + 2);
  // port is big-Endian in raw data etc 80 == 0x005d
  const portRemote = new DataView(portBuffer).getUint16(0);

  let addressIndex = portIndex + 2;
  const addressBuffer = new Uint8Array(vBuffer.slice(addressIndex, addressIndex + 1));

  // 1--> ipv4  addressLength =4
  // 2--> domain name addressLength=addressBuffer[1]
  // 3--> ipv6  addressLength =16
  const addressType = addressBuffer[0];
  let addressLength = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue = "";
  switch (addressType) {
    case 1:
      addressLength = 4;
      // 将 4 个字节转为点分十进制格式
      addressValue = new Uint8Array(vBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
      break;
    case 2:
      addressLength = new Uint8Array(vBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(vBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 3:
      addressLength = 16;
      const dataView = new DataView(vBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      // 2001:0db8:85a3:0000:0000:8a2e:0370:7334
      // 每 2 字节构成 IPv6 地址的一部分
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(":");
      // seems no need add [] for ipv6
      break;
    default:
      return {
        hasError: true,
        message: `invalid  addressType is ${addressType}`,
      };
  }
  if (!addressValue) {
    return {
      hasError: true,
      message: `addressValue is empty, addressType is ${addressType}`,
    };
  }

  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vVersion: version,
    isUDP,
  };
}

/**
 * Converts a remote socket to a WebSocket connection.
 * @param {import("@cloudflare/workers-types").Socket} remoteSocket The remote socket to convert.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket to connect to.
 * @param {ArrayBuffer | null} vResponseHeader The V response header.
 * @param {(() => Promise<void>) | null} retry The function to retry the connection if it fails.
 * @param {(info: string) => void} log The logging function.
 * @returns {Promise<void>} A Promise that resolves when the conversion is complete.
 */
async function remoteSocketToWS(remoteSocket, webSocket, vResponseHeader, log) {
  // remote--> ws
  // let remoteChunkCount = 0;
  /** @type {ArrayBuffer | null} */
  let vHeader = vResponseHeader;
  let hasIncomingData = false; // check if remoteSocket has incoming data
  await remoteSocket.readable
    .pipeTo(
      new WritableStream({
        start() {},
        /**
         * @param {Uint8Array} chunk
         * @param {*} controller
         */
        async write(chunk, controller) {
          hasIncomingData = true;
          // remoteChunkCount++;
          if (webSocket.readyState !== WS_READY_STATE_OPEN) {
            controller.error("webSocket.readyState is not open, maybe close");
          }
          if (vHeader) {
            webSocket.send(await new Blob([vHeader, chunk]).arrayBuffer());
            vHeader = null;
          } else {
            // console.log(`remoteSocketToWS send chunk ${chunk.byteLength}`);
            // seems no need rate limit this, CF seems fix this??..
            // if (remoteChunkCount > 20000) {
            // 	// cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
            // 	await delay(1);
            // }
            webSocket.send(chunk);
          }
        },
        close() {
          log(`remoteConnection!.readable is close with hasIncomingData is ${hasIncomingData}`);
          // safeCloseWebSocket(webSocket); // no need server close websocket frist for some case will casue HTTP ERR_CONTENT_LENGTH_MISMATCH issue, client will send close event anyway.
        },
        abort(reason) {
          console.error(`remoteConnection!.readable abort`, reason);
        },
      }),
    )
    .catch(error => {
      console.error(`remoteSocketToWS has exception `, error.stack || error);
      safeCloseWebSocket(webSocket);
    });

  // seems is cf connect socket have error,
  // 1. Socket.closed will have error
  // 2. Socket.readable will be close without any data coming
  //if (!hasIncomingData && retry) {
  // log(`retry`)
  // retry();
  //}
  return hasIncomingData;
}

function convertToNAT64IPv6(ipv4) {
  const parts = ipv4.split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid IPv4");
  }

  const hex = parts.map(part => {
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) throw new Error("Invalid IPv4 segment");
    return num.toString(16).padStart(2, "0");
  });
  // const prefixes = ["2602:fc59:b0:64::"];
  const prefix = random(PREFIXES[proxyCountry]) || PREFIXES["US"][0];
  return `[${prefix}${hex[0]}${hex[1]}:${hex[2]}${hex[3]}]`;
}

async function getIPv6Proxy(domain) {
  try {
    const data = await fetch(`${dohURL}?name=${domain}&type=A`, {
      headers: { Accept: "application/dns-json" },
    }).then(r => r.json());

    if (data.Answer && data.Answer.length > 0) {
      const aRecord = data.Answer.find(r => r.type === 1);
      if (aRecord) {
        return convertToNAT64IPv6(aRecord.data);
      }
    }
    throw new Error("Failed to resolve domain!");
  } catch (err) {
    throw new Error(`DNS resolution failed ${err.message}`);
  }
}

/**
 * Decodes a base64 string into an ArrayBuffer.
 * @param {string} base64Str The base64 string to decode.
 * @returns {{earlyData: ArrayBuffer|null, error: Error|null}} An object containing the decoded ArrayBuffer or null if there was an error, and any error that occurred during decoding or null if there was no error.
 */
function base64ToArrayBuffer(base64Str) {
  if (!base64Str) {
    return { earlyData: null, error: null };
  }
  try {
    // go use modified Base64 for URL rfc4648 which js atob not support
    // 这种变体使用 '-' 和 '_' 来代替标准 Base64 中的 '+' 和 '/'
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, c => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { earlyData: null, error };
  }
}

/**
 * Checks if a given string is a valid UUID.
 * Note: This is not a real UUID validation.
 * @param {string} uuid The string to validate as a UUID.
 * @returns {boolean} True if the string is a valid UUID, false otherwise.
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
/**
 * Closes a WebSocket connection safely without throwing exceptions.
 * @param {import("@cloudflare/workers-types").WebSocket} socket The WebSocket connection to close.
 */
function safeCloseWebSocket(socket, code, reason = "") {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
      code ? socket.close(code, reason) : socket.close();
    }
  } catch (error) {
    console.error("safeCloseWebSocket error", error);
  }
}

const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset + 0]] +
    byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] +
    byteToHex[arr[offset + 3]] +
    "-" +
    byteToHex[arr[offset + 4]] +
    byteToHex[arr[offset + 5]] +
    "-" +
    byteToHex[arr[offset + 6]] +
    byteToHex[arr[offset + 7]] +
    "-" +
    byteToHex[arr[offset + 8]] +
    byteToHex[arr[offset + 9]] +
    "-" +
    byteToHex[arr[offset + 10]] +
    byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] +
    byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] +
    byteToHex[arr[offset + 15]]
  ).toLowerCase();
}

function stringify(arr, offset = 0) {
  try {
    const uuid = unsafeStringify(arr, offset);
    if (!isValidUUID(uuid)) {
      console.error("Stringified UUID is invalid");
      return null;
    }
    return uuid;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * Handles outbound UDP traffic by transforming the data into DNS queries and sending them over a WebSocket connection.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket connection to send the DNS queries over.
 * @param {ArrayBuffer} vResponseHeader The V response header.
 * @param {(string) => void} log The logging function.
 * @returns {{write: (chunk: Uint8Array) => void}} An object with a write method that accepts a Uint8Array chunk to write to the transform stream.
 */
async function handleUDPOutBound(webSocket, vResponseHeader, log) {
  let isVHeaderSent = false;
  const transformStream = new TransformStream({
    start(controller) {},
    transform(chunk, controller) {
      // udp message 2 byte is the the length of udp data
      // TODO: this should have bug, beacsue maybe udp chunk can be in two websocket message
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
        index = index + 2 + udpPakcetLength;
        controller.enqueue(udpData);
      }
    },
    flush(controller) {},
  });

  // only handle dns udp for now
  transformStream.readable
    .pipeTo(
      new WritableStream({
        async write(chunk) {
          const resp = await fetch(
            dohURL, // dns server url
            {
              method: "POST",
              headers: { "content-type": "application/dns-message" },
              body: chunk,
            },
          );
          const dnsQueryResult = await resp.arrayBuffer();
          const udpSize = dnsQueryResult.byteLength;
          // console.log([...new Uint8Array(dnsQueryResult)].map((x) => x.toString(16)));
          const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
          if (webSocket.readyState === WS_READY_STATE_OPEN) {
            log(`doh success and dns message length is ${udpSize}`);
            if (isVHeaderSent) {
              webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
            } else {
              webSocket.send(await new Blob([vResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
              isVHeaderSent = true;
            }
          }
        },
      }),
    )
    .catch(error => {
      log("dns udp has error" + error);
    });

  const writer = transformStream.writable.getWriter();

  return {
    /**
     * @param {Uint8Array} chunk
     */
    write(chunk) {
      writer.write(chunk);
    },
  };
}

function decodeUI(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const decoded = bytes.map(b => b ^ 0x55);
  return new TextDecoder().decode(decoded);
}

function vBaseConfig(id, addr, port, host, tls = false, mode = "nat64", mark = "") {
  let sc = "security=none";
  let suffix = port;
  if (tls) {
    sc = `security=tls&sni=${host}`;
    suffix = "tls-" + suffix;
  }
  if (mode == "nat64") suffix += "-nat64";
  const path = encodeURIComponent(`/?pm=${mode}`);
  return `${atob(vl)}://${id}${atob(at)}${addr}:${port}?${sc}&encryption=none&fp=chrome&type=ws&host=${host}&path=${path}#${mark}${addr}-${suffix}`;
}

function vSampleConfig(userID, host) {
  const isWorker = host.endsWith("workers.dev");
  return vBaseConfig(userID, isWorker ? domains[0] : host, isWorker ? 80 : 443, host, !isWorker);
}

// ================= UI界面 =================
function getUI(userID, host) {
  const vSample = vSampleConfig(userID, host);
  let html = decodeUI(ui);
  return html
    .replace("${pt}", host.endsWith("workers.dev") ? "WS" : "TLS + WS")
    .replace("${vSample}", vSample)
    .replace(/\$\{host\}/g, host)
    .replace(/\$\{userID\}/g, userID);
}

// ==================== 生成订阅配置 ====================
async function createSub(userID, headers, mode) {
  const portSet_http = [80, 8080, 8880, 2052, 2086, 2095, 2082];
  const portSet_https = [443, 8443, 2053, 2096, 2087, 2083];
  const hostName = headers.get("Host");
  const configs = [];
  let geos = {};
  if (!/\.(\d+)$/.test(domains[domains.length - 1])) {
    let ps = cfipApi.map(u =>
      fetch(u, { headers })
        .then(r => r.text())
        .catch(e => ""),
    );
    let ips = await Promise.allSettled(ps).then(rs => rs.reduce((acc, r) => (!r.value.includes("html") && acc.push(...r.value.split(/[^\.\d]+/)), acc), []).filter(e => e));
    if (ips.length) {
      domains.push(...ips);
      geos = await geoLookupBatch(ips);
    }
  }

  if (hostName.includes("workers.dev")) {
    for (const port of portSet_http) {
      for (const addr of domains) {
        const mark = geos[addr] ? `${geos[addr].countryCode}-${geos[addr].region}-${geos[addr].city}-` : "";
        configs.push(vBaseConfig(userID, addr, port, hostName, false, mode, mark));
      }
    }
  } else {
    domains.push(hostName);
    for (const port of portSet_https) {
      for (const addr of domains) {
        const mark = geos[addr] ? `${geos[addr].countryCode}-${geos[addr].region}-${geos[addr].city}-` : "";
        configs.push(vBaseConfig(userID, addr, port, hostName, true, mode, mark));
      }
    }
  }
  return btoa(configs.join("\n"));
}
async function geoLookupBatch(ips) {
  const dict = {};

  const res = await fetch("http://ip-api.com/batch?fields=query,countryCode,regionName,city,timezone,status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ips),
  });
  if (!res.ok) throw new Error(`ip-api request failed: ${res.status}`);

  const data = await res.json();
  for (const item of data) {
    if (item.status === "success") {
      dict[item.query] = {
        ip: item.query,
        country: item.country,
        countryCode: item.countryCode,
        region: item.regionName,
        city: item.city,
        timezone: item.timezone,
      };
    }
  }

  return dict;
}
