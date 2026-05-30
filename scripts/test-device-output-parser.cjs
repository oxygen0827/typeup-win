const assert = require("node:assert/strict");

const { parseDeviceOutput } = require("../electron/local-server");

const jsonDevices = parseDeviceOutput(`
[agent] 使用 CA 证书: C:\\Users\\Administrator\\AppData\\Local\\Programs\\TypeUp\\resources\\engine\\voice-keyboard\\dist\\TypeUpAgent\\_internal\\certifi\\cacert.pem
{"devices":[{"id":0,"name":"耳机 (Redmi Buds 5 Pro)","default":false},{"id":3,"name":"麦克风 (HyperX Cloud III)","default":true},{"id":12,"name":"Microsoft 阵列麦克风","default":false}]}
`);

assert.deepEqual(jsonDevices, [
  { id: 0, name: "耳机 (Redmi Buds 5 Pro)", default: false },
  { id: 3, name: "麦克风 (HyperX Cloud III)", default: true },
  { id: 12, name: "Microsoft 阵列麦克风", default: false },
]);

const legacyDevices = parseDeviceOutput(`
可用麦克风设备：

  [ 0] 耳机 (Redmi Buds 5 Pro)
  [ 3] 麦克风 (HyperX Cloud III) ← 系统默认
  [12] 阵列麦克风
`);

assert.deepEqual(legacyDevices, [
  { id: 0, name: "耳机 (Redmi Buds 5 Pro)", default: false },
  { id: 3, name: "麦克风 (HyperX Cloud III)", default: true },
  { id: 12, name: "阵列麦克风", default: false },
]);

console.log("device output parser ok");
