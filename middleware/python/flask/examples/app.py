"""Run: pip install flask && python app.py   then: curl -A "GPTBot/1.4" localhost:5000/ && curl localhost:5000/stats"""
import os
import sys

from flask import Flask, jsonify

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ai_bot_tracker_flask import AiBotTrackerFlask  # noqa: E402

app = Flask(__name__)
tracker = AiBotTrackerFlask(app, {"database": {"type": "sqlite", "path": "bot_visits.sqlite"}})


@app.route("/")
def index():
    return "Hello"


@app.route("/stats")  # add your own authentication before exposing this
def stats():
    return jsonify(tracker.get_stats())


if __name__ == "__main__":
    app.run(port=5000)
