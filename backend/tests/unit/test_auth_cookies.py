"""HttpOnly cookie helpers: flags + set/clear round-trip."""

from fastapi import Response

from app.core.security import (
    set_auth_cookies,
    clear_auth_cookies,
    ACCESS_COOKIE,
    REFRESH_COOKIE,
)


def _headers(response: Response) -> list[str]:
    getlist = getattr(response.headers, "getlist", None)
    if getlist:
        return getlist("set-cookie")
    return response.headers.get_list("set-cookie")


def _cookies(response: Response) -> dict[str, str]:
    out: dict[str, str] = {}
    for header in _headers(response):
        pair = header.split(";", 1)[0]
        k, _, v = pair.partition("=")
        out[k.strip()] = v.strip().strip('"')
    return out


def test_set_cookies_are_httponly():
    resp = Response()
    set_auth_cookies(resp, "access-123", "refresh-456")
    raw = "; ".join(_headers(resp)).lower()
    assert ACCESS_COOKIE in raw and REFRESH_COOKIE in raw
    assert raw.count("httponly") == 2
    assert "samesite=lax" in raw
    assert _cookies(resp)[ACCESS_COOKIE] == "access-123"
    assert _cookies(resp)[REFRESH_COOKIE] == "refresh-456"


def test_clear_cookies_expires_both():
    resp = Response()
    set_auth_cookies(resp, "a", "r")
    clear_auth_cookies(resp)
    # delete_cookie appends expiring headers for both names
    names = [h.split(";", 1)[0].split("=")[0].strip() for h in _headers(resp)]
    assert ACCESS_COOKIE in names and REFRESH_COOKIE in names
