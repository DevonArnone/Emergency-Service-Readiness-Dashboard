"""Test script for Phase 2 - Real-time readiness and certification management."""
import requests
import json
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8000/api"

def test_phase2():
    print("🧪 Testing Phase 2 - Real-time Readiness & Certification Management\n")
    
    # Setup: Create personnel and unit (reuse from Phase 1 or create new)
    print("1. Setting up test data...")
    
    # Create personnel with expiring cert
    personnel_data = {
        "name": "Sarah Johnson",
        "rank": "Lieutenant",
        "role": "Firefighter II",
        "certifications": ["Firefighter II", "EMT-P"],
        "cert_expirations": {
            "Firefighter II": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
            "EMT-P": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()  # Expired!
        },
        "availability_status": "AVAILABLE",
        "station_id": "station-1"
    }
    response = requests.post(f"{BASE_URL}/personnel", json=personnel_data)
    if response.status_code != 200:
        print(f"   ⚠️  Personnel creation failed: {response.text}")
        return
    personnel = response.json()
    personnel_id = personnel["personnel_id"]
    print(f"   ✅ Created personnel: {personnel['name']}")
    
    # Create unit
    unit_data = {
        "unit_name": "Engine 2",
        "type": "ENGINE",
        "minimum_staff": 4,
        "required_certifications": ["Firefighter II"],
        "station_id": "station-1"
    }
    response = requests.post(f"{BASE_URL}/units", json=unit_data)
    if response.status_code != 200:
        print(f"   ⚠️  Unit creation failed: {response.text}")
        return
    unit = response.json()
    unit_id = unit["unit_id"]
    print(f"   ✅ Created unit: {unit['unit_name']}")
    
    # Test 2: Get unit readiness (should show understaffed)
    print("\n2. Testing unit readiness calculation...")
    response = requests.get(f"{BASE_URL}/readiness/units/{unit_id}")
    if response.status_code == 200:
        readiness = response.json()
        print(f"   ✅ Readiness Score: {readiness['readiness_score']}%")
        print(f"   ✅ Staff: {readiness['staff_present']}/{readiness['staff_required']}")
        print(f"   ✅ Understaffed: {readiness['is_understaffed']}")
        if readiness['issues']:
            print(f"   ✅ Issues: {', '.join(readiness['issues'])}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 3: Check expired certifications
    print("\n3. Testing expired certification detection...")
    response = requests.get(f"{BASE_URL}/certifications/expired")
    if response.status_code == 200:
        expired = response.json()
        print(f"   ✅ Found {len(expired)} expired certifications")
        for cert in expired:
            print(f"      - {cert['name']}: {cert['certification']} (expired {cert['days_expired']} days ago)")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 4: Check expiring certifications
    print("\n4. Testing expiring certification detection...")
    response = requests.get(f"{BASE_URL}/certifications/expiring?days_ahead=30")
    if response.status_code == 200:
        expiring = response.json()
        print(f"   ✅ Found {len(expiring)} certifications expiring within 30 days")
        for cert in expiring:
            status = "EXPIRED" if cert['is_expired'] else f"expires in {cert['days_until_expiry']} days"
            print(f"      - {cert['name']}: {cert['certification']} ({status})")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 5: Mark expired certifications
    print("\n5. Testing certification expiration check...")
    response = requests.post(f"{BASE_URL}/certifications/check-expirations")
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Marked {result['marked_unqualified']} personnel as unqualified")
        print(f"   ✅ Affected {len(result['affected_units'])} units")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 6: Get all units readiness
    print("\n6. Testing all units readiness...")
    response = requests.get(f"{BASE_URL}/readiness/units")
    if response.status_code == 200:
        all_readiness = response.json()
        print(f"   ✅ Retrieved readiness for {len(all_readiness)} units")
        for unit_readiness in all_readiness:
            print(f"      - {unit_readiness['unit_name']}: {unit_readiness['readiness_score']}%")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    print("\n✅ Phase 2 tests complete!")
    print("\n💡 WebSocket endpoint available at: ws://localhost:8000/ws/unit-readiness/{unit_id}")

if __name__ == "__main__":
    try:
        test_phase2()
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure the server is running:")
        print("   cd backend && uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

