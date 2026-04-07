"""
Business context weighting for vendor risk scores.

Raw technical scores treat all vendors equally regardless of what data they hold.
These multipliers adjust the effective exposure score based on the sensitivity of
data the vendor can access — so a payment processor with a CRITICAL CVE is treated
differently from a marketing tool with the same CVE.
"""

CONTEXT_MULTIPLIERS: dict[str, float] = {
    "none":      0.8,   # Confirmed no sensitive data access
    "standard":  1.0,   # Default / unknown
    "pii":       1.4,   # Personal / customer data
    "financial": 1.6,   # Payment / financial data
    "auth":      1.6,   # Authentication / SSO provider
    "health":    1.8,   # Health / medical data
    "critical":  2.0,   # Critical infrastructure
}

SENSITIVITY_LABELS: dict[str, str] = {
    "none":      "No Data Access",
    "standard":  "Standard / Unknown",
    "pii":       "PII / Personal Data",
    "financial": "Financial / Payment",
    "auth":      "Authentication / SSO",
    "health":    "Health / Medical",
    "critical":  "Critical Infrastructure",
}

VALID_SENSITIVITIES: set[str] = set(CONTEXT_MULTIPLIERS.keys())


def compute_effective_score(raw_score: float, data_sensitivity: str | None) -> float:
    """Return the business-adjusted risk score, capped at 100."""
    multiplier = CONTEXT_MULTIPLIERS.get(data_sensitivity or "standard", 1.0)
    return round(min(100.0, raw_score * multiplier), 1)
