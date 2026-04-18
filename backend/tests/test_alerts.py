import services.alerts as alerts


def test_reserved_example_domain_is_suppressed():
    assert alerts._is_non_deliverable_test_address("testuser_123@example.com") is True
    assert alerts._is_non_deliverable_test_address("qa@demo.test") is True
    assert alerts._is_non_deliverable_test_address("ops@localhost") is True


def test_real_domain_is_not_suppressed():
    assert alerts._is_non_deliverable_test_address("person@company.com") is False


def test_send_email_skips_when_email_disabled(monkeypatch):
    calls = []

    monkeypatch.setattr(alerts, "EMAIL_ENABLED", False)
    monkeypatch.setattr(alerts, "_send_via_resend", lambda *args, **kwargs: calls.append("resend"))
    monkeypatch.setattr(alerts, "_send_via_gmail", lambda *args, **kwargs: calls.append("gmail"))

    alerts._send_email("person@company.com", "Welcome", "<p>hi</p>")

    assert calls == []


def test_send_email_skips_reserved_test_domains(monkeypatch):
    calls = []

    monkeypatch.setattr(alerts, "EMAIL_ENABLED", True)
    monkeypatch.setattr(alerts, "_send_via_resend", lambda *args, **kwargs: calls.append("resend"))
    monkeypatch.setattr(alerts, "_send_via_gmail", lambda *args, **kwargs: calls.append("gmail"))

    alerts._send_email("testuser_999@example.com", "Welcome", "<p>hi</p>")

    assert calls == []


def test_send_alert_email_skips_without_owner_recipient(monkeypatch):
    calls = []

    monkeypatch.setattr(alerts, "_send_email", lambda *args, **kwargs: calls.append("sent"))

    alerts.send_alert_email(
        vendor_name="Real Vendor",
        domain="company.com",
        score=87.0,
        events=[],
        recipient_email=None,
    )

    assert calls == []


def test_send_alert_email_skips_reserved_vendor_domain(monkeypatch):
    calls = []

    monkeypatch.setattr(alerts, "_send_email", lambda *args, **kwargs: calls.append("sent"))

    alerts.send_alert_email(
        vendor_name="Debug Vendor",
        domain="debug-a2a9f867.example",
        score=87.0,
        events=[],
        recipient_email="owner@company.com",
    )

    assert calls == []
