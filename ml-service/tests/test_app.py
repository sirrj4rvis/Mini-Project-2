import pytest
import json
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    rv = client.get('/health')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['status'] == 'ok'
    assert data['service'] == 'ml-price-service'

def test_predict_requires_body(client):
    rv = client.post('/predict')
    assert rv.status_code == 400
    data = json.loads(rv.data)
    assert 'error' in data

def test_predict_insufficient_data(client):
    payload = {
        "product_id": "123",
        "history": [
            {"date": "2023-01-01", "price": 100}
        ]
    }
    rv = client.post('/predict', json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['recommendation'] == 'INSUFFICIENT_DATA'
    assert data['predicted_price'] is None

def test_predict_success(client):
    payload = {
        "product_id": "123",
        "history": [
            {"date": "2023-01-01", "price": 100},
            {"date": "2023-01-02", "price": 95},
            {"date": "2023-01-03", "price": 90},
            {"date": "2023-01-04", "price": 85}
        ]
    }
    rv = client.post('/predict', json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert 'predicted_price' in data
    assert 'trend' in data
    assert data['trend'] == 'falling'

def test_recommend_success(client):
    payload = {
        "current_price": 100,
        "predicted_price": 80,
        "trend": "falling"
    }
    rv = client.post('/recommend', json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    # If price drops by 20%, it should say WAIT (since it will get cheaper)
    assert data['recommendation'] == 'WAIT'
    assert data['savings_potential'] == 20.0
