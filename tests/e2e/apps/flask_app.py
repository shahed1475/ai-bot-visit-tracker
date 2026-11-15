"""Flask app with the Flask middleware (report-only). Env: PORT, TRACKER_URL, TRACKER_KEY, SITE."""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../..")
sys.path.insert(0, os.path.join(ROOT, "middleware/python/flask"))
from flask import Flask  # noqa: E402
from ai_bot_tracker_flask import AiBotTrackerFlask  # noqa: E402

app = Flask(__name__)
AiBotTrackerFlask(app, {"database": False, "report": {"endpoint": os.environ["TRACKER_URL"], "key": os.environ["TRACKER_KEY"], "site": os.environ["SITE"]}})


@app.route("/", defaults={"p": ""})
@app.route("/<path:p>")
def page(p):
    if p.endswith("missing"):
        return "not found", 404
    return f"ok /{p}"


app.run(host="127.0.0.1", port=int(os.environ["PORT"]), threaded=True, use_reloader=False)
