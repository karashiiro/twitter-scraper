import { Cookie, CookieJar } from 'tough-cookie';
import setCookie from 'set-cookie-parser';
import type { Headers as HeadersPolyfill } from 'headers-polyfill';

/**
 * Updates a cookie jar with the Set-Cookie headers from the provided Headers instance.
 * @param cookieJar The cookie jar to update.
 * @param url The request URL.
 * @param headers The response headers to populate the cookie jar with.
 */
export async function updateCookieJar(
  cookieJar: CookieJar,
  url: string,
  headers: Headers | HeadersPolyfill,
) {
  const setCookieHeader = headers.get('set-cookie');
  if (setCookieHeader) {
    const cookies = setCookie.splitCookiesString(setCookieHeader);
    for (const cookie of cookies.map((c) => Cookie.parse(c))) {
      if (!cookie) continue;
      console.log(`${cookie.secure ? 'https' : 'http'}://${new URL(url).host}`);
      await cookieJar.setCookie(
        cookie,
        `${cookie.secure ? 'https' : 'http'}://${new URL(url).host}`,
      );
    }
  }
}
