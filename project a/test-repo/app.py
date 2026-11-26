# Deliberately insecure code for ThreatLens testing.
import pickle
import sqlite3
import subprocess
import hashlib
from flask import Flask, request

app = Flask(__name__)


@app.route("/user")
def get_user():
    user_id = request.args.get("id")
    conn = sqlite3.connect("app.db")
    # SQL injection: string formatting into a query
    cur = conn.execute("SELECT * FROM users WHERE id = '%s'" % user_id)
    return str(cur.fetchall())


@app.route("/ping")
def ping():
    host = request.args.get("host")
    # Command injection: shell=True with user input
    return subprocess.check_output("ping -c 1 " + host, shell=True)


@app.route("/load", methods=["POST"])
def load():
    # Insecure deserialization of untrusted input
    return str(pickle.loads(request.data))


def hash_password(pw: str) -> str:
    # Weak hash for passwords
    return hashlib.md5(pw.encode()).hexdigest()


if __name__ == "__main__":
    app.run(debug=True)
