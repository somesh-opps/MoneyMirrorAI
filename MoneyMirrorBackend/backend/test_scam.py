import json
from main import scam_shield
from pydantic import BaseModel

class ScamShieldPayload(BaseModel):
    message: str

test_cases = {
    "Expected SAFE": [
        "Your SBI account statement is ready.\nVisit https://sbi.co.in",
        "Your Amazon order has been delivered.",
        "Your ICICI Bank KYC update is pending."
    ],
    "Expected SUSPICIOUS": [
        "Your account needs verification.\nClick here.",
        "Your reward is waiting.\nClaim now."
    ],
    "Expected DANGEROUS": [
        "Your KYC expires today.\nClick verify-kyc.xyz immediately.\nEnter OTP.",
        "Refund pending.\nEnter UPI PIN to receive money.",
        "Your account will be blocked in 30 minutes.\nVerify your password now.",
        "You won ₹50,000.\nClaim immediately using this link."
    ]
}

for expected_type, messages in test_cases.items():
    print(f"\\n=== {expected_type} ===")
    for msg in messages:
        payload = ScamShieldPayload(message=msg)
        result = scam_shield(payload)
        print(f"\\nMessage: {msg}")
        print(f"Verdict: {result['verdict']} | Score: {result['risk_score']}")
        print(f"Trust Signals: {result['trust_signals']}")
        print(f"Critical Flags: {result['critical_flags']}")
        print(f"Risk Reasons: {result['risk_reasons']}")
