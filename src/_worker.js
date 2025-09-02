// @ts-ignore
import { connect } from "cloudflare:sockets";
import CF, { cfhostRE, inCfcidr } from "./cfutil";
import proxys from "./proxys.json";
import cfhost from "./cfhost.json";

// How to generate your own UUID:
// [Windows] Press "Win + R", input cmd and run:  Powershell -NoExit -Command "[guid]::NewGuid()"
let userID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

// reversed proxy (Non-CF ISP)
//const proxys = ["edgetunnel.anycast.eu.org","cdn.xn--b6gac.eu.org","cdn-b100.xn--b6gac.eu.org","cdn-all.xn--b6gac.eu.org"]
// Anycast/cloudflare.com
const domains = [
  "5ch.net",
  "arca.live",
  "brainly.com",
  "cambridge.org",
  "donmai.us",
  "emojipedia.org",
  "fbi.gov",
  "feedback.bit.ly",
  "fontawesome.com",
  "freecodecamp.org",
  "getbootstrap.com",
  "gur.gov.ua",
  "hdmoli.com",
  "hubspot.com",
  "hugedomains.com",
  "icook.tw",
  "indeed.com",
  "ip.sb",
  "iplocation.io",
  "japan.com",
  "leetcode.com",
  "mdpi.com",
  "noodlemagazine.com",
  "okcupid.com",
  "pcmag.com",
  "philosophy.hku.hk",
  "quillbot.com",
  "russia.com",
  "singapore.com",
  "smallseotools.com",
  "time.is",
  "try.tp-link.com",
  "udemy.com",
  "visa.com",
  "visa.com.hk",
  "visa.com.sg",
  "visa.com.tw",
  "whatismyip.com",
  "wto.org",
  "www.gov.se",
];

// if you want to use ipv6 or single proxy, please add comment at this line and remove comment at the next line
// use single proxy instead of random
//let proxy = 'cdn.xn--b6gac.eu.org';
// ipv6 proxy example remove comment to use
//let proxy6 = "2a01:4f8:c2c:123f:64:5:6810:c55a"
let dohURL = "https://cloudflare-dns.com/dns-query"; // or https://dns.google/dns-query
const cf = new CF({ proxys, cfhost });

if (!isValidUUID(userID)) {
  throw new Error("uuid is invalid");
}

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
      //proxy = env.PROXY || proxy;
      dohURL = env.DOH_URL || dohURL;
      let userID_Path = userID;
      if (userID.includes(",")) {
        userID_Path = userID.split(",")[0];
      }
      if (!cf.KV) {
        cf.setKV(env.KV);
        cf.loadCfhost();
        cf.loadProxys();
      }
      console.log(
        `fetch() ${cf.proxys[443].length}(443) ${cf.proxys[80].length}(80) ${cf.proxys["openai"].length}(openai), ${cf.cfhost.size}, kv loaded: proxys ${cf.proxysLoaded}, cfhost ${cf.cfhostLoaded}, raw ${cf.cfhostRaw}`
      );
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        const url = new URL(request.url);
        switch (url.pathname) {
          case `/cf`: {
            return new Response(JSON.stringify(request.cf, null, 4), {
              status: 200,
              headers: {
                "Content-Type": "application/json;charset=utf-8",
              },
            });
          }
          case `/${userID_Path}`: {
            const host = request.headers.get("Host");
            if (/curl|wget/.test(request.headers.get("User-Agent"))) {
              return new Response(vBaseConfig(userID, host, 443, host, true), {
                status: 200,
                headers: { "Content-Type": "text/plain;charset=utf-8" },
              });
            }
            return new Response(getConfig(userID, host), {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            });
          }
          case `/sub/${userID_Path}`: {
            const url = new URL(request.url);
            // const searchParams = url.searchParams;
            const subConfig = createSub(userID, request.headers.get("Host"));
            // Construct and return response object
            return new Response(btoa(subConfig), {
              status: 200,
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
            });
          }
          case `/bestip/${userID_Path}`: {
            return fetch(`https://bestip.06151953.xyz/auto?host=${host}&uuid=${userID_Path}&path=/`, {
              headers: request.headers,
            });
          }
          default:
            const { cf } = request;
            const city = cf.city || cf.timezone.split("/")[1];
            const whost = "https://m.weathercn.com";
            const wUrl = whost + "/current-weather.do?partner=1000001071_hfaw";
            const page = `<!DOCTYPE html><html><head><meta charset="UTF-8">
		          <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${city}-天气</title></head>
              <body><p>${cf.country} - ${cf.region} - ${cf.city} | Timezone:${cf.timezone}</p>
              <p><a id="link" href="${wUrl}" target="_blank">查看[<span id="cityName">${city}</span>]逐小时天气预报</a></p>
              <p><img src="https://${cf.country == "CN" ? "zh." : ""}wttr.in/${city}_n.png"/></p><script>
                fetch('${whost}/citysearchajax.do?partner=1000001071_hfaw&q=${city.replace(/_| /g, "")}').then(r => r.json()).then(r => {
                    let cityName = '${city}', id = '';
                    if (r.listAccuCity) {
                      cityName = r.listAccuCity[0].localizedName;
                      id = r.listAccuCity[0].key;
                      document.title = cityName + '-天气'
                      document.querySelector('#cityName').innerText = cityName
                      document.querySelector('#link').href = '${wUrl}&id=' + id
                    }  
                  })
                  .catch(console.error);  
              </script></body></html>`;
            return new Response(page, { headers: { "content-type": "text/html;charset=UTF-8" } });
        }
      } else {
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

          const {
            hasError,
            message,
            portRemote = 443,
            addressRemote = "",
            rawDataIndex,
            vVersion = new Uint8Array([0, 0]),
            isUDP,
          } = processVHeader(chunk, userID);
          address = addressRemote;
          portWithRandomLog = `${portRemote} ${isUDP ? "udp" : "tcp"} `;
          if (hasError) {
            // controller.error(message);
            throw new Error(message); // cf seems has bug, controller.error will not end stream
          }
          // Handle UDP connections for DNS (port 53) only
          if (isUDP) {
            if (portRemote === 53) {
              isDns = true;
            } else {
              throw new Error("UDP proxy only enabled for DNS which is port 53");
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
      })
    )
    .catch(err => {
      log("readableWebSocketStream pipeTo error", err);
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
    /** @type {import("@cloudflare/workers-types").Socket} */
    const tcpSocket = connect({
      hostname: address,
      port: port,
    });
    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(rawClientData); // first write, nomal is tls client hello
    writer.releaseLock();
    return tcpSocket;
  }

  /**
   * Retries connecting to the remote address and port if the Cloudflare socket has no incoming data.
   * @returns {Promise<void>} A Promise that resolves when the retry is complete.
   */
  async function retry() {
    const proxy = cf.getProxy(addressRemote, portRemote);
    const tcpSocket = await connectAndWrite(proxy.host || addressRemote, portRemote);
    tcpSocket.closed
      .catch(error => {
        console.log("retry tcpSocket closed error", error);
        if (/HTTP|fetch/i.test(error) && proxy.host) {
          cf.deleteProxy(proxy);
        }
      })
      .finally(() => {
        safeCloseWebSocket(webSocket);
      });
    remoteSocketToWS(tcpSocket, webSocket, vResponseHeader, log);
  }
  let r = undefined;
  if (!cfhostRE.test(addressRemote) && !cf.cfhost.has(addressRemote) && !(r = inCfcidr(addressRemote))) {
    const tcpSocket = await connectAndWrite(addressRemote, portRemote);
    // when remoteSocket is ready, pass to websocket
    // remote--> ws
    if (!(await remoteSocketToWS(tcpSocket, webSocket, vResponseHeader, log))) {
      retry();
      r === false && cf.tagCfhost(addressRemote);
    }
  } else {
    log(`Hit proxy for ${addressRemote}`);
    retry();
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

      webSocketServer.addEventListener("close", () => {
        if (readableStreamCancel) {
          return;
        }
        safeCloseWebSocket(webSocketServer);
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
  let isValidUser = false;
  let isUDP = false;
  const slicedBuffer = new Uint8Array(vBuffer.slice(1, 17));
  const slicedBufferString = stringify(slicedBuffer);
  // check if userID is valid uuid or uuids split by , and contains userID in it otherwise return error message to console
  // isValidUser = uuids.some(userUuid => slicedBufferString === userUuid.trim());
  isValidUser = userID.includes(",")
    ? userID.split(",").some(userUuid => slicedBufferString === userUuid.trim())
    : slicedBufferString === userID.trim();

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
        message: `invild  addressType is ${addressType}`,
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
          if (webSocket.readyState !== WS_READY_STATE_OPEN) {
            controller.error("webSocket.readyState is not open, maybe close");
          }
          hasIncomingData = true;
          // remoteChunkCount++;
          if (vResponseHeader) {
            webSocket.send(await new Blob([vResponseHeader, chunk]).arrayBuffer());
            vResponseHeader = null;
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
      })
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
function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
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
  const uuid = unsafeStringify(arr, offset);
  if (!isValidUUID(uuid)) {
    throw TypeError("Stringified UUID is invalid");
  }
  return uuid;
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
              headers: {
                "content-type": "application/dns-message",
              },
              body: chunk,
            }
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
      })
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
const at = "QA==";
const pt = "dmxlc3M=";
const ed = "RWRnZVR1bm5lbA==";
function vBaseConfig(uuid, address, port, host, tls = false, remark = "") {
  const tlsParam = tls ? `security=tls&sni=${host}` : "security=none";
  return `${atob(pt)}://${uuid}${atob(
    at
  )}${address}:${port}?${tlsParam}&encryption=none&fp=randomized&type=ws&host=${host}&path=%2F%3Fed%3D2048#${address}${remark}`;
}
/**
 *
 * @param {string} userID - single or comma separated userIDs
 * @param {string | null} hostName
 * @returns {string}
 */
function getConfig(userIDs, hostName) {
  // Split the userIDs into an array
  const userIDArray = userIDs.split(",");

  // Prepare output string for each userID
  const sublink = `https://${hostName}/sub/${userIDArray[0]}?format=clash`;
  const subbestip = `https://${hostName}/bestip/${userIDArray[0]}`;
  const clash_link = `https://url.v1.mk/sub?target=clash&url=${encodeURIComponent(
    `https://${hostName}/sub/${userIDArray[0]}?format=clash`
  )}&insert=false&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;

  // HTML Head with CSS and FontAwesome library
  const htmlHead = `
  <head>
	<title>${atob(ed)}: ${atob(pt)} configuration</title>
	<meta name='description' content='This is a tool for generating ${atob(pt)} protocol configurations.' />
	<meta name='keywords' content='${atob(ed)}, cloudflare pages, cloudflare worker, severless' />
	<meta name='viewport' content='width=device-width, initial-scale=1' />
	<meta property='og:site_name' content='${atob(ed)}: ${atob(pt)} configuration' />
	<meta property='og:type' content='website' />
	<meta property='og:title' content='${atob(ed)} - ${atob(pt)} configuration and subscription' />
	<meta property='og:description' content='Use cloudflare pages and worker severless to implement ${atob(pt)} protocol' />
	<meta property='og:url' content='https://${hostName}/' />
	<style>
	body {
	  font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	  background-color: #f0f0f0;
	  color: #333;
    max-width: 900px;
    margin: 20px auto;
	}
	a {
	  color: #1a0dab;
	  text-decoration: none;
	}
	img {
	  max-width: 100%;
	  height: auto;
	}
	pre {
	  white-space: pre-wrap;
	  word-wrap: break-word;
	  background-color: #fff;
	  border: 1px solid #ddd;
	  padding: 15px;
    margin: 0;
	}
	/* Dark mode */
	@media (prefers-color-scheme: dark) {
	  body {
      background-color: #333;
      color: #f0f0f0;
	  }
	  a {
		  color: #9db4ff;
	  }
	  pre {
      background-color: #282a36;
      border-color: #6272a4;
	  }
	}
	</style>
	<link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'>
  </head>
  `;
  // Prepare header string
  const header = `
    <div align='center'>
      <p><img src="https://avatars.githubusercontent.com/u/16624315?v=4" style="height: 75px;border-radius: 50%;"></p>
      <h4>欢迎！这是生成 ${atob(pt)} 协议的配置。</h4>
      <p><a href="//${hostName}/sub/${userIDArray[0]}" class="btn" target="_blank">${atob(
    pt
  )} 订阅</a> | <a href="clash://install-config?url=${encodeURIComponent(
    `https://${hostName}/sub/${userIDArray[0]}?format=clash`
  )}" class="btn" target="_blank">Clash 订阅</a> | 
        <a href="${clash_link}" class="btn" target="_blank">转 Clash 格式</a> | 
        <a href="${subbestip}" class="btn" target="_blank">优选IP·订阅</a>
      </p>
    </div>`;
  // Prepare config output string for each userID
  const output = userIDArray
    .map(userID => {
      const vMain = vBaseConfig(userID, hostName, 443, hostName, true);
      return `<h3>UUID: ${userID}</h3>${atob(pt)} Configuration with default domain
---------------------------------------------------------------
<code>${vMain}</code>
<button onclick='copyToClipboard("${vMain}")'> <i class="fa fa-clipboard"></i> Copy Main</button>
---------------------------------------------------------------`;
    })
    .join("\n");
  // Join output with newlines, wrap inside <html> and <body>
  return `
  <html>
  ${htmlHead}
  <body>
  ${header}
  <pre>${output}</pre>
  <p align="center">本项目相关教程见：<a href="https://my-onedrive.pages.dev/solutions/${atob(ed)}">${atob(ed)}</a></p>
  <h3 align="center">若本项目对您有帮助，请给予捐赠/打赏，以便于更好的维护与优化，感激不尽🙏</h3>
  <div style="display:flex;margin:20px 0;">
    <img src="https://my-onedrive.pages.dev/api/raw?path=/alipay_qrcode.jpg" style="max-width: calc(49% - 10px);margin-right: 20px;">
    <img src="https://my-onedrive.pages.dev/api/raw?path=/wechat_reward_qrcode.png" style="max-width: calc(51% - 10px);">
  </div>
  </body>
  <script>
	function copyToClipboard(text) {
	  navigator.clipboard.writeText(text)
		.then(() => {
		  alert("Copied to clipboard");
		})
		.catch((err) => {
		  console.error("Failed to copy to clipboard:", err);
		});
	}
  </script>
  </html>`;
}

const portSet_http = new Set([80, 8080, 8880, 2052, 2086, 2095, 2082]);
const portSet_https = new Set([443, 8443, 2053, 2096, 2087, 2083]);

function createSub(userID_Path, hostName) {
  const userIDArray = userID_Path.includes(",") ? userID_Path.split(",") : [userID_Path];

  const output = userIDArray.flatMap(userID => {
    const httpConfigurations = !hostName.includes("workers.dev")
      ? []
      : Array.from(portSet_http).flatMap(port => {
          const vMainHttp = vBaseConfig(userID, hostName, port, hostName, false, `-HTTP-${port}`);
          return domains
            .flatMap(domain => {
              return vBaseConfig(userID, domain, port, hostName, false, `-HTTP-${port}-${domain}`);
            })
            .concat(vMainHttp);
        });
    const httpsConfigurations = Array.from(portSet_https).flatMap(port => {
      const vMainHttps = hostName.includes("workers.dev") ? [] : vBaseConfig(userID, hostName, port, hostName, true, `-HTTPS-${port}`);
      return domains
        .flatMap(domain => {
          return vBaseConfig(userID, domain, port, hostName, true, `-HTTPS-${port}-${domain}`);
        })
        .concat(vMainHttps);
    });

    return [...httpConfigurations, ...httpsConfigurations];
  });

  return output.join("\n");
}
