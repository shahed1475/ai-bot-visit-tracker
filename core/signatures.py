"""Shared bot registry (signatures/ai-bots.json) for Python.

Matching contract (identical in every language): the first registry entry whose
case-insensitive `ua` regex matches wins; unknown crawlers fall back to "generic-bot".
"""
import ipaddress
import json
import re
from pathlib import Path
from typing import Dict, List, Optional

_REGISTRY_PATH = Path(__file__).resolve().parent.parent / "signatures" / "ai-bots.json"
REGISTRY: List[Dict] = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))["bots"]
_COMPILED = [(b, re.compile(b["ua"], re.IGNORECASE)) for b in REGISTRY]
_GENERIC = re.compile(r"[a-z]bot\b|\bbot\b|\b(crawler|spider|scraper|fetcher|indexer)\b", re.IGNORECASE)
_GENERIC_BOT = {"id": "generic-bot", "name": "Other crawler", "operator": "Unknown", "kind": "other",
                "purpose": "unknown", "ua": "", "ipSources": []}
MAX_UA = 512


def match(user_agent: Optional[str]) -> Optional[Dict]:
    """Return the registry entry for a user agent, a generic entry for unknown crawlers, or None."""
    if not user_agent or not isinstance(user_agent, str):
        return None
    ua = user_agent[:MAX_UA]
    for bot, regex in _COMPILED:
        if regex.search(ua):
            return bot
    return _GENERIC_BOT if _GENERIC.search(ua) else None


def in_ranges(ip: Optional[str], cidrs: List[str]) -> bool:
    """True when ip is inside any CIDR (IPv4, IPv6, IPv4-mapped IPv6). Garbage input is False."""
    try:
        addr = ipaddress.ip_address(str(ip).strip())
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    for cidr in cidrs:
        try:
            net = ipaddress.ip_network(cidr, strict=False)
        except ValueError:
            continue
        if net.version == addr.version and addr in net:
            return True
    return False


def verify(bot: Dict, ip: Optional[str], ranges: Dict[str, List[str]]) -> str:
    """'verified' | 'unverified' | 'unknown' (unknown = no published ranges loaded for this bot)."""
    listed = ranges.get(bot["id"])
    if not ip or not bot.get("ipSources") or not listed:
        return "unknown"
    return "verified" if in_ranges(ip, listed) else "unverified"
