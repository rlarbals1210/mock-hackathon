from fastapi.testclient import TestClient

import app.main as main_module


def test_lifespan_warms_matching_services_before_requests(monkeypatch):
    calls = []

    def fake_warmup():
        calls.append("warm")
        return {"dataSource": "test", "modelAReady": True, "modelBReady": True, "warnings": []}

    monkeypatch.setattr(main_module, "warmup_matching_services", fake_warmup)
    with TestClient(main_module.app) as client:
        assert calls == ["warm"]
        assert main_module.app.state.matching_warmup["dataSource"] == "test"
        assert client.get("/api/health").status_code == 200
