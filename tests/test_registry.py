"""Contract tests for signatures/ai-bots.json and signatures/fixtures.json.

Matching contract shared by every implementation: the FIRST bot (in file
order) whose `ua` regex matches the user agent (case-insensitive) wins.
"""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PURPOSES = {"training", "indexing", "retrieval", "unknown"}
KINDS = {"ai", "search", "social", "other"}
REQUIRED_UA = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot",
    "Claude-User", "PerplexityBot", "Perplexity-User", "Bytespider", "Amazonbot",
    "meta-externalagent", "CCBot", "Google-CloudVertexBot", "Applebot",
    "DuckAssistBot", "MistralAI-User", "Googlebot", "bingbot",
]


def load():
    reg = json.loads((ROOT / "signatures" / "ai-bots.json").read_text())
    fx = json.loads((ROOT / "signatures" / "fixtures.json").read_text())
    return reg["bots"], fx["cases"]


def match(bots, ua):
    for b in bots:
        if re.search(b["ua"], ua or "", re.I):
            return b
    return None


class RegistryTest(unittest.TestCase):
    def test_entries_are_well_formed(self):
        bots, _ = load()
        ids = [b["id"] for b in bots]
        self.assertEqual(len(ids), len(set(ids)), "duplicate ids")
        for b in bots:
            self.assertIn(b["purpose"], PURPOSES, b["id"])
            self.assertIn(b["kind"], KINDS, b["id"])
            re.compile(b["ua"], re.I)
            for key in ("name", "operator", "robots", "docs"):
                self.assertIn(key, b, b["id"])
            self.assertIn("ipSources", b, b["id"])

    def test_fixtures_cover_required_bots(self):
        _, cases = load()
        blob = " ".join(c["ua"] for c in cases).lower()
        for token in REQUIRED_UA:
            self.assertIn(token.lower(), blob, f"no fixture for {token}")

    def test_fixtures_match_expectations(self):
        bots, cases = load()
        for c in cases:
            got = match(bots, c["ua"])
            exp = c["expect"]
            if exp is None:
                self.assertIsNone(got, c["ua"])
                continue
            self.assertIsNotNone(got, c["ua"])
            self.assertEqual(got["id"], exp["id"], c["ua"])
            self.assertEqual(got["purpose"], exp["purpose"], c["ua"])
            self.assertEqual(got["kind"], exp["kind"], c["ua"])

    def test_humans_and_empty_never_match(self):
        bots, _ = load()
        for ua in ["", None,
                   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) LinkedInApp/9.0",
                   "Mozilla/5.0 (Linux; Android 14) Telegram-Android/10.0 Discord/200"]:
            self.assertIsNone(match(bots, ua), ua)


if __name__ == "__main__":
    unittest.main()
