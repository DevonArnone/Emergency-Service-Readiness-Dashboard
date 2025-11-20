"""Quick test script for Phase 1 Emergency Services data models."""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def test_phase1():
    print("🧪 Testing Phase 1 - Emergency Services Data Models\n")
    
    # Test 1: Create Personnel
    print("1. Creating Personnel...")
    personnel_data = {
        "name": "John Smith",
        "rank": "Captain",
        "role": "Firefighter II",
        "certifications": ["Firefighter II", "EMT-B"],
        "cert_expirations": {
            "Firefighter II": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            "EMT-B": (datetime.utcnow() + timedelta(days=180)).isoformat()
        },
        "availability_status": "AVAILABLE",
        "station_id": "station-1"
    }
    response = requests.post(f"{BASE_URL}/personnel", json=personnel_data)
    if response.status_code == 200:
        personnel = response.json()
        personnel_id = personnel["personnel_id"]
        print(f"   ✅ Created personnel: {personnel['name']} (ID: {personnel_id})")
    else:
        print(f"   ❌ Failed: {response.status_code} - {response.text}")
        return
    
    # Test 2: Create Unit
    print("\n2. Creating Unit...")
    unit_data = {
        "unit_name": "Engine 1",
        "type": "ENGINE",
        "minimum_staff": 4,
        "required_certifications": ["Firefighter II"],
        "station_id": "station-1"
    }
    response = requests.post(f"{BASE_URL}/units", json=unit_data)
    if response.status_code == 200:
        unit = response.json()
        unit_id = unit["unit_id"]
        print(f"   ✅ Created unit: {unit['unit_name']} (ID: {unit_id})")
    else:
        print(f"   ❌ Failed: {response.status_code} - {response.text}")
        return
    
    # Test 3: Create Unit Assignment
    print("\n3. Creating Unit Assignment...")
    shift_start = datetime.utcnow()
    shift_end = shift_start + timedelta(hours=8)
    assignment_data = {
        "unit_id": unit_id,
        "personnel_id": personnel_id,
        "shift_start": shift_start.isoformat(),
        "shift_end": shift_end.isoformat(),
        "assignment_status": "ON_SHIFT"
    }
    response = requests.post(f"{BASE_URL}/unit-assignments", json=assignment_data)
    if response.status_code == 200:
        assignment = response.json()
        print(f"   ✅ Created assignment (ID: {assignment['assignment_id']})")
    else:
        print(f"   ❌ Failed: {response.status_code} - {response.text}")
        return
    
    # Test 4: List Personnel
    print("\n4. Listing Personnel...")
    response = requests.get(f"{BASE_URL}/personnel")
    if response.status_code == 200:
        personnel_list = response.json()
        print(f"   ✅ Found {len(personnel_list)} personnel")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 5: List Units
    print("\n5. Listing Units...")
    response = requests.get(f"{BASE_URL}/units")
    if response.status_code == 200:
        units_list = response.json()
        print(f"   ✅ Found {len(units_list)} units")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 6: List Unit Assignments
    print("\n6. Listing Unit Assignments...")
    response = requests.get(f"{BASE_URL}/unit-assignments")
    if response.status_code == 200:
        assignments_list = response.json()
        print(f"   ✅ Found {len(assignments_list)} assignments")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    print("\n✅ Phase 1 tests complete!")

if __name__ == "__main__":
    try:
        test_phase1()
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure the server is running:")
        print("   cd backend && uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")

