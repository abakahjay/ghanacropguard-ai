import { ApiError, absoluteUrl, api, setBaseUrl, setToken, uploadPrediction } from "@/lib/api";

class FakeXHR {
  static last;
  upload = {};
  headers = {};
  status = 0;
  responseText = "";
  timeout = 0;
  method = "";
  url = "";
  onload;
  onerror;
  ontimeout;
  open(m, u) {
    this.method = m;
    this.url = u;
  }
  setRequestHeader(k, v) {
    this.headers[k] = v;
  }
  send() {
    FakeXHR.last = this;
  }
}

beforeEach(async () => {
  global.XMLHttpRequest = FakeXHR;
  await setBaseUrl("http://test.local:7004");
  await setToken("tok");
});

test("upload sends auth header, reports progress, resolves on 201", async () => {
  const progress = [];
  const p = uploadPrediction("file:///a.jpg", (f) => progress.push(f));
  const x = FakeXHR.last;
  expect(x.url).toBe("http://test.local:7004/api/v1/cropguard/predictions");
  expect(x.headers.Authorization).toBe("Bearer tok");
  x.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
  x.status = 201;
  x.responseText = JSON.stringify({ id: "abc" });
  x.onload?.();
  await expect(p).resolves.toEqual({ id: "abc" });
  expect(progress).toEqual([0.5]);
});

test("upload surfaces the server's error message (e.g. model unavailable)", async () => {
  const p = uploadPrediction("file:///a.jpg", () => {});
  const x = FakeXHR.last;
  x.status = 503;
  x.responseText = JSON.stringify({
    detail: { code: "model_unavailable", message: "The AI model is not available right now." },
  });
  x.onload?.();
  await expect(p).rejects.toMatchObject({ status: 503, code: "model_unavailable" });
});

test("upload network error becomes a friendly ApiError", async () => {
  const p = uploadPrediction("file:///a.jpg", () => {});
  FakeXHR.last.onerror?.();
  await expect(p).rejects.toBeInstanceOf(ApiError);
});

test("api() maps fetch failure to an offline message", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  await expect(api("/health")).rejects.toMatchObject({ status: 0, code: "network" });
});

test("server address validation and absolute image URLs", async () => {
  await expect(setBaseUrl("not a url")).rejects.toBeInstanceOf(ApiError);
  await setBaseUrl("http://192.168.1.20:7004/");
  expect(absoluteUrl("/api/v1/cropguard/predictions/x/image?sig=1")).toBe(
    "http://192.168.1.20:7004/api/v1/cropguard/predictions/x/image?sig=1",
  );
  expect(absoluteUrl(null)).toBeNull();
});
