# test_service.py -- verifies the service reproduces the known training scores.
# Run the service first (Step 6), then run: python test_service.py

import requests

URL = "https://vigilante-azjt.onrender.com/score"

# (sender, subject, snippet, expected_score)
# expected values are the known scores from the model's
# fresh-email stress test in Colab.
CASES = [
    (
        "Google <no-reply@accounts.google.com>",
        "Security alert: new sign-in on Windows",
        "A new device signed in to your account",
        0.652
    ),
    (
        "HDFC Bank <alerts@hdfcbank.net>",
        "Your account has been debited Rs. 4,500",
        "Transaction alert for your account",
        0.576
    ),
    (
        "Priya Sharma <priya.sharma@gmail.com>",
        "Re: Can we meet tomorrow for the project?",
        "Sure, does 3pm work for you",
        0.417
    ),
    (
        "Amazon <order-update@amazon.in>",
        "Your order has been delivered",
        "Your package was delivered today",
        0.337
    ),
    (
        "Prof. Mehta <mehta@thapar.edu>",
        "Submit your assignment by Friday",
        "Please submit the report before the deadline",
        0.449
    ),
    (
        "Myntra <offers@email.myntra.com>",
        "FLAT 70% OFF ends tonight! Shop now",
        "Biggest sale of the season",
        0.011
    ),
    (
        "LinkedIn <newsletter@linkedin.com>",
        "5 new jobs picked for you this week",
        "Jobs matching your profile",
        0.017
    ),
    (
        "Medium <noreply@medium.com>",
        "Today's digest: 8 stories for you",
        "Recommended reading",
        0.030
    ),
    (
        "Spotify <no-reply@spotify.com>",
        "Your Discover Weekly is ready",
        "New music picked for you",
        0.070
    ),
    (
        "Unstop <noreply@unstop.news>",
        "Hackathon registration closing soon",
        "Register before the deadline",
        0.106
    ),
]

TOL = 0.02
passed = 0

print(f"{'expected':>9} {'got':>7} {'status':<7} subject")
print("-" * 70)

for sender, subject, snippet, expected in CASES:
    r = requests.post(
        URL,
        json={
            "sender": sender,
            "subject": subject,
            "snippet": snippet
        }
    )

    got = r.json()["score"]
    ok = abs(got - expected) <= TOL
    passed += ok

    print(
        f"{expected:>9.3f} {got:>7.3f} "
        f"{'PASS' if ok else 'FAIL':<7} "
        f"{subject[:38]}"
    )

print("-" * 70)
print(f"{passed}/{len(CASES)} cases within +/-{TOL}")

if passed == len(CASES):
    print("SUCCESS: the service reproduces the training scores exactly.")
else:
    print("MISMATCH: see Troubleshooting in the guide.")