from fastapi.testclient import TestClient

from backend import main as appmod


def test_list_extensions_endpoint(monkeypatch):
    monkeypatch.setattr(appmod.manager, "list_installed", lambda: [{"name": "ext-a", "installed": True}])
    client = TestClient(appmod.app)
    resp = client.get("/extensions/list")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["name"] == "ext-a"


def test_install_endpoint_updates_scrapers(monkeypatch):
    # stub install and load_all to avoid git operations
    monkeypatch.setattr(appmod.manager, "install", lambda url: "ext-new")
    monkeypatch.setattr(appmod.manager, "load_all", lambda: {"ext-new": None})

    client = TestClient(appmod.app)
    resp = client.post("/extensions/install", json={"git_url": "https://example.com/repo.git"})
    assert resp.status_code == 200
    assert resp.json().get("installed") == "ext-new"
    assert "ext-new" in appmod.scrapers


def test_update_and_remove_endpoints(monkeypatch):
    monkeypatch.setattr(appmod.manager, "update", lambda name: name)
    monkeypatch.setattr(appmod.manager, "remove", lambda name: name)
    monkeypatch.setattr(appmod.manager, "load_all", lambda: {})

    client = TestClient(appmod.app)
    r1 = client.post("/extensions/update", json={"name": "ext-a"})
    assert r1.status_code == 200 and r1.json().get("updated") == "ext-a"

    r2 = client.post("/extensions/remove", json={"name": "ext-a"})
    assert r2.status_code == 200 and r2.json().get("removed") == "ext-a"
