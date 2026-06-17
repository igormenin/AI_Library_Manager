import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

export function logDebug(message: string) {
  try {
    const logPath = path.join(__dirname, '..', 'debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    console.error('logDebug failed to write to file:', e);
  }
}

export function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  logDebug(`HTTP GET requesting: ${url}`);
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      headers: {
        'User-Agent': 'ai-library-manager-vscode-extension',
        ...headers
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      logDebug(`HTTP GET response status: ${res.statusCode} for URL: ${url}`);
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        logDebug(`HTTP GET response data received length: ${data.length} for URL: ${url}`);
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data) as T;
            resolve(parsed);
          } catch (e) {
            logDebug(`HTTP GET JSON parse error: ${(e as Error).message} for URL: ${url}. Raw response snippet: ${data.substring(0, 200)}`);
            reject(new Error(`Failed to parse JSON response: ${(e as Error).message}`));
          }
        } else {
          logDebug(`HTTP GET request failed with status: ${res.statusCode} for URL: ${url}`);
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (err) => {
      logDebug(`HTTP GET request error: ${err.message} for URL: ${url}`);
      reject(err);
    });
  });
}

export function postJson<T>(url: string, body: any, headers: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'User-Agent': 'ai-library-manager-vscode-extension',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch (e) {
            resolve({} as T);
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

export function patchJson<T>(url: string, body: any, headers: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: {
        'User-Agent': 'ai-library-manager-vscode-extension',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch (e) {
            resolve({} as T);
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}
