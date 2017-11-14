import HttpError from './HttpError';

const mimeType = 'application/vnd.api+json';

const fetchJson = (url, options = {}) => {
  const requestHeaders = options.headers || new Headers({ 'Accept': mimeType });

  if (!(options && options.body && options.body instanceof FormData)) {
    requestHeaders.set('Content-Type', mimeType);
  }

  if (options.user && options.user.authenticated && options.user.token) {
    requestHeaders.set('Authorization', options.user.token);
  }

  return fetch(url, { ...options, headers: requestHeaders })
    .then(response => response.text().then(text => ({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: text
    })))
    .then(({ status, statusText, headers, body }) => {
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        // not json, no big deal
      }
      if (status < 200 || status >= 300) {
        return Promise.reject(new HttpError((json && json.message) || statusText, status));
      }
      return { status, headers, body, json };
    });
};

export const jsonApiHttpClient = (url, options = {}) => {
  if (!options.headers) {
    options.headers = new Headers({ 'Accept': mimeType });
  }
  options.headers.set('Content-Type', mimeType);
  return fetchJson(url, options);
};
